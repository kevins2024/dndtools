// Drafts the 2024 data for one subclass from dnd2024.wikidot.com:
//
//   node scripts/ingest-2024-subclass.js barbarian:path-of-the-berserker           # dry run
//   node scripts/ingest-2024-subclass.js barbarian:path-of-the-berserker --write
//
// Writes engine/data/5e2024/subclasses/<class>-<name-slug>.json, one
// pub24_sub_<class>-<subclass>-<feature> entry per feature in
// src/data/published_features.json, and the id->name entries in
// engine/data/5e/feature-catalog.json. See 2024_CONVERSION_PLAN.md.
//
// The wikidot site mixes official books with Unearthed Arcana and third-party
// material, so the page's "Source:" line is checked and anything that is not an
// official 2024-rules book is refused (pass --allow-source to override).
//
// Always-prepared spell tables ("<X> Spells", Level | Spells rows) are captured
// under the field name characterSpells.js already reads for that class; the
// Eldritch Knight / Arcane Trickster casting table becomes the subclass's own
// spellcasting block.

const fs = require('fs')
const path = require('path')
const { fetchPage } = require('./fetch-2024-wikidot')
const { parseSections, slug, splitRow } = require('./ingest-2024-class')

const ROOT = path.join(__dirname, '..')
const REFUSED_SOURCE = /unearthed|arcana unleashed|homebrew|third.?party/i
const SPELL_FIELD = {
  cleric: 'domain_spells_by_level',
  paladin: 'oath_spells_by_level',
  druid: 'circle_spells_by_level',
  ranger: 'bonus_spells_by_level',
  warlock: 'patron_spells_by_level',
  sorcerer: 'bonus_spells_by_level',
}
const ORDINAL = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 }
// Cantrip counts are prose on the page ("You know two cantrips ... another at
// level 10"), so they are stated here and covered by a test.
const THIRD_CASTER = {
  'Eldritch Knight': {
    class: 'fighter',
    ability: 'int',
    cantrips: { 3: 2, 10: 3 },
  },
  'Arcane Trickster': {
    class: 'rogue',
    ability: 'int',
    cantrips: { 3: 3, 10: 4 },
  },
}

// "<Class> Level | Spells" style tables -> { title, byLevel }
function parseSpellTables(lines) {
  const tables = []
  for (let i = 0; i < lines.length; i++) {
    const head = splitRow(lines[i])
    if (
      head.length === 2 &&
      /Level$/.test(head[0]) &&
      /(^| )Spells$/.test(head[1])
    ) {
      const byLevel = {}
      for (let j = i + 1; j < lines.length; j++) {
        const [lvl, spells] = splitRow(lines[j])
        if (!/^\d+$/.test(lvl ?? '') || !spells) break
        byLevel[lvl] = spells
          .split(',')
          .map((s) => s.trim().replace(/\*$/, '')) // footnote marker (Knowledge Domain: "*Spell of the Divination School")
          .filter(Boolean)
      }
      tables.push({ title: lines[i - 1], byLevel })
    }
  }
  return tables
}

// "Fighter Level | Prepared Spells | 1st | 2nd ..." (Eldritch Knight / Arcane Trickster)
function parseCasterTable(lines) {
  const i = lines.findIndex((l) =>
    /^\w+ Level \| Prepared Spells \| 1st/.test(l)
  )
  if (i < 0) return null
  const cols = splitRow(lines[i])
  const out = { prepared_spells_by_level: {} }
  for (let n = 1; n <= 4; n++) out[`spell_slots_level_${n}_by_level`] = {}
  for (let j = i + 1; j < lines.length; j++) {
    const cells = splitRow(lines[j])
    if (!/^\d+$/.test(cells[0])) break
    out.prepared_spells_by_level[cells[0]] = Number(cells[1])
    for (let c = 2; c < cols.length; c++) {
      const n = ORDINAL[cols[c]]
      out[`spell_slots_level_${n}_by_level`][cells[0]] = /^\d+$/.test(cells[c])
        ? Number(cells[c])
        : 0
    }
  }
  return out
}

