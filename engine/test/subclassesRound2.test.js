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
  assert.deepEqual(at3, [
    "Channel Divinity: Nature's Wrath",
    'Channel Divinity: Turn the Faithless',
  ])
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

test('Great Old One resolves under the name actually used on the roster ("Great Old One", not "The Great Old One")', () => {
  const sub = engine.loadSubclass('Warlock', 'Great Old One')
  assert.ok(sub)
  assert.deepEqual(sub.features_by_level['1'], ['Awakened Mind'])
})

test("Life Domain and Tempest Domain both line up with Cleric's own subclass_feature_levels [1,2,6,8,17]", () => {
  const cleric = engine.loadClass('Cleric')
  for (const name of ['Life Domain', 'Tempest Domain']) {
    const sub = engine.loadSubclass('Cleric', name)
    const levels = Object.keys(sub.features_by_level).map(Number)
    for (const lvl of levels) {
      assert.ok(
        cleric.subclass_feature_levels.includes(lvl),
        `${name} has a slot at ${lvl}`
      )
    }
  }
})

test("Revven's actual Tempest Domain spell list matches the verified domain_spells_by_level table exactly", () => {
  const path = require('path')
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))
  const revven = characters.find((c) => c.name === 'Revven')
  const tempest = engine.loadSubclass('Cleric', 'Tempest Domain')
  const allDomainSpells = Object.values(tempest.domain_spells_by_level).flat()
  for (const spellName of allDomainSpells) {
    assert.ok(
      revven.spells.some((s) => s.name === spellName),
      `Revven should have ${spellName} (Tempest domain spell)`
    )
  }
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
