// Thin wrapper around engine/rules/5e/weaponSets.js, same pattern and same
// reasoning as src/utils/combatTurn.js: weapon-set/loadout checks run on
// nearly every combat-sheet render, not a rules-catalog lookup, so this
// skips the /api/engine/* routes entirely and requires the engine file
// directly.
//
// Imports rules/5e/weaponSets.js directly — NOT the engine/index.js
// barrel, which several rule modules break webpack for via fs/path at
// require-time (see combatTurn.js's own header comment for the full
// story). weaponSets.js has zero dependencies — no fs, no path, no other
// rule file — so this is safe the same way combatTurn.js is.
const weaponSetsEngine = require('../../engine/rules/5e/weaponSets')

export const activeWeaponSet = weaponSetsEngine.activeWeaponSet
export const isActiveEquipped = weaponSetsEngine.isActiveEquipped
export const isDualWieldingMelee = weaponSetsEngine.isDualWieldingMelee