async function ingest(pageSlug, { write, allowSource }) {
  const [cls, page] = pageSlug.split(':')
  const { title, source, lines } = await fetchPage(pageSlug)
  if (!allowSource && (!source || REFUSED_SOURCE.test(source))) {
    console.log(
      `SKIPPED ${pageSlug}: source is "${source}" (not an official 2024-rules book)`
    )
    return null
  }
  const className = cls[0].toUpperCase() + cls.slice(1)
  const displayName = title
  const sub = slug(displayName)
  const sourceLabel = `${source} (2024)`
  const sections = parseSections(lines)
  const nameCount = {}
  for (const s of sections) nameCount[s.name] = (nameCount[s.name] ?? 0) + 1

  const featuresByLevel = {}
  const published = []
  const catalog = {}
  for (const s of sections) {
    const id = `pub24_sub_${cls}-${sub}-${slug(s.name)}${
      nameCount[s.name] > 1 ? `-l${s.level}` : ''
    }`
    ;(featuresByLevel[s.level] ??= []).push(id)
    catalog[id] = s.name
    published.push({
      id,
      name: s.name,
      category: 'subclass_feature',
      class: `${className} (${displayName})`,
      level_gained: s.level,
      description: s.body.join('\n'),
      source: sourceLabel,
      ruleset: '2024',
      homebrew: false,
    })
  }

  const data = {
    class: className,
    name: displayName,
    ruleset: '2024',
    source: sourceLabel,
    description:
      lines.slice(1).find((l) => !/^Level \d+:/.test(l) && l.length > 40) ?? '',
    features_by_level: featuresByLevel,
  }

  const third = THIRD_CASTER[displayName]
  const casterTable = third && parseCasterTable(lines)
  if (casterTable) {
    data.spellcasting = { type: 'third', ability: third.ability }
    data.cantrips_by_level = third.cantrips
    Object.assign(data, casterTable)
  }

  const spellTables = parseSpellTables(lines)
  const field = SPELL_FIELD[cls]
  if (spellTables.length === 1 && field) data[field] = spellTables[0].byLevel
  else if (spellTables.length > 1 && cls === 'druid') {
    // Circle of the Land: one table per land type.
    data.land_spells_by_type = Object.fromEntries(
      spellTables.map((t) => [t.title.replace(/ Land$/, ''), t.byLevel])
    )
  } else if (spellTables.length) data.spell_tables_unmapped = spellTables

  console.log(
    `${className} / ${displayName} [${source}]: ${
      published.length
    } features at ${Object.keys(featuresByLevel).join(', ')}` +
      (casterTable ? '; third-caster table' : '') +
      (spellTables.length ? `; ${spellTables.length} spell table(s)` : '')
  )
  if (!write) return data

  const outFile = path.join(
    ROOT,
    'engine',
    'data',
    '5e2024',
    'subclasses',
    `${cls}-${sub}.json`
  )
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n')

  const pubFile = path.join(ROOT, 'src', 'data', 'published_features.json')
  const pub = JSON.parse(fs.readFileSync(pubFile, 'utf8'))
  const mine = new RegExp(`^pub24_sub_${cls}-${sub}-`)
  fs.writeFileSync(
    pubFile,
    JSON.stringify(
      [...pub.filter((e) => !mine.test(e.id ?? '')), ...published],
      null,
      2
    ) + '\n'
  )
  const catFile = path.join(
    ROOT,
    'engine',
    'data',
    '5e',
    'feature-catalog.json'
  )
  const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'))
  for (const k of Object.keys(cat)) if (mine.test(k)) delete cat[k]
  Object.assign(cat, catalog)
  fs.writeFileSync(catFile, JSON.stringify(cat, null, 2) + '\n')
  return data
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const pages = args.filter((a) => !a.startsWith('--'))
  if (!pages.length) {
    console.error(
      'usage: node scripts/ingest-2024-subclass.js <class>:<page> [...] [--write] [--allow-source]'
    )
    process.exit(1)
  }
  ;(async () => {
    for (const p of pages) {
      await ingest(p, {
        write: args.includes('--write'),
        allowSource: args.includes('--allow-source'),
      })
    }
  })().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { ingest }
