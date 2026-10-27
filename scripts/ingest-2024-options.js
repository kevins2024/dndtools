// Drafts the 2024 option lists that classes pick from — Metamagic, Eldritch
// Invocations, Battle Master maneuvers — and the 2024 weapon table (with Mastery
// properties), from dnd2024.wikidot.com.
//
//   node scripts/ingest-2024-options.js metamagic|invocations|maneuvers|weapons [--write]
//
// Output shapes match the 2014 files in engine/data/5e/ so the engine modules
// (metamagic.js, invocations.js, maneuvers.js, weapons.js) can serve either.

const fs = require('fs')
const path = require('path')
const { fetchPage } = require('./fetch-2024-wikidot')
const { slug, splitRow } = require('./ingest-2024-class')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'engine', 'data', '5e2024')

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

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

// Pages that list options as "Name / Source: .. / [Cost|Prerequisite: ..] / text..."
// open with a table of contents of exactly those names.
function entriesFromToc(lines) {
  const start = lines.findIndex((l) => /^Table of Contents$/i.test(l))
  const names = []
  for (let i = start + 1; i < lines.length; i++) {
    if (
      /^(Metamagic Options|Eldritch Invocations?)$/i.test(lines[i]) &&
      names.length
    )
      break
    // The table of contents ends where the first entry's own heading repeats a name.
    if (lines[i].length > 40 || names.includes(lines[i])) break
    names.push(lines[i])
  }
  const entries = []
  let from = start + 1 + names.length
  const positions = []
  for (const n of names) {
    const idx = lines.findIndex(
      (l, i) => i >= from && l === n && /^Source:/.test(lines[i + 1] ?? '')
    )
    if (idx < 0) continue
    positions.push({ name: n, idx })
    from = idx + 1
  }
  positions.forEach((p, k) => {
    const end = positions[k + 1]?.idx ?? lines.length
    entries.push({ name: p.name, body: lines.slice(p.idx + 1, end) })
  })
  return entries
}

async function metamagic(write) {
  const { lines } = await fetchPage('sorcerer:metamagic')
  const options = {}
  const published = []
  const catalog = {}
  for (const e of entriesFromToc(lines)) {
    const source = /^Source:\s*(.*)$/.exec(e.body[0])?.[1] ?? null
    const cost = /^Cost:\s*(.*)$/.exec(e.body[1])?.[1] ?? null
    const text = e.body
      .slice(cost ? 2 : 1)
      .filter((l) => !/^(Help|Terms of Service)/.test(l))
    const id = `pub24_metamagic-${slug(e.name)}`
    options[e.name] = {
      source: `${source} (2024)`,
      id,
      cost,
      ruleset: '2024',
      description: text.join('\n'),
    }
    catalog[id] = `Metamagic: ${e.name}`
    published.push({
      id,
      name: `Metamagic: ${e.name}`,
      category: 'metamagic_option',
      cost,
      description: text.join('\n'),
      source: `${source} (2024)`,
      ruleset: '2024',
      homebrew: false,
    })
  }
  console.log(
    `metamagic: ${Object.keys(options).length} options`,
    Object.keys(options).join(', ')
  )
  if (!write) return
  writeJson(path.join(OUT, 'metamagic.json'), { Sorcerer: options })
  mergeFeatures('pub24_metamagic-', published, catalog)
}

