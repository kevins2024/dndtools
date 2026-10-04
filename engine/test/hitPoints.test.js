const test = require('node:test')
const assert = require('node:assert')
const {
  effectiveMaxHp,
  applyDamage,
  applyHealing,
  applyTempHp,
  applyTrackedDamage,
  applyTrackedHealing,
  applyTrackedTempHp,
  concentrationDC,
} = require('../rules/5e/hitPoints')

test('applyDamage: temp HP absorbs first, remainder hits hp_current', () => {
  const r = applyDamage({ hp_current: 20, hp_max: 30, hp_temp: 5 }, 8)
  assert.deepStrictEqual(r.patch, { hp_temp: 0, hp_current: 17 })
  assert.strictEqual(r.absorbed, 5)
  assert.strictEqual(r.dealt, 3)
})

test('applyDamage: damage fully inside temp HP leaves hp_current alone', () => {
  const r = applyDamage({ hp_current: 20, hp_max: 30, hp_temp: 10 }, 4)
  assert.deepStrictEqual(r.patch, { hp_temp: 6, hp_current: 20 })
  assert.strictEqual(r.dealt, 0)
})

test('applyDamage: hp_current floors at 0 and dealt reflects the real loss', () => {
  const r = applyDamage({ hp_current: 4, hp_max: 30 }, 10)
  assert.strictEqual(r.patch.hp_current, 0)
  assert.strictEqual(r.dealt, 4)
})

test('applyDamage: non-positive amount is a no-op', () => {
  assert.deepStrictEqual(applyDamage({ hp_current: 5 }, 0).patch, {})
  assert.deepStrictEqual(applyDamage({ hp_current: 5 }, -3).patch, {})
})

test('applyHealing: capped at hp_max + hp_max_modifier', () => {
  const c = { hp_current: 25, hp_max: 30, hp_max_modifier: 5 }
  assert.strictEqual(effectiveMaxHp(c), 35)
  const r = applyHealing(c, 20)
  assert.strictEqual(r.patch.hp_current, 35)
  assert.strictEqual(r.healed, 10)
})

test('applyHealing: a negative max modifier lowers the cap', () => {
  const r = applyHealing(
    { hp_current: 20, hp_max: 30, hp_max_modifier: -8 },
    20
  )
  assert.strictEqual(r.patch.hp_current, 22)
})

test('applyTempHp: does not stack, keeps the higher', () => {
  assert.strictEqual(applyTempHp({ hp_temp: 5 }, 8).patch.hp_temp, 8)
  assert.strictEqual(applyTempHp({ hp_temp: 9 }, 8).patch.hp_temp, 9)
  assert.strictEqual(applyTempHp({}, 4).patch.hp_temp, 4)
})

test('applyTrackedDamage: enemy temp HP absorbs first, damage tracks the rest', () => {
  const r = applyTrackedDamage({ damage: 3, maxHp: 20, tempHp: 4 }, 10)
  assert.deepStrictEqual(r.hp, { damage: 9, maxHp: 20, tempHp: 0 })
  assert.strictEqual(r.absorbed, 4)
})

test('applyTrackedDamage: no temp HP means all of it counts', () => {
  const r = applyTrackedDamage({ damage: 0, maxHp: null, tempHp: 0 }, 7)
  assert.strictEqual(r.hp.damage, 7)
  assert.strictEqual(r.absorbed, 0)
})

test('applyTrackedHealing: damage floors at 0', () => {
  assert.strictEqual(applyTrackedHealing({ damage: 5 }, 12).hp.damage, 0)
  assert.strictEqual(applyTrackedHealing({ damage: 9 }, 4).hp.damage, 5)
})

test('applyTrackedTempHp: keeps the higher', () => {
  assert.strictEqual(
    applyTrackedTempHp({ damage: 0, tempHp: 6 }, 3).hp.tempHp,
    6
  )
  assert.strictEqual(
    applyTrackedTempHp({ damage: 0, tempHp: 2 }, 3).hp.tempHp,
    3
  )
})

test('concentrationDC: 10 or half the damage, whichever is higher', () => {
  assert.strictEqual(concentrationDC(1), 10)
  assert.strictEqual(concentrationDC(20), 10)
  assert.strictEqual(concentrationDC(21), 10)
  assert.strictEqual(concentrationDC(22), 11)
  assert.strictEqual(concentrationDC(45), 22)
})
