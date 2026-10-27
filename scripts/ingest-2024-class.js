// Drafts the 2024 data for one PHB class from dnd2024.wikidot.com:
//
//   node scripts/ingest-2024-class.js barbarian            # dry run, prints a summary
//   node scripts/ingest-2024-class.js barbarian --write    # writes the files below
//
// Writes (see 2024_CONVERSION_PLAN.md for the conventions):
//   engine/data/5e2024/classes/<class>.json       class chassis (features by id)
//   src/data/published_features.json              one entry per feature, ruleset "2024"
//   engine/data/5e/feature-catalog.json           id -> display name
//
// It drafts only what the page states mechanically. Things that need judgement
// (feature-mechanics.json action types/uses, spellcasting tables, subclass
// files) are authored by hand afterwards. Re-running replaces this class's own
// pub24_<class>-* entries and nothing else.

const fs = require('fs')
const path = require('path')
const { fetchPageLines } = require('./fetch-2024-wikidot')

const ROOT = path.join(__dirname, '..')
const SKIP_FEATURE =
  /^(Ability Score Improvement|Epic Boon|Subclass feature|.* Subclass)$/i

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const snake = (s) => slug(s).replace(/-/g, '_')

// How each PHB class casts (the page only says it in prose). Subclass casters
// (Eldritch Knight, Arcane Trickster) carry theirs on the subclass file.
const CLASS_SPELLCASTING = {
  bard: { type: 'full', ability: 'cha' },
  cleric: { type: 'full', ability: 'wis' },
  druid: { type: 'full', ability: 'wis' },
  sorcerer: { type: 'full', ability: 'cha' },
  wizard: { type: 'full', ability: 'int' },
  paladin: { type: 'half', ability: 'cha' },
  ranger: { type: 'half', ability: 'wis' },
  warlock: { type: 'pact', ability: 'cha' },
  artificer: { type: 'artificer', ability: 'int' },
}

const ABILITY = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

function splitRow(line) {
  return line.split(' | ').map((c) => c.trim())
}

// The "Core X Traits" table is a two-column key/value table; the extractor
// emits each row as "Primary Ability | Strength".
function parseCoreTraits(lines) {
  const out = {}
  const start = lines.findIndex((l) => /^Core .* Traits$/.test(l))
  if (start < 0) return out
  for (let i = start + 1; i < lines.length; i++) {
    const [key, val] = splitRow(lines[i])
    if (!val) break
    out[key] = val
  }
  return out
}

function parseSaves(text) {
  return text
    .split(/ and |, /)
    .map((s) => ABILITY[s.trim().toLowerCase()])
    .filter(Boolean)
}

function parseArmor(text) {
  const t = text.toLowerCase()
  const out = []
  for (const k of ['light', 'medium', 'heavy'])
    if (new RegExp(`\\b${k}\\b`).test(t)) out.push(k)
  if (/shield/.test(t)) out.push('shields')
  return out
}

// Tokens: 'simple', 'martial', or a conditional grant for the classes that only
// get some Martial weapons: 'martial:light' (Monk), 'martial:finesse_or_light' (Rogue).
function parseWeapons(text) {
  const t = text.toLowerCase()
  const out = []
  if (/simple/.test(t)) out.push('simple')
  if (/martial/.test(t)) {
    if (/finesse or light/.test(t)) out.push('martial:finesse_or_light')
    else if (/light property/.test(t)) out.push('martial:light')
    else out.push('martial')
  }
  return out
}

function parseSkills(text) {
  const m = /Choose (?:any )?(\d+)(?: skills)?(?::\s*(.*))?$/i.exec(text)
  if (!m) return null
  const options = m[2]
    ? m[2]
        .replace(/\bor\b/g, ',')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(snake)
    : 'any'
  return { count: Number(m[1]), options }
}

// "Choose A or B: (A) Greataxe, 4 Handaxes, Explorer's Pack, and 15 GP; or (B) 75 GP"
// (Fighter has a third, "(C) 155 GP"). Returns { raw, A: {items, gold}, B, C }.
function parseEquipment(text) {
  const clean = text.replace(/[’]/g, "'")
  const parts = clean.split(/;?\s*(?:or\s*)?\(([A-C])\)\s*/).slice(1)
  const out = { raw: clean }
  for (let i = 0; i < parts.length; i += 2) {
    const letter = parts[i]
    let gold = 0
    const items = []
    const pieces = parts[i + 1]
      .replace(/\band\b/g, ',')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    for (const piece of pieces) {
      const g = /^(\d[\d,]*)\s*GP$/i.exec(piece)
      if (g) {
        gold += Number(g[1].replace(/,/g, ''))
        continue
      }
      const q = /^(\d+)\s+(.*)$/.exec(piece)
      items.push(q ? { name: q[2], qty: Number(q[1]) } : { name: piece })
    }
    out[letter] = { items, gold }
  }
  return out
}

