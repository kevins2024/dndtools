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

function parseWeapons(text) {
  const t = text.toLowerCase()
  const out = []
  if (/simple/.test(t)) out.push('simple')
  if (/martial/.test(t)) out.push('martial')
  return out
}

function parseSkills(text) {
  const m = /Choose (?:any )?(\d+)(?::\s*(.*))?$/i.exec(text)
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

// "(A) Greataxe, 4 Handaxes, Explorer’s Pack, and 15 GP; or (B) 75 GP"
function parseEquipment(text) {
  const pick = (re) => {
    const m = re.exec(text)
    return m ? m[1].trim() : null
  }
  const a = pick(/\(A\)\s*(.*?)(?:;\s*or\s*\(B\)|$)/i)
  const b = pick(/\(B\)\s*(.*)$/i)
  const parsePkg = (s) => {
    if (!s) return null
    let gold = 0
    const items = []
    for (const part of s
      .replace(/\band\b/g, ',')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)) {
      const g = /^(\d[\d,]*)\s*GP$/i.exec(part)
      if (g) {
        gold += Number(g[1].replace(/,/g, ''))
        continue
      }
      const q = /^(\d+)\s+(.*)$/.exec(part)
      items.push(q ? { name: q[2], qty: Number(q[1]) } : { name: part })
    }
    return { items, gold }
  }
  return { raw: text, A: parsePkg(a), B: parsePkg(b) }
}

function parseFeatureTable(lines, className) {
  const head = lines.findIndex(
    (l) =>
      /^Level \| Proficiency Bonus \| Features/.test(l) &&
      !/Class Features$/.test(l)
  )
  if (head < 0) throw new Error('feature table not found')
  const cols = splitRow(lines[head])
  const rows = []
  for (let i = head + 1; i < lines.length; i++) {
    const cells = splitRow(lines[i])
    if (!/^\d+$/.test(cells[0]) || cells.length < 3) break
    rows.push(cells)
  }
  return { cols, rows }
}

function parseSections(lines) {
  const sections = []
  let cur = null
  for (const line of lines) {
    const m = /^Level (\d+): (.+)$/.exec(line)
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

function numeric(v) {
  const t = v.replace(/^\+/, '')
  return /^-?\d+$/.test(t) ? Number(t) : v
}

async function ingest(className, { write }) {
  const lines = await fetchPageLines(`${className}:main`)
  const display = className[0].toUpperCase() + className.slice(1)

  const core = parseCoreTraits(lines)
  const { cols, rows } = parseFeatureTable(lines, display)
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
  const extraCols = cols.slice(3)
  const extras = Object.fromEntries(extraCols.map((c) => [c, {}]))
  const subclassLevels = []

  for (const cells of rows) {
    const level = Number(cells[0])
    for (const c of extraCols.keys())
      extras[extraCols[c]][level] = numeric(cells[3 + c] ?? '')
    for (const rawName of cells[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (/^Subclass feature$/i.test(rawName)) {
        subclassLevels.push(level)
        continue
      }
      if (/ Subclass$/i.test(rawName)) {
        subclassLevels.push(level)
        continue
      }
      if (SKIP_FEATURE.test(rawName)) continue
      const sec = sectionByKey.get(sectionKey(level, rawName))
      if (!sec)
        warnings.push(`no "Level ${level}: ${rawName}" section on the page`)
      const id = idFor(rawName, level)
      ;(featuresByLevel[level] ??= []).push(id)
      catalog[id] = rawName
      published.push({
        id,
        name: rawName,
        category: 'class_feature',
        class: display,
        level_gained: level,
        description: sec ? sec.body.join('\n') : '',
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
    skill_choices: parseSkills(core['Skill Proficiencies'] ?? ''),
    subclass_name: `${display} Subclass`,
    subclass_choice_level: Math.min(...subclassLevels.filter((l) => l)),
    subclass_feature_levels: [...new Set(subclassLevels)].sort((a, b) => a - b),
    spellcasting: { type: 'none' },
    features_by_level: featuresByLevel,
    starting_equipment: parseEquipment(core['Starting Equipment'] ?? ''),
    ...Object.fromEntries(extraCols.map((c) => [snake(c) + '_by_level', extras[c]])),
  }

  console.log(
    `\n${display}: ${rows.length} levels, ${published.length} features, ${Object.keys(extras).length} extra columns (${extraCols.join(', ')})`
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
    // Keep hand-authored fields (spellcasting, mechanics tables) on a re-run.
    const prev = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    for (const k of ['spellcasting', 'description_override'])
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
