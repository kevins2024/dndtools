const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test("Oath of the Crown features match Enauweyn's actual feature list at level 9", () => {
  const at3 = engine.subclassFeaturesGainedAtLevel(
    'Paladin',
    'Oath of the Crown',
    3
  )
  assert.deepEqual(at3, [
    'Channel Divinity: Champion Challenge',
    'Channel Divinity: Turn the Tide',
  ])
  const at7 = engine.subclassFeaturesGainedAtLevel(
    'Paladin',
    'Oath of the Crown',
    7
  )
  assert.deepEqual(at7, ['Crown — Divine Allegiance'])

  // subclassFeaturesGainedAtLevel is a pure "what's gained at exactly this
  // level" lookup, not character-aware — 15 correctly returns a real feature
  // even though Enauweyn (level 9) hasn't reached it yet.
  assert.deepEqual(
    engine.subclassFeaturesGainedAtLevel('Paladin', 'Oath of the Crown', 15),
    ['Unyielding Spirit']
  )

  // What a level-9 Enauweyn should actually have accumulated (3 + 7, not 15/20):
  const gainedByLevel9 = [3, 7].flatMap((lvl) =>
    engine.subclassFeaturesGainedAtLevel('Paladin', 'Oath of the Crown', lvl)
  )
  assert.deepEqual(gainedByLevel9, [
    'Channel Divinity: Champion Challenge',
    'Channel Divinity: Turn the Tide',
    'Crown — Divine Allegiance',
  ])
})

test("Circle of the Moon feature levels line up with the Druid base class's own subclass_feature_levels, except the one deliberate homebrew exception", () => {
  // Level 8 is Wild Symbiosis — a table house rule bolted onto a level Druid
  // doesn't normally use for subclass features (real subclass_feature_levels
  // is [2,6,10,14]). describeLevelUp is intentionally NOT gated on this list
  // for that exact reason (see levelUp.js) — this test still guards every
  // OTHER level against an accidental typo, which is what it originally
  // existed to catch.
  const KNOWN_HOMEBREW_EXCEPTIONS = { 8: 'Wild Symbiosis' }

  const druid = engine.loadClass('Druid')
  const moon = engine.loadSubclass('Druid', 'Circle of the Moon')
  const moonLevels = Object.keys(moon.features_by_level).map(Number)
  for (const lvl of moonLevels) {
    if (druid.subclass_feature_levels.includes(lvl)) continue
    assert.equal(
      KNOWN_HOMEBREW_EXCEPTIONS[lvl],
      moon.features_by_level[String(lvl)][0],
      `Circle of the Moon grants something at level ${lvl} that isn't a real Druid subclass-feature level AND isn't the known homebrew exception — likely a typo`
    )
  }
})

test('Abjuration Wizard features resolve by class + subclass name regardless of spacing/case', () => {
  const features = engine.subclassFeaturesGainedAtLevel(
    'wizard',
    'abjuration',
    2
  )
  assert.deepEqual(features, ['Abjuration Savant', 'Arcane Ward'])
})

test('listSubclasses includes the original 4 built this session', () => {
  const all = engine.listSubclasses()
  assert.ok(all.length >= 4)
  assert.ok(
    all.some((s) => s.class === 'Paladin' && s.name === 'Oath of the Crown')
  )
})
