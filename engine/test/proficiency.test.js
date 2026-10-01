const test = require('node:test')
const assert = require('node:assert/strict')
const {
  effectiveProficiencyBonus,
  effectiveProficiencyBonusBreakdown,
} = require('../rules/5e/proficiency')

test('effectiveProficiencyBonus: level-table base, no item bonus', () => {
  const character = { level: 9 }
  assert.equal(effectiveProficiencyBonus(character, {}), 4)
})

test('effectiveProficiencyBonus: a manual override on the character wins over the level table', () => {
  const character = { level: 9, proficiency_bonus: 6 }
  assert.equal(effectiveProficiencyBonus(character, {}), 6)
})

test('effectiveProficiencyBonusBreakdown: value matches effectiveProficiencyBonus, and an item bonus appears as a named line', () => {
  const character = { level: 9 }
  const bonuses = { proficiency_bonus: 1 }
  const items = [
    { name: 'Ioun Stone of Mastery', stat_bonuses: { proficiency_bonus: 1 } },
  ]
  const { value, breakdown } = effectiveProficiencyBonusBreakdown(
    character,
    bonuses,
    items
  )
  assert.equal(value, effectiveProficiencyBonus(character, bonuses))
  assert.equal(value, 5)
  assert.ok(
    breakdown.some((l) => l.label === 'Ioun Stone of Mastery' && l.amount === 1)
  )
})

test('effectiveProficiencyBonusBreakdown: falls back to a generic "Item/feature bonus" line when the source item was not passed in', () => {
  const character = { level: 9 }
  const bonuses = { proficiency_bonus: 1 }
  const { value, breakdown } = effectiveProficiencyBonusBreakdown(
    character,
    bonuses
  )
  assert.equal(value, 5)
  assert.ok(
    breakdown.some((l) => l.label === 'Item/feature bonus' && l.amount === 1)
  )
})
