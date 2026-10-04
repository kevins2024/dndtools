const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const {
  derivedDefaults,
  hydrateItem,
  dehydrateItem,
  overridesOf,
} = require('../rules/5e/itemHydration')
const {
  lookup,
  listItemCatalog,
  officialItems,
  campaignItems,
  itemMechanics,
} = require('../rules/5e/itemCatalog')

const partyItems = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'data', 'party_items.json'),
    'utf8'
  )
)

// A tiny library for the pure-function tests.
const wand = {
  id: 'test-wand',
  name: 'Test Wand',
  rarity: 'rare',
  requires_attunement: true,
  desc: 'Official text.',
}
const fakeLookup = {
  entry: (id) => (id === 'test-wand' ? wand : null),
  mechanics: (id) =>
    id === 'test-wand'
      ? { charges_max: 3, charges_recharge: '1d3', action_type: 'action' }
      : {},
}

test('derivedDefaults: text, rarity, attunement and mechanics come from the library', () => {
  const d = derivedDefaults(wand, { charges_max: 3 })
  assert.deepStrictEqual(d, {
    effect: 'Official text.',
    rarity: 'rare',
    needs_attunement: true,
    charges_max: 3,
  })
})

test('derivedDefaults: a rarity that is not one (varies/unknown/unique) is not supplied', () => {
  for (const rarity of ['varies', 'unknown', 'unique']) {
    assert.ok(!('rarity' in derivedDefaults({ ...wand, rarity })))
  }
})

test('hydrateItem: expands a reference, instance fields win, full charges are the default', () => {
  const stored = {
    name: 'Test Wand',
    catalog_id: 'test-wand',
    attuned: true,
    id: 'i1',
  }
  const h = hydrateItem(stored, fakeLookup)
  assert.strictEqual(h.effect, 'Official text.')
  assert.strictEqual(h.charges_max, 3)
  assert.strictEqual(h.charges_current, 3)
  assert.strictEqual(h.attuned, true)
  // an override on the record beats the library
  assert.strictEqual(
    hydrateItem({ ...stored, effect: 'House rule.' }, fakeLookup).effect,
    'House rule.'
  )
  // spent charges are kept, not reset
  assert.strictEqual(
    hydrateItem({ ...stored, charges_current: 1 }, fakeLookup).charges_current,
    1
  )
})

test('hydrateItem/dehydrateItem: items with no catalog_id, or an unknown one, pass through untouched', () => {
  const plain = { name: 'Dagger', id: 'd' }
  assert.strictEqual(hydrateItem(plain, fakeLookup), plain)
  assert.strictEqual(dehydrateItem(plain, fakeLookup), plain)
  const orphan = { name: 'X', catalog_id: 'nope', id: 'x', effect: 'kept' }
  assert.strictEqual(hydrateItem(orphan, fakeLookup), orphan)
  assert.strictEqual(dehydrateItem(orphan, fakeLookup), orphan)
})

test('dehydrateItem strips what merely repeats the library, keeps instance state and overrides', () => {
  const full = hydrateItem(
    {
      name: 'Test Wand',
      catalog_id: 'test-wand',
      attuned: true,
      carried_by: 'Vaz',
      id: 'i1',
      notes: 'n',
    },
    fakeLookup
  )
  assert.deepStrictEqual(dehydrateItem(full, fakeLookup), {
    name: 'Test Wand',
    catalog_id: 'test-wand',
    attuned: true,
    carried_by: 'Vaz',
    id: 'i1',
    notes: 'n',
  })
  // a divergent field survives as an override
  const edited = { ...full, effect: 'Edited.', charges_current: 2 }
  const stored = dehydrateItem(edited, fakeLookup)
  assert.strictEqual(stored.effect, 'Edited.')
  assert.strictEqual(stored.charges_current, 2)
  assert.deepStrictEqual(overridesOf(stored, fakeLookup), ['effect'])
})

