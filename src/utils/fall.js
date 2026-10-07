// Thin wrapper around engine/rules/5e/fall.js (the campaign's fall-damage
// house rule), same pattern as unarmedAttacks.js: requires the leaf engine
// file directly, never the engine/index.js barrel (no fs/path dependencies).
const fallEngine = require('../../engine/rules/5e/fall')

export const LETHAL_OVER_FT = fallEngine.LETHAL_OVER_FT
export const FALL_CAP_DAMAGE = fallEngine.FALL_CAP_DAMAGE
export const fallDamage = fallEngine.fallDamage
export const fallDC = fallEngine.fallDC
export const rollFall = fallEngine.rollFall
export const fallCheckOptions = fallEngine.fallCheckOptions
