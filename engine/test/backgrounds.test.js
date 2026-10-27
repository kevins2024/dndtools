const test = require('node:test')
const assert = require('node:assert/strict')
const { listBackgrounds, loadBackground } = require('../rules/5e/backgrounds')
const { listSkills, loadSkill } = require('../rules/5e/skills')

test('listSkills has all 18 real 5e skills, each with a governing ability', () => {
  const skills = listSkills()
  assert.equal(skills.length, 18)
  for (const s of skills) {
    assert.ok(['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(s.ability))
  }
})

test('loadSkill resolves by id or by name, case-insensitively', () => {
  assert.equal(loadSkill('sleight_of_hand').name, 'Sleight of Hand')
  assert.equal(loadSkill('Sleight of Hand').id, 'sleight_of_hand')
  assert.equal(loadSkill('ARCANA').ability, 'int')
})

test('loadBackground returns null for an unknown name instead of guessing', () => {
  assert.equal(loadBackground('Definitely Not A Real Background'), null)
})
