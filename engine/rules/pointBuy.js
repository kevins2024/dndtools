// Standard 5e point buy: 27 points, scores range 8-15 before any species bonus.
const COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
const BUDGET = 27
const MIN_SCORE = 8
const MAX_SCORE = 15

function scoreCost(score) {
  if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw new Error(
      `Point buy score must be an integer from ${MIN_SCORE} to ${MAX_SCORE}, got ${score}.`
    )
  }
  return COSTS[score]
}

// scores: {str, dex, con, int, wis, cha}, each 8-15.
function pointBuyCost(scores) {
  return Object.values(scores).reduce((sum, s) => sum + scoreCost(s), 0)
}

function validatePointBuy(scores) {
  const cost = pointBuyCost(scores)
  return {
    cost,
    budget: BUDGET,
    remaining: BUDGET - cost,
    valid: cost <= BUDGET,
  }
}

module.exports = {
  COSTS,
  BUDGET,
  MIN_SCORE,
  MAX_SCORE,
  scoreCost,
  pointBuyCost,
  validatePointBuy,
}
