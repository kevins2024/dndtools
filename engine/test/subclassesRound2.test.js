const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('listSubclasses includes all subclasses built in this round', () => {
  assert.ok(engine.listSubclasses().length >= 15)
})

test('Oath of the Ancients matches Chuknora-relevant verified data', () => {
  const at3 = engine.subclassFeaturesGainedAtLevel(
    'Paladin',
    'Oath of the Ancients',
    3
  )
  assert.deepEqual(at3, ["Nature's Wrath", 'Oath of the Ancients Spells'])
  const sub = engine.loadSubclass('Paladin', 'Oath of the Ancients')
  assert.deepEqual(sub.oath_spells_by_level['3'], [
    'Ensnaring Strike',
    'Speak with Animals',
  ])
})

test('Path of the Giant now has all 4 feature-slot levels filled (previously only had 2)', () => {
  const sub = engine.loadSubclass('Barbarian', 'Path of the Giant')
  assert.deepEqual(
    Object.keys(sub.features_by_level)
      .map(Number)
      .sort((a, b) => a - b),
    [3, 6, 10, 14]
  )
})

test('the old roster name "Great Old One" resolves to the 2024 Great Old One Patron', () => {
  const sub = engine.loadSubclass('Warlock', 'Great Old One')
  assert.ok(sub)
  assert.equal(sub.name, 'Great Old One Patron')
  assert.ok(sub.features_by_level['3'].includes('Awakened Mind'))
})

test("Life Domain lines up with Cleric's own subclass_feature_levels; the legacy Tempest Domain loses its 8th-level Divine Strike to Blessed Strikes", () => {
  const cleric = engine.loadClass('Cleric')
  const life = engine.loadSubclass('Cleric', 'Life Domain')
  for (const lvl of Object.keys(life.features_by_level).map(Number))
    assert.ok(
      cleric.subclass_feature_levels.includes(lvl),
      `Life Domain has a slot at ${lvl}`
    )
  const tempest = engine.loadSubclass('Cleric', 'Tempest Domain')
  assert.equal(tempest.legacy, true)
  // 2024 Blessed Strikes: a Divine Strike from an older-book subclass is not taken on top of it.
  assert.deepEqual(
    Object.keys(tempest.features_by_level).map(Number),
    [3, 6, 17]
  )
})

test("the Tempest Domain's spells are the PHB's, by Cleric level (2014), and a 2024 Cleric gets the level 1 pair at level 3", () => {
  assert.deepEqual(
    engine.loadSubclass('Cleric', 'Tempest Domain', '2014')
      .domain_spells_by_level,
    {
      1: ['Fog Cloud', 'Thunderwave'],
      3: ['Gust of Wind', 'Shatter'],
      5: ['Call Lightning', 'Sleet Storm'],
      7: ['Control Water', 'Ice Storm'],
      9: ['Destructive Wave', 'Insect Plague'],
    }
  )
  // 2024: a legacy domain starts at level 3, so everything it gave before then arrives at 3.
  assert.deepEqual(
    engine.loadSubclass('Cleric', 'Tempest Domain', '2024')
      .domain_spells_by_level,
    {
      3: ['Fog Cloud', 'Thunderwave', 'Gust of Wind', 'Shatter'],
      5: ['Call Lightning', 'Sleet Storm'],
      7: ['Control Water', 'Ice Storm'],
      9: ['Destructive Wave', 'Insect Plague'],
    }
  )
})

test('Assassin subclass_feature_levels [3,9,13,17] match Rogue base class exactly', () => {
  const rogue = engine.loadClass('Rogue')
  const assassin = engine.loadSubclass('Rogue', 'Assassin')
  assert.deepEqual(
    Object.keys(assassin.features_by_level)
      .map(Number)
      .sort((a, b) => a - b),
    rogue.subclass_feature_levels
  )
})
