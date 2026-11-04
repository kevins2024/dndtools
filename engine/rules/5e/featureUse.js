// Using a feature: the rule behind a "Use" button. A feature's feature-mechanics entry says what using it
// does (`on_use`: a list of effects) and whether it starts a temporary state (`active`); this resolves
// them against the character, spends the use, and returns what happened as data:
//
//   useFeature(character, 'pub24_species_aasimar-healing-hands', { rng })
//     -> { ok: true, feature: 'Healing Hands', patch: { features }, effects: [
//            { kind: 'heal', target: 'a creature you touch', dice: '3d4', rolls: [2, 4, 1], total: 7 } ] }
//
// Effect kinds: heal, temp_hp, action, damage, area_save, reduce_damage, teleport, condition,
// speed_reduction (see feature-mechanics.json's `on_use` doc). Every number is rolled or computed here,
// with a { value, breakdown } where it is a DC or an amount, so the screen only shows it.
//
// A temporary state (Celestial Revelation, Draconic Flight, Large Form, Stonecunning) is recorded in
// `active_effects`; featureGrants.activeGrants reads what it gives, endActiveEffect ends it, and a rest
// ends them all (rest.js).
//
// Pure: does not mutate the character; a caller merges the patch. No fs/path, so browser code may use it.

const { effectiveGrants } = require('./featureGrants')
const { pickFeatureId, lineageRow } = require('./speciesLineage')
const { resolveAmount, totalLevel } = require('./amounts')
const { usesRemaining, spendUse } = require('./limitedUse')
const { applyTempHp } = require('./hitPoints')

const findFeature = (character, ref) =>
  (character.features ?? []).find(
    (f) => f.id === ref || pickFeatureId(f) === ref || f.name === ref
  )

const rollDice = (count, sides, rng = Math.random) =>
  Array.from({ length: count }, () => 1 + Math.floor(rng() * sides))
const sum = (xs) => xs.reduce((n, x) => n + x, 0)

// What a feature's Use does, or null if the engine has nothing to resolve (a plain feature with a
// counter). { kind: 'active' | 'effects', minLevel, options: [{ id, name }] | null }.
function featureAction(character, feature) {
  const g = effectiveGrants(feature)
  if (g.option_of || (!g.on_use && !g.active)) return null
  const options = g.active?.choose_one_of
    ? g.active.choose_one_of.map((id) => {
        const o = findFeature(character, id)
        return { id, name: o?.name ?? id }
      })
    : null
  return {
    kind: g.active ? 'active' : 'effects',
    minLevel: g.min_level ?? null,
    options,
    requires: g.active?.requires ?? null,
  }
}

function amountOf(formula, character, equippedItems) {
  return resolveAmount(formula, character, equippedItems)
}

// One effect of `on_use`, resolved into the descriptor the screen shows.
function resolveEffect(e, ctx) {
  const { character, rng, equippedItems } = ctx
  const dice = (spec) => {
    const count = amountOf(spec.count, character, equippedItems).value
    const rolls = rollDice(count, spec.sides, rng)
    return { dice: `${count}d${spec.sides}`, rolls, total: sum(rolls) }
  }
  // 'lineage': the damage type of the character's Draconic Ancestry, from the ancestry feature
  const lineageDamage = () =>
    (character.features ?? [])
      .map((f) => effectiveGrants(f).lineage_damage)
      .find(Boolean) ??
    String(lineageRow(character)?.resistance ?? '').toLowerCase() ??
    null
  const damageType = (type) =>
    type === 'lineage' ? lineageDamage() || null : type

  switch (e.kind) {
    case 'heal':
      return { kind: 'heal', target: e.target ?? null, ...dice(e.dice) }
    case 'temp_hp': {
      const amount = amountOf(e.amount, character, equippedItems)
      ctx.tempHp = Math.max(ctx.tempHp ?? 0, amount.value)
      return {
        kind: 'temp_hp',
        amount: amount.value,
        breakdown: amount.breakdown,
      }
    }
    case 'action':
      return { kind: 'action', action: e.action }
    case 'damage':
      return {
        kind: 'damage',
        trigger: e.trigger ?? null,
        target: e.target ?? null,
        type: damageType(e.type),
        ...dice(e.dice),
      }
    case 'area_save': {
      const dc = e.dc ? amountOf(e.dc, character, equippedItems) : null
      return {
        kind: 'area_save',
        ability: e.ability,
        dc: dc && { value: dc.value, breakdown: dc.breakdown },
        replaces: e.replaces ?? null,
        shapes: e.shapes ?? null,
        radiusFeet: e.radius_feet ?? null,
        targets: e.targets ?? null,
        damage: e.damage
          ? { type: damageType(e.damage.type), ...dice(e.damage.dice) }
          : null,
        onSuccess: e.on_success ?? null,
        onFailure: e.on_failure ?? null,
      }
    }
    case 'reduce_damage': {
      const { dice: d, rolls, total } = dice(e.dice)
      const bonus = e.plus_ability
        ? amountOf(
            { type: 'ability_mod', ability: e.plus_ability },
            character,
            equippedItems
          )
        : { value: 0, breakdown: [] }
      return {
        kind: 'reduce_damage',
        trigger: e.trigger ?? null,
        dice: d,
        rolls,
        bonus: bonus.value,
        total: total + bonus.value,
        breakdown: [{ label: d, amount: total }, ...bonus.breakdown],
      }
    }
    case 'teleport':
      return { kind: 'teleport', feet: e.feet, to: e.to ?? null }
    case 'condition':
      return {
        kind: 'condition',
        condition: e.condition,
        trigger: e.trigger ?? null,
        maxTargetSize: e.max_target_size ?? null,
      }
    case 'speed_reduction':
      return { kind: 'speed_reduction', feet: e.feet, until: e.until ?? null }
    default:
      throw new Error(`Unknown on_use effect kind "${e.kind}"`)
  }
}

