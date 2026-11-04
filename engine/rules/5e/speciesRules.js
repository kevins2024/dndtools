// Species and trait rules that are a number or a yes/no the engine answers, read from a feature's
// feature-mechanics entry (see featureGrants.js for the fields), so the rule lives in data and one
// function, never only in a trait's text.
//
//   effectiveSize(character, 'grappling')            'Medium' -> 'Large' for a Catrin (Broad Build)
//   braceOutcome(character, damage, attackerSize)    Catrin's Brace: half damage, push 5 ft
//   canMoveThroughSpace(character, creatureSize)     Drevani's Low Profile, Halfling Nimbleness
//   canHideBehind(character, creatureSize)           Halfling Naturally Stealthy
//   applyDamageWithSurvival(character, damage)       Orc Relentless Endurance: drop to 1 HP, not 0
//   objectLimit / createObject / dismantleObject     Rock Gnome's clockwork devices
//
// No fs/path (plain data), so browser code may use it.

const { effectiveGrants, activeGrants } = require('./featureGrants')
const { effectiveMaxHp, applyDamage } = require('./hitPoints')
const { usesRemaining, spendUse } = require('./limitedUse')
const SPECIES = require('../../data/5e2024/species.json')

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
const sizeIndex = (s) => SIZES.indexOf(String(s ?? '').split(/[ (]/)[0])

// The size a character normally is: the species' own (the first size the 2024 text names), Medium if
// none is known. Homebrew sheets that carry `size` themselves win.
function baseSize(character) {
  if (character.size && sizeIndex(character.size) >= 0)
    return SIZES[sizeIndex(character.size)]
  const genus = String(character.genus ?? '').toLowerCase()
  const text = SPECIES.find(
    (s) =>
      genus === s.name.toLowerCase() ||
      genus.endsWith(` ${s.name.toLowerCase()}`)
  )?.size
  return sizeIndex(text) >= 0 ? SIZES[sizeIndex(text)] : 'Medium'
}

// The size to use for `purpose` ('carrying_capacity', 'grappling'): one larger when a feature says the
// character counts as larger for it (Powerful Build, Broad Build).
function effectiveSize(character, purpose) {
  // the size right now: a temporary state can change it (Goliath Large Form)
  if (purpose === 'current')
    return activeGrants(character).size ?? baseSize(character)
  const larger = (character.features ?? []).some((f) =>
    (effectiveGrants(f).size_counts_as_larger ?? []).includes(purpose)
  )
  const i = sizeIndex(baseSize(character))
  return SIZES[Math.min(i + (larger ? 1 : 0), SIZES.length - 1)]
}

// A reaction with a computable effect (Catrin's Brace). Returns what happens when the character uses it
// against a melee hit for `damage` from a creature of `attackerSize`, or null if the character has no
// such feature or it is spent.
function braceOutcome(character, damage, attackerSize) {
  const f = (character.features ?? []).find(
    (x) => effectiveGrants(x).reaction_effect?.trigger === 'hit_by_melee_attack'
  )
  if (!f) return null
  const effect = effectiveGrants(f).reaction_effect
  const left = f.uses_current ?? f.uses_max ?? effectiveGrants(f).uses_max
  if (left != null && left <= 0) return null
  const taken = Math.floor(damage * (1 - effect.damage_fraction))
  const pushed =
    effect.push && sizeIndex(attackerSize) <= sizeIndex(effect.push.max_size)
  return {
    feature: f.name,
    damageTaken: taken,
    damagePrevented: damage - taken,
    pushFeet: pushed ? effect.push.feet : 0,
  }
}

// Whether the character can move through the space of a creature of `creatureSize` without
// squeezing, from a feature's `moves_through_creature_space: { min_size }`: they may pass through
// creatures of that size or larger.
function canMoveThroughSpace(character, creatureSize) {
  return (character.features ?? []).some((f) => {
    const rule = effectiveGrants(f).moves_through_creature_space
    if (!rule) return false
    const smallest =
      rule.size_delta != null
        ? sizeIndex(baseSize(character)) + rule.size_delta
        : sizeIndex(rule.min_size)
    return sizeIndex(creatureSize) >= smallest
  })
}

// Whether the character can take the Hide action when the only thing obscuring them is a creature of
// `creatureSize` (Halfling Naturally Stealthy: a creature at least one size larger).
function canHideBehind(character, creatureSize) {
  return (character.features ?? []).some((f) => {
    const rule = effectiveGrants(f).hide_obscured_by
    return (
      rule &&
      sizeIndex(creatureSize) >=
        sizeIndex(baseSize(character)) + rule.size_delta
    )
  })
}

// Damage to a character, with the features that let it survive (Orc Relentless Endurance: "When you are
// reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead"). Killed outright
// is 2024's rule: the damage left after reaching 0 equals or exceeds the Hit Point maximum. Returns
// { patch, absorbed, dealt, survivedWith: 'Relentless Endurance' | null, killedOutright }; the feature's
// use is spent in the patch. Without such a feature this is hitPoints.applyDamage.
function applyDamageWithSurvival(character, amount) {
  const result = applyDamage(character, amount)
  const before = character.hp_current ?? 0
  const after = result.patch.hp_current
  const remaining = result.dealt != null ? amount - result.absorbed : 0
  const overkill = Math.max(0, remaining - before)
  const killedOutright = after === 0 && overkill >= effectiveMaxHp(character)
  const base = { ...result, survivedWith: null, killedOutright }
  if (after !== 0 || before <= 0 || killedOutright) return base
  const feature = (character.features ?? []).find((f) => {
    const g = effectiveGrants(f)
    return g.survives_at_hp != null && usesRemaining(f) !== 0
  })
  if (!feature) return base
  return {
    ...base,
    patch: {
      ...result.patch,
      hp_current: effectiveGrants(feature).survives_at_hp,
      features: character.features.map((f) =>
        f === feature ? spendUse(f) : f
      ),
    },
    survivedWith: feature.name,
  }
}

// Objects the character can have in existence (Rock Gnome's Tiny clockwork devices).
const objectRules = (character) =>
  (character.features ?? [])
    .map((f) => ({ f, rule: effectiveGrants(f).creates_objects }))
    .filter((x) => x.rule)

function objectLimit(character, kind) {
  const found = objectRules(character).find((x) => x.rule.kind === kind)
  return found ? found.rule : null
}

// Creates one, naming the effect it was given. { ok, error } or { ok: true, patch, object }.
function createObject(character, kind, effect) {
  const rule = objectLimit(character, kind)
  if (!rule) return { ok: false, error: `The character cannot make a ${kind}.` }
  const have = (character.created_objects ?? []).filter((o) => o.kind === kind)
  if (have.length >= rule.max)
    return {
      ok: false,
      error: `Already has ${rule.max} ${kind}s; dismantle one first.`,
    }
  const object = {
    kind,
    effect,
    ac: rule.ac,
    hp: rule.hp,
    lasts_hours: rule.lasts_hours,
  }
  return {
    ok: true,
    object,
    patch: { created_objects: [...(character.created_objects ?? []), object] },
  }
}

function dismantleObject(character, index) {
  return {
    patch: {
      created_objects: (character.created_objects ?? []).filter(
        (_, i) => i !== index
      ),
    },
  }
}

module.exports = {
  effectiveSize,
  baseSize,
  braceOutcome,
  canMoveThroughSpace,
  canHideBehind,
  applyDamageWithSurvival,
  objectLimit,
  createObject,
  dismantleObject,
  SIZES,
}
