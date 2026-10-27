// Drafts the 2024 species, backgrounds and feats from dnd2024.wikidot.com.
//
//   node scripts/ingest-2024-origins.js species            # dry run, lists what it would write
//   node scripts/ingest-2024-origins.js species --write
//   node scripts/ingest-2024-origins.js backgrounds --write
//   node scripts/ingest-2024-origins.js feats --write
//   ... --source "Eberron - Forge of the Artificer"        # another official book (default: Player's Handbook)
//
// Writes engine/data/5e2024/{species,backgrounds,feats}.json, one published_features.json entry per trait/
// feat (ruleset "2024") and its feature-catalog.json id. Hand-written mechanics (darkvision numbers, skill
// grants, spells...) live in separate *-grants.json files the engine merges in, so re-running this never
// loses them. See 2024_CONVERSION_PLAN.md.

const fs = require('fs')
const path = require('path')
const { fetchPage } = require('./fetch-2024-wikidot')
const { slug, snake, splitRow } = require('./ingest-2024-class')

const ROOT = path.join(__dirname, '..')
const DATA_2024 = path.join(ROOT, 'engine', 'data', '5e2024')
const ABILITY = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

async function listPages(kind) {
  const html = await (
    await fetch(`https://dnd2024.wikidot.com/${kind}:all`)
  ).text()
  return [
    ...new Set(
      [...html.matchAll(new RegExp(`href="/(${kind}:[^"#]+)"`, 'g'))].map(
        (m) => m[1]
      )
    ),
  ]
}

