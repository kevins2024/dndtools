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

test('listBackgrounds is a curated set of 40 real backgrounds (each a clean 2-skill grant) plus one homebrew free-choice background', () => {
  const backgrounds = listBackgrounds()
  assert.equal(backgrounds.length, 41)
  const skillIds = new Set(listSkills().map((s) => s.id))

  // Born Adventurer is the one deliberate exception — no real background
  // lets you freely pick any two skills, so it's flagged homebrew with an
  // empty fixed list and a free_choice marker instead of guessed real skills.
  const freeChoiceNames = new Set(['Born Adventurer'])

  for (const b of backgrounds) {
    if (freeChoiceNames.has(b.name)) {
      assert.equal(b.homebrew, true, `${b.name} should be flagged homebrew`)
      assert.deepEqual(b.skill_proficiencies, [])
      assert.equal(b.free_choice?.count, 2)
      continue
    }
    assert.equal(b.skill_proficiencies.length, 2)
    for (const skillId of b.skill_proficiencies) {
      assert.ok(
        skillIds.has(skillId),
        `${b.name} references unknown skill "${skillId}"`
      )
    }
    assert.ok(b.source, `${b.name} is missing a source citation`)
  }
})

test('loadBackground resolves real PHB backgrounds with their correct RAW skills', () => {
  assert.deepEqual(loadBackground('Acolyte').skill_proficiencies, [
    'insight',
    'religion',
  ])
  assert.deepEqual(loadBackground('criminal').skill_proficiencies, [
    'deception',
    'stealth',
  ])
  assert.deepEqual(loadBackground('Sailor').skill_proficiencies, [
    'athletics',
    'perception',
  ])
})

test('loadBackground returns null for an unknown name instead of guessing', () => {
  assert.equal(loadBackground('Definitely Not A Real Background'), null)
})
