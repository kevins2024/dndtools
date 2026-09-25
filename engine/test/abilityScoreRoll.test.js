const test = require('node:test')
const assert = require('node:assert/strict')
const {
  abilityScoreFromDice,
  rollD6,
  rollAbilityScore,
  rollAbilityScoreSet,
} = require('../rules/5e/abilityScoreRoll')

test('abilityScoreFromDice drops the single lowest die and sums the rest', () => {
  const result = abilityScoreFromDice([6, 6, 6, 1])
  assert.equal(result.droppedIndex, 3)
  assert.equal(result.total, 18)
  assert.deepEqual(result.dice, [6, 6, 6, 1])
})

test('abilityScoreFromDice drops only ONE occurrence when the lowest value repeats', () => {
  // Two 2s tied for lowest — only one gets dropped, not both.
  const result = abilityScoreFromDice([2, 2, 5, 4])
  assert.equal(result.droppedIndex, 0)
  assert.equal(result.total, 11) // 2 + 5 + 4, the second 2 stays
})

test('abilityScoreFromDice: worst possible roll (all 1s) totals 3', () => {
  const result = abilityScoreFromDice([1, 1, 1, 1])
  assert.equal(result.total, 3)
})

test('abilityScoreFromDice: best possible roll (all 6s) totals 18', () => {
  const result = abilityScoreFromDice([6, 6, 6, 6])
  assert.equal(result.total, 18)
})

test('rollD6 always returns an integer 1-6', () => {
  for (let i = 0; i < 200; i++) {
    const roll = rollD6()
    assert.ok(Number.isInteger(roll))
    assert.ok(roll >= 1 && roll <= 6)
  }
})

test('rollAbilityScore produces a total between 3 and 18 with real dice attached', () => {
  for (let i = 0; i < 100; i++) {
    const result = rollAbilityScore()
    assert.equal(result.dice.length, 4)
    assert.ok(result.total >= 3 && result.total <= 18)
  }
})

test('rollAbilityScoreSet produces exactly 6 independent rolls', () => {
  const set = rollAbilityScoreSet()
  assert.equal(set.length, 6)
  for (const result of set) {
    assert.ok(result.total >= 3 && result.total <= 18)
  }
})
