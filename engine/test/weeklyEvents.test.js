const test = require('node:test')
const assert = require('node:assert')
const {
  rollBetween,
  REFUGEE_TIERS,
  refugeeTier,
  rollRefugees,
  rollLineItems,
  rollCrossingProfitWeek,
  advanceCrossingProfit,
} = require('../rules/weeklyEvents')

// rng that makes a d`sides` land on `face`.
const face = (sides, f) => () => (f - 1) / sides + 0.0001
// rng that returns the given values in order, then repeats the last.
const seq = (...vals) => {
  let i = 0
  return () => vals[Math.min(i++, vals.length - 1)]
}

test('rollBetween: inclusive at both ends', () => {
  assert.strictEqual(rollBetween(5, 5), 5)
  assert.strictEqual(
    rollBetween(200, 1200, () => 0),
    200
  )
  assert.strictEqual(
    rollBetween(200, 1200, () => 0.999999),
    1200
  )
})

test('refugeeTier: boundaries match the table', () => {
  assert.strictEqual(refugeeTier(1).id, 'critical')
  assert.strictEqual(refugeeTier(2).id, 'standard')
  assert.strictEqual(refugeeTier(5).id, 'standard')
  assert.strictEqual(refugeeTier(6).id, 'interesting')
  assert.strictEqual(refugeeTier(10).id, 'interesting')
  assert.strictEqual(refugeeTier(11).id, 'remarkable')
  assert.strictEqual(refugeeTier(15).id, 'remarkable')
  assert.strictEqual(refugeeTier(16).id, 'extraordinary')
  assert.strictEqual(refugeeTier(19).id, 'extraordinary')
  assert.strictEqual(refugeeTier(20).id, 'exceptional')
  assert.strictEqual(REFUGEE_TIERS.at(-1).max, 20)
})

test('rollRefugees: d4+3 arrivals, each with a roll and its tier', () => {
  const r = rollRefugees(face(4, 2)) // d4 = 2 -> 5 refugees (every die reads as a 2-ish face)
  assert.strictEqual(r.count, 5)
  assert.strictEqual(r.rolls.length, 5)
  for (const x of r.rolls) {
    assert.ok(x.roll >= 1 && x.roll <= 20)
    assert.strictEqual(x.id, refugeeTier(x.roll).id)
  }
  assert.strictEqual(rollRefugees(() => 0.999999).count, 7)
  assert.strictEqual(rollRefugees(() => 0).count, 4)
})

test('rollLineItems: rolls each range and totals', () => {
  const out = rollLineItems(
    [
      { name: 'a', amount_min: 10, amount_max: 10 },
      { name: 'b', amount_min: 5, amount_max: 15 },
    ],
    () => 0
  )
  assert.deepStrictEqual(
    out.items.map((i) => i.rolled),
    [10, 5]
  )
  assert.strictEqual(out.total, 15)
})

test('rollCrossingProfitWeek: every band lands inside its range', () => {
  const bands = [
    [2, 'Bad week', 200, 1200],
    [5, 'Bad week', 200, 1200],
    [6, 'Normal', 1500, 2500],
    [14, 'Normal', 1500, 2500],
    [15, 'Good week', 2800, 4200],
    [19, 'Good week', 2800, 4200],
    [20, 'Exceptional', 8000, 9500],
  ]
  for (const [roll, band, lo, hi] of bands) {
    // first rng call picks the d20 face, second the in-range value
    for (const second of [0, 0.999999]) {
      const w = rollCrossingProfitWeek(seq((roll - 1) / 20 + 0.001, second))
      assert.strictEqual(w.roll, roll)
      assert.strictEqual(w.band, band)
      assert.ok(w.value >= lo && w.value <= hi, `${band} ${w.value}`)
    }
  }
})

test('rollCrossingProfitWeek: Disaster severity table', () => {
  const sev = (d6) => rollCrossingProfitWeek(seq(0.001, (d6 - 1) / 6 + 0.001))
  assert.strictEqual(sev(1).value, -500)
  assert.strictEqual(sev(2).value, -500)
  assert.strictEqual(sev(3).value, -1000)
  assert.strictEqual(sev(4).value, -1000)
  assert.strictEqual(sev(5).value, -1500)
  assert.strictEqual(sev(6).value, -1500)
  assert.strictEqual(sev(6).band, 'Disaster')
  assert.ok(sev(6).detail.includes('crisis'))
})

// d20 face 10 -> Normal, in-range value from rng 0 -> 1500
const normalWeek = seq(9.5 / 20, 0)

test('advanceCrossingProfit: week 1 is carried forward with no payout', () => {
  const r = advanceCrossingProfit({}, normalWeek)
  assert.strictEqual(r.stage, 'pending')
  assert.strictEqual(r.rolled, true)
  assert.strictEqual(r.week1.value, 1500)
  assert.deepStrictEqual(r.next.pending, { ...r.week1, week: 1 })
  assert.strictEqual(r.next.awaiting, null)
})

test('advanceCrossingProfit: week 2 combines both values into awaiting', () => {
  const pending = {
    roll: 10,
    band: 'Normal',
    value: 2000,
    detail: 'x',
    week: 1,
  }
  const r = advanceCrossingProfit({ pending }, seq(9.5 / 20, 0))
  assert.strictEqual(r.stage, 'awaiting')
  assert.strictEqual(r.rolled, true)
  assert.strictEqual(r.combined, 3500)
  assert.strictEqual(r.week1, pending)
  assert.strictEqual(r.next.pending, null)
  assert.strictEqual(r.next.awaiting.combined, 3500)
})

test('advanceCrossingProfit: an unapplied payout is re-surfaced, never overwritten', () => {
  const awaiting = { week1: { value: 1 }, week2: { value: 2 }, combined: 3 }
  let called = 0
  const r = advanceCrossingProfit({ pending: null, awaiting }, () => {
    called++
    return 0.5
  })
  assert.strictEqual(r.stage, 'awaiting')
  assert.strictEqual(r.rolled, false)
  assert.strictEqual(r.combined, 3)
  assert.strictEqual(called, 0) // no dice thrown
  assert.strictEqual(r.next.awaiting, awaiting)
})