// Every "Level | ..." table on the page. The main one carries Proficiency Bonus
// and the feature names; classes with wide tables (Monk, Paladin, Ranger...)
// split the per-level columns into a second table, which is merged in.
function parseTables(lines) {
  const tables = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^Level \| /.test(lines[i])) continue
    const cols = splitRow(lines[i])
    const rows = []
    for (let j = i + 1; j < lines.length; j++) {
      const cells = splitRow(lines[j])
      if (!/^\d+$/.test(cells[0]) || cells.length < 2) break
      rows.push(cells)
    }
    if (rows.length >= 15) tables.push({ cols, rows })
  }
  return tables
}

function parseFeatureTable(lines) {
  const tables = parseTables(lines)
  const main = tables.find((t) => t.cols[1] === 'Proficiency Bonus')
  if (!main) throw new Error('feature table not found')
  const nameCol = main.cols.findIndex((c) => /Features$/.test(c))
  const extra = []
  for (let c = 0; c < main.cols.length; c++) {
    if (c === 0 || c === 1 || c === nameCol) continue
    extra.push({ name: main.cols[c], values: Object.fromEntries(main.rows.map((r) => [r[0], r[c] ?? ''])) })
  }
  for (const t of tables) {
    if (t === main) continue
    for (let c = 1; c < t.cols.length; c++) {
      extra.push({ name: t.cols[c], values: Object.fromEntries(t.rows.map((r) => [r[0], r[c] ?? ''])) })
    }
  }
  return { nameCol, rows: main.rows, extra }
}

function parseSections(lines) {
  const sections = []
  let cur = null
  for (const line of lines) {
    const m = /^Level (\d+): (.+)$/i.exec(line)
    if (m) {
      cur = { level: Number(m[1]), name: m[2].trim(), body: [] }
      sections.push(cur)
    } else if (cur && /^(Barbarian|[A-Z][a-z]+) Subclasses$/.test(line)) {
      cur = null
    } else if (cur) {
      cur.body.push(line)
    }
  }
  return sections
}

const ORDINAL = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6, '7th': 7, '8th': 8, '9th': 9 }
const columnKey = (name) =>
  ORDINAL[name] ? `spell_slots_level_${ORDINAL[name]}_by_level` : snake(name) + '_by_level'

const norm = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim()

function numeric(v) {
  const t = v.replace(/^\+/, '')
  return /^-?\d+$/.test(t) ? Number(t) : v
}

