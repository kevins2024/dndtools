const test = require('node:test')
const assert = require('node:assert')
const {
  parseItemPage,
  parseTypeLine,
  normalizeRarity,
  htmlToText,
} = require('../../scripts/build-item-cache')

// Minimal wikidot-shaped page.
const page = (title, body, tags = '') =>
  `<div class="page-title page-header"><span>${title}</span></div>
   <div id="page-content">${body}<div class="content-separator" style="display: none:"></div></div>
   <div class="page-tags">${tags}</div>`

test('parseTypeLine: category, subtype, rarity and attunement note', () => {
  const t = parseTypeLine(
    'Weapon (any one-handed melee weapon), common (requires attunement by a warforged)'
  )
  assert.strictEqual(t.category, 'weapon')
  assert.strictEqual(t.subtype, 'any one-handed melee weapon')
  assert.strictEqual(t.rarityText, 'common')
  assert.strictEqual(t.requires_attunement, true)
  assert.strictEqual(t.attunement_note, 'by a warforged')
})

test('parseTypeLine: commas inside the subtype do not split the rarity', () => {
  const t = parseTypeLine('Armor (light, medium, or heavy), rarity varies')
  assert.strictEqual(t.category, 'armor')
  assert.strictEqual(t.subtype, 'light, medium, or heavy')
  assert.strictEqual(t.rarityText, 'rarity varies')
})

test('parseTypeLine: a line with no rarity at all is not a type line', () => {
  assert.strictEqual(parseTypeLine('Weapons are tools of war.'), null)
})

test('normalizeRarity: plain, noted, multiple and vague forms', () => {
  assert.deepStrictEqual(normalizeRarity('very rare'), {
    rarity: 'very rare',
    rarity_note: null,
  })
  assert.strictEqual(
    normalizeRarity('uncommon (+1), rare (+2)').rarity,
    'varies'
  )
  assert.strictEqual(normalizeRarity('rarity varies').rarity, 'varies')
  assert.strictEqual(normalizeRarity('rarity by figurine').rarity, 'varies')
  assert.strictEqual(normalizeRarity('unknown rarity').rarity, 'unknown')
  assert.strictEqual(normalizeRarity('???').rarity, 'unknown')
  assert.strictEqual(normalizeRarity('unique').rarity, 'unique')
  assert.strictEqual(normalizeRarity('rare (silver or brass)').rarity, 'rare')
})

test('htmlToText: paragraphs, bullets and table rows', () => {
  const text = htmlToText(
    '<p>One.</p><p>Two <em>em</em>.</p><ul><li>a</li><li>b</li></ul><table><tr><th>Roll</th><th>Effect</th></tr><tr><td>1</td><td>Boom</td></tr></table>'
  )
  assert.match(text, /One\.\n\nTwo em\./)
  assert.match(text, /• a\n• b/)
  assert.match(text, /Roll \| Effect\n1 \| Boom/)
})

test('parseItemPage: the Gem of Seeing', () => {
  const item = parseItemPage(
    page(
      'Gem of Seeing',
      "<p>Source: Dungeon Master's Guide</p><p><em>Wondrous item, rare (requires attunement)</em></p><p>This gem has 3 charges.</p><p>It regains 1d3 charges at dawn.</p>",
      '<a href="/system:page-tags/tag/dmg#pages">dmg</a>'
    ),
    'https://example/x'
  )
  assert.strictEqual(item.id, 'gem-of-seeing')
  assert.strictEqual(item.source, "Dungeon Master's Guide")
  assert.strictEqual(item.category, 'wondrous item')
  assert.strictEqual(item.rarity, 'rare')
  assert.strictEqual(item.requires_attunement, true)
  assert.strictEqual(
    item.desc,
    'This gem has 3 charges.\n\nIt regains 1d3 charges at dawn.'
  )
  assert.deepStrictEqual(item.tags, ['dmg'])
})

test('parseItemPage: tolerates unclosed <p> tags, "Source -", and a non-italic type line', () => {
  const item = parseItemPage(
    page(
      'Odd Page',
      '<p>Source - Waterdeep: Dungeon of the Mad Mage<p>Weapon (longsword), unknown rarity (requires attunement by a Creature of Non-Evil Alignment)<p>A strange blade.'
    ),
    'u'
  )
  assert.strictEqual(item.source, 'Waterdeep: Dungeon of the Mad Mage')
  assert.strictEqual(item.category, 'weapon')
  assert.strictEqual(item.subtype, 'longsword')
  assert.strictEqual(item.rarity, 'unknown')
  assert.strictEqual(
    item.attunement_note,
    'by a Creature of Non-Evil Alignment'
  )
  assert.strictEqual(item.desc, 'A strange blade.')
})

test('parseItemPage: multiple sources on one line', () => {
  const item = parseItemPage(
    page(
      'Figurine',
      "<p>Source: Dungeon Master's Guide, Fizban's Treasury of Dragons</p><p><em>Wondrous item, rarity by figurine</em></p><p>A statuette.</p>"
    ),
    'u'
  )
  assert.deepStrictEqual(item.sources, [
    "Dungeon Master's Guide",
    "Fizban's Treasury of Dragons",
  ])
  assert.strictEqual(item.rarity, 'varies')
})

test('parseItemPage: a page with no content area is not an item', () => {
  assert.strictEqual(parseItemPage('<html></html>', 'u'), null)
})
