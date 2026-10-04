const test = require('node:test')
const assert = require('node:assert')
const {
  rollInitiativeFor,
  rollInitiativeOrder,
  sortByInitiative,
} = require('../rules/5e/initiative')

// rng returning the given d20 faces in order (then repeating the last).
const faces = (...fs) => {
  let i = 0
  return () => (fs[Math.min(i++, fs.length - 1)] - 1) / 20 + 0.001
}

test('rollInitiativeFor: d20 + modifier', () => {
  const r = rollInitiativeFor({ key: 'a', mod: 3 }, faces(12))
  assert.deepStrictEqual(r, { natural: 12, total: 15 })
})

test('rollInitiativeFor: advantage keeps the higher of two d20s', () => {
  const r = rollInitiativeFor(
    { key: 'a', mod: 0, advantage: true },
    faces(4, 17)
  )
  assert.deepStrictEqual(r, { natural: 17, total: 17 })
})

test('rollInitiativeOrder: no ties means every tiebreakOrder is 0', () => {
  const entries = [
    { key: 'a', mod: 2 },
    { key: 'b', mod: 0 },
  ]
  const rolls = rollInitiativeOrder(entries, faces(10, 15))
  assert.deepStrictEqual(rolls.a, {
    total: 12,
    tiebreakOrder: 0,
    advantage: false,
  })
  assert.deepStrictEqual(rolls.b, {
    total: 15,
    tiebreakOrder: 0,
    advantage: false,
  })
})

test('rollInitiativeOrder: same total but different modifier is NOT a re-roll tie', () => {
  // a: 10+2 = 12, b: 12+0 = 12 — modifier breaks it later in the sort.
  const rolls = rollInitiativeOrder(
    [
      { key: 'a', mod: 2 },
      { key: 'b', mod: 0 },
    ],
    faces(10, 12)
  )
  assert.strictEqual(rolls.a.tiebreakOrder, 0)
  assert.strictEqual(rolls.b.tiebreakOrder, 0)
})

test('rollInitiativeOrder: same total AND modifier re-rolls only the tied group until distinct', () => {
  // First pass: a=10, b=10 (tied at +0), c=18. Tie-break rolls: both 7 (still
  // tied, re-roll), then a=5, b=14 -> b acts first.
  const entries = [
    { key: 'a', mod: 0 },
    { key: 'b', mod: 0 },
    { key: 'c', mod: 0 },
  ]
  const rolls = rollInitiativeOrder(entries, faces(10, 10, 18, 7, 7, 5, 14))
  assert.strictEqual(rolls.c.tiebreakOrder, 0)
  assert.strictEqual(rolls.b.tiebreakOrder, 1)
  assert.strictEqual(rolls.a.tiebreakOrder, 2)
})

test('sortByInitiative: total desc, then modifier desc, then tiebreak order', () => {
  const entries = [
    { key: 'slow', mod: 0 },
    { key: 'fast', mod: 0 },
    { key: 'highMod', mod: 3 },
    { key: 'lowMod', mod: 1 },
    { key: 'tieA', mod: 0 },
    { key: 'tieB', mod: 0 },
  ]
  const rolls = {
    slow: { total: 5, tiebreakOrder: 0 },
    fast: { total: 20, tiebreakOrder: 0 },
    highMod: { total: 12, tiebreakOrder: 0 },
    lowMod: { total: 12, tiebreakOrder: 0 },
    tieA: { total: 9, tiebreakOrder: 2 },
    tieB: { total: 9, tiebreakOrder: 1 },
  }
  assert.deepStrictEqual(
    sortByInitiative(entries, rolls).map((e) => e.key),
    ['fast', 'highMod', 'lowMod', 'tieB', 'tieA', 'slow']
  )
})

test('sortByInitiative: reads advantage back from the roll, and unrolled entries sort last', () => {
  const out = sortByInitiative(
    [
      { key: 'rolled', mod: 0, advantage: false },
      { key: 'unrolled', mod: 0 },
    ],
    { rolled: { total: 8, tiebreakOrder: 0, advantage: true } }
  )
  assert.deepStrictEqual(
    out.map((e) => e.key),
    ['rolled', 'unrolled']
  )
  assert.strictEqual(out[0].advantage, true)
  assert.strictEqual(out[1].total, 0)
})

test('sortByInitiative does not mutate its input', () => {
  const entries = [
    { key: 'a', mod: 0 },
    { key: 'b', mod: 0 },
  ]
  sortByInitiative(entries, { a: { total: 1 }, b: { total: 2 } })
  assert.deepStrictEqual(
    entries.map((e) => e.key),
    ['a', 'b']
  )
})
