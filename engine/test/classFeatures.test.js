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
