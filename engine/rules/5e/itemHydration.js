// How a party item references the item library instead of copying it —
// the item-side equivalent of how features reference a feature id.
//
// Three layers of data, none duplicated:
//   1. The LIBRARY entry (official: engine/data/5e/magic-items.json, built by
//      scripts/build-item-cache.js; ours: engine/data/5e/campaign-items.json)
//      — name, source, rarity, attunement, the item's text.
//   2. MECHANICS (engine/data/5e/item-mechanics.json, keyed by library id) —
//      the structured game effects (stat bonuses, charges, granted spells,
//      weapon effects, ...) the engine can act on. Same job
//      feature-mechanics.json does for features.
//   3. The ITEM RECORD in party_items.json — `catalog_id`, plus ONLY what is
//      true of this particular copy: who carries it, whether it's attuned,
//      current charges, notes, its +N, and anything it deliberately does
//      differently from the library (an override).
//
// `hydrateItem` expands a stored record into the full item shape every
// consumer already reads (item.effect, item.stat_bonuses, ...), so the UI
// needed no changes; `dehydrateItem` is its inverse, stripping anything that
// merely repeats the library so a save can never write a copy back to disk.
// An item with no `catalog_id` (a mount, a plain Dagger, a not-yet-linked
// item) passes through both untouched.
//
// Pure and browser-safe: it takes a `lookup` ({ entry(id), mechanics(id) })
// rather than reading any file — itemCatalog.js is the fs-backed lookup.

// Fields the library supplies when the record doesn't set them itself.
function derivedDefaults(entry, mechanics = {}) {
  const defaults = {}
  if (entry.desc) defaults.effect = entry.desc
  if (entry.flavor) defaults.description = entry.flavor
  // "varies"/"unknown"/"unique" aren't a rarity an item can be said to have.
  if (entry.rarity && !['varies', 'unknown', 'unique'].includes(entry.rarity)) {
    defaults.rarity = entry.rarity
  }
  defaults.needs_attunement = !!entry.requires_attunement
  return { ...defaults, ...mechanics }
}

function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function hydrateItem(item, lookup) {
  if (!item?.catalog_id) return item
  const entry = lookup.entry(item.catalog_id)
  if (!entry) return item
  const mechanics = lookup.mechanics(item.catalog_id) ?? {}
  const hydrated = { ...derivedDefaults(entry, mechanics), ...item }
  // A charged item that has never been spent has no stored current value.
  if (hydrated.charges_max != null && hydrated.charges_current == null) {
    hydrated.charges_current = hydrated.charges_max
  }
  return hydrated
}

function dehydrateItem(item, lookup) {
  if (!item?.catalog_id) return item
  const entry = lookup.entry(item.catalog_id)
  if (!entry) return item
  const mechanics = lookup.mechanics(item.catalog_id) ?? {}
  const defaults = derivedDefaults(entry, mechanics)
  const stored = { ...item }
  for (const key of Object.keys(defaults)) {
    if (key in stored && deepEqual(stored[key], defaults[key]))
      delete stored[key]
  }
  // Full charges are the default state, not something to store.
  if (
    defaults.charges_max != null &&
    stored.charges_current === defaults.charges_max
  ) {
    delete stored.charges_current
  }
  return stored
}

const hydrateItems = (items, lookup) => items.map((i) => hydrateItem(i, lookup))
const dehydrateItems = (items, lookup) =>
  items.map((i) => dehydrateItem(i, lookup))

// Keys on a stored record that differ from what the library would supply —
// i.e. this copy's deliberate overrides. For the audit report.
function overridesOf(item, lookup) {
  if (!item?.catalog_id) return []
  const entry = lookup.entry(item.catalog_id)
  if (!entry) return []
  const defaults = derivedDefaults(
    entry,
    lookup.mechanics(item.catalog_id) ?? {}
  )
  return Object.keys(defaults).filter(
    (k) => k in item && !deepEqual(item[k], defaults[k])
  )
}

module.exports = {
  derivedDefaults,
  hydrateItem,
  dehydrateItem,
  hydrateItems,
  dehydrateItems,
  overridesOf,
}
