const test = require('node:test')
const assert = require('node:assert/strict')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')

// The PHB "Multiclassing Proficiencies" table grants a real skill choice to
// Bard/Ranger/Rogue on pickup — previously only ever surfaced as a warning
// telling the player to add it by hand (see TODO.md's Level Up tool audit,
// finding #9). Now a real pendingChoice/patch path, reusing the same
// skill_choices.options data (engine/data/classes/<class>.json) the New
// Character tool's own class-skill picker already reads.

function baseFighter(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    proficiency_bonus: 3,
    stat_str: 16,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 13,
    stat_wis: 10,
    stat_cha: 8,
    hp_max: 44,
    hp_current: 44,
    hit_dice_current: 5,
    spellcasting_ability: null,
    features: [],
    spells: [],
    skill_proficiencies: ['Athletics', 'Intimidation'],
    classes: [{ name: 'Fighter', subclass: 'Champion', level: 5 }],
    ...overrides,
  }
}

test('diffLevelUp: an unresolved multiclass skill grant is a real pendingChoice, not a warning', () => {
  const character = baseFighter() // DEX 14 meets Rogue's prereq
  const result = diffLevelUp(character, { className: 'Rogue' })
  const choice = result.pendingChoices.find(
    (p) => p.type === 'multiclassSkillChoice'
  )
  assert.ok(choice)
  assert.equal(choice.count, 1)
  assert.equal(choice.className, 'Rogue')
  assert.equal(result.patch.skill_proficiencies, undefined)
})

test('diffLevelUp: a valid multiclass skill choice resolves it and adds the real display name', () => {
  const character = baseFighter()
  const result = diffLevelUp(character, {
    className: 'Rogue',
    multiclassSkillChoice: 'stealth',
  })
  assert.ok(
    !result.pendingChoices.some((p) => p.type === 'multiclassSkillChoice')
  )
  assert.ok(result.patch.skill_proficiencies.includes('Stealth'))
  // Existing proficiencies are preserved, not clobbered.
  assert.ok(result.patch.skill_proficiencies.includes('Athletics'))
})

test("diffLevelUp: a skill not on the class's own list is rejected with a warning and re-offered as a pendingChoice", () => {
  const character = baseFighter()
  const result = diffLevelUp(character, {
    className: 'Rogue',
    multiclassSkillChoice: 'arcana', // not on Rogue's skill_choices.options
  })
  assert.ok(
    result.warnings.some((w) => w.includes('arcana') && w.includes("isn't"))
  )
  assert.ok(
    result.pendingChoices.some((p) => p.type === 'multiclassSkillChoice')
  )
  assert.equal(result.patch.skill_proficiencies, undefined)
})

test('diffLevelUp: a multiclass skill choice already known is a no-op note, not a wasted or duplicated proficiency', () => {
  const character = baseFighter({ skill_proficiencies: ['Stealth'] })
  const result = diffLevelUp(character, {
    className: 'Rogue',
    multiclassSkillChoice: 'stealth',
  })
  assert.ok(
    result.warnings.some((w) => w.includes('Stealth') && w.includes('already'))
  )
  assert.equal(result.patch.skill_proficiencies, undefined)
  assert.ok(
    !result.pendingChoices.some((p) => p.type === 'multiclassSkillChoice')
  )
})

test("diffLevelUp: Bard's skill_choices.options === 'any' allows any real skill, not just a fixed sublist", () => {
  const character = baseFighter({ stat_cha: 14 }) // meets Bard's CHA 13 prereq
  const result = diffLevelUp(character, {
    className: 'Bard',
    multiclassSkillChoice: 'arcana',
  })
  assert.ok(result.patch.skill_proficiencies.includes('Arcana'))
})

test('diffLevelUp: a class with no skill grant in the multiclass table (Fighter) never produces a multiclassSkillChoice', () => {
  const character = baseFighter({
    stat_str: 14,
    classes: [{ name: 'Wizard', level: 5 }],
  })
  const result = diffLevelUp(character, { className: 'Fighter' })
  assert.ok(
    !result.pendingChoices.some((p) => p.type === 'multiclassSkillChoice')
  )
})

test('diffLevelUp: leveling an EXISTING class never offers a multiclass skill choice, even if that class normally grants one on pickup', () => {
  const character = baseFighter({
    classes: [{ name: 'Rogue', subclass: 'Thief', level: 3 }],
  })
  const result = diffLevelUp(character, { className: 'Rogue' })
  assert.ok(
    !result.pendingChoices.some((p) => p.type === 'multiclassSkillChoice')
  )
})
