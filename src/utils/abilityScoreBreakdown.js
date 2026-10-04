// Thin wrapper around engine/rules/5e/abilityScoreBreakdown.js, same
// pattern as src/utils/checks.js. Imports the leaf rule file directly — NOT
// the engine/index.js barrel (see combatTurn.js's header comment).
const breakdownEngine = require('../../engine/rules/5e/abilityScoreBreakdown')

export const abilityScoreBreakdown = breakdownEngine.abilityScoreBreakdown
