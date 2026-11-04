// Thin wrapper around engine/rules/5e/speciesRules.js (species rules that are a number or a yes/no:
// Relentless Endurance, Naturally Stealthy, clockwork devices), same pattern as src/utils/featureGrants.js.
const speciesEngine = require('../../engine/rules/5e/speciesRules')

export const applyDamageWithSurvival = speciesEngine.applyDamageWithSurvival
export const effectiveSize = speciesEngine.effectiveSize
export const canHideBehind = speciesEngine.canHideBehind
export const canMoveThroughSpace = speciesEngine.canMoveThroughSpace
export const objectLimit = speciesEngine.objectLimit
export const createObject = speciesEngine.createObject
export const dismantleObject = speciesEngine.dismantleObject
