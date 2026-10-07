const test = require('node:test')
const assert = require('node:assert')
const {
  hurlSomething,
  hurlDiceCount,
  maxHurlWeight,
  HURL_ACTION_COST,
} = require('../rules/5e/hurlSomething')

const hurler = (overrides = {}) => ({
  name: 'Brick',
  level: 9,
  classes: [{ name: 'Barbarian', level: 9 }],
  stat_str: 22, // +6
  stat_dex: 12,
  stat_con: 10,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
  features: [{ id: 'hb_hurl_something', name: 'Hurl Something' }],
  ...overrides,
})

test('hurlDiceCount: 1d4 per full 8 lb, never fewer than one', () => {
  assert.strictEqual(hurlDiceCount(3), 1)
  assert.strictEqual(hurlDiceCount(8), 1)
  assert.strictEqual(hurlDiceCount(15), 1)
  assert.strictEqual(hurlDiceCount(16), 2)
  assert.strictEqual(hurlDiceCount(110), 13)
})

test('maxHurlWeight: five pounds per point of Strength', () => {
  assert.strictEqual(maxHurlWeight(21), 105)
  assert.strictEqual(maxHurlWeight(22), 110)
})

test('hurlSomething: needs the feature AND effective Strength 21+', () => {
  assert.strictEqual(hurlSomething(hurler({ features: [] })), null)
  assert.strictEqual(hurlSomething(hurler({ stat_str: 20 })), null)
  assert.ok(hurlSomething(hurler({ stat_str: 21 })))
})

test('hurlSomething: Strength from a feature bonus counts toward the 21 minimum', () => {
  const c = hurler({
    stat_str: 20,
    features: [
      { id: 'hb_hurl_something', name: 'Hurl Something' },
      { name: 'Hulking Build', stat_bonuses: { str: 2 } },
    ],
  })
  assert.strictEqual(hurlSomething(c).maxWeight, 110)
})

test('hurlSomething: at the weight limit, STR 22 throws 13d4 +6 at +10 to hit', () => {
  const h = hurlSomething(hurler())
  assert.strictEqual(h.dice, '13d4')
  assert.strictEqual(h.weight, 110)
  assert.strictEqual(h.attack.value, 6 + 4)
  assert.strictEqual(h.damage.value, 6)
  assert.strictEqual(h.actionCost, HURL_ACTION_COST)
  assert.strictEqual(h.autoCritFromAboveFt, 20)
})

test('hurlSomething: a lighter object is fewer dice; heavier than the limit is clamped', () => {
  assert.strictEqual(hurlSomething(hurler(), [], { weight: 50 }).dice, '6d4')
  assert.strictEqual(hurlSomething(hurler(), [], { weight: 500 }).weight, 110)
})

test('hurlSomething: splash only above 40 lb, DC 8 + prof + STR mod', () => {
  assert.strictEqual(hurlSomething(hurler(), [], { weight: 40 }).splash, null)
  const s = hurlSomething(hurler(), [], { weight: 48 }).splash
  assert.strictEqual(s.dc, 8 + 4 + 6)
  assert.strictEqual(s.dice, '6d4')
  assert.strictEqual(s.onFail, 'half')
})

test("hurlSomething: Thrown Weapon Fighting +2 and Hurler's Rage (raging only) add to damage", () => {
  const features = [
    { id: 'hb_hurl_something', name: 'Hurl Something' },
    { id: 'fighting-style-thrown-weapon-fighting', name: 'TWF' },
    { id: 'hb_hurlers_rage', name: "Hurler's Rage" },
  ]
  assert.strictEqual(hurlSomething(hurler({ features })).damage.value, 6 + 2)
  const raging = hurlSomething(hurler({ features, conditions: ['Raging'] }))
  assert.strictEqual(raging.damage.value, 6 + 2 + 3) // Barbarian 9: +3
  assert.ok(
    raging.damage.breakdown.some((l) => l.label === 'Raging' && l.amount === 3)
  )
  // Rage damage without Hurler's Rage doesn't reach a thrown object.
  const noHurlersRage = hurler({
    features: features.slice(0, 2),
    conditions: ['Raging'],
  })
  assert.strictEqual(hurlSomething(noHurlersRage).damage.value, 6 + 2)
})
