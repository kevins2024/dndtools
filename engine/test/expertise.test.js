const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test("diffLevelUp: Bard's Expertise options do NOT include Thieves' Tools (Rogue-only alternative)", () => {
  const character = {
    classes: [],
    features: [],
    spells: [],
    skill_proficiencies: ['Performance', 'Persuasion'],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Bard',
    toLevel: 3,
  })
  const choice = result.pendingChoices.find((p) => p.type === 'expertiseChoice')
  assert.deepEqual(choice.options, ['Performance', 'Persuasion'])
})

test('diffLevelUp: re-previewing an already-resolved Expertise level does not re-prompt', () => {
  const character = {
    classes: [{ name: 'Rogue', level: 1 }],
    features: [
      {
        name: 'Expertise: Stealth, Deception',
        type: 'expertise',
        level_gained: 1,
        _source: 'Rogue',
      },
    ],
    spells: [],
    skill_proficiencies: ['Stealth', 'Perception', 'Deception', 'Acrobatics'],
    skill_expertise: ['Stealth', 'Deception'],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Rogue',
    toLevel: 2,
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'expertiseChoice'),
    undefined
  )
})
