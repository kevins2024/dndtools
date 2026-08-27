const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('all 13 base classes load and have the required shape', () => {
  const names = [
    'barbarian',
    'bard',
    'cleric',
    'druid',
    'fighter',
    'monk',
    'paladin',
    'ranger',
    'rogue',
    'sorcerer',
    'warlock',
    'wizard',
    'artificer',
  ]
  for (const name of names) {
    const cls = engine.loadClass(name)
    assert.ok(cls, `${name} should load`)
    assert.ok(Array.isArray(cls.saving_throw_proficiencies))
    assert.equal(cls.saving_throw_proficiencies.length, 2)
    assert.ok(cls.spellcasting && typeof cls.spellcasting.type === 'string')
    assert.ok(typeof cls.subclass_choice_level === 'number')
  }
})

test('subclass choice level always appears in its own subclass_feature_levels', () => {
  const names = [
    'barbarian',
    'bard',
    'cleric',
    'druid',
    'fighter',
    'monk',
    'paladin',
    'ranger',
    'rogue',
    'sorcerer',
    'warlock',
    'wizard',
    'artificer',
  ]
  for (const name of names) {
    const cls = engine.loadClass(name)
    assert.ok(
      cls.subclass_feature_levels.includes(cls.subclass_choice_level),
      `${name}: subclass_choice_level (${cls.subclass_choice_level}) missing from subclass_feature_levels`
    )
  }
})

test('featuresGainedAtLevel finds Paladin Extra Attack at 5, subclass slot at 3', () => {
  const at3 = engine.featuresGainedAtLevel('Paladin', 3)
  assert.ok(at3.named.includes('Divine Health'))
  assert.equal(at3.subclassChoice, true)
  assert.equal(at3.subclassFeatureSlot, true)

  const at5 = engine.featuresGainedAtLevel('Paladin', 5)
  assert.ok(at5.named.includes('Extra Attack'))
  assert.equal(at5.subclassFeatureSlot, false)
})

test('allFeaturesUpToLevel accumulates in level order', () => {
  const upTo6 = engine.allFeaturesUpToLevel('Fighter', 6)
  const names = upTo6.map((f) => f.name)
  assert.deepEqual(names, [
    'Fighting Style',
    'Second Wind',
    'Action Surge (1 use)',
    'Extra Attack (1)',
  ])
})

test('Ranger and Rogue ASI-adjacent tables match verified wikidot data', () => {
  const rogue = engine.loadClass('rogue')
  assert.equal(rogue.sneak_attack_dice_by_level['9'], 5)
  assert.equal(rogue.sneak_attack_dice_by_level['17'], 9)

  const monk = engine.loadClass('monk')
  assert.equal(monk.martial_arts_die_by_level['11'], 8)
  assert.equal(monk.unarmored_movement_bonus_by_level['18'], 30)
})
