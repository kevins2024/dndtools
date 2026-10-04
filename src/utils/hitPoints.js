// Thin wrapper around engine/rules/5e/hitPoints.js, same pattern and
// reasoning as src/utils/checks.js: HP edits are rapid-click, session-local
// state with no reason to round-trip a server call.
//
// Imports the leaf rule file directly — NOT the engine/index.js barrel,
// which breaks webpack via fs/path at require-time (see combatTurn.js's
// header comment). hitPoints.js has zero dependencies, so this is safe.
const hitPointsEngine = require('../../engine/rules/5e/hitPoints')

export const effectiveMaxHp = hitPointsEngine.effectiveMaxHp
export const applyDamage = hitPointsEngine.applyDamage
export const applyHealing = hitPointsEngine.applyHealing
export const applyTempHp = hitPointsEngine.applyTempHp
export const applyTrackedDamage = hitPointsEngine.applyTrackedDamage
export const applyTrackedHealing = hitPointsEngine.applyTrackedHealing
export const applyTrackedTempHp = hitPointsEngine.applyTrackedTempHp
export const concentrationDC = hitPointsEngine.concentrationDC
