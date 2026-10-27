// Drafts the 2024 spell list from dnd2024.wikidot.com into src/data/spells_2024.json.
//
//   node scripts/ingest-2024-spells.js            # dry run: counts and a sample
//   node scripts/ingest-2024-spells.js --write
//   node scripts/ingest-2024-spells.js --source "Forgotten Realms - Heroes of Faerun" --write   # add another official book
//
// One record per spell in the same shape the 2014 caches use (name, level, school,
// casting_time, range, components, material, duration, concentration, ritual,
// description, higher_level, classes, attack_type) plus `source` and
// `ruleset: "2024"`. The class list comes from the page's own "(Sorcerer, Wizard)"
// tag, so it follows the 2024 spell lists. Default source is the Player's Handbook;
// other books' spells are merged in by name when --source is given.

const fs = require('fs')
const path = require('path')
const { fetchPage } = require('./fetch-2024-wikidot')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'src', 'data', 'spells_2024.json')
const REFUSED = /unearthed|arcana unleashed|homebrew|third.?party/i

async function listSlugs() {
  const html = await (
    await fetch('https://dnd2024.wikidot.com/spell:all')
  ).text()
  return [
    ...new Set([...html.matchAll(/href="\/(spell:[^"#]+)"/g)].map((m) => m[1])),
  ].filter((s) => !/-school$|^spell:all$/.test(s))
}

// The wiki title-cases page titles ("Cone Of Cold"); the book doesn't.
const SMALL_WORDS = new Set([
  'Of',
  'And',
  'With',
  'The',
  'To',
  'In',
  'From',
  'For',
  'On',
  'At',
  'By',
  'Or',
])
const fixCase = (name) =>
  name
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w.toLowerCase() : w))
    .join(' ')

function parseSpell(title, source, lines) {
  const head = lines[1] ?? ''
  let m = /^Level (\d) ([A-Za-z]+) \(([^)]*)\)$/.exec(head)
  let level
  let school
  let classes
  if (m) {
    level = Number(m[1])
    school = m[2]
    classes = m[3]
  } else if ((m = /^([A-Za-z]+) Cantrip \(([^)]*)\)$/.exec(head))) {
    level = 0
    school = m[1]
    classes = m[2]
  } else return null
  // A few pages say "Component:" for "Components:".
  const field = (label) => {
    const l = lines.find((x) => new RegExp(`^${label}s?:`).test(x))
    return l ? l.replace(/^[^:]+:\s*/, '').trim() : null
  }
  // One page capitalises units ("1 Hour", "60 Feet", "10 Days"); the book doesn't.
  const lowerUnits = (t) =>
    t?.replace(
      /\b(Hours?|Minutes?|Rounds?|Days?|Feet|Miles?|Mile|Foot)\b/g,
      (m) => m.toLowerCase()
    ) ?? t
  // One page says "1 Action"; every other says "Action".
  const castingTime = lowerUnits(
    field('Casting Time')?.replace(/^1 (Action|Bonus Action)\b/, '$1') ?? null
  )
  // (Yolande's Regal Presence reads "Components: Component: V, S, M".)
  const comps = (field('Component') ?? '').replace(/^Components?:\s*/, '')
  const duration = lowerUnits(field('Duration') ?? '')
  const body = lines.slice(
    lines.findIndex((l) => l.startsWith('Duration:')) + 1
  )
  const higher = body.filter((l) =>
    /^(Using a Higher-Level Spell Slot|Cantrip Upgrade)\./.test(l)
  )
  const text = body.filter((l) => !higher.includes(l))
  const material = /\(([^)]*)\)/.exec(comps)?.[1] ?? null
  const description = text.join('\n')
  return {
    name: fixCase(title),
    level,
    school,
    casting_time: castingTime,
    range: lowerUnits(field('Range')),
    components: comps
      .replace(/\s*\(.*\)$/, '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    ...(material ? { material } : {}),
    duration,
    concentration: /^Concentration/i.test(duration),
    ritual: /\bRitual\b/.test(castingTime ?? ''),
    description,
    ...(higher.length ? { higher_level: higher.join('\n') } : {}),
    classes: classes
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    ...(/ranged spell attack/i.test(description)
      ? { attack_type: 'ranged' }
      : /melee spell attack/i.test(description)
      ? { attack_type: 'melee' }
      : {}),
    source: `${source} (2024)`,
    ruleset: '2024',
    homebrew: false,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--source')
  const source = i >= 0 ? args[i + 1] : "Player's Handbook"
  if (REFUSED.test(source))
    throw new Error(`"${source}" is not an official 2024-rules book`)
  const slugs = await listSlugs()
  const spells = []
  const skipped = []
  for (let k = 0; k < slugs.length; k += 8) {
    const batch = await Promise.all(
      slugs.slice(k, k + 8).map((s) =>
        fetchPage(s)
          .then((p) => ({ slug: s, ...p }))
          .catch(() => null)
      )
    )
    for (const p of batch) {
      if (!p || p.source !== source) continue
      const sp = parseSpell(p.title, source, p.lines)
      if (sp) spells.push(sp)
      else skipped.push(p.slug)
    }
  }
  const byLevel = {}
  for (const s of spells) byLevel[s.level] = (byLevel[s.level] ?? 0) + 1
  console.log(`${spells.length} spells from ${source}`, byLevel)
  if (skipped.length) console.log('unparsed:', skipped.join(', '))
  console.log(
    JSON.stringify(
      spells.find((s) => s.name === 'Fireball'),
      null,
      1
    ).slice(0, 900)
  )
  if (!args.includes('--write')) return
  const prev = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
    : []
  const names = new Set(spells.map((s) => s.name))
  const merged = [...prev.filter((s) => !names.has(s.name)), ...spells].sort(
    (a, b) => a.level - b.level || a.name.localeCompare(b.name)
  )
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n')
  console.log(`wrote ${merged.length} to ${path.relative(ROOT, OUT)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
