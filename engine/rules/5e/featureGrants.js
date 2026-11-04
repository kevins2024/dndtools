// What a character's features DO to the sheet, read from data, not from prose.
//
// A feature (class, subclass, species, feat, homebrew species trait) says what it does in its
// `feature-mechanics.json` entry (keyed by the feature's id), in `grants_*` fields:
//
//   grants_resistance:               ['fire']                      damage types
//   grants_saving_throw_advantage:   ['being_charmed']             what the advantage is against
//   grants_skill_advantage:          ['Stealth'] | [{ skill: 'Perception', when: 'relies on smell' }]
//                                                                  a plain name is unconditional, an object
//                                                                  is advantage only in the stated case
//   grants_check_advantage:          [{ when: 'to end the Grappled condition' }]
//   grants_darkvision:               60                            feet
//   grants_skill_proficiency:        ['History']
//   grants_skill_proficiency_choice: { count: 1, options: ['Acrobatics', ...] | 'any' }
//   grants_weapon_proficiency:       ['rapier'] | [{ filter: { category, kind, lacks: [property] } }]
//   grants_armor_proficiency / grants_tool_proficiency: [..]
//   grants_tool_proficiency_choice:  { count, options: ['Gaming Set', ...] | 'artisan' }
//   grants_tool_replace_from:        "Artisan's Tools"            a fixed tool already held is replaced by a pick
//   grants_saving_throw_proficiency: ['wis']; grants_saving_throw_replace_options: ['int', 'cha']
//
// A species lineage table (species-choices.json) adds the lineage's own resistance and darkvision.
// A feature record on the sheet may also carry the same fields itself (they win over the catalog).
//
// `characterGrants` is what the sheet shows: derived from the character's features every time, never
// stored, so a character gets a feature's effect the moment it has the feature, whichever path put it
// there. `proficiencyGrants` is what taking a feature adds to the stored proficiency lists (the level-up
// and the creation apply those once, because a proficiency is state the player can also gain elsewhere).
//
// No fs/path (plain data), so browser code may use it.

const MECHANICS = require('../../data/5e/feature-mechanics.json')
const WEAPONS = require('../../data/5e2024/weapons.json')
const { lineageRow, pickFeatureId } = require('./speciesLineage')
const { resolveAmount } = require('./amounts')

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim()

// A feature's effective grants: its catalog entry, overridden by anything on the record itself.
function effectiveGrants(feature) {
  const id = feature?.id ?? pickFeatureId(feature)
  const entry = id && id !== '_schema' ? MECHANICS[id] : null
  const own = Object.fromEntries(
    Object.entries(feature ?? {}).filter(([k]) => k.startsWith('grants_'))
  )
  return { ...(entry ?? {}), ...own }
}

// value -> [names of the features that give it], kept in first-seen order.
function collector() {
  const map = new Map()
  const add = (value, source) => {
    const key = typeof value === 'string' ? norm(value) : JSON.stringify(value)
    if (!map.has(key)) map.set(key, { value, sources: [] })
    if (source && !map.get(key).sources.includes(source))
      map.get(key).sources.push(source)
  }
  return { add, entries: () => [...map.values()] }
}

