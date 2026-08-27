const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('proficiency bonus matches the roster (level 9 -> +4)', () => {
  assert.equal(engine.proficiencyBonus(1), 2)
  assert.equal(engine.proficiencyBonus(4), 2)
  assert.equal(engine.proficiencyBonus(5), 3)
  assert.equal(engine.proficiencyBonus(9), 4)
  assert.equal(engine.proficiencyBonus(13), 5)
  assert.equal(engine.proficiencyBonus(17), 6)
  assert.equal(engine.proficiencyBonus(20), 6)
})

test('ability modifier follows the floor((score-10)/2) rule', () => {
  assert.equal(engine.abilityModifier(10), 0)
  assert.equal(engine.abilityModifier(8), -1)
  assert.equal(engine.abilityModifier(18), 4)
  assert.equal(engine.abilityModifier(22), 6)
})

test('ASI levels default to 4/8/12/16/19 except Fighter and Rogue', () => {
  assert.equal(engine.isAsiLevel('Wizard', 6), false)
  assert.equal(engine.isAsiLevel('Wizard', 8), true)
  assert.equal(engine.isAsiLevel('Fighter', 6), true)
  assert.equal(engine.isAsiLevel('Fighter', 14), true)
  assert.equal(engine.isAsiLevel('Rogue', 10), true)
  assert.equal(engine.isAsiLevel('Rogue', 14), false)
})

test('hit die matches known class values', () => {
  assert.equal(engine.hitDieForClass('Paladin'), 10)
  assert.equal(engine.hitDieForClass('Druid'), 8)
  assert.equal(engine.hitDieForClass('Wizard'), 6)
  assert.equal(engine.hitDieForClass('Barbarian'), 12)
})