async function ingest(className, { write }) {
  const lines = await fetchPageLines(`${className}:main`)
  const display = className[0].toUpperCase() + className.slice(1)

  const core = parseCoreTraits(lines)
  const { nameCol, rows, extra } = parseFeatureTable(lines)
  const sections = parseSections(lines)

  // ── features by level (by id) and the per-level extra columns ──────────
  const sectionKey = (level, name) => `${level}:${name.toLowerCase()}`
  const sectionByKey = new Map(
    sections.map((s) => [sectionKey(s.level, s.name), s])
  )
  const nameCount = {}
  for (const s of sections) nameCount[s.name] = (nameCount[s.name] ?? 0) + 1

  const idFor = (name, level) =>
    `pub24_${className}-${slug(name)}${nameCount[name] > 1 ? `-l${level}` : ''}`

  const featuresByLevel = {}
  const published = []
  const catalog = {}
  const warnings = []
  const subclassLevels = []

  for (const cells of rows) {
    const level = Number(cells[0])
    for (const rawName of (cells[nameCol] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== '-' && s !== '—')) {
      if (/^Subclass feature$/i.test(rawName)) {
        subclassLevels.push(level)
        continue
      }
      if (/ Subclass$/i.test(rawName)) {
        subclassLevels.push(level)
        continue
      }
      if (SKIP_FEATURE.test(rawName)) continue
      // Table names carry qualifiers the section headings drop ("Action Surge
      // (One Use)", "Mystic Arcanum (Level 6 Spell)"), and the page mixes ’ and '.
      const baseName = rawName.replace(/\s*\(.*\)\s*$/, '')
      const sameLevel = (nm) =>
        sections.find((x) => x.level === level && norm(x.name) === norm(nm))
      const sec = sectionByKey.get(sectionKey(level, rawName)) ?? sameLevel(rawName) ?? sameLevel(baseName)
      let repeatOf = null
      if (!sec) {
        // The table lists a feature again at a later level (Metamagic 10th,
        // Expertise 9th...) to say you gain more of it; the page only has the
        // original "Level N: Name" text.
        repeatOf = sections.find(
          (x) =>
            x.level < level &&
            (norm(x.name) === norm(rawName) || norm(x.name) === norm(baseName))
        )
        if (!repeatOf)
          warnings.push(`no "Level ${level}: ${rawName}" section on the page`)
      }
      const id = repeatOf
        ? `pub24_${className}-${slug(rawName)}-l${level}`
        : idFor(rawName, level)
      ;(featuresByLevel[level] ??= []).push(id)
      catalog[id] = rawName
      published.push({
        id,
        name: rawName,
        category: 'class_feature',
        class: display,
        level_gained: level,
        description: sec
          ? sec.body.join('\n')
          : repeatOf
          ? `You gain more from this feature at this level; see "${repeatOf.name}" (level ${repeatOf.level}).\n${repeatOf.body.join('\n')}`
          : '',
        source: "Player's Handbook (2024)",
        ruleset: '2024',
        homebrew: false,
      })
    }
  }

  const levelWord = (n) => `${n}`
  const chassis = {
    name: display,
    ruleset: '2024',
    description: lines[1] ?? '',
    primary_ability: core['Primary Ability'] ?? null,
    saving_throw_proficiencies: parseSaves(
      core['Saving Throw Proficiencies'] ?? ''
    ),
    armor_proficiencies: parseArmor(core['Armor Training'] ?? ''),
    weapon_proficiencies: parseWeapons(core['Weapon Proficiencies'] ?? ''),
    weapon_proficiencies_text: core['Weapon Proficiencies'] ?? null,
    tool_proficiencies_text: core['Tool Proficiencies'] ?? null,
    skill_choices: parseSkills(core['Skill Proficiencies'] ?? ''),
    subclass_name: `${display} Subclass`,
    subclass_choice_level: Math.min(...subclassLevels.filter((l) => l)),
    subclass_feature_levels: [...new Set(subclassLevels)].sort((a, b) => a - b),
    spellcasting: CLASS_SPELLCASTING[className] ?? { type: 'none' },
    features_by_level: featuresByLevel,
    starting_equipment: parseEquipment(core['Starting Equipment'] ?? ''),
    ...Object.fromEntries(
      extra.map((e) => [
        columnKey(e.name),
        Object.fromEntries(
          Object.entries(e.values).map(([l, v]) => [
            l,
            // "-" in a spell-slot column means no slots of that level.
            /^[-—]$/.test(v) && /^spell_slots/.test(columnKey(e.name)) ? 0 : numeric(v),
          ])
        ),
      ])
    ),
  }

  console.log(
    `\n${display}: ${rows.length} levels, ${published.length} features, ${extra.length} extra columns (${extra.map((e) => e.name).join(', ')})`
  )
  console.log(
    `subclass levels: ${chassis.subclass_feature_levels.join(', ')}  saves: ${chassis.saving_throw_proficiencies.join(',')}  armor: ${chassis.armor_proficiencies.join(',')}  weapons: ${chassis.weapon_proficiencies.join(',')}`
  )
  if (warnings.length) console.log('WARNINGS:\n  ' + warnings.join('\n  '))
  void levelWord

  if (!write) {
    console.log(JSON.stringify(chassis, null, 2).slice(0, 2500))
    return
  }

  const outFile = path.join(
    ROOT,
    'engine',
    'data',
    '5e2024',
    'classes',
    `${className}.json`
  )
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  if (fs.existsSync(outFile)) {
    // Keep a hand-written description on a re-run.
    const prev = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    for (const k of ['description_override'])
      if (prev[k]) chassis[k] = prev[k]
  }
  fs.writeFileSync(outFile, JSON.stringify(chassis, null, 2) + '\n')

  const pubFile = path.join(ROOT, 'src', 'data', 'published_features.json')
  const pub = JSON.parse(fs.readFileSync(pubFile, 'utf8'))
  const mine = new RegExp(`^pub24_${className}-`)
  const kept = pub.filter((e) => !mine.test(e.id ?? ''))
  fs.writeFileSync(
    pubFile,
    JSON.stringify([...kept, ...published], null, 2) + '\n'
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
  console.log('written.')
}

if (require.main === module) {
  const cls = process.argv[2]
  if (!cls) {
    console.error('usage: node scripts/ingest-2024-class.js <class> [--write]')
    process.exit(1)
  }
  ingest(cls.toLowerCase(), { write: process.argv.includes('--write') }).catch(
    (e) => {
      console.error(e)
      process.exit(1)
    }
  )
}

module.exports = { ingest, parseSections, slug, snake, splitRow }
