// Thin wrapper around engine/rules/5e/armorClass.js, same pattern and same
// reasoning as src/utils/combatTurn.js: AC is recomputed on nearly every
// character-sheet render, not a rules-catalog lookup, so this skips the
// /api/engine/* routes entirely and requires the engine file directly.
//
// Imports rules/5e/armorClass.js directly — NOT the engine/index.js
// barrel, which several rule modules break webpack for via fs/path at
// require-time (see combatTurn.js's own header comment for the full
// story). armorClass.js's dependencies (characterStats.js, abilities.js,
// armor.js, weaponSets.js) are all themselves zero-fs/path-dependency leaf
// modules, so this is safe the same way combatTurn.js is.
const armorClassEngine = require('../../engine/rules/5e/armorClass')

export const computeAC = armorClassEngine.computeAC
