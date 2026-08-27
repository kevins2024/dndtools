const test = require('node:test')
const assert = require('node:assert/strict')
const {
  scoreCost,
  pointBuyCost,
  validatePointBuy,
  BUDGET,
} = require('../rules/pointBuy')

test('scoreCost matches the standard 5e point buy table', () => {
  assert.equal(scoreCost(8), 0)
  assert.equal(scoreCost(9), 1)
  assert.equal(scoreCost(10), 2)
  assert.equal(scoreCost(11), 3)
  assert.equal(scoreCost(12), 4)
  assert.equal(scoreCost(13), 5)
  assert.equal(scoreCost(14), 7)
  assert.equal(scoreCost(15), 9)
})

test('scoreCost rejects anything outside 8-15', () => {
  assert.throws(() => scoreCost(7))
  assert.throws(() => scoreCost(16))
  assert.throws(() => scoreCost(12.5))
})

test('pointBuyCost: classic "max two stats" spread (15,14,13,12,10,8) costs exactly the full 27-point budget', () => {
  const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
  assert.equal(pointBuyCost(scores), 27)
})

test('validatePointBuy flags an over-budget spread and reports remaining correctly', () => {
  const cheap = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
  const cheapResult = validatePointBuy(cheap)
  assert.equal(cheapResult.cost, 0)
  assert.equal(cheapResult.remaining, BUDGET)
  assert.ok(cheapResult.valid)

  const allFifteens = { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 }
  const overResult = validatePointBuy(allFifteens)
  assert.equal(overResult.cost, 54)
  assert.ok(!overResult.valid)
})
