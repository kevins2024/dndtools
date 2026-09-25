// Standard ability score generation (PHB): roll 4d6, drop the single
// lowest die, sum the remaining three. Repeat six times, then assign the
// six totals to abilities however the player chooses — this file has no
// opinion on assignment, that's a UI/character-creation concern, not a
// rule this function needs to know about.
//
// Split deliberately into a pure, deterministic piece (abilityScoreFromDice
// — given 4 die results, what's the dropped one and the total) and an
// impure piece (rollD6/rollAbilityScore/rollAbilityScoreSet — actually
// generates the random dice). Only the pure piece is meaningfully unit
// testable; the random half is a thin wrapper around it.
//
// Zero dependencies (no fs/path, no other rule file) — same as
// combatTurn.js, so browser code can require() this directly for the New
// Character tool's roll-and-animate UI without a server round trip. See
// src/utils/abilityScoreRoll.js for that thin wrapper, and CLAUDE.md's
// standing note on why combatTurn.js gets this same direct-require
// treatment.

// dice: an array of exactly 4 numbers (1-6 each). Drops ONE occurrence of
// the lowest value (not every die tied for lowest — if you roll two 2s as
// your lowest pair, only one of them is dropped, the RAW-correct reading
// of "drop the lowest die").
function abilityScoreFromDice(dice) {
  const lowestValue = Math.min(...dice)
  const droppedIndex = dice.indexOf(lowestValue)
  const total = dice.reduce(
    (sum, value, i) => (i === droppedIndex ? sum : sum + value),
    0
  )
  return { dice: [...dice], droppedIndex, total }
}

function rollD6() {
  return 1 + Math.floor(Math.random() * 6)
}

function rollAbilityScore() {
  return abilityScoreFromDice([rollD6(), rollD6(), rollD6(), rollD6()])
}

// Six independent rolls — one per ability, unassigned (see this file's own
// header comment on why assignment isn't this function's job).
function rollAbilityScoreSet() {
  return Array.from({ length: 6 }, rollAbilityScore)
}

module.exports = {
  abilityScoreFromDice,
  rollD6,
  rollAbilityScore,
  rollAbilityScoreSet,
}
