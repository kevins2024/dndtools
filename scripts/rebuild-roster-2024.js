// One-off (2026-10-27): bring the migrated 28-character roster in line with the rules
// the engine now enforces, and record the facts scores and HP are calculated from.
//
//   node scripts/rebuild-roster-2024.js            # dry run: prints what would change
//   node scripts/rebuild-roster-2024.js --write
//
// For every character:
//   - ability_base      = the stored score minus every recorded ability_score_history change
//                         (the real base was never written down; this is the base the record implies)
//   - hp_unrecorded_dice= the hit-die results the record implies (max HP minus CON, species and
//                         feature bonuses), because per-level rolls were never written down
//   - level_history     = origin + one entry per class level (rebuilt from the sheet), the 2014->2024
//                         migration and this correction pass
//   - hp_max / stat_*   = the calculated values (this is where the Tough feat's missing HP appears)
// plus the sheet-specific corrections listed in FIXES below, each recorded in the character's history.
//
// Idempotent: a character that already has a level_history is skipped.

const fs = require('fs')
const path = require('path')
const { reconstructLevelHistory } = require('../engine/rules/5e/levelHistory')
const { deriveCharacter, deriveMaxHp } = require('../engine/rules/5e/derive')
const { migrateCharacterTo2024 } = require('../engine/rules/5e/migrate2024')
const { loadSubclass } = require('../engine/rules/5e/subclasses')
const { findSpellRecord } = require('../engine/rules/5e/spellLists')
const { auditCharacter } = require('../engine/rules/5e/auditCharacter')

const ROOT = path.join(__dirname, '..')
const FILE = path.join(ROOT, 'src', 'data', 'characters.json')
const ANSWERS = require('../2024_MIGRATION_ANSWERS.json')
const ROSTER_2014 = require('../engine/test/fixtures/roster2014.json')
const SPELLBOOKS = require('../src/data/spellbooks.json')
const DATE = '2026-10-27'
const write = process.argv.includes('--write')

const KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const has = (c, name) => (c.spells || []).some((s) => s.name === name)
const addSpell = (c, name, extra) => {
  if (has(c, name)) return false
  const rec = findSpellRecord(name, '2024')
  c.spells.push({ name, level: rec?.level ?? 0, prepared: true, ...extra })
  return true
}
const flagSpell = (c, name, extra) => {
  const s = (c.spells || []).find((x) => x.name === name)
  if (!s) return false
  Object.assign(s, extra)
  return true
}

