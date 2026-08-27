const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('isSpellOnClassList correctly distinguishes Wizard-eligible spells from Cleric-only ones', () => {
  // The concrete motivating case: don't let a Wizard scribe a scroll that
  // isn't actually on the Wizard list.
  assert.equal(engine.isSpellOnClassList('Wizard', 'Fireball'), true)
  assert.equal(engine.isSpellOnClassList('Wizard', 'Cure Wounds'), false)
  assert.equal(engine.isSpellOnClassList('Cleric', 'Cure Wounds'), true)
  assert.equal(engine.isSpellOnClassList('Wizard', 'Guiding Bolt'), false)
})

test('isSpellOnClassList resolves homebrew spells using their own classes field', () => {
  assert.equal(engine.isSpellOnClassList('Wizard', 'Undead Ward'), true)
  assert.equal(engine.isSpellOnClassList('Sorcerer', 'Undead Ward'), false)
})

test('item-only homebrew spells (Starfall, Smite From Afar, The Stones Agree) are on NO class list', () => {
  for (const name of ['Starfall', 'Smite From Afar', 'The Stones Agree']) {
    const record = engine.findSpellRecord(name)
    assert.ok(record, `${name} should still be found`)
    assert.equal(record.item_only, true)
    assert.equal(engine.isSpellOnClassList('Wizard', name), false)
    assert.equal(engine.isSpellOnClassList('Sorcerer', name), false)
  }
})

test("isSpellOnClassList returns null (not false) for a spell it can't find at all", () => {
  assert.equal(
    engine.isSpellOnClassList('Wizard', 'Not A Real Spell Name'),
    null
  )
})
