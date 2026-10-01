// Thin wrapper around engine/rules/pointBuy.js, same pattern and same
// reasoning as src/utils/combatTurn.js: point-buy cost is recalculated on
// every keystroke while building a character, not a rules-catalog lookup,
// so this skips the /api/engine/* routes entirely and requires the engine
// file directly.
//
// Found 2026-09-30: NewCharacterTool.vue had its own local copy of the
// point-buy cost table with a comment reading "Mirrors engine/rules/
// pointBuy.js's table — kept local for instant UI" — but pointBuy.js is
// already a zero-dependency leaf module (no fs, no path, no other rule
// file), exactly the shape combatTurn.js/abilityScoreRoll.js already prove
// safe to require directly from the browser. The "kept local" duplication
// looks like it predated that pattern being established here, or just
// didn't check. See engine/CHECKLIST.md's 2026-09-30 entry.
//
// Imports rules/pointBuy.js directly — NOT the engine/index.js barrel,
// which several rule modules break webpack for via fs/path at require-time
// (see combatTurn.js's own header comment for the full story).
const pointBuyEngine = require('../../engine/rules/pointBuy')

export const POINT_BUY_COSTS = pointBuyEngine.COSTS
export const POINT_BUY_BUDGET = pointBuyEngine.BUDGET
export const POINT_BUY_MIN_SCORE = pointBuyEngine.MIN_SCORE
export const POINT_BUY_MAX_SCORE = pointBuyEngine.MAX_SCORE
export const scoreCost = pointBuyEngine.scoreCost
export const pointBuyCost = pointBuyEngine.pointBuyCost
export const validatePointBuy = pointBuyEngine.validatePointBuy
