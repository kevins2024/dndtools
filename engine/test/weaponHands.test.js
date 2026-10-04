const test = require('node:test')
const assert = require('node:assert')
const {
  isOneHandedWeapon,
  setHand,
  nextHand,
  loadoutHands,
} = require('../rules/5e/weaponHands')

const char = { name: 'Denna' }
const dagger = (id, extra = {}) => ({
  id,
  name: id,
  type: 'weapon',
  slot: 'melee1h',
  equipped_by: 'Denna',
  ...extra,
})

test('isOneHandedWeapon: 1H melee/ranged yes, 2H and non-weapons no', () => {
  assert.ok(isOneHandedWeapon(dagger('a')))
  assert.ok(isOneHandedWeapon(dagger('a', { slot: 'ranged1h' })))
  assert.ok(!isOneHandedWeapon(dagger('a', { slot: 'melee2h' })))
  assert.ok(!isOneHandedWeapon({ id: 'r', type: 'wondrous', slot: 'ring' }))
})

test('nextHand cycles unassigned -> main -> off -> unassigned', () => {
  assert.strictEqual(nextHand(null), 'main')
  assert.strictEqual(nextHand(undefined), 'main')
  assert.strictEqual(nextHand('main'), 'off')
  assert.strictEqual(nextHand('off'), null)
})

test('setHand: with exactly one other one-handed weapon, it gets the opposite hand', () => {
  const a = dagger('a')
  const b = dagger('b')
  assert.deepStrictEqual(setHand(a, [a, b], 'main'), [
    { id: 'a', hand: 'main' },
    { id: 'b', hand: 'off' },
  ])
  assert.deepStrictEqual(setHand(a, [a, b], 'off'), [
    { id: 'a', hand: 'off' },
    { id: 'b', hand: 'main' },
  ])
})

test('setHand: promoting the off-hand weapon to main swaps them', () => {
  const a = dagger('a', { hand: 'main' })
  const b = dagger('b', { hand: 'off' })
  const patches = setHand(b, [a, b], 'main')
  assert.deepStrictEqual(
    Object.fromEntries(patches.map((p) => [p.id, p.hand])),
    {
      a: 'off',
      b: 'main',
    }
  )
})

test('setHand: clearing a hand touches only that weapon', () => {
  const a = dagger('a', { hand: 'main' })
  const b = dagger('b', { hand: 'off' })
  assert.deepStrictEqual(setHand(a, [a, b], null), [{ id: 'a', hand: null }])
})

test('setHand: with three one-handers, only a same-hand conflict is cleared', () => {
  const a = dagger('a', { hand: 'main' })
  const b = dagger('b', { hand: 'off' })
  const c = dagger('c')
  const patches = setHand(c, [a, b, c], 'main')
  const out = Object.fromEntries(patches.map((p) => [p.id, p.hand]))
  assert.strictEqual(out.c, 'main')
  assert.strictEqual(out.a, null) // lost main
  assert.ok(!('b' in out)) // off hand untouched
})

test('setHand: loadouts are independent — Set 1 main does not clash with Set 2 main', () => {
  const s1 = dagger('s1', { weapon_set: 1, hand: 'main' })
  const s2a = dagger('s2a', { weapon_set: 2 })
  const s2b = dagger('s2b', { weapon_set: 2 })
  const patches = setHand(s2a, [s1, s2a, s2b], 'main')
  assert.deepStrictEqual(
    Object.fromEntries(patches.map((p) => [p.id, p.hand])),
    { s2a: 'main', s2b: 'off' }
  )
})

test('setHand: a set-agnostic weapon shares a loadout with both sets', () => {
  const any = dagger('any', { hand: 'main' }) // no weapon_set
  const s2 = dagger('s2', { weapon_set: 2 })
  const patches = setHand(s2, [any, s2], 'main')
  assert.deepStrictEqual(
    Object.fromEntries(patches.map((p) => [p.id, p.hand])),
    { s2: 'main', any: 'off' }
  )
})

test('setHand: two-handed weapons have no hand', () => {
  const gs = dagger('gs', { slot: 'melee2h' })
  assert.deepStrictEqual(setHand(gs, [gs], 'main'), [])
})

test('loadoutHands: two unassigned one-handers are ambiguous', () => {
  const items = [dagger('a'), dagger('b')]
  const h = loadoutHands(char, items)
  assert.strictEqual(h.main, null)
  assert.strictEqual(h.ambiguous, true)
  assert.strictEqual(h.unassigned.length, 2)
})

test('loadoutHands: fully assigned pair reports main/off and is not ambiguous', () => {
  const a = dagger('a', { hand: 'main' })
  const b = dagger('b', { hand: 'off' })
  const h = loadoutHands(char, [a, b])
  assert.strictEqual(h.main, a)
  assert.strictEqual(h.off, b)
  assert.strictEqual(h.ambiguous, false)
})

test('loadoutHands: one weapon + shield is unambiguous; the shield is the off hand', () => {
  const sword = dagger('sword')
  const shield = {
    id: 'sh',
    type: 'armor',
    armor_type: 'shield',
    equipped_by: 'Denna',
  }
  const h = loadoutHands(char, [sword, shield])
  assert.strictEqual(h.off, shield)
  assert.strictEqual(h.ambiguous, false)
})

test('loadoutHands: a lone weapon, or a two-hander, is never ambiguous', () => {
  assert.strictEqual(loadoutHands(char, [dagger('a')]).ambiguous, false)
  const gs = dagger('gs', { slot: 'melee2h' })
  const h = loadoutHands(char, [gs])
  assert.strictEqual(h.twoHanded, gs)
  assert.strictEqual(h.ambiguous, false)
})

test('loadoutHands: only the active loadout counts, and setNum asks about the other', () => {
  const a = dagger('a', { weapon_set: 1, hand: 'main' })
  const b = dagger('b', { weapon_set: 1, hand: 'off' })
  const c = dagger('c', { weapon_set: 2 })
  const d = dagger('d', { weapon_set: 2 })
  const set1 = { ...char, active_weapon_set: 1 }
  assert.strictEqual(loadoutHands(set1, [a, b, c, d]).ambiguous, false)
  assert.strictEqual(loadoutHands(set1, [a, b, c, d], 2).ambiguous, true)
})

test('loadoutHands: ignores weapons equipped by someone else', () => {
  const mine = dagger('mine')
  const theirs = dagger('theirs', { equipped_by: 'Vaz' })
  assert.strictEqual(loadoutHands(char, [mine, theirs]).ambiguous, false)
})