async function pagesFromSource(kind, source) {
  const out = []
  const slugs = await listPages(kind)
  // modest concurrency so the site isn't hammered
  for (let i = 0; i < slugs.length; i += 8) {
    const batch = await Promise.all(
      slugs.slice(i, i + 8).map((s) =>
        fetchPage(s)
          .then((p) => ({ slug: s, ...p }))
          .catch(() => null)
      )
    )
    for (const p of batch) if (p && p.source === source) out.push(p)
  }
  return out
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

// Replace every published/catalog entry whose id starts with `prefix`, then add the new ones.
function mergeFeatures(prefix, published, catalog) {
  const pubFile = path.join(ROOT, 'src', 'data', 'published_features.json')
  const pub = JSON.parse(fs.readFileSync(pubFile, 'utf8'))
  writeJson(pubFile, [
    ...pub.filter((e) => !(e.id ?? '').startsWith(prefix)),
    ...published,
  ])
  const catFile = path.join(
    ROOT,
    'engine',
    'data',
    '5e',
    'feature-catalog.json'
  )
  const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'))
  for (const k of Object.keys(cat)) if (k.startsWith(prefix)) delete cat[k]
  writeJson(catFile, { ...cat, ...catalog })
}

// ── species ───────────────────────────────────────────────────────────

// "Name. Description..." paragraph -> { name, description }
function splitTrait(line) {
  const m = /^([A-Z][A-Za-z’' -]{2,40})\.\s+(.*)$/.exec(line)
  return m ? { name: m[1].trim(), description: m[2].trim() } : null
}

function parseSpecies(title, source, lines) {
  // A species page can interleave another book's variant (Lorwyn elves...),
  // introduced by its own "Source:" line. Lore is read up to that line; the
  // "<Species> Traits" block is found wherever it sits and read to the end of
  // the traits, skipping table rows that belong to the other book.
  const secondSource = lines.findIndex((l, i) => i > 0 && /^Source:/.test(l))
  const traitsAt = lines.findIndex((l) =>
    new RegExp(`^${title} Traits$`, 'i').test(l)
  )
  const loreEnd = [secondSource, traitsAt].filter((i) => i > 0)
  const out = {
    name: title,
    ruleset: '2024',
    source: `${source} (2024)`,
    description: lines
      .slice(1, loreEnd.length ? Math.min(...loreEnd) : 3)
      .join('\n'),
    creature_type: null,
    size: null,
    speed: null,
    traits: [],
    tables: [],
  }
  const body = lines
  if (traitsAt < 0) return out
  const tail = body.slice(traitsAt + 1)
  let table = null
  for (let i = 0; i < tail.length; i++) {
    const l = tail[i]
    let m
    if ((m = /^Creature Type:\s*(.*)$/.exec(l))) out.creature_type = m[1]
    else if ((m = /^Size:\s*(.*)$/.exec(l))) out.size = m[1]
    else if ((m = /^Speed:\s*(\d+)/.exec(l))) out.speed = Number(m[1])
    else if (/^Source:/.test(l)) break
    else if (l.includes(' | ')) {
      if (/lorwyn|shadowmoor|eberron|ravenloft|faerun/i.test(l.split(' | ')[0]))
        continue
      if (!table) {
        table = { title: tail[i - 1], rows: [] }
        out.tables.push(table)
      }
      table.rows.push(splitRow(l))
    } else {
      table = null
      const t = splitTrait(l)
      if (t) out.traits.push(t)
      else if (out.traits.length && !/^As an? /.test(l) && l.length > 25) {
        // continuation paragraph of the previous trait
        out.traits[out.traits.length - 1].description += '\n' + l
      }
    }
  }
  return out
}

async function ingestSpecies(source, write) {
  const pages = await pagesFromSource('species', source)
  const species = []
  const published = []
  const catalog = {}
  for (const p of pages) {
    const sp = parseSpecies(p.title, source, p.lines)
    for (const t of sp.traits) {
      t.id = `pub24_species_${slug(sp.name)}-${slug(t.name)}`
      // Rules the engine applies from the trait itself (not parsed from its prose).
      if (t.name === 'Dwarven Toughness') t.grants_hp_per_level = 1
      catalog[t.id] = t.name
      published.push({
        id: t.id,
        name: t.name,
        category: 'speciesTrait',
        species: sp.name,
        description: t.description,
        source: sp.source,
        ruleset: '2024',
        homebrew: false,
      })
    }
    species.push(sp)
    console.log(
      `${sp.name}: ${sp.traits.length} traits [${sp.traits
        .map((t) => t.name)
        .join(', ')}] speed ${sp.speed} ${sp.size}`
    )
  }
  if (!write) return
  const file = path.join(DATA_2024, 'species.json')
  // other books' species already in the file stay; this source's are replaced
  const prev = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : []
  const keep = prev.filter((s) => !species.some((n) => n.name === s.name))
  writeJson(
    file,
    [...keep, ...species].sort((a, b) => a.name.localeCompare(b.name))
  )
  mergeFeatures('pub24_species_', published, catalog)
  console.log('written.')
}

// ── backgrounds ───────────────────────────────────────────────────────

function parseEquipment(text) {
  const clean = text.replace(/[’]/g, "'")
  const parts = clean.split(/;?\s*(?:or\s*)?\(([A-C])\)\s*/).slice(1)
  const out = { raw: clean }
  for (let i = 0; i < parts.length; i += 2) {
    let gold = 0
    const items = []
    for (const piece of parts[i + 1]
      .replace(/\band\b/g, ',')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)) {
      const g = /^(\d[\d,]*)\s*GP$/i.exec(piece)
      if (g) gold += Number(g[1].replace(/,/g, ''))
      else {
        const q = /^(\d+)\s+(.*)$/.exec(piece)
        items.push(q ? { name: q[2], qty: Number(q[1]) } : { name: piece })
      }
    }
    out[parts[i]] = { items, gold }
  }
  return out
}

async function ingestBackgrounds(source, write) {
  const pages = await pagesFromSource('background', source)
  const out = []
  const published = []
  const catalog = {}
  for (const p of pages) {
    const get = (label) => {
      const l = p.lines.find((x) => x.startsWith(`${label}:`))
      return l ? l.slice(label.length + 1).trim() : null
    }
    const abilities = (get('Ability Scores') ?? '')
      .split(',')
      .map((a) => ABILITY[a.trim().toLowerCase()])
      .filter(Boolean)
    const tool = get('Tool Proficiency') ?? ''
    const bg = {
      name: p.title,
      ruleset: '2024',
      source: `${source} (2024)`,
      description: p.lines[1] ?? '',
      ability_scores: abilities,
      feat: get('Feat'),
      skill_proficiencies: (get('Skill Proficiencies') ?? '')
        .split(/ and |, /)
        .map((s) => snake(s.trim()))
        .filter(Boolean),
      tool_proficiency: /^Choose/i.test(tool)
        ? {
            choose: tool
              .replace(/^Choose one kind of /i, '')
              .replace(/^Choose one /i, ''),
          }
        : { fixed: [tool] },
      equipment: parseEquipment(get('Equipment') ?? ''),
    }
    out.push(bg)
    console.log(
      `${bg.name}: ${bg.ability_scores.join('/')} | ${
        bg.feat
      } | ${bg.skill_proficiencies.join(', ')} | ${JSON.stringify(
        bg.tool_proficiency
      )}`
    )
  }
  void published
  void catalog
  if (!write) return
  const file = path.join(DATA_2024, 'backgrounds.json')
  const prev = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : []
  const keep = prev.filter((b) => !out.some((n) => n.name === b.name))
  writeJson(
    file,
    [...keep, ...out].sort((a, b) => a.name.localeCompare(b.name))
  )
  console.log('written.')
}

// ── feats ─────────────────────────────────────────────────────────────

const FEAT_HEADINGS = {
  'Origin Feats': 'origin',
  'General Feats': 'general',
  'Fighting Style Feats': 'fighting_style',
  'Epic Boon Feats': 'epic_boon',
  'Dragonmark Feats': 'dragonmark',
  'Planar Pact Feats': 'planar_pact',
  'Dark Gift Feats': 'dark_gift',
}
const TAB_LABELS = new Set([
  'Common',
  'Faerun',
  'Eberron',
  'Exotic',
  'Ravenloft',
  'Arcana Unleashed',
  'Project Lamordia',
  'Name',
])

async function featCategories() {
  const lines = (await fetchPage('feat:all')).lines
  const byName = {}
  let cat = null
  for (const l of lines) {
    if (FEAT_HEADINGS[l]) cat = FEAT_HEADINGS[l]
    else if (cat && !TAB_LABELS.has(l) && l.length < 60) byName[l] = cat
  }
  return byName
}

// Prerequisite line -> the engine's prerequisite shape (featPrerequisites.js),
// or { type: 'unknown', text } when any part isn't recognised (evaluated
// permissively, and the raw text is always kept).
function parsePrerequisite(text) {
  if (!text) return { raw: null, parsed: null }
  // The wiki has a stray trailing ")" on one page (Polearm Master).
  let rest = text.replace(/\u00a0/g, ' ').replace(/^([^(]*)\)$/, '$1')
  const all = []
  const take = (re, fn) => {
    rest = rest.replace(re, (...m) => {
      all.push(fn(m))
      return ' '
    })
  }
  const AB = '(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)'
  take(/Level (\d+)\+/, (m) => ({ type: 'character_level', min: Number(m[1]) }))
  // "Strength or Dexterity 13+", "Intelligence, Wisdom, or Charisma 13+"
  take(new RegExp(`((?:${AB}(?:, | or |, or ))+${AB}) (\\d+)\\+`), (m) => ({
    type: 'any_of',
    options: m[1]
      .split(/, or |, | or /)
      .map((a) => ({
        ability: ABILITY[a.trim().toLowerCase()],
        min: Number(m[2]),
      })),
  }))
  take(new RegExp(`(${AB}) (\\d+)\\+`), (m) => ({
    type: 'ability_score',
    ability: ABILITY[m[1].toLowerCase()],
    min: Number(m[2]),
  }))
  take(/Spellcasting or Pact Magic feature/i, () => ({ type: 'spellcasting' }))
  take(/(?:Proficiency with )?(Light|Medium|Heavy) Armor Training/i, (m) => ({
    type: 'proficiency',
    proficiency: `${m[1].toLowerCase()}_armor`,
  }))
  take(/Shield Training/i, () => ({
    type: 'proficiency',
    proficiency: 'shields',
  }))
  take(/Martial Weapon Proficiency/i, () => ({
    type: 'proficiency',
    proficiency: 'martial_weapon',
  }))
  take(/Fighting Style feature/i, () => ({ type: 'fighting_style_feature' }))
  const leftover = rest.replace(/[,\s]+/g, ' ').trim()
  if (leftover) return { raw: text, parsed: { type: 'unknown', text } }
  return {
    raw: text,
    parsed: all.length === 1 ? all[0] : { type: 'all_of', all },
  }
}

async function ingestFeats(source, write) {
  const cats = await featCategories()
  const pages = await pagesFromSource('feat', source)
  const feats = {}
  const published = []
  const catalog = {}
  for (const p of pages) {
    const body = p.lines.slice(1)
    // Prerequisites are either their own "Prerequisite: ..." line or, on Epic
    // Boon pages, folded into a heading line: "Epic Boon Feat (Prerequisite: Level 19+)".
    const pre =
      /^Prerequisite:\s*(.*)$/.exec(body[0] ?? '') ??
      /^[A-Za-z ]+ Feat \(Prerequisite:\s*(.*)\)$/.exec(body[0] ?? '')
    const { raw, parsed } = parsePrerequisite(pre?.[1] ?? null)
    const text = body.slice(pre ? 1 : 0)
    // "Increase your Strength or Dexterity score by 1, to a maximum of 20." /
    // "Increase one ability score of your choice by 1, to a maximum of 30." /
    // "Choose one ability in which you lack saving throw proficiency. Increase that ability by 1..."
    const asiLine = text.find((l) => /^Ability Score Increase\./i.test(l))
    let abilityIncrease = null
    if (asiLine) {
      const cap = /maximum of (\d+)/.exec(asiLine)
      const amount = Number(/by (\d)/.exec(asiLine)?.[1] ?? 1)
      const named = /Increase (?:your )?(.+?)(?: score)? by/i.exec(asiLine)
      let options = null
      if (
        /one ability (?:score )?of your choice|that ability by|one ability in which/i.test(
          asiLine
        )
      ) {
        options = Object.values(ABILITY)
      } else if (named) {
        options = named[1]
          .split(/,\s*|\s+or\s+/i)
          .map((a) => ABILITY[a.trim().toLowerCase()])
          .filter(Boolean)
      }
      if (options?.length) {
        abilityIncrease = {
          choice_of: options,
          amount,
          max_score: cap ? Number(cap[1]) : 20,
        }
      }
    }
    const id = `pub24_feat-${slug(p.title)}`
    const feat = {
      id,
      source: `${source} (2024)`,
      ruleset: '2024',
      category: cats[p.title] ?? null,
      prerequisite: parsed,
      prerequisite_text: raw,
      repeatable: text.some((l) => /^Repeatable\./i.test(l)),
      description: text.join('\n'),
    }
    if (abilityIncrease) feat.ability_score_increase = abilityIncrease
    feats[p.title] = feat
    catalog[id] = p.title
    published.push({
      id,
      name: p.title,
      category: 'feat',
      feat_category: feat.category,
      description: feat.description,
      prerequisite: raw,
      source: feat.source,
      ruleset: '2024',
      homebrew: false,
    })
  }
  const byCat = {}
  for (const f of Object.values(feats))
    byCat[f.category] = (byCat[f.category] ?? 0) + 1
  console.log(`${Object.keys(feats).length} feats from ${source}:`, byCat)
  const unknown = Object.entries(feats).filter(
    ([, f]) => f.prerequisite?.type === 'unknown'
  )
  if (unknown.length)
    console.log(
      'prerequisites kept as text:',
      unknown.map(([n, f]) => `${n} (${f.prerequisite_text})`).join('; ')
    )
  const uncategorised = Object.entries(feats)
    .filter(([, f]) => !f.category)
    .map(([n]) => n)
  if (uncategorised.length)
    console.log('NO CATEGORY:', uncategorised.join(', '))
  if (!write) return
  const file = path.join(DATA_2024, 'feats.json')
  const prev = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {}
  const merged = { ...prev, ...feats }
  writeJson(
    file,
    Object.fromEntries(
      Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))
    )
  )
  mergeFeatures('pub24_feat-', published, catalog)
  console.log('written.')
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const kind = args[0]
  const i = args.indexOf('--source')
  const source = i >= 0 ? args[i + 1] : "Player's Handbook"
  const write = args.includes('--write')
  const run = {
    species: ingestSpecies,
    backgrounds: ingestBackgrounds,
    feats: ingestFeats,
  }[kind]
  if (!run) {
    console.error(
      'usage: node scripts/ingest-2024-origins.js species|backgrounds|feats [--source "<book>"] [--write]'
    )
    process.exit(1)
  }
  run(source, write).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
