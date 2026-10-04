const test = require('node:test')
const assert = require('node:assert')
const {
  weaveDustForRoll,
  weaveDustEstimateRange,
} = require('../rules/houseRules')

test('weaveDustForRoll: no value_gp means null, not 0', () => {
  assert.strictEqual(weaveDustForRoll({}, 10), null)
  assert.strictEqual(weaveDustForRoll(null, 10), null)
  assert.strictEqual(weaveDustEstimateRange({}), null)
})

test('weaveDustForRoll: base is value/15, roll shifts it by 1% per step from the 10/11 midpoint', () => {
  const item = { value_gp: 1500 } // base 100
  assert.strictEqual(weaveDustForRoll(item, 11), 101)
  assert.strictEqual(weaveDustForRoll(item, 10), 99)
  assert.strictEqual(weaveDustForRoll(item, 19), 109)
  assert.strictEqual(weaveDustForRoll(item, 2), 91)
})

test('weaveDustForRoll: natural 20 doubles, natural 1 halves, result rounds down', () => {
  const item = { value_gp: 1500 }
  assert.strictEqual(weaveDustForRoll(item, 20), 200)
  assert.strictEqual(weaveDustForRoll(item, 1), 50)
  assert.strictEqual(weaveDustForRoll({ value_gp: 100 }, 11), 6) // 6.666 * 1.01
})

test('weaveDustForRoll: missing charges cost up to 30%', () => {
  const empty = { value_gp: 1500, charges_max: 10, charges_current: 0 }
  assert.strictEqual(weaveDustForRoll(empty, 20), 140) // 100 * 0.7 * 2
  const half = { value_gp: 1500, charges_max: 10, charges_current: 5 }
  assert.strictEqual(weaveDustForRoll(half, 20), 170) // 100 * 0.85 * 2
})

test('weaveDustForRoll: material-recharge items also lose the cost of the missing materials', () => {
  const wand = {
    value_gp: 1500,
    charges_max: 10,
    charges_current: 5,
    charges_recharge_type: 'material',
    charges_recharge_material_cost_gp: 30,
  }
  // base 100 * 0.85 = 85, minus 5 * 30 / 15 = 10 -> 75, roll 20 doubles
  assert.strictEqual(weaveDustForRoll(wand, 20), 150)
})

test('weaveDustForRoll: never negative', () => {
  const wand = {
    value_gp: 150,
    charges_max: 10,
    charges_current: 0,
    charges_recharge_type: 'material',
    charges_recharge_material_cost_gp: 500,
  }
  assert.strictEqual(weaveDustForRoll(wand, 10), 0)
})

test('weaveDustEstimateRange: low/high are the non-crit extremes (rolls 2 and 19)', () => {
  assert.deepStrictEqual(weaveDustEstimateRange({ value_gp: 1500 }), {
    low: 91,
    high: 109,
  })
})

const { crowdStrength, crowdAreaDamage } = require('../rules/houseRules')

test('crowdStrength: matches the house-rule example (5 creatures, 50 max HP)', () => {
  const at = (hp) => crowdStrength({ size: 5, maxHp: 50, damage: 50 - hp })
  assert.strictEqual(at(50), 5)
  assert.strictEqual(at(41), 5)
  assert.strictEqual(at(40), 4)
  assert.strictEqual(at(31), 4)
  assert.strictEqual(at(30), 3)
  assert.strictEqual(at(20), 2)
  assert.strictEqual(at(10), 1)
  assert.strictEqual(at(1), 1)
  assert.strictEqual(at(0), 0)
})

test('crowdStrength: null when not a crowd or max HP unknown; damage past max floors at 0', () => {
  assert.strictEqual(crowdStrength({ size: 1, maxHp: 50, damage: 0 }), null)
  assert.strictEqual(crowdStrength({ size: null, maxHp: 50, damage: 0 }), null)
  assert.strictEqual(crowdStrength({ size: 5, maxHp: null, damage: 0 }), null)
  assert.strictEqual(crowdStrength({ size: 5, maxHp: 50, damage: 80 }), 0)
})

test('crowdAreaDamage: halved then multiplied by Strength (the rule\'s fireball example)', () => {
  assert.strictEqual(crowdAreaDamage(20, 3), 30)
})
