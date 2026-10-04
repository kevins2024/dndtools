// Thin wrapper around engine/rules/5e/rest.js, same pattern and reasoning
// as src/utils/checks.js: rests mutate session-local state, so this skips
// the /api/engine/* routes and requires the engine file directly.
//
// Imports the leaf rule file directly — NOT the engine/index.js barrel,
// which breaks webpack via fs/path at require-time (see combatTurn.js's
// header comment). rest.js depends only on dice.js and abilities.js, both
// zero-fs/path leaf modules, so this is safe.
const restEngine = require('../../engine/rules/5e/rest')

export const hitDieSides = restEngine.hitDieSides
export const hitDiceAvailable = restEngine.hitDiceAvailable
export const hpMissing = restEngine.hpMissing
export const averageHitDieHealing = restEngine.averageHitDieHealing
export const shortRestHealEstimate = restEngine.shortRestHealEstimate
export const rollShortRestHealing = restEngine.rollShortRestHealing
export const shortRestPreview = restEngine.shortRestPreview
export const longRestPreview = restEngine.longRestPreview
export const applyShortRest = restEngine.applyShortRest
export const applyLongRest = restEngine.applyLongRest
export const rechargeItems = restEngine.rechargeItems
export const SHORT_REST_RECHARGE_TYPES = restEngine.SHORT_REST_RECHARGE_TYPES
export const LONG_REST_RECHARGE_TYPES = restEngine.LONG_REST_RECHARGE_TYPES
