const test = require('node:test')
const assert = require('node:assert/strict')
const {
  savingThrow,
  savingThrowBreakdown,
  allSavingThrows,
  skill,
  skillBreakdown,
  allSkills,
  passivePerception,
  passivePerceptionBreakdown,
  initiative,
  skillAdvantage,
  skillTraining,
  hasInitiativeAdvantage,
  spellAttackBonus,
  spellAttackBonusBreakdown,
  spellSaveDC,
  spellSaveDCBreakdown,
} = require('../rules/5e/checks')

function baseChar(overrides = {}) {
  return {
    level: 9,
    proficiency_bonus: 4,
    stat_str: 10,
    stat_dex: 16, // +3
    stat_con: 12,
    stat_int: 8,
    stat_wis: 14, // +2
    stat_cha: 10,
    saving_throws: [],
    skill_proficiencies: [],
    skill_expertise: [],
    features: [],
    ...overrides,
  }
}

test('savingThrow: proficient adds the full prof bonus, non-proficient does not', () => {
  const character = baseChar({ saving_throws: ['dex'] })
  assert.equal(savingThrow(character, 'dex', []), 3 + 4) // mod + prof
  assert.equal(savingThrow(character, 'str', []), 0) // mod 0, no prof
})

test('allSavingThrows returns all 6 abilities', () => {
  const result = allSavingThrows(baseChar(), [])
  assert.deepEqual(Object.keys(result).sort(), [
    'cha',
    'con',
    'dex',
    'int',
    'str',
    'wis',
  ])
})

test('skill: not proficient, no Jack of All Trades -> just the ability mod', () => {
  assert.equal(skill(baseChar(), 'Perception', []), 2) // WIS mod
})

test('skill: proficient adds full prof, expertise adds double', () => {
  const proficient = baseChar({ skill_proficiencies: ['Perception'] })
  assert.equal(skill(proficient, 'Perception', []), 2 + 4)
  const expert = baseChar({
    skill_proficiencies: ['Perception'],
    skill_expertise: ['Perception'],
  })
  assert.equal(skill(expert, 'Perception', []), 2 + 8)
})

test('skill: Jack of All Trades adds half prof (rounded down) only when not already proficient', () => {
  const jack = baseChar({
    features: [{ name: 'Jack of All Trades' }],
  })
  assert.equal(skill(jack, 'Perception', []), 2 + 2) // half of 4 = 2
  const jackButProficient = baseChar({
    skill_proficiencies: ['Perception'],
    features: [{ name: 'Jack of All Trades' }],
  })
  assert.equal(skill(jackButProficient, 'Perception', []), 2 + 4) // full prof wins, not doubled
})

test('skill: item-granted proficiency only counts from an equipped item, not a carried one', () => {
  const character = baseChar()
  const equipped = [{ grants_skill_proficiency: ['Stealth'] }]
  assert.equal(skill(character, 'Stealth', equipped), 3 + 4) // DEX mod + prof
  assert.equal(skill(character, 'Stealth', []), 3) // no item -> no proficiency
})

test('passivePerception is 10 + the Perception skill total', () => {
  const character = baseChar({ skill_proficiencies: ['Perception'] })
  assert.equal(passivePerception(character, []), 10 + 2 + 4)
})

test('initiative is the DEX modifier plus any flat bonus', () => {
  assert.equal(initiative(baseChar(), []), 3)
  const items = [{ stat_bonuses: { initiative: 2 } }]
  assert.equal(initiative(baseChar(), items), 5)
})

test('hasInitiativeAdvantage requires attunement when the item needs it', () => {
  const needsAttunementUnattuned = [
    {
      grants_initiative_advantage: true,
      needs_attunement: true,
      attuned: false,
    },
  ]
  assert.equal(
    hasInitiativeAdvantage(baseChar(), needsAttunementUnattuned),
    false
  )
  const attuned = [
    {
      grants_initiative_advantage: true,
      needs_attunement: true,
      attuned: true,
    },
  ]
  assert.equal(hasInitiativeAdvantage(baseChar(), attuned), true)
  const noAttunementNeeded = [{ grants_initiative_advantage: true }]
  assert.equal(hasInitiativeAdvantage(baseChar(), noAttunementNeeded), true)
})

test('spellAttackBonus/spellSaveDC return null for a character with no spellcasting_ability', () => {
  assert.equal(spellAttackBonus(baseChar(), []), null)
  assert.equal(spellSaveDC(baseChar(), []), null)
})

test('spellAttackBonus/spellSaveDC use the stated spellcasting ability mod + prof', () => {
  const caster = baseChar({ spellcasting_ability: 'wis' })
  assert.equal(spellAttackBonus(caster, []), 2 + 4)
  assert.equal(spellSaveDC(caster, []), 8 + 2 + 4)
})

// ── Breakdown siblings: value must match the plain function, and named
// item/feature lines must show up without being double-counted into value.

