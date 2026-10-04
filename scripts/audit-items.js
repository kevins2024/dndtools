// Read-only audit of how party items relate to the item library (see
// engine/rules/5e/itemHydration.js). Run any time; it changes nothing.
//
//   node scripts/audit-items.js
//
// Reports, in order of how much they matter:
//   1. UNLINKED items that carry their own text or mechanics — copy/paste
//      data that should reference a library entry (official, or a new
//      campaign entry). Mounts and plain mundane gear are ignored.
//   2. COPIED data: a linked item storing a value that just repeats the
//      library. Must stay empty (the engine tests enforce it too).
//   3. DANGLING ids: a catalog_id or mechanics key with no library entry.
//   4. OVERRIDES: linked items that deliberately differ from the library —
//      each is either a house rule worth keeping or a stale paraphrase worth
//      deleting; this is the list to review.
//   5. CAMPAIGN entries whose name is close to an official item — possibly an
//      official item under another name.

const fs = require('fs')
const path = require('path')
const {
  lookup,
  officialItems,
  campaignItems,
  itemMechanics,
} = require('../engine/rules/5e/itemCatalog')
const {
  derivedDefaults,
  overridesOf,
} = require('../engine/rules/5e/itemHydration')

const items = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'src', 'data', 'party_items.json'),
    'utf8'
  )
)

const norm = (n) =>
  n
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const STOP = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'for'])
const tokens = (n) =>
  new Set(
    norm(n)
      .split(' ')
      .filter((t) => t && !STOP.has(t))
  )

const section = (title, lines) => {
  console.log(`\n${title}: ${lines.length}`)
  lines.forEach((l) => console.log('  ' + l))
}

const hasContent = (i) =>
  i.effect ||
  i.description ||
  i.stat_bonuses ||
  i.spells_granted ||
  i.weapon_effects ||
  i.features_granted ||
  i.charges_max != null

// A Gem Pouch-style ledger (`contents`) is per-party state — its text IS the
// state — not an item definition, so it is deliberately never linked.
const unlinked = items
  .filter(
    (i) =>
      !i.catalog_id &&
      i.type !== 'mount' &&
      !Array.isArray(i.contents) &&
      hasContent(i)
  )
  .map(
    (i) => `${i.id} ${i.name}${i.effect ? '  — ' + i.effect.slice(0, 70) : ''}`
  )

const copied = []
for (const i of items) {
  if (!i.catalog_id) continue
  const entry = lookup.entry(i.catalog_id)
  if (!entry) continue
  const defaults = derivedDefaults(entry, lookup.mechanics(i.catalog_id))
  for (const key of Object.keys(defaults)) {
    if (key in i && JSON.stringify(i[key]) === JSON.stringify(defaults[key])) {
      copied.push(`${i.id} ${i.name}: ${key}`)
    }
  }
}

const dangling = [
  ...items
    .filter((i) => i.catalog_id && !lookup.entry(i.catalog_id))
    .map((i) => `${i.id} ${i.name} -> ${i.catalog_id}`),
  ...Object.keys(itemMechanics)
    .filter((id) => !lookup.entry(id))
    .map((id) => `item-mechanics key with no entry: ${id}`),
]

const overrides = items
  .map((i) => ({ i, keys: overridesOf(i, lookup) }))
  .filter((x) => x.keys.length)
  .map((x) => `${x.i.id} ${x.i.name} [${x.i.catalog_id}]: ${x.keys.join(', ')}`)

const similar = []
for (const c of campaignItems) {
  // A declared variant of an official item is already linked to it.
  if (c.variant_of) continue
  const a = tokens(c.name)
  let best = null
  for (const o of officialItems) {
    const b = tokens(o.name)
    const score =
      [...a].filter((t) => b.has(t)).length / Math.max(a.size, b.size)
    if (!best || score > best.score) best = { score, name: o.name }
  }
  if (best && best.score >= 0.67)
    similar.push(`${c.name}  ~  ${best.name} (${best.score.toFixed(2)})`)
}

console.log(
  `party items ${items.length} | linked ${
    items.filter((i) => i.catalog_id).length
  } | official entries ${officialItems.length} | campaign entries ${
    campaignItems.length
  }`
)
section(
  'UNLINKED items with their own text/mechanics (copy/paste risk)',
  unlinked
)
section('COPIED library data stored on a linked item (must be empty)', copied)
section('DANGLING ids (must be empty)', dangling)
section(
  'OVERRIDES (linked items that differ from the library on purpose)',
  overrides
)
section(
  'CAMPAIGN entries close to an official name (possibly the same item)',
  similar
)

process.exitCode = copied.length || dangling.length ? 1 : 0