test('dehydrate(hydrate(x)) is stable and hydrate(dehydrate(x)) loses nothing', () => {
  const stored = {
    name: 'Test Wand',
    catalog_id: 'test-wand',
    id: 'i1',
    charges_current: 1,
    attuned: false,
  }
  const once = hydrateItem(stored, fakeLookup)
  assert.deepStrictEqual(dehydrateItem(once, fakeLookup), stored)
  assert.deepStrictEqual(
    hydrateItem(dehydrateItem(once, fakeLookup), fakeLookup),
    once
  )
})

// ── integrity of the real library ───────────────────────────────────────

test('library ids are unique, and no campaign entry shadows an official one (a name conflict must be surfaced, not hidden)', () => {
  const officialIds = new Set(officialItems.map((i) => i.id))
  assert.strictEqual(
    officialIds.size,
    officialItems.length,
    'duplicate official ids'
  )
  const campaignIds = campaignItems.map((i) => i.id)
  assert.strictEqual(
    new Set(campaignIds).size,
    campaignIds.length,
    'duplicate campaign ids'
  )
  const clashes = campaignIds.filter((id) => officialIds.has(id))
  assert.deepStrictEqual(clashes, [])
  const officialNames = new Set(officialItems.map((i) => i.name.toLowerCase()))
  const nameClashes = campaignItems
    .filter((i) => officialNames.has(i.name.toLowerCase()))
    .map((i) => i.name)
  assert.deepStrictEqual(nameClashes, [])
})

test('every official entry has the fields the rest of the system relies on', () => {
  for (const i of officialItems) {
    assert.ok(i.id && i.name, `id/name on ${i.name}`)
    assert.ok(i.desc, `desc on ${i.name}`)
    assert.ok(Array.isArray(i.sources), `sources on ${i.name}`)
  }
  assert.ok(officialItems.length > 800)
})

test('every item-mechanics key and every party item catalog_id resolves to a library entry', () => {
  const missingMech = Object.keys(itemMechanics).filter(
    (id) => !lookup.entry(id)
  )
  assert.deepStrictEqual(missingMech, [])
  const dangling = partyItems
    .filter((i) => i.catalog_id && !lookup.entry(i.catalog_id))
    .map((i) => `${i.id} ${i.name} -> ${i.catalog_id}`)
  assert.deepStrictEqual(dangling, [])
})

test('party_items.json holds no copy of library data: nothing stored equals what the library supplies', () => {
  const duplicated = []
  for (const item of partyItems) {
    if (!item.catalog_id) continue
    const entry = lookup.entry(item.catalog_id)
    const defaults = derivedDefaults(entry, lookup.mechanics(item.catalog_id))
    for (const key of Object.keys(defaults)) {
      if (
        key in item &&
        JSON.stringify(item[key]) === JSON.stringify(defaults[key])
      ) {
        duplicated.push(`${item.id} ${item.name}: ${key}`)
      }
    }
  }
  assert.deepStrictEqual(duplicated, [])
})

test('every stored party item hydrates to a full item with text where the library has text', () => {
  for (const item of partyItems) {
    if (!item.catalog_id) continue
    const h = hydrateItem(item, lookup)
    const entry = lookup.entry(item.catalog_id)
    if (entry.desc)
      assert.ok(h.effect, `${item.id} ${item.name} has no effect text`)
    assert.strictEqual(typeof h.needs_attunement, 'boolean')
  }
})

test('the Gem of Seeing is the official DMG entry, with charges from the mechanics layer', () => {
  const gem = partyItems.find((i) => i.name === 'Gem of Seeing')
  assert.strictEqual(gem.catalog_id, 'gem-of-seeing')
  assert.ok(
    !('effect' in gem) && !('charges_max' in gem),
    'no copied data on the record'
  )
  const h = hydrateItem(gem, lookup)
  assert.strictEqual(h.charges_max, 3)
  assert.strictEqual(h.charges_recharge, '1d3')
  assert.strictEqual(h.needs_attunement, true)
  assert.match(h.effect, /truesight out to 120 feet/)
  assert.strictEqual(
    lookup.entry('gem-of-seeing').source,
    "Dungeon Master's Guide"
  )
})

