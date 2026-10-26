const test = require('node:test')
const assert = require('node:assert')
const {
  holderOf,
  effectNeedsPair,
  pairInfo,
  pairRequirement,
} = require('../rules/5e/pairedItems')
const { getCharacterSpells } = require('../rules/5e/characterSpells')
const { hydrateItems } = require('../rules/5e/itemHydration')
const { lookup } = require('../rules/5e/itemCatalog')

const stoneA = {
  id: 'a',
  name: 'Stone A',
  catalog_id: 'stone-a',
  equipped_by: 'Eldi',
  attuned: true,
  pair: { with: 'stone-b', range_ft: 30, effects: ['Combo'] },
}
const stoneB = {
  id: 'b',
  name: 'Stone B',
  catalog_id: 'stone-b',
  equipped_by: 'Rith',
  attuned: true,
}

test('holderOf: equipped beats carried beats stored; "disallowed" is not a holder', () => {
  assert.deepStrictEqual(holderOf(stoneA), {
    who: 'Eldi',
    place: null,
    status: 'equipped',
  })
  assert.strictEqual(
    holderOf({ equipped_by: 'disallowed', carried_by: 'Siv' }).status,
    'carried'
  )
  assert.deepStrictEqual(holderOf({ stored_at: 'The Winery' }), {
    who: null,
    place: 'The Winery',
    status: 'stored',
  })
  assert.strictEqual(holderOf({}).status, 'unassigned')
})

test('pairInfo: finds the partner by catalog id and says who has it', () => {
  const info = pairInfo(stoneA, [stoneA, stoneB])
  assert.strictEqual(info.rangeFt, 30)
  assert.deepStrictEqual(info.effects, ['Combo'])
  assert.strictEqual(info.partners.length, 1)
  assert.strictEqual(info.partners[0].name, 'Stone B')
  assert.strictEqual(info.partners[0].who, 'Rith')
  assert.strictEqual(info.partners[0].status, 'equipped')
})

test('pairInfo: an item with no pair, or a missing partner', () => {
  assert.strictEqual(pairInfo(stoneB, [stoneA, stoneB]), null)
  assert.deepStrictEqual(pairInfo(stoneA, [stoneA]).partners, [])
})

test('pairInfo: two copies of the same catalog item pair with each other, not themselves', () => {
  const a = {
    id: '1',
    name: 'Twin',
    catalog_id: 't',
    carried_by: 'Vaz',
    pair: { with: 't' },
  }
  const b = { id: '2', name: 'Twin', catalog_id: 't', carried_by: 'Enauweyn' }
  const partners = pairInfo(a, [a, b]).partners
  assert.deepStrictEqual(
    partners.map((p) => p.id),
    ['2']
  )
})

test('pairRequirement: only the effects the pair names are marked', () => {
  assert.ok(effectNeedsPair(stoneA, 'Combo'))
  assert.ok(!effectNeedsPair(stoneA, 'Solo Spell'))
  assert.ok(pairRequirement(stoneA, 'Combo', [stoneA, stoneB]))
  assert.strictEqual(
    pairRequirement(stoneA, 'Solo Spell', [stoneA, stoneB]),
    null
  )
  assert.strictEqual(pairRequirement(stoneB, 'Combo', [stoneA, stoneB]), null)
})

test('getCharacterSpells: only the pair-dependent item spell carries pair info', () => {
  const item = {
    ...stoneA,
    needs_attunement: true,
    spells_granted: ['Solo Spell', { name: 'Combo' }],
  }
  const spells = getCharacterSpells(
    { name: 'Eldi', classes: [] },
    [item, stoneB],
    []
  )
  const solo = spells.find((s) => s.name === 'Solo Spell')
  const combo = spells.find((s) => s.name === 'Combo')
  assert.strictEqual(solo.pair, null)
  assert.strictEqual(combo.pair.partners[0].who, 'Rith')
})

test('real data: the Farreach rings and the stones are paired, and only the right effects are marked', () => {
  const items = hydrateItems(
    [
      'the-farreach-a',
      'the-farreach-b',
      'stone-of-the-broken-vein',
      'stone-of-the-rootbound-ward',
    ].map((catalog_id, i) => ({ id: `i${i}`, name: catalog_id, catalog_id })),
    lookup
  )
  const [ringA, ringB, vein, ward] = items
  assert.strictEqual(pairInfo(ringA, items).partners[0].id, ringB.id)
  assert.strictEqual(pairInfo(ringB, items).partners[0].id, ringA.id)
  assert.strictEqual(pairInfo(vein, items).partners[0].id, ward.id)
  assert.strictEqual(pairInfo(ward, items).partners[0].id, vein.id)
  for (const stone of [vein, ward]) {
    assert.ok(effectNeedsPair(stone, 'The Stones Agree'))
    for (const g of stone.spells_granted) {
      assert.strictEqual(
        effectNeedsPair(stone, g.name),
        g.name === 'The Stones Agree',
        g.name
      )
    }
  }
  for (const ring of [ringA, ringB]) {
    assert.ok(effectNeedsPair(ring, 'Farreach Pairing'))
    assert.ok(!effectNeedsPair(ring, "Ring's Answer"))
    for (const f of ring.pair.effects)
      assert.ok(ring.features_granted.includes(f))
  }
})
