const test = require('node:test')
const assert = require('node:assert/strict')
const { resolveEffectiveStats } = require('../rules/5e/characterStats')
const { resolveEffectiveScores } = require('../rules/5e/abilityScores')

function baseChar(overrides = {}) {
  return {
    stat_str: 10,
    stat_dex: 14,
    stat_con: 12,
    stat_int: 8,
    stat_wis: 10,
    stat_cha: 16,
    features: [],
    ...overrides,
  }
}

test('resolveEffectiveStats: no items/features returns base scores and empty bonus buckets', () => {
  const { scores, bonuses, unarmoredBonuses } = resolveEffectiveStats(
    baseChar(),
    []
  )
  assert.deepEqual(scores, {
    str: 10,
    dex: 14,
    con: 12,
    int: 8,
    wis: 10,
    cha: 16,
  })
  assert.deepEqual(bonuses, {})
  assert.deepEqual(unarmoredBonuses, {})
})

test('resolveEffectiveStats: stat_overrides sets a score to a fixed value regardless of base', () => {
  const items = [{ stat_overrides: { con: 19 } }]
  const { scores } = resolveEffectiveStats(baseChar(), items)
  assert.equal(scores.con, 19)
})

test('resolveEffectiveStats: item stat_bonuses routes ability keys to scores, everything else to bonuses', () => {
  const items = [{ stat_bonuses: { dex: 1, ac: 2, melee_attack: 1 } }]
  const { scores, bonuses } = resolveEffectiveStats(baseChar(), items)
  assert.equal(scores.dex, 15) // 14 base + 1
  assert.equal(bonuses.ac, 2)
  assert.equal(bonuses.melee_attack, 1)
  assert.equal(scores.ac, undefined) // never leaks into scores
})

test('resolveEffectiveStats: feature stat_bonuses use the exact same routing as item stat_bonuses', () => {
  const character = baseChar({
    features: [
      { name: 'Elven Accuracy', stat_bonuses: { dex: 1 } },
      { name: 'Fighting Style: Defense', stat_bonuses: { ac: 1 } },
    ],
  })
  const { scores, bonuses } = resolveEffectiveStats(character, [])
  assert.equal(scores.dex, 15)
  assert.equal(bonuses.ac, 1)
})

test('resolveEffectiveStats: unarmored_stat_bonuses accumulate separately from stat_bonuses', () => {
  const items = [{ unarmored_stat_bonuses: { ac_unarmored_con: 1 } }]
  const { unarmoredBonuses, bonuses } = resolveEffectiveStats(baseChar(), items)
  assert.equal(unarmoredBonuses.ac_unarmored_con, 1)
  assert.equal(bonuses.ac_unarmored_con, undefined)
})

test('resolveEffectiveScores stays a thin scores-only view of resolveEffectiveStats (same numbers, no bonuses leak in)', () => {
  const character = baseChar({
    features: [{ name: 'Fighting Style: Defense', stat_bonuses: { ac: 1 } }],
  })
  const items = [{ stat_bonuses: { str: 2 } }]
  const scores = resolveEffectiveScores(character, items)
  const full = resolveEffectiveStats(character, items)
  assert.deepEqual(scores, full.scores)
  assert.equal(scores.str, 12)
})
