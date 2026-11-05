// Thin wrapper around engine/rules/5e/weaponMasteries.js (a leaf file with no fs/path, so browser code
// requires it directly; see src/utils/combatTurn.js for why).
const engine = require('../../engine/rules/5e/weaponMasteries')

export const masteryPool = engine.masteryPool
export const masteryInfo = engine.masteryInfo
export const masteryOfKind = engine.masteryOfKind
export const masteredWeapons = engine.masteredWeapons
export const masteryOfWeapon = engine.masteryOfWeapon
export const masteryChangeOptions = engine.masteryChangeOptions
export const changeMastery = engine.changeMastery