// name -> (character, note) => void ; each pushes human-readable notes
const FIXES = {
  Petra(c, note) {
    const stale = [
      'Spiritual Weapon',
      'Beacon of Hope',
      'Guardian of Faith',
      'Raise Dead',
    ]
    c.spells = c.spells.filter((s) => !(s.domain && stale.includes(s.name)))
    note(
      `Removed the 2014 Life Domain spells that are not on the 2024 Life Domain list: ${stale.join(
        ', '
      )} (they are still Cleric spells and can be prepared normally).`
    )
    c.spells = c.spells.filter(
      (s) => !(s.name === 'Mass Healing Word' && !s.domain)
    )
    for (const name of [
      'Aid',
      'Mass Healing Word',
      'Aura of Life',
      'Greater Restoration',
    ])
      addSpell(c, name, { domain: true })
    note(
      'Added the 2024 Life Domain spells that were missing: Aid, Mass Healing Word, Aura of Life, Greater Restoration.'
    )
  },
  Chuknora(c, note) {
    if (c.spell_slots?.level_1) {
      c.spell_slots.level_1 = {
        max: 3,
        current: Math.min(c.spell_slots.level_1.current + 1, 3),
      }
      note(
        'First-level spell slots corrected from 2 to 3 (Paladin 3 uses the Paladin table; this was also wrong under the 2014 rules).'
      )
    }
    for (const n of ['Ensnaring Strike', 'Speak with Animals'])
      flagSpell(c, n, { type: 'oath' })
    note(
      'Marked Ensnaring Strike and Speak with Animals as Oath of the Ancients spells (always prepared).'
    )
    addSpell(c, 'Divine Smite', { featureGranted: true, _source: 'Paladin' })
    note("Added Divine Smite (2024 Paladin's Smite: always prepared).")
  },
  Enauweyn(c, note) {
    if (
      addSpell(c, 'Divine Smite', { featureGranted: true, _source: 'Paladin' })
    )
      note("Added Divine Smite (2024 Paladin's Smite: always prepared).")
  },
  Ferghus(c, note) {
    if (
      addSpell(c, 'Divine Smite', { featureGranted: true, _source: 'Paladin' })
    )
      note("Added Divine Smite (2024 Paladin's Smite: always prepared).")
  },
  Elucyne(c, note) {
    if (
      flagSpell(c, "Hunter's Mark", {
        featureGranted: true,
        _source: 'Ranger',
        type: undefined,
      })
    ) {
      delete c.spells.find((s) => s.name === "Hunter's Mark").type
      note(
        "Hunter's Mark is always prepared for a 2024 Ranger (Favored Enemy), so it no longer counts against prepared spells."
      )
    }
  },
  "Therynv'l"(c, note) {
    const sub = loadSubclass('Druid', 'Circle of the Moon', '2024')
    for (const [lvl, names] of Object.entries(sub.circle_spells_by_level))
      if (Number(lvl) <= 9)
        for (const n of names) {
          if (
            !addSpell(c, n, {
              featureGranted: true,
              _source: 'Circle of the Moon',
            })
          )
            flagSpell(c, n, {
              featureGranted: true,
              _source: 'Circle of the Moon',
            })
        }
    note(
      'Added the 2024 Circle of the Moon spells (always prepared): Cure Wounds, Moonbeam, Starry Wisp, Conjure Animals, Fount of Moonlight, Mass Cure Wounds.'
    )
  },
  Kerra(c, note) {
    const sub = loadSubclass('Warlock', 'Great Old One Patron', '2024')
    for (const [lvl, names] of Object.entries(sub.patron_spells_by_level))
      if (Number(lvl) <= 5)
        for (const n of names)
          addSpell(c, n, { featureGranted: true, _source: 'Great Old One' })
    note(
      "Added the 2024 Great Old One patron spells (always prepared): Detect Thoughts, Dissonant Whispers, Phantasmal Force, Tasha's Hideous Laughter, Clairvoyance, Hunger of Hadar."
    )
  },
  Rith(c, note) {
    dropDuplicateMetamagic(c, note)
  },
  Iyani(c, note) {
    dropDuplicateMetamagic(c, note)
  },
  Lyria(c, note) {
    const before = c.prepared_spells.length
    c.prepared_spells = c.prepared_spells.filter((n) => n !== 'Identify')
    if (c.prepared_spells.length < before)
      note(
        'Identify is no longer marked prepared: that was one more prepared spell than a Wizard with INT 20 at level 9 may have, and no feature or item explains it. Identify is a ritual, so she can still cast it from the spellbook without preparing it.'
      )
  },
  Revven(c, note) {
    const sub = loadSubclass('Cleric', 'Tempest Domain', '2024')
    const idx = (sub.features_by_level['3'] || []).findIndex((n) =>
      /^Bonus Proficiencies/.test(n)
    )
    if (
      idx >= 0 &&
      !c.features.some((f) => /^Bonus Proficiencies/.test(f.name))
    ) {
      c.features.push({
        name: sub.features_by_level['3'][idx],
        id: sub.features_by_level_ids?.['3']?.[idx] ?? null,
        type: 'feature',
        level_gained: 3,
        _source: 'Cleric',
      })
      note(
        'Added the Tempest Domain Bonus Proficiencies entry (martial weapons and heavy armor were already on the sheet).'
      )
    }
  },
}

function dropDuplicateMetamagic(c, note) {
  const mine = c.features.filter(
    (f) =>
      f.type === 'metamagic' && f._source === 'Sorcerer' && f.level_gained === 2
  )
  if (!mine.length) return
  c.features = c.features.filter((f) => !mine.includes(f))
  note(
    `Removed ${
      mine.length
    } Metamagic entries added by the first migration (${mine
      .map((f) => f.name.replace('Metamagic: ', ''))
      .join(', ')}); the character already had its two options from before.`
  )
}

function magicInitiateSpells(c) {
  for (const f of c.features)
    if (
      f.type === 'feat' &&
      f.name === 'Magic Initiate' &&
      f.choices?.cantrips &&
      !f.spells_granted
    )
      f.spells_granted = [...f.choices.cantrips, f.choices.spell]
}

