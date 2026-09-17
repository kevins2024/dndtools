const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test("diffLevelUp: Rogue 1st level with no expertiseChoice surfaces a pendingChoice offering skill proficiencies + Thieves' Tools", () => {
  const character = {
    classes: [],
    features: [],
    spells: [],
    skill_proficiencies: ['Stealth', 'Perception', 'Deception', 'Acrobatics'],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Rogue',
    toLevel: 1,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'expertiseChoice'),
    {
      type: 'expertiseChoice',
      level: 1,
      count: 2,
      options: [
        'Stealth',
        'Perception',
        'Deception',
        'Acrobatics',
        "Thieves' Tools",
      ],
    }
  )
  assert.ok(result.newFeatures.some((f) => f.name === 'Expertise'))
})

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

test('diffLevelUp: choosing 2 skills resolves the generic entry and writes both into skill_expertise via the patch', () => {
  const character = {
    classes: [],
    features: [],
    spells: [],
    skill_proficiencies: ['Stealth', 'Perception', 'Deception', 'Acrobatics'],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Rogue',
    toLevel: 1,
    expertiseChoice: ['Stealth', 'Deception'],
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'expertiseChoice'),
    undefined
  )
  const feature = result.newFeatures.find((f) => f.type === 'expertise')
  assert.equal(feature.name, 'Expertise: Stealth, Deception')
  assert.equal(feature.level_gained, 1)
  assert.deepEqual(result.patch.skill_expertise.sort(), [
    'Deception',
    'Stealth',
  ])
})

test("diffLevelUp: Rogue's second Expertise grant at 6th level excludes skills that already have it from 1st level", () => {
  const character = {
    classes: [{ name: 'Rogue', level: 5 }],
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
    toLevel: 6,
  })
  const choice = result.pendingChoices.find((p) => p.type === 'expertiseChoice')
  assert.deepEqual(choice.options, [
    'Perception',
    'Acrobatics',
    "Thieves' Tools",
  ])
})

test('diffLevelUp: choosing the 6th-level grant produces a SECOND, separate feature entry and merges into existing skill_expertise', () => {
  const character = {
    classes: [{ name: 'Rogue', level: 5 }],
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
    toLevel: 6,
    expertiseChoice: ['Perception', 'Acrobatics'],
  })
  const features = result.newFeatures.filter((f) => f.type === 'expertise')
  assert.equal(features.length, 1)
  assert.equal(features[0].name, 'Expertise: Perception, Acrobatics')
  assert.equal(features[0].level_gained, 6)
  assert.deepEqual(result.patch.skill_expertise.sort(), [
    'Acrobatics',
    'Deception',
    'Perception',
    'Stealth',
  ])
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

test("diffLevelUp: picking a skill the character isn't proficient in is still recorded, with a warning", () => {
  const character = {
    classes: [],
    features: [],
    spells: [],
    skill_proficiencies: ['Stealth'],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Rogue',
    toLevel: 1,
    expertiseChoice: ['Stealth', 'Arcana'],
  })
  const feature = result.newFeatures.find((f) => f.type === 'expertise')
  assert.equal(feature.name, 'Expertise: Stealth, Arcana')
  assert.ok(result.warnings.some((w) => w.includes('Arcana')))
})

test('diffLevelUp: picking the same skill twice is recorded, with a warning', () => {
  const character = {
    classes: [],
    features: [],
    spells: [],
    skill_proficiencies: ['Stealth', 'Perception'],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Rogue',
    toLevel: 1,
    expertiseChoice: ['Stealth', 'Stealth'],
  })
  assert.ok(
    result.warnings.some(
      (w) => w.includes('two DIFFERENT proficiencies') || w.includes('twice')
    )
  )
})
