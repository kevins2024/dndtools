const test = require('node:test')
const assert = require('node:assert/strict')
const { diffLevelUp } = require('../rules/diffLevelUp')

// Real attribution for ability score increases (2026-09-03) — the flagship
// item deferred earlier this session ("hold this for when I have more
// tokens"). Motivating cases: Jaygar's INT 20 (2 ASIs + Fade Away, no
// recorded trail) and Siv's DEX 20 (Human racial + 2 ASIs). See
// engine/CHECKLIST.md for the full design writeup — stat_str/etc. keep
// meaning "the final number" (additive, non-destructive); this is a purely
// explanatory history array.

function baseFighter(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 3,
    proficiency_bonus: 2,
    stat_str: 15,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 10,
    hp_max: 28,
    hp_current: 28,
    hit_dice_current: 3,
    features: [],
    spells: [],
    classes: [{ name: 'Fighter', subclass: 'Champion', level: 3 }],
    ...overrides,
  }
}

test('diffLevelUp: a plain ASI records a real ability_score_history entry', () => {
  const character = baseFighter()
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    asiOrFeatResolutions: { 4: { type: 'asi', increases: { str: 2 } } },
  })
  assert.equal(result.patch.stat_str, 17)
  assert.deepEqual(result.patch.ability_score_history, [
    {
      ability: 'str',
      amount: 2,
      source: 'Ability Score Improvement',
      level_gained: 4,
    },
  ])
})

test('diffLevelUp: a feat with its own ability bump records the FEAT as the source, not "Ability Score Improvement"', () => {
  const character = baseFighter()
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    asiOrFeatResolutions: {
      4: { type: 'feat', featName: 'Fade Away', abilityChoice: 'dex' },
    },
  })
  assert.equal(result.patch.stat_dex, 15)
  assert.deepEqual(result.patch.ability_score_history, [
    { ability: 'dex', amount: 1, source: 'Fade Away', level_gained: 4 },
  ])
})

test('diffLevelUp: a feat with NO ability_score_increase (e.g. Alert) records no history entry at all', () => {
  const character = baseFighter()
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    asiOrFeatResolutions: { 4: { type: 'feat', featName: 'Alert' } },
  })
  assert.equal(result.patch.ability_score_history, undefined)
})

test('diffLevelUp: history entries accumulate across levels and always sum correctly to the final stat', () => {
  // Jaygar's real-world shape: two ASIs plus a feat's own +1, all to the
  // same ability across 3 separate level-ups.
  let character = baseFighter({ stat_int: 15 })

  let result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    asiOrFeatResolutions: { 4: { type: 'asi', increases: { int: 2 } } },
  })
  character = { ...character, ...result.patch }
  assert.equal(character.stat_int, 17)

  result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 6,
    asiOrFeatResolutions: { 6: { type: 'asi', increases: { int: 2 } } },
  })
  character = { ...character, ...result.patch }
  assert.equal(character.stat_int, 19)

  result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 8,
    asiOrFeatResolutions: {
      8: { type: 'feat', featName: 'Fade Away', abilityChoice: 'int' },
    },
  })
  character = { ...character, ...result.patch }
  assert.equal(character.stat_int, 20)

  // 3 entries total, one per level-up, each on the right level.
  assert.equal(character.ability_score_history.length, 3)
  assert.deepEqual(
    character.ability_score_history.map((h) => h.level_gained),
    [4, 6, 8]
  )
  assert.deepEqual(
    character.ability_score_history.map((h) => h.source),
    ['Ability Score Improvement', 'Ability Score Improvement', 'Fade Away']
  )
  // The whole point: history sums back to exactly (final - starting base).
  const historySum = character.ability_score_history
    .filter((h) => h.ability === 'int')
    .reduce((sum, h) => sum + h.amount, 0)
  assert.equal(15 + historySum, character.stat_int)
})

test('diffLevelUp: an ASI that gets capped at 20 records the ACTUAL applied delta, not the requested amount', () => {
  const character = baseFighter({ stat_str: 19 })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    asiOrFeatResolutions: { 4: { type: 'asi', increases: { str: 2 } } },
  })
  assert.equal(result.patch.stat_str, 20)
  // Only +1 actually happened (19 -> 20), even though a full ASI was spent —
  // recording the requested +2 here would make the history NOT sum to the
  // final stat.
  assert.deepEqual(result.patch.ability_score_history, [
    {
      ability: 'str',
      amount: 1,
      source: 'Ability Score Improvement',
      level_gained: 4,
    },
  ])
})

test('diffLevelUp: pre-existing ability_score_history on the character is preserved, not overwritten', () => {
  const character = baseFighter({
    ability_score_history: [
      { ability: 'str', amount: 2, source: 'Human racial', level_gained: 1 },
    ],
  })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    asiOrFeatResolutions: { 4: { type: 'asi', increases: { str: 2 } } },
  })
  assert.equal(result.patch.ability_score_history.length, 2)
  assert.equal(result.patch.ability_score_history[0].source, 'Human racial')
  assert.equal(
    result.patch.ability_score_history[1].source,
    'Ability Score Improvement'
  )
})
