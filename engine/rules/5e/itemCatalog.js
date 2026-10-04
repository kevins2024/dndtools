// The item library, loaded: official items (scripts/build-item-cache.js),
// our own campaign items, and the structured mechanics overlay, merged behind
// one lookup that itemHydration.js consumes. See itemHydration.js for what
// the three layers are and why.
//
// A campaign entry may be a VARIANT of a library item (`variant_of` + optional
// `desc_edits`): it inherits everything from the base — text, source, category,
// attunement, mechanics — and states only what differs, so the official text
// is never pasted a second time. See resolveVariant below.
//
// An id is unique across official and campaign entries (campaign-items.json
// ids that collide with an official id are rejected by the test suite, so a
// name conflict is always surfaced rather than silently shadowing).
//
// Plain `require` of JSON (no fs/path calls), so webpack can bundle this if a
// browser build ever wants it.

const official = require('../../data/5e/magic-items.json')
const campaign = require('../../data/5e/campaign-items.json')
const mechanicsById = require('../../data/5e/item-mechanics.json')

// Applies a variant's text edits ([[find, replace], ...]) to its base item's
// text. Every `find` must occur in the base text: if upstream text changes
// (a rebuilt cache) so an edit no longer applies, that is an error at load
// time and in the test suite, never a silently unedited variant.
function applyDescEdits(desc, edits, variantId) {
  let out = desc
  for (const [find, replace] of edits ?? []) {
    if (!out.includes(find)) {
      throw new Error(
        `item variant "${variantId}": text to edit not found in its base: ${JSON.stringify(find)}`
      )
    }
    out = out.split(find).join(replace)
  }
  return out
}

// A campaign entry with `variant_of` = the base's id. The result is the base
// entry with this entry's own fields on top (name, rarity, ...) and the base
// text with `desc_edits` applied. Its source says it's a campaign variant.
function resolveVariant(item, base) {
  const { desc_edits, ...own } = item
  return {
    ...base,
    ...own,
    desc: applyDescEdits(base.desc, desc_edits, item.id),
    source: own.source ?? `Campaign variant of ${base.name}`,
    sources: [own.source ?? `Campaign variant of ${base.name}`],
    homebrew: true,
    library: 'campaign',
  }
}

const entries = new Map()
for (const item of official)
  entries.set(item.id, { ...item, library: 'official' })
for (const item of campaign) {
  // Campaign entries never override an official id (the test suite fails on
  // a collision); first write wins so a collision can't change behavior.
  if (entries.has(item.id)) continue
  if (item.variant_of) {
    const base = entries.get(item.variant_of)
    if (!base) {
      throw new Error(
        `item variant "${item.id}": base "${item.variant_of}" is not in the library`
      )
    }
    entries.set(item.id, resolveVariant(item, base))
  } else {
    entries.set(item.id, { ...item, library: 'campaign' })
  }
}

// A variant starts from its base's mechanics and overrides what differs
// (a 3-level Ring of Spell Storing has charges_max 3, the same action, slot,
// ...).
const baseIdOf = (id) => campaign.find((c) => c.id === id)?.variant_of ?? null
function mechanicsOf(id) {
  const own = mechanicsById[id]
  const base = baseIdOf(id)
  return {
    ...(base ? mechanicsOf(base) : {}),
    ...(own && typeof own === 'object' ? own : {}),
  }
}

const lookup = {
  entry: (id) => entries.get(id) ?? null,
  mechanics: (id) => mechanicsOf(id),
}

// ── Auto-linking a new item to the library ──────────────────────────────
// An item typed in by hand, added from the Item Generator, or pasted in via
// JSON intake arrives with no catalog_id and its own copy of the item's
// text. `autoLinkItem` links it to the library when it can be sure what item
// it is, applying the same policy used when the existing items were migrated:
// the official text replaces a paraphrase of it, and anything that adds
// numbers the official text lacks (or says "house rule") is kept as an
// explicit `effect` override instead of being thrown away.
//
// Matching is by name only, and deliberately conservative — an item that
// doesn't clearly match stays unlinked (scripts/audit-items.js lists those):
//   1. the exact library name        ("Boots of Speed")
//   2. a hand-confirmed alias        ("Ioun Stone of Mastery" -> Ioun Stone)
//   3. Potion of Greater/Superior/Supreme Healing, "Scroll of <spell>"
//   4. a plain "+N" weapon/armor/shield (no special properties)
//   5. "<library name> +N" / "<library name> (variant)"
// Mounts and per-party ledgers (an item with a `contents` list) never link.