// opts: { option (a feature id, for a feature that asks which form), rng, equippedItems }.
// { ok: false, error } when it cannot be used; { ok: true, feature, patch, effects, requires } otherwise.
function useFeature(character, ref, opts = {}) {
  const { option = null, rng = Math.random, equippedItems = [] } = opts
  const feature = findFeature(character, ref)
  if (!feature) return { ok: false, error: `The character has no "${ref}".` }
  const g = effectiveGrants(feature)
  const action = featureAction(character, feature)
  if (!action)
    return {
      ok: false,
      error: `${feature.name} has no effect the engine resolves.`,
    }
  if (g.min_level && totalLevel(character) < g.min_level)
    return {
      ok: false,
      error: `${feature.name} needs character level ${g.min_level}.`,
    }
  if (feature.uses_max != null && !(usesRemaining(feature) > 0))
    return { ok: false, error: `${feature.name} has no uses left.` }
  const id = feature.id ?? pickFeatureId(feature)
  if (
    action.kind === 'active' &&
    (character.active_effects ?? []).some((e) => e.id === id)
  )
    return { ok: false, error: `${feature.name} is already active.` }

  let optionFeature = null
  if (action.options) {
    optionFeature = action.options.find((o) => o.id === option)
    if (!optionFeature)
      return {
        ok: false,
        error: `${feature.name}: choose one of ${action.options
          .map((o) => o.name)
          .join(', ')}.`,
      }
  }

  const ctx = { character, rng, equippedItems, tempHp: 0 }
  const effects = [
    ...(g.on_use ?? []),
    ...(optionFeature
      ? effectiveGrants(findFeature(character, optionFeature.id)).on_use ?? []
      : []),
  ].map((e) => resolveEffect(e, ctx))

  const patch = {
    features: character.features.map((f) => (f === feature ? spendUse(f) : f)),
  }
  if (action.kind === 'active')
    patch.active_effects = [
      ...(character.active_effects ?? []),
      {
        id,
        name: optionFeature
          ? `${feature.name}: ${optionFeature.name}`
          : feature.name,
        ...(optionFeature ? { option: optionFeature.id } : {}),
      },
    ]
  if (ctx.tempHp > 0)
    Object.assign(patch, applyTempHp(character, ctx.tempHp).patch)
  return {
    ok: true,
    feature: feature.name,
    patch,
    effects,
    requires: action.requires,
    durationMinutes: g.active?.duration_minutes ?? null,
  }
}

// End a temporary state early (or when its time runs out). Returns a patch.
function endActiveEffect(character, id) {
  return {
    patch: {
      active_effects: (character.active_effects ?? []).filter(
        (e) => e.id !== id
      ),
    },
  }
}

module.exports = { useFeature, featureAction, endActiveEffect, findFeature }
