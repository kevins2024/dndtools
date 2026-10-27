// The choices a 2024 class asks the player to make as it levels — Weapon Mastery,
// Fighting Style (a feat now), Divine/Primal Order, Expertise, Metamagic, Primal
// Knowledge. diffLevelUp.js calls resolveChoices2024 for a 2024 character and
// merges the result into its own newFeatures / pendingChoices / proficiency
// accumulators; under the 2014 rules this module returns nothing.
//
// Two shapes of rule live here:
//   - COUNT-BASED (Weapon Mastery, Fighting Style): the class table says how many
//     you should have at this level, so the shortfall is computed from what the
//     character already owns. Making a pick later, or after a Long Rest swap, just
//     works; so does migrating a character that already has some picks.
//   - GRANT-BASED (Expertise, Metamagic, Orders, Primal Knowledge): a feature hands
//     you picks at specific levels; only grants crossed by (fromLevel, toLevel] are
//     asked for, and a grant already recorded at that level is skipped.
//
// Pure data in, plain objects out; no fs (the data comes through the same loaders
// everything else uses).

const { loadClass } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')
const { loadRulesetJson } = require('./ruleset')
const { rulesetOf } = require('./rulesetId')
const { listFeats } = require('./grants')
const { listMetamagicOptions } = require('./metamagic')

const key = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const countAt = (table, level) => {
  let v = 0
  let best = -Infinity
  for (const [k, val] of Object.entries(table || {})) {
    if (Number(k) <= level && Number(k) > best && typeof val === 'number') {
      best = Number(k)
      v = val
    }
  }
  return v
}

// ── Weapon Mastery ────────────────────────────────────────────────────

function weaponTable() {
  const t = loadRulesetJson('2024', 'weapons.json') ?? {}
  return Object.fromEntries(
    Object.entries(t).filter(([k]) => !k.startsWith('_'))
  )
}

// Which weapons a class may master. Barbarian: Simple or Martial MELEE; Rogue:
// the weapons it is proficient with (Simple, plus Martial that are Finesse or
// Light); Fighter, Paladin, Ranger: Simple or Martial.
function masteryPool(className) {
  const cls = String(className).toLowerCase()
  return Object.entries(weaponTable())
    .filter(([, w]) => {
      if (cls === 'barbarian') return w.weapon_type === 'melee'
      if (cls === 'rogue')
        return w.category === 'simple' || w.finesse || w.light
      return true
    })
    .map(([name]) => name)
}

function weaponMastery({ character, className, toLevel, choices, out }) {
  const cls = loadClass(className, '2024')
  // Barbarian and Fighter have a Weapon Mastery column that grows; Paladin,
  // Ranger and Rogue just master two kinds from the level they get the feature.
  const hasFeature = Object.entries(cls?.features_by_level ?? {}).some(
    ([lvl, names]) => Number(lvl) <= toLevel && names.includes('Weapon Mastery')
  )
  const target = cls?.weapon_mastery_by_level
    ? countAt(cls.weapon_mastery_by_level, toLevel)
    : hasFeature
    ? 2
    : 0
  if (!target) return
  const mine = (character.features || []).filter(
    (f) => f.type === 'weaponMastery' && f._source === className
  )
  const need = target - mine.length
  if (need <= 0) return
  const table = weaponTable()
  const pool = masteryPool(className)
  const owned = new Set(mine.map((f) => f.weapon))
  let still = need
  for (const raw of choices.weaponMastery ?? []) {
    if (still <= 0) break
    const name = String(raw).toLowerCase()
    if (!pool.includes(name)) {
      out.notes.push(
        `${raw} isn't a weapon ${className} can master — not applied.`
      )
      continue
    }
    if (owned.has(name)) {
      out.notes.push(
        `${titleCase(name)} is already one of ${className}'s mastered weapons — pick a different kind.`
      )
      continue
    }
    owned.add(name)
    out.features.push({
      name: `Weapon Mastery: ${titleCase(name)}`,
      type: 'weaponMastery',
      weapon: name,
      mastery: table[name].mastery,
      _source: className,
      level_gained: toLevel,
    })
    still--
  }
  if (still > 0) {
    out.pendingChoices.push({
      type: 'weaponMasteryChoice',
      count: still,
      level: toLevel,
      options: pool.filter((w) => !owned.has(w)),
    })
  }
}

// ── Fighting Style (feat) ─────────────────────────────────────────────

function fightingStyleFeats() {
  return listFeats('2024').filter(
    (f) => f.ruleset === '2024' && f.category === 'fighting_style'
  )
}