test('listItemCatalog merges official and campaign entries, tagged by library', () => {
  const all = listItemCatalog()
  assert.strictEqual(all.length, officialItems.length + campaignItems.length)
  assert.ok(all.some((i) => i.library === 'official'))
  assert.ok(all.some((i) => i.library === 'campaign'))
})

// ── auto-linking ────────────────────────────────────────────────────────
const { matchLibraryEntry, autoLinkItem } = require('../rules/5e/itemCatalog')

test('matchLibraryEntry: exact names, aliases, healing potions, scrolls and plain +N gear', () => {
  const id = (item) => matchLibraryEntry(item)
  assert.strictEqual(
    id({ name: 'Boots of Speed', type: 'wondrous' }),
    'boots-of-speed'
  )
  assert.strictEqual(
    id({ name: "Heward's Handy Haversack" }),
    'hewards-handy-haversack'
  )
  assert.strictEqual(id({ name: 'Ioun Stone of Mastery' }), 'ioun-stone')
  assert.strictEqual(
    id({ name: 'Potion of Superior Healing' }),
    'potion-of-healing'
  )
  assert.strictEqual(id({ name: 'Scroll of Fireball' }), 'spell-scroll')
  assert.strictEqual(
    id({
      name: 'Longsword +1',
      type: 'weapon',
      effect: '+1 to attack and damage rolls.',
    }),
    'weapon-1-2-or-3'
  )
  assert.strictEqual(
    id({ name: 'Shield +2', type: 'armor', armor_type: 'shield' }),
    'shield-1-2-3'
  )
  assert.strictEqual(
    id({ name: 'Ring of Protection +1', type: 'ring' }),
    'ring-of-protection'
  )
})

test('matchLibraryEntry: never links mounts, ledgers, already-linked items, plain gear or special +N weapons', () => {
  assert.strictEqual(
    matchLibraryEntry({ name: 'Unnamed Horse', type: 'mount' }),
    null
  )
  assert.strictEqual(
    matchLibraryEntry({ name: 'Gem Pouch', contents: [] }),
    null
  )
  assert.strictEqual(
    matchLibraryEntry({ name: 'Boots of Speed', catalog_id: 'x' }),
    null
  )
  assert.strictEqual(
    matchLibraryEntry({ name: 'Dagger', type: 'weapon' }),
    null
  )
  assert.strictEqual(
    matchLibraryEntry({
      name: 'Longsword +1',
      type: 'weapon',
      weapon_effects: [{}],
    }),
    null
  )
})

test('autoLinkItem: a paraphrase is replaced by the library text; a house rule is kept as an override', () => {
  const para = autoLinkItem({
    name: 'Cloak of Displacement',
    type: 'wondrous',
    effect: 'Attackers have disadvantage.',
  })
  assert.strictEqual(para.catalog_id, 'cloak-of-displacement')
  assert.ok(!('effect' in para))
  const house = autoLinkItem({
    name: 'Bag of Holding',
    effect: 'Holds 15 items (house rule).',
  })
  assert.strictEqual(house.catalog_id, 'bag-of-holding')
  assert.strictEqual(house.effect, 'Holds 15 items (house rule).')
  const none = { name: 'Dagger', type: 'weapon' }
  assert.strictEqual(autoLinkItem(none), none)
})

test('silvered Shortswords carry the property, not rules text', () => {
  const swords = partyItems.filter((i) => i.name === 'Silvered Shortsword')
  assert.ok(swords.length >= 2)
  for (const s of swords) {
    assert.strictEqual(s.silvered, true)
    assert.ok(!s.effect)
  }
})

// ── variants of library items ───────────────────────────────────────────
const { applyDescEdits, resolveVariant } = require('../rules/5e/itemCatalog')