const speciesHp = (c) => {
  const { traitsFor } = require('../engine/rules/5e/species')
  return traitsFor(c.genus, c.subgenus, '2024').reduce(
    (n, t) => n + (t.grants_hp_per_level || 0),
    0
  )
}

function rebuild(src, report) {
  const c = JSON.parse(JSON.stringify(src))
  if (c.level_history?.length) return null
  const notes = []
  const note = (m) => notes.push(m)

  FIXES[c.name]?.(c, note)
  magicInitiateSpells(c)

  // ability scores: base = stored minus recorded changes
  const hist = c.ability_score_history || []
  c.ability_base = {}
  for (const k of KEYS)
    c.ability_base[k] =
      c[`stat_${k}`] -
      hist
        .filter((h) => h.ability === k)
        .reduce((n, h) => n + (h.amount || 0), 0)
  c.ability_score_history = hist
  c.ability_base_note =
    'Implied by the sheet (stored score minus every recorded change). The real starting scores were not written down; replace these when they are known.'

  // HP: dice implied by the stored total, before bonuses the first migration forgot to apply
  const levels = c.classes.reduce((n, k) => n + k.level, 0)
  const con = Math.floor((c.stat_con - 10) / 2)
  const migratedTough = c.features.some(
    (f) =>
      f.type === 'feat' &&
      f.name === 'Tough' &&
      ['origin', 'species'].includes(f._grant)
  )
  const withoutTough = migratedTough
    ? c.features.filter(
        (f) =>
          !(
            f.type === 'feat' &&
            f.name === 'Tough' &&
            ['origin', 'species'].includes(f._grant)
          )
      )
    : c.features
  const oldHp = c.hp_max
  const probe = {
    ...c,
    features: withoutTough,
    level_history: [],
    hp_unrecorded_dice: 0,
  }
  const without = deriveMaxHp(
    probe,
    Object.fromEntries(KEYS.map((k) => [k, c[`stat_${k}`]]))
  ).total
  c.hp_unrecorded_dice = oldHp - without
  void con
  void levels

  // history: origin + levels (rebuilt), the migration, this pass
  const rebuilt = reconstructLevelHistory(c).map((e) => {
    if (e.kind === 'level') e.hp = { gain: null, method: 'unrecorded' }
    return e
  })
  const original = ROSTER_2014.find((x) => x.name === c.name)
  const migrated = original
    ? migrateCharacterTo2024(original, { answers: ANSWERS[c.name] ?? {} })
    : null
  const history = [...rebuilt]
  if (migrated)
    history.push({
      kind: 'migration',
      from: '2014',
      to: '2024',
      date: DATE,
      notes: [...migrated.changes.map((x) => x.detail), ...migrated.warnings],
    })
  const d = deriveCharacter(c)
  if (d.hp_max !== oldHp) {
    note(
      `Maximum HP ${oldHp} -> ${d.hp_max}: the Tough feat's +2 per level was not applied when the feat was added.`
    )
  }
  c.hp_current = Math.max(0, (c.hp_current ?? oldHp) + (d.hp_max - oldHp))
  Object.assign(c, {
    stat_str: d.stat_str,
    stat_dex: d.stat_dex,
    stat_con: d.stat_con,
    stat_int: d.stat_int,
    stat_wis: d.stat_wis,
    stat_cha: d.stat_cha,
    hp_max: d.hp_max,
    proficiency_bonus: d.proficiency_bonus,
  })
  if (notes.length) history.push({ kind: 'audit', date: DATE, notes })
  c.level_history = history
  report.push({ name: c.name, notes })
  return c
}

const chars = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const report = []
const out = chars.map((c) => rebuild(c, report) ?? c)
for (const r of report) {
  console.log(`\n## ${r.name}`)
  r.notes.forEach((n) => console.log(`  - ${n}`))
}
let errors = 0
for (const c of out) {
  const bad = auditCharacter(c, { spellbooks: SPELLBOOKS }).filter(
    (i) => i.severity === 'error'
  )
  if (bad.length) {
    errors++
    console.log(
      `\n!! ${c.name} still has errors:\n` +
        bad.map((i) => `   ${i.code}: ${i.message}`).join('\n')
    )
  }
}
console.log(
  `\n${report.length} character(s) rebuilt; ${errors} with audit errors afterwards.`
)
if (write) {
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n')
  console.log('characters.json written.')
} else console.log('(dry run; pass --write to save)')