function fightingStyle({
  character,
  className,
  subclassName,
  toLevel,
  choices,
  out,
}) {
  const cls = loadClass(className, '2024')
  const sub = subclassName
    ? loadSubclass(className, subclassName, '2024')
    : null
  const grantsFrom = (data) =>
    Object.entries(data?.features_by_level ?? {})
      .filter(([lvl]) => Number(lvl) <= toLevel)
      .flatMap(([, names]) => names)
      .filter((n) => /Fighting Style$/.test(n)).length
  const expected = grantsFrom(cls) + grantsFrom(sub)
  if (!expected) return
  const mine = (character.features || []).filter(
    (f) =>
      f.type === 'feat' &&
      f._source === className &&
      f._grant === 'fightingStyle'
  )
  let need = expected - mine.length
  if (need <= 0) return
  const styles = fightingStyleFeats()
  const taken = new Set((character.features || []).map((f) => f.name))
  const picks = [].concat(choices.fightingStyle ?? [])
  for (const raw of picks) {
    if (need <= 0) break
    const feat = styles.find((s) => key(s.name) === key(raw))
    if (!feat) {
      out.notes.push(`${raw} isn't a Fighting Style feat — not applied.`)
      continue
    }
    if (taken.has(feat.name)) {
      out.notes.push(
        `${feat.name} is already known — pick a different Fighting Style.`
      )
      continue
    }
    taken.add(feat.name)
    out.features.push({
      name: feat.name,
      id: feat.id,
      type: 'feat',
      _grant: 'fightingStyle',
      _source: className,
      level_gained: toLevel,
    })
    need--
  }
  if (need > 0) {
    out.pendingChoices.push({
      type: 'fightingStyleChoice',
      count: need,
      level: toLevel,
      options: styles.map((s) => s.name).filter((n) => !taken.has(n)),
    })
  }
}

// ── Divine Order / Primal Order ───────────────────────────────────────

const ORDERS = {
  'Divine Order': {
    field: 'divineOrder',
    pending: 'divineOrderChoice',
    options: {
      Protector: { weapons: ['martial'], armor: ['heavy'], cantrips: 0 },
      Thaumaturge: { weapons: [], armor: [], cantrips: 1 },
    },
  },
  'Primal Order': {
    field: 'primalOrder',
    pending: 'primalOrderChoice',
    options: {
      Warden: { weapons: ['martial'], armor: ['medium'], cantrips: 0 },
      Magician: { weapons: [], armor: [], cantrips: 1 },
    },
  },
}

function orders({ character, crossed, toLevel, choices, out }) {
  for (const [featureName, def] of Object.entries(ORDERS)) {
    if (!crossed.some((c) => c.name === featureName)) continue
    if (
      (character.features || []).some(
        (f) =>
          f.type === def.field.replace(/([A-Z])/g, '$1') &&
          f.level_gained === toLevel
      )
    )
      continue
    const picked = choices[def.field]
    if (!picked) {
      out.pendingChoices.push({
        type: def.pending,
        level: crossed.find((c) => c.name === featureName).level,
        options: Object.keys(def.options),
      })
      continue
    }
    const opt = def.options[picked]
    if (!opt) {
      throw new Error(
        `${picked} isn't a valid ${featureName} — expected ${Object.keys(def.options).join(' or ')}.`
      )
    }
    out.features.push({
      name: `${featureName}: ${picked}`,
      type: def.field,
      level_gained: crossed.find((c) => c.name === featureName).level,
    })
    out.extraWeaponProficiencies.push(...opt.weapons)
    out.extraArmorProficiencies.push(...opt.armor)
    out.extraCantrips += opt.cantrips
  }
}

// ── Expertise (Rogue, Bard, Ranger's Deft Explorer, Wizard's Scholar) ─────

const EXPERTISE = {
  Expertise: { count: 2 },
  'Deft Explorer': { count: 1 },
  Scholar: {
    count: 1,
    only: [
      'arcana',
      'history',
      'investigation',
      'medicine',
      'nature',
      'religion',
    ],
  },
}

