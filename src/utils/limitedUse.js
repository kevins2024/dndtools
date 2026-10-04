// Thin wrapper around engine/rules/5e/limitedUse.js, same pattern as
// src/utils/rest.js. Imports the zero-dependency leaf file directly — NOT
// the engine/index.js barrel (see combatTurn.js's header comment).
const limitedUseEngine = require('../../engine/rules/5e/limitedUse')

export const usesRemaining = limitedUseEngine.usesRemaining
export const canSpendUse = limitedUseEngine.canSpendUse
export const spendUse = limitedUseEngine.spendUse
export const restoreUse = limitedUseEngine.restoreUse
export const spendCharge = limitedUseEngine.spendCharge
export const restoreCharge = limitedUseEngine.restoreCharge
export const spendGrantUse = limitedUseEngine.spendGrantUse
export const restoreGrantUse = limitedUseEngine.restoreGrantUse
