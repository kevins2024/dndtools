// The 2024 spell data (src/data/spells_2024.json) as the rest of the engine depends on it: written without
// mechanical slips, flags that agree with the text, and every spell name the engine's own data refers to
// (subclass spell tables, species lineages, always-prepared spells, feature grants) is a real 2024 spell.
// scripts/crosscheck-spells.js compares the same data with the SRD 5.2 (word for word, 301 of 322 SRD
// spells agree; the rest differ only where the SRD drops tables, names non-SRD content, or has its own glitch).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const spells = require('../../src/data/spells_2024.json')
const { lint } = require('../../scripts/crosscheck-spells.js')
const { findSpellRecord } = require('../rules/5e/spellLists')

// Spells that end in a table or a list (no closing full stop in the book), or whose stat block abbreviates
// "ft." mid-sentence: reviewed, not slips.
const REVIEWED = {
  Creation: ['does not end like a sentence'],
  'Greater Restoration': ['does not end like a sentence'],
  'Summon Dragon': ['does not end like a sentence'],
  'Guards and Wards': ['does not end like a sentence'],
  'Summon Fiend': ['sentence starts in lower case'],
  'Control Weather': ['does not end like a sentence'],
}

test('every 2024 spell is written without mechanical slips and its flags agree with its text', () => {
  assert.ok(spells.length >= 390)
  const problems = []
  for (const s of spells)
    for (const p of lint(s)) {
      const allowed = (REVIEWED[s.name] ?? []).some((a) => p.includes(a))
      if (!allowed) problems.push(`${s.name}: ${p}`)
    }
  assert.deepEqual(problems, [])
})

test('spell names are unique and every spell has a school, a level 0-9 and a class list of real classes', () => {
  const CLASSES = [
    'Artificer',
    'Bard',
    'Cleric',
    'Druid',
    'Paladin',
    'Ranger',
    'Sorcerer',
    'Warlock',
    'Wizard',
  ]
  const SCHOOLS = [
    'Abjuration',
    'Conjuration',
    'Divination',
    'Enchantment',
    'Evocation',
    'Illusion',
    'Necromancy',
    'Transmutation',
  ]
  const names = new Set()
  const problems = []
  for (const s of spells) {
    if (names.has(s.name.toLowerCase())) problems.push(`${s.name}: duplicate`)
    names.add(s.name.toLowerCase())
    if (!SCHOOLS.includes(s.school))
      problems.push(`${s.name}: school "${s.school}"`)
    if (!(Number.isInteger(s.level) && s.level >= 0 && s.level <= 9))
      problems.push(`${s.name}: level ${s.level}`)
    for (const c of s.classes ?? [])
      if (!CLASSES.includes(c)) problems.push(`${s.name}: class "${c}"`)
  }
  assert.deepEqual(problems, [])
})

// every spell name the engine's data refers to, with where
function referencedSpells() {
  const refs = []
  const root = path.join(__dirname, '..', 'data')
  const add = (name, where) => {
    if (typeof name === 'string') refs.push([name, where])
  }
  const strings = (v, where) => {
    if (typeof v === 'string') add(v, where)
    else if (Array.isArray(v)) v.forEach((x) => strings(x, where))
    else if (v && typeof v === 'object')
      Object.values(v).forEach((x) => strings(x, where))
  }
  // subclass spell tables and class always-prepared spells (2024)
  // (a subclass's `spell_list` names the class list it draws from, not spells, so it is not here)
  const SPELL_TABLES = /(spells_by_level|spells_by_type|always_prepared_spells)/
  const walk = (o, where) => {
    if (Array.isArray(o)) return o.forEach((x) => walk(x, where))
    if (!o || typeof o !== 'object') return
    for (const [k, v] of Object.entries(o)) {
      if (SPELL_TABLES.test(k)) strings(v, `${where} ${k}`)
      else walk(v, where)
    }
  }
  for (const dir of ['classes', 'subclasses']) {
    const d = path.join(root, '5e2024', dir)
    for (const f of fs.readdirSync(d))
      walk(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), `${dir}/${f}`)
  }
  // species lineages
  const sc = require('../data/5e2024/species-choices.json')
  for (const [species, spec] of Object.entries(sc)) {
    if (species.startsWith('_')) continue
    for (const [lineage, row] of Object.entries(spec.lineages ?? {})) {
      strings(row.cantrips ?? [], `${species} ${lineage} cantrips`)
      strings(row.spellsAtLevel ?? {}, `${species} ${lineage} spellsAtLevel`)
      strings(row.alwaysPrepared ?? [], `${species} ${lineage} alwaysPrepared`)
    }
    strings(spec.fixedCantrips ?? [], `${species} fixedCantrips`)
  }
  // features that grant a spell (feature-mechanics and the 2024 feats)
  const mech = require('../data/5e/feature-mechanics.json')
  for (const [id, m] of Object.entries(mech))
    if (m?.grants_spells?.fixed)
      strings(m.grants_spells.fixed, `${id} grants_spells`)
  return refs
}

test('every spell the engine data names is a real 2024 spell', () => {
  const refs = referencedSpells()
  assert.ok(refs.length > 100, `only ${refs.length} references found`)
  const missing = refs
    .filter(([name]) => !findSpellRecord(name, '2024'))
    .map(([name, where]) => `${name} (${where})`)
  assert.deepEqual([...new Set(missing)], [])
})
