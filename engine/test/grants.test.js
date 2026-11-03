const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('Fey Touched grants data matches verified RAW text', () => {
  const feat = engine.loadFeat('Fey Touched')
  assert.ok(feat)
  assert.deepEqual(feat.grants_spells.fixed, ['Misty Step'])
  assert.equal(feat.grants_spells.choice.level, 1)
  assert.deepEqual(feat.grants_spells.choice.schools, [
    'Divination',
    'Enchantment',
  ])
})

test('isFeatGrantedSpell recognizes the fixed grant, not an arbitrary spell', () => {
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', 'Misty Step'), true)
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', 'Fireball'), false)
})

test("Fey Touched's Misty Step counts as a feat-granted spell, and a Divine Soul's Law affinity spell is Bless", () => {
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', 'Misty Step'), true)
  const divineSoul = engine.loadSubclass('Sorcerer', 'Divine Soul')
  assert.equal(divineSoul.grants_spells.affinity_bonus_spell.law, 'Bless')
})

test('Shadow Touched grants data matches verified RAW text', () => {
  const feat = engine.loadFeat('Shadow Touched')
  assert.ok(feat)
  assert.deepEqual(feat.grants_spells.fixed, ['Invisibility'])
  assert.deepEqual(feat.grants_spells.choice.schools, [
    'Illusion',
    'Necromancy',
  ])
})

test('Shadow Touched grants Invisibility and Fey Touched grants Misty Step as feat spells', () => {
  assert.equal(
    engine.isFeatGrantedSpell('Shadow Touched', 'Invisibility'),
    true
  )
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', 'Misty Step'), true)
})
