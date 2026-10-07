// Thin wrapper around engine/rules/houseRules.js, same pattern as
// src/utils/rest.js. Imports the zero-dependency leaf file directly — NOT
// the engine/index.js barrel (see combatTurn.js's header comment).
const houseRulesEngine = require('../../engine/rules/houseRules')

export const weaveDustForRoll = houseRulesEngine.weaveDustForRoll
export const weaveDustEstimateRange = houseRulesEngine.weaveDustEstimateRange
export const crowdStrength = houseRulesEngine.crowdStrength
export const crowdAreaDamage = houseRulesEngine.crowdAreaDamage
export const landingImpact = houseRulesEngine.landingImpact