function parseInvocationPrereq(text) {
  if (!text) return null
  const all = []
  let leftover = text
  leftover = leftover.replace(/Level (\d+)\+ Warlock/i, (_, n) => {
    all.push({ type: 'level', className: 'Warlock', level: Number(n) })
    return ''
  })
  leftover = leftover.replace(/([A-Z][A-Za-z' ]+?) Invocation/g, (_, n) => {
    all.push({ type: 'feature', feature: n.trim() })
    return ''
  })
  leftover = leftover.replace(
    /a Warlock Cantrip That Deals Damage( via an Attack Roll)?/i,
    (_, atk) => {
      all.push({ type: 'warlock_damage_cantrip', attack_roll: !!atk })
      return ''
    }
  )
  if (leftover.replace(/[,\s]+/g, '')) all.push({ type: 'unknown', text })
  return all.length === 1 ? all[0] : { type: 'all_of', all }
}

async function invocations(write) {
  const { lines } = await fetchPage('warlock:eldritch-invocation')
  const out = {}
  const published = []
  const catalog = {}
  for (const e of entriesFromToc(lines)) {
    const source = /^Source:\s*(.*)$/.exec(e.body[0])?.[1] ?? null
    const preLine = /^Prerequisite:\s*(.*)$/.exec(e.body[1] ?? '')
    const text = e.body
      .slice(preLine ? 2 : 1)
      .filter((l) => !/^(Help|Terms of Service)/.test(l))
    const id = `pub24_invocation-${slug(e.name)}`
    const pre = parseInvocationPrereq(preLine?.[1] ?? null)
    out[e.name] = {
      source: `${source} (2024)`,
      id,
      ruleset: '2024',
      level:
        pre?.type === 'level'
          ? pre.level
          : (pre?.all?.find((p) => p.type === 'level')?.level ?? 1),
      prerequisite: pre,
      prerequisite_text: preLine?.[1] ?? null,
      repeatable: text.some((l) => /^Repeatable\./i.test(l)),
      description: text.join('\n'),
    }
    catalog[id] = e.name
    published.push({
      id,
      name: e.name,
      category: 'warlock_invocation',
      description: text.join('\n'),
      prerequisite: preLine?.[1] ?? null,
      source: `${source} (2024)`,
      ruleset: '2024',
      homebrew: false,
    })
  }
  const unknown = Object.entries(out).filter(([, v]) =>
    JSON.stringify(v.prerequisite).includes('unknown')
  )
  console.log(
    `invocations: ${Object.keys(out).length}`,
    unknown.length ? `UNPARSED prereqs: ${unknown.map(([n]) => n)}` : ''
  )
  if (!write) return
  writeJson(path.join(OUT, 'invocations.json'), out)
  mergeFeatures('pub24_invocation-', published, catalog)
}

async function maneuvers(write) {
  const { lines } = await fetchPage('fighter:battle-master')
  const start = lines.findIndex((l) => l === 'Maneuver Options')
  const out = {}
  const published = []
  const catalog = {}
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^([A-Z][A-Za-z’' ]{2,30})\.$/.exec(lines[i])
    if (!m) continue
    const name = m[1].replace(/’/g, "'")
    const body = []
    for (
      let j = i + 1;
      j < lines.length &&
      !/^[A-Z][A-Za-z’' ]{2,30}\.$/.test(lines[j]) &&
      !/^(Help|Terms of Service|Powered)/.test(lines[j]);
      j++
    )
      body.push(lines[j])
    const id = `pub24_maneuver-${slug(name)}`
    out[name] = {
      source: "Player's Handbook (2024)",
      id,
      ruleset: '2024',
      description: body.join('\n'),
    }
    catalog[id] = name
    published.push({
      id,
      name,
      category: 'maneuver',
      description: body.join('\n'),
      source: "Player's Handbook (2024)",
      ruleset: '2024',
      homebrew: false,
    })
    i += body.length
  }
  console.log(
    `maneuvers: ${Object.keys(out).length}`,
    Object.keys(out).join(', ')
  )
  if (!write) return
  writeJson(path.join(OUT, 'maneuvers.json'), { Fighter: out })
  mergeFeatures('pub24_maneuver-', published, catalog)
}

// Weapons table -> the 2014 weapons.json shape plus mastery & property flags.
async function weapons(write) {
  const { lines } = await fetchPage('equipment:weapon')
  const table = {}
  let category = null
  let kind = null
  for (const l of lines) {
    let m
    if ((m = /^(Simple|Martial) (Melee|Ranged) Weapons$/.exec(l))) {
      category = m[1].toLowerCase()
      kind = m[2].toLowerCase()
      continue
    }
    if (/^Weapon Properties$/.test(l)) break
    const cells = splitRow(l)
    if (!category || cells.length < 5 || cells[0] === 'Name') continue
    const [name, damage, props, mastery] = cells
    const dm = /^(\d+d\d+|\d+) (Bludgeoning|Piercing|Slashing)/i.exec(damage)
    if (!dm) continue
    const has = (p) => new RegExp(`(^|, )${p}`, 'i').test(props)
    const versatile = /Versatile \((\d+d\d+)\)/i.exec(props)
    const thrown = /Thrown \(Range (\d+)\/(\d+)\)/i.exec(props)
    const ammo = /Ammunition \(Range (\d+)\/(\d+)/i.exec(props)
    const entry = {
      weapon_type: kind,
      damage_dice: dm[1],
      damage_type: dm[2].toLowerCase(),
      category,
      finesse: has('Finesse'),
      versatile: !!versatile,
      mastery: mastery.toLowerCase(),
      properties:
        props === '—' || props === '-'
          ? []
          : props.split(/,\s*(?![^(]*\))/).map((p) => p.trim()),
    }
    if (versatile) entry.damage_dice_2h = versatile[1]
    if (thrown)
      entry.thrown = { normal: Number(thrown[1]), long: Number(thrown[2]) }
    if (ammo) entry.range = { normal: Number(ammo[1]), long: Number(ammo[2]) }
    for (const p of ['Heavy', 'Light', 'Reach', 'Loading'])
      if (has(p)) entry[p.toLowerCase()] = true
    if (has('Two-Handed')) entry.two_handed = true
    table[name.toLowerCase()] = entry
  }
  console.log(`weapons: ${Object.keys(table).length}`)
  if (!write) return
  writeJson(path.join(OUT, 'weapons.json'), {
    _schema: {
      note: "2024 Player's Handbook weapon table (dnd2024.wikidot.com equipment:weapon), same keys/fields as engine/data/5e/weapons.json plus `mastery` (the weapon's mastery property), `properties` (the printed list), and flags heavy/light/reach/loading/two_handed, `range` for Ammunition weapons.",
    },
    ...table,
  })
}

if (require.main === module) {
  const kind = process.argv[2]
  const run = { metamagic, invocations, maneuvers, weapons }[kind]
  if (!run) {
    console.error(
      'usage: node scripts/ingest-2024-options.js metamagic|invocations|maneuvers|weapons [--write]'
    )
    process.exit(1)
  }
  run(process.argv.includes('--write')).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
