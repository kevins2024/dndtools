// The repo rule (CLAUDE.md, "The engine IS the game"), enforced for species WITHOUT reading any text:
// every 2024 species trait, every lineage/ancestry/legacy option and every homebrew species trait has a
// feature-mechanics entry that is one of
//
//   - a rule the engine applies: a `grants_*` field or one of featureGrants.RULE_KEYS (on_use, active,
//     d20_reroll_on, survives_at_hp, ...), or
//   - a `pick`: a choice made at creation, which must be a real choice in species-choices.json, or
//   - `narrative: "<reason>"`: reviewed, nothing a rule can compute.
//
// A trait with only bookkeeping (a name, a use counter, a recharge) fails: a counter is not a rule. This
// replaces trusting a scan of the description for phrases like "advantage on", which can only find the
// traits it has a phrase for (it missed Halfling Luck, Trance and Resourceful). What the rules DO is
// tested in speciesRules2024.test.js and featureGrants2024.test.js.
const test = require('node:test')
const assert = require('node:assert/strict')
const published = require('../../src/data/published_features.json')
const mechanics = require('../data/5e/feature-mechanics.json')
const speciesCache = require('../../src/data/api_data_cache/species.json')
const SPECIES_CHOICES = require('../data/5e2024/species-choices.json')
const { isRule } = require('../rules/5e/featureGrants')

const features = Array.isArray(published)
  ? published
  : Object.values(published)[0]
