// The Weekly Events tool's rolls: weekly income/expense ranges, the refugee
// arrivals table, and the Crossing Profit System's two-week ship-cargo
// cycle (a house rule — see src/data/house_rules.json for the table-facing
// text). Extracted 2026-10-01 from src/components/WeeklyEvents.vue, where
// the tables and the week-1/week-2 state machine lived inline.
//
// Same split as d20Test.js: dice come from an injectable `rng` (a () =>
// number in [0, 1), default Math.random) so tests pin them. Pure otherwise —
// results are plain data, nothing here touches finances/state (the store
// applies them).
//
// Zero fs/path dependencies — browser code require()s this directly; see
// src/utils/weeklyEvents.js.

const { rollDie } = require('./5e/dice')

// Inclusive integer in [min, max].
function rollBetween(min, max, rng = Math.random) {
  if (min === max) return min
  return min + Math.floor(rng() * (max - min + 1))
}

// Refugee tiers by d20 roll: the first tier whose `max` is >= the roll.
const REFUGEE_TIERS = [
  {
    id: 'critical',
    max: 1,
    label: 'Critically desperate — may need immediate intervention',
  },
  {
    id: 'standard',
    max: 5,
    label: 'Standard — needs shelter, stability, and time',
  },
  {
    id: 'interesting',
    max: 10,
    label: 'Interesting — notable skill or unusual background',
  },
  {
    id: 'remarkable',
    max: 15,
    label: 'Remarkable — significant history or connections',
  },
  {
    id: 'extraordinary',
    max: 19,
    label: 'Extraordinary — rare circumstances, clear story thread',
  },
  {
    id: 'exceptional',
    max: 20,
    label: 'Exceptional — major NPC potential, unique situation',
  },
]

function refugeeTier(roll) {
  return REFUGEE_TIERS.find((t) => roll <= t.max) ?? null
}

// d4+3 arrivals, each rolled on the tier table.
function rollRefugees(rng = Math.random) {
  const count = rollDie(4, rng) + 3
  const rolls = Array.from({ length: count }, () => {
    const roll = rollDie(20, rng)
    const tier = refugeeTier(roll)
    return { roll, id: tier.id, label: tier.label }
  })
  return { count, rolls }
}

// Rolls each { amount_min, amount_max } line item and totals them.
function rollLineItems(items, rng = Math.random) {
  const rolled = items.map((item) => ({
    ...item,
    rolled: rollBetween(item.amount_min, item.amount_max, rng),
  }))
  return { items: rolled, total: rolled.reduce((s, i) => s + i.rolled, 0) }
}

// Crossing Profit System, one week. d20 → band → gold value. A 1 is a
// Disaster with a d6 severity; every other band rolls within its range.
function rollCrossingProfitWeek(rng = Math.random) {
  const roll = rollDie(20, rng)
  if (roll === 1) {
    const severity = rollDie(6, rng)
    if (severity <= 2) {
      return {
        roll,
        band: 'Disaster',
        value: -500,
        detail: 'Cargo spoiled or lost overboard',
      }
    }
    if (severity <= 4) {
      return {
        roll,
        band: 'Disaster',
        value: -1000,
        detail: 'Cargo destroyed outright',
      }
    }
    if (severity === 5) {
      return {
        roll,
        band: 'Disaster',
        value: -1500,
        detail: 'Ship damaged badly, needs repair',
      }
    }
    return {
      roll,
      band: 'Disaster',
      value: -1500,
      detail: "'Or worse' — a genuine crisis, worth developing as a story beat",
    }
  }
  if (roll <= 5) {
    return {
      roll,
      band: 'Bad week',
      value: rollBetween(200, 1200, rng),
      detail: 'Reduced but recoverable profit',
    }
  }
  if (roll <= 14) {
    return {
      roll,
      band: 'Normal',
      value: rollBetween(1500, 2500, rng),
      detail: 'Standard baseline profit',
    }
  }
  if (roll <= 19) {
    return {
      roll,
      band: 'Good week',
      value: rollBetween(2800, 4200, rng),
      detail: 'Above-average trade conditions',
    }
  }
  return {
    roll,
    band: 'Exceptional',
    value: rollBetween(8000, 9500, rng),
    detail: 'Major profit spike or a valuable discovery',
  }
}

// Two weekly rolls make one cycle: week 1's value is kept as an unpaid
// intermediate, and at the end of week 2 the two are added — that total is
// what pays out. State: { pending, awaiting } where `pending` is week 1's
// result (null between cycles) and `awaiting` is a combined result not yet
// applied to the party purse (null when nothing is waiting).
//
// Returns { stage, rolled, next: { pending, awaiting }, ...display }. Does
// NOT roll when a combined result is still awaiting application (it just
// re-surfaces it, rolled: false — never silently overwrite an unpaid
// payout), so the caller only persists `next` when `rolled` is true.
function advanceCrossingProfit(
  { pending = null, awaiting = null } = {},
  rng = Math.random
) {
  if (awaiting) {
    return {
      stage: 'awaiting',
      rolled: false,
      ...awaiting,
      next: { pending, awaiting },
    }
  }
  const thisWeek = rollCrossingProfitWeek(rng)
  if (!pending) {
    return {
      stage: 'pending',
      rolled: true,
      week1: thisWeek,
      next: { pending: { ...thisWeek, week: 1 }, awaiting: null },
    }
  }
  const result = {
    week1: pending,
    week2: thisWeek,
    combined: pending.value + thisWeek.value,
  }
  return {
    stage: 'awaiting',
    rolled: true,
    ...result,
    next: { pending: null, awaiting: result },
  }
}

module.exports = {
  rollBetween,
  REFUGEE_TIERS,
  refugeeTier,
  rollRefugees,
  rollLineItems,
  rollCrossingProfitWeek,
  advanceCrossingProfit,
}