test('applyDescEdits applies every edit, and fails loudly when the base text no longer has the text to edit', () => {
  assert.strictEqual(
    applyDescEdits('holds 5 levels of 1st through 5th', [['5 levels', '3 levels'], ['5th', '3rd']], 'v'),
    'holds 3 levels of 1st through 3rd'
  )
  assert.throws(() => applyDescEdits('no match here', [['5 levels', '3 levels']], 'v'), /text to edit not found/)
  assert.strictEqual(applyDescEdits('unchanged', undefined, 'v'), 'unchanged')
})

test('resolveVariant: inherits the base, overrides what the variant states, marks itself campaign', () => {
  const base = { id: 'b', name: 'Base', source: 'DMG', rarity: 'rare', category: 'ring', requires_attunement: true, desc: 'holds 5', library: 'official' }
  const v = resolveVariant({ id: 'v', name: 'Base (3)', variant_of: 'b', rarity: 'uncommon', desc_edits: [['5', '3']] }, base)
  assert.strictEqual(v.name, 'Base (3)')
  assert.strictEqual(v.rarity, 'uncommon')
  assert.strictEqual(v.desc, 'holds 3')
  assert.strictEqual(v.category, 'ring')
  assert.strictEqual(v.requires_attunement, true)
  assert.strictEqual(v.library, 'campaign')
  assert.strictEqual(v.source, 'Campaign variant of Base')
  assert.ok(!('desc_edits' in v))
})

test('every campaign variant resolves against an official base, with its edits applied and mechanics inherited', () => {
  const variants = campaignItems.filter((c) => c.variant_of)
  assert.ok(variants.length >= 2)
  for (const v of variants) {
    const entry = lookup.entry(v.id)
    const base = lookup.entry(v.variant_of)
    assert.ok(base, `${v.id}: base ${v.variant_of} missing`)
    assert.strictEqual(entry.library, 'campaign')
    // an edit that changes nothing would mean the variant is just a copy
    if (v.desc_edits?.length) assert.notStrictEqual(entry.desc, base.desc, v.id)
    const baseMech = lookup.mechanics(v.variant_of)
    for (const key of Object.keys(baseMech)) {
      if (!(key in (itemMechanics[v.id] ?? {}))) {
        assert.deepStrictEqual(lookup.mechanics(v.id)[key], baseMech[key], `${v.id} inherits ${key}`)
      }
    }
  }
})

test('Ring of Spell Storing comes in 3, 5 and 7 level versions with scaled rarity', () => {
  const entry = (id) => lookup.entry(id)
  assert.strictEqual(entry('ring-of-spell-storing-3-levels').rarity, 'uncommon')
  assert.strictEqual(entry('ring-of-spell-storing').rarity, 'rare')
  assert.strictEqual(entry('ring-of-spell-storing-7-levels').rarity, 'very rare')
  assert.match(entry('ring-of-spell-storing-3-levels').desc, /up to 3 levels worth/)
  assert.match(entry('ring-of-spell-storing-3-levels').desc, /1st through 3rd level/)
  assert.match(entry('ring-of-spell-storing-7-levels').desc, /up to 7 levels worth/)
  assert.match(entry('ring-of-spell-storing-7-levels').desc, /1st through 7th level/)
  assert.deepStrictEqual(
    [3, 5, 7].map((n) => {
      const id = n === 5 ? 'ring-of-spell-storing' : `ring-of-spell-storing-${n}-levels`
      return lookup.mechanics(id).charges_max
    }),
    [3, 5, 7]
  )
  // Pirra's ring is the 3-level one, with nothing copied onto the record
  const pirra = partyItems.find((i) => i.id === 'items_142')
  assert.strictEqual(pirra.catalog_id, 'ring-of-spell-storing-3-levels')
  assert.ok(!('effect' in pirra) && !('charges_max' in pirra))
  assert.strictEqual(
    matchLibraryEntry({ name: 'Ring of Spell Storing (7 levels)' }),
    'ring-of-spell-storing-7-levels'
  )
})