const norm = (s) => String(s).toLowerCase().replace(/[’']/g, "'")

const traits = features.filter((f) => String(f.id).startsWith('pub24_species'))
const homebrew = (
  Array.isArray(speciesCache) ? speciesCache : Object.values(speciesCache)[0]
)
  .filter((s) => s.homebrew && s.playable !== false && s.traits)
  .flatMap((s) => s.traits.map((t) => ({ ...t, species: s.name })))

const isPick = (id, name, speciesName) => {
  const choices = SPECIES_CHOICES[speciesName]?.choices ?? []
  return choices.some((c) => norm(c.title).startsWith(norm(name)))
}

function disposition(id, name, speciesName) {
  const m = mechanics[id]
  if (!m) return 'no feature-mechanics entry'
  if (Object.keys(m).some(isRule)) return null
  if (m.narrative)
    return typeof m.narrative === 'string' ? null : 'narrative needs a reason'
  if (m.pick)
    return isPick(id, name, speciesName)
      ? null
      : `pick, but species-choices.json has no choice titled "${name}"`
  return 'only a name or a counter: no rule, pick or narrative reason'
}

test('every 2024 species trait is a rule the engine applies, a validated pick, or narrative with a reason', () => {
  assert.ok(traits.length >= 40)
  const problems = traits
    .map((f) => [f.id, disposition(f.id, f.name, f.species)])
    .filter(([, why]) => why)
    .map(([id, why]) => `${id}: ${why}`)
  assert.deepEqual(problems, [])
})

test('every homebrew species trait is held to the same standard', () => {
  assert.ok(homebrew.length >= 10)
  const problems = homebrew
    .map((t) => [t.id, disposition(t.id, t.name, t.species)])
    .filter(([, why]) => why)
    .map(([id, why]) => `${id}: ${why}`)
  assert.deepEqual(problems, [])
})

test('every lineage, ancestry and legacy option is a published feature with a rule', () => {
  const problems = []
  for (const [species, spec] of Object.entries(SPECIES_CHOICES)) {
    if (species.startsWith('_') || !spec.lineageChoice) continue
    const choice = spec.choices.find((c) => c.id === spec.lineageChoice)
    const slug = (s) =>
      norm(s)
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    for (const option of choice.options) {
      const id = `pub24_species_${slug(species)}-${slug(choice.title)}--${slug(
        option
      )}`
      if (!features.some((f) => f.id === id))
        problems.push(`${id}: not published`)
      const m = mechanics[id]
      if (!m) problems.push(`${id}: no feature-mechanics entry`)
      else if (m.name !== `${choice.title}: ${option}`)
        problems.push(
          `${id}: name "${m.name}" must be "${choice.title}: ${option}"`
        )
      // the effect is on the entry, or in the lineage table row the engine reads
      const row = spec.lineages?.[option]
      const hasEffect =
        (m && Object.keys(m).some(isRule)) ||
        (row && (row.resistance || row.darkvision || row.speed || row.cantrips))
      if (!hasEffect) problems.push(`${id}: no rule`)
    }
  }
  assert.deepEqual(problems, [])
})

test('a rule that points at another feature points at one that exists', () => {
  const problems = []
  for (const [id, m] of Object.entries(mechanics)) {
    if (id.startsWith('_')) continue
    if (m.option_of && !mechanics[m.option_of])
      problems.push(`${id}: option_of ${m.option_of} has no entry`)
    for (const o of m.active?.choose_one_of ?? [])
      if (!mechanics[o]) problems.push(`${id}: option ${o} has no entry`)
      else if (mechanics[o].option_of !== id)
        problems.push(`${id}: option ${o} is not option_of this feature`)
    const KINDS = [
      'heal',
      'temp_hp',
      'action',
      'damage',
      'area_save',
      'reduce_damage',
      'teleport',
      'condition',
      'speed_reduction',
    ]
    for (const e of m.on_use ?? [])
      if (!KINDS.includes(e.kind))
        problems.push(
          `${id}: on_use kind "${e.kind}" is not one the engine resolves`
        )
  }
  assert.deepEqual(problems, [])
})

test('Dwarven Toughness: the species data and the rule entry agree', () => {
  const species = require('../data/5e2024/species.json').find(
    (s) => s.name === 'Dwarf'
  )
  for (const t of species.traits)
    assert.equal(
      mechanics[t.id]?.grants_hp_per_level,
      t.grants_hp_per_level,
      t.name
    )
})

test('every rule key a species trait uses is read by engine code (a key nothing reads is not a rule)', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const dir = path.join(__dirname, '..', 'rules')
  const sources = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name))
      else if (e.name.endsWith('.js'))
        sources.push(fs.readFileSync(path.join(d, e.name), 'utf8'))
    }
  }
  walk(dir)
  const keys = new Set()
  for (const t of [...traits, ...homebrew]) {
    for (const k of Object.keys(mechanics[t.id] ?? {}))
      if (isRule(k)) keys.add(k)
  }
  for (const id of Object.keys(mechanics))
    if (id.includes('--'))
      for (const k of Object.keys(mechanics[id])) if (isRule(k)) keys.add(k)
  // read as a property (".key") or by name (["key"]); a plain substring check, not a pattern
  const reads = (s, k) => {
    for (let at = s.indexOf('.' + k); at >= 0; at = s.indexOf('.' + k, at + 1))
      if (!/[A-Za-z0-9_]/.test(s[at + 1 + k.length] ?? ' ')) return true
    return s.includes("['" + k + "']")
  }
  const unread = [...keys].filter((k) => !sources.some((s) => reads(s, k)))
  assert.deepEqual(unread, [])
})

test('the playable legacy species (Half-Elf, Half-Orc) are held to the same standard: every trait is a rule, published', () => {
  const legacy = Object.entries(SPECIES_CHOICES)
    .filter(([, v]) => v && v.legacyPlayable)
    .map(([name]) => name)
  assert.deepEqual(legacy.sort(), ['Half-Elf', 'Half-Orc'])
  const species = require('../data/5e/species.json')
  const list = Array.isArray(species) ? species : Object.values(species)
  const problems = []
  for (const name of legacy)
    for (const t of list.find((s) => s.name === name).traits) {
      const why = disposition(t.id, t.name, name)
      if (why) problems.push(`${name} ${t.name} (${t.id}): ${why}`)
      if (!features.some((f) => f.id === t.id))
        problems.push(`${name} ${t.name} (${t.id}): not published`)
    }
  assert.deepEqual(problems, [])
})
