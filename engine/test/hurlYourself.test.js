const test = require('node:test')
const assert = require('node:assert')
const {
  hurlYourself,
  hurlYourselfDamage,
  HURL_YOURSELF_MULTIPLIER,
} = require('../rules/5e/hurlYourself')
const { HURL_ACTION_COST } = require('../rules/5e/hurlSomething')
const { longJumpFeet, highJumpFeet } = require('../rules/5e/jump')
const {
  fallTier,
  fallDiceCount,
  fallDC,
  fallDamage,
  rollFall,
  fallCheckOptions,
  isLethalFall,
  FALL_CAP_DAMAGE,
} = require('../rules/5e/fall')
const { landingImpact } = require('../rules/houseRules')

const brute = (overrides = {}) => ({
  name: 'Brick',
  level: 9,
  classes: [{ name: 'Barbarian', level: 9 }],
  stat_str: 22, // +6
  stat_dex: 12, // +1
  stat_con: 18, // +4
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
  saving_throws: ['str', 'con'],
  skill_proficiencies: [],
  features: [{ id: 'hb_hurl_yourself', name: 'Hurl Yourself' }],
  ...overrides,
})

test('jump: long jump is STR feet running, half standing; high jump is 3 + STR mod', () => {
  assert.strictEqual(longJumpFeet(22), 22)
  assert.strictEqual(longJumpFeet(22, { running: false }), 11)
  assert.strictEqual(highJumpFeet(22), 9)
  assert.strictEqual(highJumpFeet(22, { running: false }), 4)
})

test('fall: tier is one per full 10 ft; dice are the triangular number of the tier', () => {
  assert.strictEqual(fallTier(9), 0)
  assert.strictEqual(fallTier(10), 1)
  assert.strictEqual(fallTier(59), 5)
  assert.deepStrictEqual(
    [10, 20, 30, 40, 50, 60].map(fallDiceCount),
    [1, 3, 6, 10, 15, 21]
  )
  assert.strictEqual(fallDiceCount(5), null)
})

test('fall: DC is 14 + tier, and there is nothing to resist under 10 ft or over 60', () => {
  assert.deepStrictEqual([10, 30, 60].map(fallDC), [15, 17, 20])
  assert.strictEqual(fallDC(5), null)
  assert.strictEqual(fallDC(61), null)
})

test('fall: more than 60 ft is lethal and rolls nothing', () => {
  assert.strictEqual(isLethalFall(60), false)
  assert.strictEqual(isLethalFall(61), true)
  assert.deepStrictEqual(fallDamage(100), { lethal: true })
  assert.deepStrictEqual(rollFall(100), { lethal: true })
})

test('fall: d8 by default, d6 when braced, with min/avg/max', () => {
  const unbraced = fallDamage(50)
  assert.strictEqual(unbraced.dice, '15d8')
  assert.deepStrictEqual(
    [unbraced.min, unbraced.avg, unbraced.max],
    [15, 67.5, 120]
  )
  const braced = fallDamage(50, { braced: true })
  assert.strictEqual(braced.dice, '15d6')
  assert.deepStrictEqual([braced.min, braced.avg, braced.max], [15, 52.5, 90])
  assert.strictEqual(fallDamage(60).max, FALL_CAP_DAMAGE) // 21d8 max = 168
})

test('rollFall: rolls each die separately and sums them', () => {
  const seq = [0, 0.99, 0.5] // d8: 1, 8, 5
  let i = 0
  const r = rollFall(20, { rng: () => seq[i++ % seq.length] })
  assert.deepStrictEqual(r.rolls, [1, 8, 5])
  assert.strictEqual(r.total, 14)
  assert.strictEqual(r.die, 8)
  assert.strictEqual(r.dice, '3d8')
  assert.strictEqual(r.dc, 16)
})

test('fallCheckOptions: Acrobatics vs CON save with real bonuses, better one named', () => {
  const c = brute({ skill_proficiencies: ['Acrobatics'] })
  const o = fallCheckOptions(c, [], 30)
  assert.strictEqual(o.dc, 17)
  assert.strictEqual(o.constitution, 4 + 4) // CON +4, proficient (+4)
  assert.strictEqual(o.acrobatics, 1 + 4) // DEX +1, proficient
  assert.strictEqual(o.best, 'constitution')
  assert.strictEqual(fallCheckOptions(c, [], 5), null)
})

