// Rolling and ordering initiative (PHB ch. 9): each combatant makes a DEX
// check (d20 + their initiative modifier, with advantage if something grants
// it); highest total goes first. Ties — which the PHB leaves to the DM — are
// broken at this table by higher modifier first, and then, if both total AND
// modifier match, by a re-roll among just the tied combatants until every
// d20 is distinct. Extracted 2026-10-01 from src/components/CombatContext.vue
// (bulk roll + sort) and src/components/ShipCombat.vue (a second, simpler
// copy of the roll-with-advantage logic).
//
// An "entry" is { key, mod, advantage? } — abstract, no character/enemy
// shape, same convention as combatTurn.js. `rolls` is the record this file
// produces and sortByInitiative consumes: { [key]: { total, tiebreakOrder,
// advantage } } — tiebreakOrder is 0 for an untied combatant, 1..n among a
// tied group (1 acts first).
//
// rng is injectable (a () => number in [0, 1), default Math.random).
//
// Zero fs/path dependencies — browser code require()s this directly; see
// src/utils/initiative.js.

const { rollD20Test } = require('./d20Test')

// One initiative roll for one entry: { natural, total }.
function rollInitiativeFor(entry, rng = Math.random) {
  const test = rollD20Test({
    advantage: !!entry.advantage,
    modifier: entry.mod ?? 0,
    rng,
  })
  return { natural: test.natural, total: test.value }
}

// Rolls everyone and resolves ties. Returns the `rolls` record.
function rollInitiativeOrder(entries, rng = Math.random) {
  const rolls = {}
  for (const entry of entries) {
    const { total } = rollInitiativeFor(entry, rng)
    rolls[entry.key] = {
      total,
      tiebreakOrder: 0,
      advantage: !!entry.advantage,
    }
  }

  // Group by identical (total, modifier) — only those are actually tied
  // once the modifier tiebreak has been applied.
  const groups = {}
  for (const entry of entries) {
    const groupKey = `${rolls[entry.key].total}_${entry.mod ?? 0}`
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(entry)
  }
  for (const tied of Object.values(groups)) {
    if (tied.length < 2) continue
    let tieRolls
    do {
      tieRolls = tied.map((entry) => ({
        key: entry.key,
        natural: rollInitiativeFor(entry, rng).natural,
      }))
    } while (new Set(tieRolls.map((r) => r.natural)).size < tied.length)
    tieRolls.sort((a, b) => b.natural - a.natural)
    tieRolls.forEach(({ key }, i) => {
      rolls[key].tiebreakOrder = i + 1
    })
  }
  return rolls
}

// Entries in turn order, each annotated with the roll it was made with
// (total/tiebreakOrder/advantage — read back from `rolls`, not live from the
// entry, so an already-made roll stays accurate if gear changes mid-fight).
// An entry with no roll yet sorts last with total 0.
function sortByInitiative(entries, rolls) {
  return entries
    .map((entry) => ({
      ...entry,
      total: rolls[entry.key]?.total ?? 0,
      tiebreakOrder: rolls[entry.key]?.tiebreakOrder ?? 0,
      advantage: rolls[entry.key]?.advantage ?? false,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        (b.mod ?? 0) - (a.mod ?? 0) ||
        a.tiebreakOrder - b.tiebreakOrder
    )
}

module.exports = { rollInitiativeFor, rollInitiativeOrder, sortByInitiative }
