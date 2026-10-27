const test = require('node:test')
const assert = require('node:assert/strict')
const {
  exhaustionEffects,
  speedAfterExhaustion,
} = require('../rules/5e/exhaustion')

test('2024 Exhaustion: -2 per level to D20 Tests, -5 ft Speed per level, death at 6', () => {
  const e3 = exhaustionEffects(3, '2024')
  assert.deepEqual(
    [e3.d20Penalty, e3.speedPenaltyFeet, e3.dead],
    [-6, 15, false]
  )
  assert.equal(exhaustionEffects(1, '2024').d20Penalty, -2)
  assert.equal(exhaustionEffects(0, '2024').d20Penalty, 0)
  assert.equal(exhaustionEffects(6, '2024').dead, true)
  assert.equal(exhaustionEffects(9, '2024').level, 6) // clamped
  assert.equal(speedAfterExhaustion(30, 2, '2024'), 20)
  assert.equal(speedAfterExhaustion(30, 6, '2024'), 0)
  assert.equal(speedAfterExhaustion(10, 3, '2024'), 0) // never negative
})
