const test = require('node:test')
const assert = require('node:assert/strict')
const {
  materialInfo,
  materialCostGp,
  componentsLabel,
} = require('../rules/5e/spellComponents')

const srd = require('../../src/data/api_data_cache/srd_spells_full.json')
const published = require('../../src/data/published_spells.json')

test('materialCostGp: takes the largest price, converting coin types', () => {
  assert.equal(
    materialCostGp('Diamonds worth 300gp, which the spell consumes.'),
    300
  )
  assert.equal(materialCostGp('A melee weapon worth at least 1 sp.'), 0.1)
  assert.equal(
    materialCostGp('A diamond worth 1,000 gp and a vessel worth 2,000 gp'),
    2000
  )
  assert.equal(materialCostGp('A pinch of sand.'), 0)
})

test('materialInfo: no M, plain, cheap priced, costly, consumed-without-price, no text', () => {
  assert.equal(materialInfo({ components: ['V', 'S'] }).kind, null)
  assert.equal(
    materialInfo({ components: ['V', 'M'], material: 'A bit of fleece.' }).kind,
    'focus'
  )
  assert.equal(
    materialInfo({
      components: ['M'],
      material: 'A pearl worth at least 100 gp.',
    }).kind,
    'cheap'
  )
  assert.equal(
    materialInfo({ components: ['M'], material: 'A diamond worth 299 gp.' })
      .kind,
    'cheap'
  )
  assert.equal(
    materialInfo({ components: ['M'], material: 'Diamonds worth 300gp.' }).kind,
    'costly'
  )
  assert.equal(
    materialInfo({
      components: ['M'],
      material: 'A ruby worth at least 999 gp.',
    }).kind,
    'costly'
  )
  const snare = materialInfo({
    components: ['S', 'M'],
    material: '25 feet of rope, which the spell consumes.',
  })
  assert.equal(snare.kind, 'costly') // consumed: you must provide it
  assert.equal(snare.costGp, 0)
  const ceremony = materialInfo({
    components: ['M'],
    material: '25 gp worth of powdered silver, which the spell consumes.',
  })
  assert.equal(ceremony.kind, 'costly') // consumed beats the cheap price
  assert.equal(materialInfo({ components: ['M'] }).kind, 'unknown')
})

test('componentsLabel: M, f where a focus works, M where it does not, never a bare f', () => {
  assert.equal(
    componentsLabel({
      components: ['V', 'S', 'M'],
      material: 'A bit of fleece.',
    }),
    'V, S, M, f'
  )
  assert.equal(
    componentsLabel({
      components: ['V', 'S', 'M'],
      material: 'A pearl worth at least 100 gp.',
    }),
    'V, S, M, f'
  )
  assert.equal(
    componentsLabel({
      components: ['V', 'S', 'M'],
      material: 'A ruby worth at least 999 gp.',
    }),
    'V, S, M'
  )
  assert.equal(componentsLabel({ components: ['V', 'S'] }), 'V, S')
  assert.equal(
    componentsLabel({ components: 'V, S, M', material: 'A pinch of dust.' }),
    'V, S, M, f'
  )
  assert.equal(componentsLabel({ components: ['V', 'M'] }), 'V, M') // unknown: don't claim a focus works
})

test('real data: every spell with a Material component has its material text on record', () => {
  const gaps = [...srd, ...published]
    .filter((s) => materialInfo(s).kind === 'unknown')
    .map((s) => s.name)
  assert.deepEqual(gaps, [])
})

test('real data spot checks', () => {
  const find = (n) => [...srd, ...published].find((s) => s.name === n)
  assert.equal(materialInfo(find('Revivify')).kind, 'costly')
  assert.equal(materialInfo(find('Fireball')).kind, 'focus')
  assert.equal(materialInfo(find('Identify')).kind, 'cheap') // 100 gp pearl
  assert.equal(materialInfo(find('Ceremony')).kind, 'costly') // consumed
  assert.equal(materialInfo(find('Create Homunculus')).costGp, 1000)
  assert.equal(materialInfo(find('Summon Fey')).costGp, 300)
})