function expertise({ character, className, crossed, choices, out }) {
  for (const c of crossed) {
    const def = EXPERTISE[c.name]
    if (!def) continue
    const already = (character.features || []).some(
      (f) =>
        f.type === 'expertise' &&
        f.level_gained === c.level &&
        f._source === className
    )
    if (already) continue
    const doubled = new Set(
      [...(character.skill_expertise || []), ...out.expertiseSkills].map(key)
    )
    let options = (character.skill_proficiencies || []).filter(
      (s) => !doubled.has(key(s)) && (!def.only || def.only.includes(key(s)))
    )
    const picked = []
    for (const raw of choices.expertise?.[c.level] ?? []) {
      if (picked.length >= def.count) break
      const match = options.find((o) => key(o) === key(raw))
      if (!match) {
        out.notes.push(
          `${raw} can't take Expertise (not a proficient skill, or already doubled) — not applied.`
        )
        continue
      }
      picked.push(match)
      options = options.filter((o) => o !== match)
    }
    if (picked.length) {
      out.expertiseSkills.push(...picked)
      out.features.push({
        name: `Expertise: ${picked.join(', ')}`,
        type: 'expertise',
        _source: className,
        level_gained: c.level,
      })
    }
    if (picked.length < def.count) {
      out.pendingChoices.push({
        type: 'expertiseChoice',
        count: def.count - picked.length,
        level: c.level,
        options,
      })
    }
  }
}

// ── Metamagic (Sorcerer) ──────────────────────────────────────────────

function metamagic({ character, className, crossed, choices, out }) {
  if (className !== 'Sorcerer') return
  const all = listMetamagicOptions('Sorcerer', '2024').map((o) => o.name)
  const known = new Set(
    (character.features || [])
      .filter((f) => f.type === 'metamagic')
      .map((f) => f.name.replace(/^Metamagic: /, ''))
  )
  let queue = [].concat(choices.metamagic ?? [])
  for (const c of crossed) {
    if (c.name !== 'Metamagic') continue
    let need = 2
    while (need > 0 && queue.length) {
      const raw = queue.shift()
      const name = all.find((n) => key(n) === key(raw))
      if (!name || known.has(name)) {
        out.notes.push(
          `${raw} isn't an available Metamagic option (unknown or already known) — not applied.`
        )
        continue
      }
      known.add(name)
      out.features.push({
        name: `Metamagic: ${name}`,
        type: 'metamagic',
        _source: 'Sorcerer',
        level_gained: c.level,
      })
      need--
    }
    if (need > 0) {
      out.pendingChoices.push({
        type: 'metamagicChoice',
        count: need,
        level: c.level,
        options: all.filter((n) => !known.has(n)),
      })
    }
  }
}

// ── Primal Knowledge (Barbarian 3rd) ──────────────────────────────────

function primalKnowledge({ character, className, crossed, choices, out }) {
  const c = crossed.find((x) => x.name === 'Primal Knowledge')
  if (!c) return
  const have = new Set((character.skill_proficiencies || []).map(key))
  const options = (
    loadClass(className, '2024')?.skill_choices?.options ?? []
  ).filter((s) => !have.has(key(s)))
  const picked = choices.primalKnowledgeSkill
  if (picked && options.some((o) => key(o) === key(picked))) {
    out.extraSkillProficiencies.push(
      options.find((o) => key(o) === key(picked))
    )
  } else {
    if (picked)
      out.notes.push(
        `${picked} isn't an available Barbarian skill — pick again.`
      )
    out.pendingChoices.push({
      type: 'skillChoice',
      count: 1,
      level: c.level,
      options,
      source: 'Primal Knowledge',
    })
  }
}

// ── entry point ───────────────────────────────────────────────────────

function resolveChoices2024({
  character,
  className,
  subclassName = null,
  fromLevel,
  toLevel,
  choices = {},
}) {
  const out = {
    features: [],
    pendingChoices: [],
    notes: [],
    extraWeaponProficiencies: [],
    extraArmorProficiencies: [],
    extraSkillProficiencies: [],
    extraCantrips: 0,
    expertiseSkills: [],
  }
  if (rulesetOf(character) !== '2024') return out
  const cls = loadClass(className, '2024')
  if (!cls) return out

  // Feature names granted at each level crossed by this call, class then subclass.
  const crossed = []
  const sub = subclassName
    ? loadSubclass(className, subclassName, '2024')
    : null
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    for (const name of cls.features_by_level[String(lvl)] ?? [])
      crossed.push({ name, level: lvl })
    for (const name of sub?.features_by_level?.[String(lvl)] ?? [])
      crossed.push({ name, level: lvl, subclass: true })
  }

  const ctx = {
    character,
    className,
    subclassName,
    fromLevel,
    toLevel,
    crossed,
    choices,
    out,
  }
  weaponMastery(ctx)
  fightingStyle(ctx)
  orders(ctx)
  expertise(ctx)
  metamagic(ctx)
  primalKnowledge(ctx)
  return out
}

module.exports = { resolveChoices2024, masteryPool }