test('savingThrowBreakdown: value matches savingThrow, and a feature bonus appears as a named line', () => {
  const character = baseChar({
    saving_throws: ['dex'],
    features: [{ name: 'Resilient (DEX)', stat_bonuses: { saving_throws: 1 } }],
  })
  const { value, breakdown } = savingThrowBreakdown(character, 'dex', [])
  assert.equal(value, savingThrow(character, 'dex', []))
  assert.equal(value, 3 + 4 + 1)
  assert.ok(
    breakdown.some((l) => l.label === 'Resilient (DEX)' && l.amount === 1)
  )
})

test('skillBreakdown: value matches skill, and the expertise line is labeled distinctly from plain proficiency', () => {
  const expert = baseChar({
    skill_proficiencies: ['Perception'],
    skill_expertise: ['Perception'],
  })
  const { value, breakdown } = skillBreakdown(expert, 'Perception', [])
  assert.equal(value, skill(expert, 'Perception', []))
  assert.ok(breakdown.some((l) => l.label.includes('Expertise')))
})

test('passivePerceptionBreakdown: value matches passivePerception', () => {
  const character = baseChar({ skill_proficiencies: ['Perception'] })
  const { value } = passivePerceptionBreakdown(character, [])
  assert.equal(value, passivePerception(character, []))
})

test('spellAttackBonusBreakdown/spellSaveDCBreakdown: null for a non-caster, matching value otherwise', () => {
  assert.equal(spellAttackBonusBreakdown(baseChar(), []), null)
  assert.equal(spellSaveDCBreakdown(baseChar(), []), null)
  const caster = baseChar({ spellcasting_ability: 'wis' })
  assert.equal(
    spellAttackBonusBreakdown(caster, []).value,
    spellAttackBonus(caster, [])
  )
  assert.equal(spellSaveDCBreakdown(caster, []).value, spellSaveDC(caster, []))
})

test('initiative: a feature with adds_ability_to_initiative adds that modifier once (Temporal Awareness)', () => {
  const wiz = {
    name: 'W',
    stat_str: 8,
    stat_dex: 14, // +2
    stat_con: 10,
    stat_int: 20, // +5
    stat_wis: 10,
    stat_cha: 10,
    features: [{ name: 'Temporal Awareness', adds_ability_to_initiative: 'int' }],
  }
  assert.strictEqual(initiative(wiz, []), 2 + 5)
  // two features naming the same ability still count it once
  const twice = {
    ...wiz,
    features: [...wiz.features, { name: 'Other', adds_ability_to_initiative: 'int' }],
  }
  assert.strictEqual(initiative(twice, []), 2 + 5)
  // no feature, no extra
  assert.strictEqual(initiative({ ...wiz, features: [] }, []), 2)
})

test('skillAdvantage: an item or feature granting it counts; an unattuned attunement-item does not', () => {
  const c = { name: 'A', stat_wis: 10, features: [] }
  const shield = { grants_skill_advantage: ['Perception'] }
  assert.strictEqual(skillAdvantage(c, 'Perception', [shield]), true)
  assert.strictEqual(skillAdvantage(c, 'Stealth', [shield]), false)
  assert.strictEqual(skillAdvantage(c, 'Perception', []), false)
  const needsAttune = { ...shield, needs_attunement: true, attuned: false }
  assert.strictEqual(skillAdvantage(c, 'Perception', [needsAttune]), false)
  assert.strictEqual(
    skillAdvantage(c, 'Perception', [{ ...needsAttune, attuned: true }]),
    true
  )
  assert.strictEqual(
    skillAdvantage(
      { ...c, features: [{ grants_skill_advantage: ['Perception'] }] },
      'Perception',
      []
    ),
    true
  )
})

test('passivePerception: advantage on Perception adds 5, shown as its own line', () => {
  const c = { name: 'A', stat_wis: 10, features: [] }
  const shield = { grants_skill_advantage: ['Perception'] }
  assert.strictEqual(passivePerception(c, []), 10)
  assert.strictEqual(passivePerception(c, [shield]), 15)
  assert.ok(
    passivePerceptionBreakdown(c, [shield]).breakdown.some(
      (l) => l.label === 'Advantage on Perception' && l.amount === 5
    )
  )
})

test('skill proficiency matches however the skill name is spelled (bug 2.2)', () => {
  const base = { name: 'T', stat_dex: 14, stat_wis: 14, level: 5, features: [] }
  // DEX +2, proficiency +3 at level 5 -> +5
  for (const spelling of ['Sleight of Hand', 'SleightOfHand', 'sleight-of-hand']) {
    const c = { ...base, skill_proficiencies: [spelling] }
    assert.strictEqual(skill(c, 'SleightOfHand', []), 5, spelling)
  }
  const wis = { ...base, skill_proficiencies: ['Animal Handling'] }
  assert.strictEqual(skill(wis, 'AnimalHandling', []), 5)
  const expert = { ...base, skill_expertise: ['Animal Handling'] }
  assert.strictEqual(skill(expert, 'AnimalHandling', []), 8)
  assert.deepStrictEqual(skillTraining(wis, 'AnimalHandling', []), {
    isProficient: true,
    hasExpertise: false,
  })
})