// Everything the sheet shows that features and the species lineage grant.
// { resistances: ['fire'], savingThrowAdvantages: [...], skillAdvantages: [{ skill, when }],
//   checkAdvantages: [{ when }], darkvision: 60,
//   sources: { resistances: { fire: ['Infernal'] }, ... } }
function characterGrants(character) {
  const res = collector()
  const sav = collector()
  const skl = collector()
  const chk = collector()
  const senses = {}
  const imm = collector()
  const reroll = new Set()
  let darkvision = Number(character.darkvision) || 0
  const darkSources = darkvision ? ['Sheet'] : []
  let needsSleep = true
  let longRestHours = 8

  // fields a sheet carries itself (older sheets, hand-entered)
  for (const r of character.resistances ?? []) res.add(r, 'Sheet')
  for (const a of character.saving_throw_advantages ?? []) sav.add(a, 'Sheet')

  for (const f of character.features ?? []) {
    const g = effectiveGrants(f)
    for (const r of g.grants_resistance ?? []) res.add(r, f.name)
    for (const a of g.grants_saving_throw_advantage ?? []) sav.add(a, f.name)
    for (const s of g.grants_skill_advantage ?? [])
      skl.add(typeof s === 'string' ? { skill: s, when: null } : s, f.name)
    for (const c of g.grants_check_advantage ?? []) chk.add(c, f.name)
    for (const c of g.grants_condition_immunity ?? []) imm.add(c, f.name)
    for (const n of g.d20_reroll_on ?? []) reroll.add(n)
    if (g.needs_sleep === false) needsSleep = false
    if (g.long_rest_hours)
      longRestHours = Math.min(longRestHours, g.long_rest_hours)
    if (g.grants_darkvision) {
      if (g.grants_darkvision > darkvision) darkSources.length = 0
      if (g.grants_darkvision >= darkvision) darkSources.push(f.name)
      darkvision = Math.max(darkvision, g.grants_darkvision)
    }
  }

  // What a temporary state the character is in right now gives (Large Form, Draconic Flight...).
  const active = activeGrants(character)
  for (const c of active.checkAdvantages) chk.add(c.grant, c.source)
  if (active.tremorsense > 0) senses.tremorsense = active.tremorsense

  const row = lineageRow(character)
  // "Resistance to the damage type associated with your Draconic Ancestry"
  if (row?.resistance)
    for (const f of character.features ?? [])
      if (effectiveGrants(f).grants_resistance_from_lineage)
        res.add(row.resistance.toLowerCase(), f.name)
  if (row?.resistance) res.add(row.resistance.toLowerCase(), 'Lineage')
  if (row?.darkvision && row.darkvision > darkvision) {
    darkvision = row.darkvision
    darkSources.length = 0
    darkSources.push('Lineage')
  }

  const values = (c) => c.entries().map((e) => e.value)
  const flySpeed = active.flySpeed
  const bySource = (c) =>
    Object.fromEntries(
      c
        .entries()
        .map((e) => [
          typeof e.value === 'string' ? e.value : JSON.stringify(e.value),
          e.sources,
        ])
    )
  return {
    resistances: values(res),
    savingThrowAdvantages: values(sav),
    skillAdvantages: values(skl),
    checkAdvantages: values(chk),
    conditionImmunities: values(imm),
    d20RerollOn: [...reroll].sort((a, b) => a - b),
    needsSleep,
    longRestHours,
    senses,
    flySpeedEqualsSpeed: flySpeed === 'speed',
    speedBonus: active.speedBonus,
    speedLines: active.speedLines,
    size: active.size,
    light: active.light,
    activeEffects: active.effects,
    darkvision,
    sources: {
      resistances: bySource(res),
      savingThrowAdvantages: bySource(sav),
      skillAdvantages: bySource(skl),
      checkAdvantages: bySource(chk),
      darkvision: darkSources,
    },
  }
}

// ── temporary states ───────────────────────────────────────────────────────────────────────────
// Using a feature whose entry has `active` (Celestial Revelation, Draconic Flight, Large Form,
// Stonecunning) puts { id, name, option } in the character's `active_effects` (featureUse.useFeature).
// While it is there, the feature's `active_grants` (and its chosen option's) count. A rest, or the
// player, ends it.

function mechanicsOf(id) {
  return id && id !== '_schema' ? MECHANICS[id] ?? null : null
}