const norm = (n) =>
  n
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const nameIndex = new Map()
for (const entry of entries.values()) {
  const key = norm(entry.name)
  if (!nameIndex.has(key)) nameIndex.set(key, entry.id)
}

// Party-item names that ARE a library item under a slightly different name
// (confirmed by hand against the official text).
const ALIASES = {
  'amulet of proof against detection':
    'amulet-of-proof-against-detection-and-location',
  'ioun stone of mastery': 'ioun-stone',
  'ring of lightning resistance': 'ring-of-resistance',
}

const GENERIC_PLUS_EFFECT =
  /^\+\d\b.*\b(attack and damage rolls?|AC|armor class)\b|^Requires attunement\.?$/i
const stripPlus = (name) => name.replace(/\s*\+\d+\s*$/, '').trim()

function genericPlusFamily(item) {
  if (!/\s\+\d\s*$/.test(item.name)) return null
  const hasExtras =
    item.weapon_effects ||
    item.extra_damage ||
    item.spells_granted ||
    item.stat_bonuses ||
    item.grants_initiative_advantage ||
    item.returning ||
    item.armor_base_ac
  if (hasExtras) return null
  if (item.effect && !GENERIC_PLUS_EFFECT.test(item.effect.trim())) return null
  if (item.type === 'weapon') return 'weapon-1-2-or-3'
  if (item.type === 'armor') {
    return item.armor_type === 'shield' || /shield/i.test(item.name)
      ? 'shield-1-2-3'
      : 'armor-1-2-or-3'
  }
  return null
}

// The library id this item should link to, or null.
function matchLibraryEntry(item) {
  if (!item?.name || item.catalog_id || item.type === 'mount') return null
  if (Array.isArray(item.contents)) return null
  const key = norm(item.name)
  if (nameIndex.has(key)) return nameIndex.get(key)
  if (ALIASES[key] && entries.has(ALIASES[key])) return ALIASES[key]
  if (/^Potion of (Greater|Superior|Supreme) Healing/i.test(item.name))
    return 'potion-of-healing'
  if (/^Scroll of /i.test(item.name)) return 'spell-scroll'
  const family = genericPlusFamily(item)
  if (family && entries.has(family)) return family
  const base = norm(stripPlus(item.name.replace(/\s*\([^)]*\)\s*/g, ' ')))
  if (base !== key && nameIndex.has(base)) return nameIndex.get(base)
  return null
}

const numbersIn = (t) => new Set((t ?? '').match(/\d+/g) ?? [])

// Why an item's own text should be kept as an override rather than replaced
// by the library text, or null if it's just a paraphrase.
function textDivergence(itemEffect, libraryDesc) {
  if (!itemEffect) return null
  if (/house rule/i.test(itemEffect)) return 'says "house rule"'
  const known = numbersIn(libraryDesc)
  const extra = [...numbersIn(itemEffect)].filter((n) => !known.has(n))
  return extra.length ? `numbers not in the library text: ${extra.join(', ')}` : null
}

// Returns the item linked to the library (a new object) or the very same
// item if there is nothing to link. Does not strip fields that merely repeat
// the library — dehydrateItem does that.
function autoLinkItem(item) {
  const id = matchLibraryEntry(item)
  if (!id) return item
  const entry = entries.get(id)
  const linked = { ...item, catalog_id: id }
  const isGeneric = id === 'weapon-1-2-or-3' || id === 'armor-1-2-or-3' || id === 'shield-1-2-3'
  if (linked.effect && entry.library === 'official') {
    if (isGeneric || !textDivergence(linked.effect, entry.desc)) {
      delete linked.effect
    }
  }
  return linked
}

// The merged library as an array (what GET /api/engine/item-catalog serves).
function listItemCatalog() {
  return [...entries.values()]
}

module.exports = {
  lookup,
  listItemCatalog,
  matchLibraryEntry,
  autoLinkItem,
  textDivergence,
  applyDescEdits,
  resolveVariant,
  officialItems: official,
  campaignItems: campaign,
  itemMechanics: mechanicsById,
}