test('hurlYourself: needs the feature and Strength 21+', () => {
  assert.strictEqual(hurlYourself(brute({ features: [] })), null)
  assert.strictEqual(hurlYourself(brute({ stat_str: 20 })), null)
  assert.ok(hurlYourself(brute({ stat_str: 21 })))
})

test('hurlYourself: jump range, the shared action cost, two targets, x2', () => {
  const h = hurlYourself(brute())
  assert.deepStrictEqual(h.range, { jump: 22 })
  assert.strictEqual(h.actionCost, HURL_ACTION_COST)
  assert.strictEqual(h.maxTargets, 2)
  assert.strictEqual(h.multiplier, 2)
  assert.strictEqual(h.fall, null) // no height given
})

test('hurlYourself: uses the campaign fall table, and a leap over 60 ft is lethal', () => {
  assert.strictEqual(
    hurlYourself(brute(), [], { heightFt: 30 }).fall.dice,
    '6d8'
  )
  assert.strictEqual(
    hurlYourself(brute(), [], { heightFt: 30, braced: true }).fall.dice,
    '6d6'
  )
  const lethal = hurlYourself(brute(), [], { heightFt: 80 })
  assert.strictEqual(lethal.lethal, true)
  assert.deepStrictEqual(lethal.fall, { lethal: true })
})

test("hurlYourselfDamage: each target takes double; the house rule's immunity and resistance apply", () => {
  assert.strictEqual(HURL_YOURSELF_MULTIPLIER, 2)
  assert.deepStrictEqual(hurlYourselfDamage(27, {}), {
    damage: 54,
    modifier: 'none',
  })
  assert.strictEqual(
    hurlYourselfDamage(27, { immunities: ['bludgeoning'] }).damage,
    0
  )
  assert.strictEqual(
    hurlYourselfDamage(27, { resistances: ['bludgeoning'] }).damage,
    27
  )
})

test('landingImpact: the target takes the same damage the faller took', () => {
  assert.deepStrictEqual(landingImpact(14, {}), {
    damage: 14,
    modifier: 'none',
  })
})

test('landingImpact: bludgeoning immunity blocks it; resistance halves; vulnerability doubles', () => {
  assert.strictEqual(
    landingImpact(14, { immunities: ['Bludgeoning'] }).damage,
    0
  )
  assert.strictEqual(
    landingImpact(14, { resistances: ['bludgeoning'] }).damage,
    7
  )
  assert.strictEqual(
    landingImpact(14, { vulnerabilities: ['bludgeoning'] }).damage,
    28
  )
})

test('landingImpact: nonmagical-attack resistance clauses and other types do not apply; no fall, no impact', () => {
  assert.strictEqual(
    landingImpact(14, {
      resistances: ['bludgeoning from nonmagical attacks', 'fire'],
    }).damage,
    14
  )
  assert.strictEqual(landingImpact(0, {}).damage, 0)
})

test('landingImpact (lethal fall): Large or smaller dies, bigger takes the table maximum, immune is untouched', () => {
  const lethal = { lethal: true }
  assert.deepStrictEqual(landingImpact(0, { size: 'Medium' }, lethal), {
    damage: null,
    modifier: 'none',
    dies: true,
  })
  assert.strictEqual(landingImpact(0, {}, lethal).dies, true) // size unknown = Medium
  assert.strictEqual(landingImpact(0, { size: 'Large' }, lethal).dies, true)
  assert.strictEqual(
    landingImpact(0, { size: 'Gargantuan' }, lethal).damage,
    FALL_CAP_DAMAGE
  )
  assert.strictEqual(
    landingImpact(0, { size: 'Huge', resistances: ['bludgeoning'] }, lethal)
      .damage,
    FALL_CAP_DAMAGE / 2
  )
  assert.strictEqual(
    landingImpact(0, { size: 'Small', immunities: ['bludgeoning'] }, lethal)
      .damage,
    0
  )
})