function activeGrants(character) {
  const out = {
    flySpeed: null,
    tremorsense: 0,
    light: null,
    size: null,
    speedBonus: 0,
    speedLines: [],
    checkAdvantages: [],
    effects: [],
  }
  for (const e of character.active_effects ?? []) {
    const base = mechanicsOf(e.id)
    const option = mechanicsOf(e.option)
    if (!base) continue
    const name = e.name ?? base.name
    for (const g of [base.active_grants, option?.active_grants]) {
      if (!g) continue
      if (g.fly_speed) out.flySpeed = g.fly_speed
      if (g.tremorsense)
        out.tremorsense = Math.max(out.tremorsense, g.tremorsense)
      if (g.light) out.light = g.light
      if (g.size) out.size = g.size
      out.speedBonus += g.speed_bonus ?? 0
      if (g.speed_bonus)
        out.speedLines.push({ label: name, amount: g.speed_bonus })
      for (const c of g.check_advantage ?? [])
        out.checkAdvantages.push({ grant: c, source: name })
    }
    const extra = base.active?.extra_damage
    const aura = option?.aura
    out.effects.push({
      id: e.id,
      name,
      option: e.option ?? null,
      optionName: option?.name ?? null,
      durationMinutes: base.active?.duration_minutes ?? null,
      extraDamage: extra
        ? {
            amount: resolveAmount(extra.amount, character),
            type: option?.extra_damage_type ?? null,
            oncePerTurn: !!extra.once_per_turn,
          }
        : null,
      aura: aura
        ? {
            timing: aura.timing,
            radiusFeet: aura.radius_feet,
            damage: {
              amount: resolveAmount(aura.damage.amount, character),
              type: aura.damage.type,
            },
          }
        : null,
    })
  }
  return out
}

// The keys of a feature-mechanics entry that ARE a rule the engine applies (as opposed to the
// bookkeeping keys: name, uses, recharge, action_type). A species trait must have one of these, or be
// marked narrative; engine/test/speciesRulesCoverage.test.js enforces it.
const RULE_KEYS = [
  'size_counts_as_larger',
  'reaction_effect',
  'unarmed_attack',
  'moves_through_creature_space',
  'hide_obscured_by',
  'd20_reroll_on',
  'on_use',
  'active',
  'on_long_rest',
  'survives_at_hp',
  'grants_hp_per_level',
  'long_rest_hours',
  'creates_objects',
  'cantrip_swap',
  'option_of',
  'lineage_damage',
  'engine_rule',
  'crit_extra_dice',
]
const isRule = (key) => key.startsWith('grants_') || RULE_KEYS.includes(key)

// ── proficiencies a feature grants ─────────────────────────────────────────────────────────────

const hasProperty = (weapon, property) =>
  (weapon.properties ?? []).some((p) => norm(p).startsWith(norm(property)))

// The weapons matching { category: 'martial', kind: 'melee', lacks: ['two-handed', 'heavy'] }, by name.
function weaponsMatching(filter) {
  return Object.entries(WEAPONS)
    .filter(([name, w]) => !name.startsWith('_') && w.category)
    .filter(
      ([, w]) =>
        (!filter.category || w.category === filter.category) &&
        (!filter.kind || w.weapon_type === filter.kind) &&
        !(filter.lacks ?? []).some((p) => hasProperty(w, p))
    )
    .map(([name]) => name)
}

// What taking this feature adds to the stored lists: skills, a skill pick, saving throws (with the
// abilities to pick from if already held), weapons, armor, tools, a tool pick, and whether a tool already
// held is replaced by another of that category.
function proficiencyGrants(feature) {
  const g = effectiveGrants(feature)
  return {
    skills: g.grants_skill_proficiency ?? [],
    skillChoice: g.grants_skill_proficiency_choice ?? null,
    saves: g.grants_saving_throw_proficiency ?? [],
    saveReplaceOptions: g.grants_saving_throw_replace_options ?? null,
    weapons: (g.grants_weapon_proficiency ?? []).flatMap((w) =>
      typeof w === 'string' ? [w] : weaponsMatching(w.filter ?? {})
    ),
    armor: g.grants_armor_proficiency ?? [],
    tools: g.grants_tool_proficiency ?? [],
    toolChoice: g.grants_tool_proficiency_choice ?? null,
    toolReplaceFrom: g.grants_tool_replace_from ?? null,
  }
}

module.exports = {
  characterGrants,
  activeGrants,
  RULE_KEYS,
  isRule,
  proficiencyGrants,
  effectiveGrants,
  weaponsMatching,
}
