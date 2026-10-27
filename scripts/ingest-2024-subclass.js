// Drafts the 2024 data for one PHB subclass from dnd2024.wikidot.com:
//
//   node scripts/ingest-2024-subclass.js barbarian berserker "Path of the Berserker"
//   node scripts/ingest-2024-subclass.js barbarian berserker "Path of the Berserker" --write
//
// args: <class> <wikidot page suffix (class:<suffix>)> <display name>
//
// Writes engine/data/5e2024/subclasses/<class>-<name-slug>.json, one
// pub24_<class>-<subclass>-<feature> entry per feature in
// src/data/published_features.json, and the id->name entries in
// engine/data/5e/feature-catalog.json. See 2024_CONVERSION_PLAN.md.
// Always-prepared spell tables ("<X> Spells" with Level | Spells rows) are
// captured under the field name characterSpells.js already reads for that class.

const fs = require('fs')
const path = require('path')
const { fetchPageLines } = require('./fetch-2024-wikidot')
const { parseSections, slug, splitRow } = require('./ingest-2024-class')

const ROOT = path.join(__dirname, '..')
const SPELL_FIELD = {
  cleric: 'domain_spells_by_level',
  paladin: 'oath_spells_by_level',
  druid: 'circle_spells_by_level',
  ranger: 'bonus_spells_by_level',
  warlock: 'patron_spells_by_level',
}

function parseSpellTables(lines) {
  const tables = []
  for (let i = 0; i < lines.length; i++) {
    const head = splitRow(lines[i])
    if (head.length === 2 && /Level$/.test(head[0]) && /Spells$/.test(head[1])) {
      const byLevel = {}
      for (let j = i + 1; j < lines.length; j++) {
        const [lvl, spells] = splitRow(lines[j])
        if (!/^\d+$/.test(lvl ?? '') || !spells) break
        byLevel[lvl] = spells.split(',').map((s) => s.trim()).filter(Boolean)
      }
      tables.push({ title: lines[i - 1], byLevel })
    }
  }
  return tables
}

async function ingest(cls, page, displayName, { write }) {
  const lines = await fetchPageLines(`${cls}:${page}`)
  const className = cls[0].toUpperCase() + cls.slice(1)
  const sub = slug(displayName)
  const sections = parseSections(lines)
  const nameCount = {}
  for (const s of sections) nameCount[s.name] = (nameCount[s.name] ?? 0) + 1

  const featuresByLevel = {}
  const published = []
  const catalog = {}
  for (const s of sections) {
    // A "<X> Spells" section only introduces the table; it isn't a feature.
    if (/ Spells$/.test(s.name) && parseSpellTables(s.body).length === 0 && /always have/.test(s.body.join(' '))) {
      // keep it: the always-prepared spells are a real feature line on the sheet
    }
    const id = `pub24_${cls}-${sub}-${slug(s.name)}${nameCount[s.name] > 1 ? `-l${s.level}` : ''}`
    ;(featuresByLevel[s.level] ??= []).push(id)
    catalog[id] = s.name
    published.push({
      id,
      name: s.name,
      category: 'subclass_feature',
      class: `${className} (${displayName})`,
      level_gained: s.level,
      description: s.body.join('\n'),
      source: "Player's Handbook (2024)",
      ruleset: '2024',
      homebrew: false,
    })
  }

  const data = {
    class: className,
    name: displayName,
    ruleset: '2024',
    description: lines.slice(2).find((l) => !/^Level \d+:/.test(l) && l.length > 40) ?? '',
    features_by_level: featuresByLevel,
  }
  const spellTables = parseSpellTables(lines)
  const field = SPELL_FIELD[cls]
  if (spellTables.length === 1 && field) data[field] = spellTables[0].byLevel
  else if (spellTables.length) data.spell_tables_unmapped = spellTables

  console.log(
    `${className} / ${displayName}: ${published.length} features at levels ${Object.keys(featuresByLevel).join(', ')}` +
      (spellTables.length ? `; ${spellTables.length} spell table(s)` : '')
  )
  if (!write) return console.log(JSON.stringify(data, null, 2).slice(0, 1500))

  const outFile = path.join(ROOT, 'engine', 'data', '5e2024', 'subclasses', `${cls}-${sub}.json`)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n')

  const pubFile = path.join(ROOT, 'src', 'data', 'published_features.json')
  const pub = JSON.parse(fs.readFileSync(pubFile, 'utf8'))
  const mine = new RegExp(`^pub24_${cls}-${sub}-`)
  fs.writeFileSync(
    pubFile,
    JSON.stringify([...pub.filter((e) => !mine.test(e.id ?? '')), ...published], null, 2) + '\n'
  )
  const catFile = path.join(ROOT, 'engine', 'data', '5e', 'feature-catalog.json')
  const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'))
  for (const k of Object.keys(cat)) if (mine.test(k)) delete cat[k]
  Object.assign(cat, catalog)
  fs.writeFileSync(catFile, JSON.stringify(cat, null, 2) + '\n')
  console.log('written.')
}

if (require.main === module) {
  const [cls, page, name] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!cls || !page || !name) {
    console.error('usage: node scripts/ingest-2024-subclass.js <class> <page> "<Display Name>" [--write]')
    process.exit(1)
  }
  ingest(cls.toLowerCase(), page, name, { write: process.argv.includes('--write') }).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
