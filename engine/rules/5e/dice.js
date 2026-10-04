// Dice-expression rolling ("1d6+1", "2d4", "1d8-1") — the one small shared
// primitive that rest recharge (a wand regaining 1d6+1 charges) and
// short-rest hit dice both need. Extracted from src/store/index.js's private
// rollDiceExpr (2026-10-01) so the rules that consume it can live in engine/.
//
// `rng` is injectable (a () => number in [0, 1), defaulting to Math.random)
// so tests can pin the dice; every caller outside a test just omits it.
//
// Zero dependencies (no fs/path, no other rule file) — browser code
// require()s this directly (via rest.js); see src/utils/rest.js.

const DICE_PATTERN = /(\d+)d(\d+)([+-]\d+)?/

function rollDie(sides, rng = Math.random) {
  return Math.floor(rng() * sides) + 1
}

// Returns 0 for a string that isn't a dice expression. A negative total
// (e.g. "1d4-5") clamps to 0 — nothing in the rules rolls a negative
// quantity of charges/points.
function rollDiceExpr(expr, rng = Math.random) {
  const match = String(expr).match(DICE_PATTERN)
  if (!match) return 0
  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  const mod = match[3] ? parseInt(match[3], 10) : 0
  let total = mod
  for (let i = 0; i < count; i++) total += rollDie(sides, rng)
  return Math.max(0, total)
}

function isDiceExpr(expr) {
  return DICE_PATTERN.test(String(expr))
}

module.exports = { rollDie, rollDiceExpr, isDiceExpr }
