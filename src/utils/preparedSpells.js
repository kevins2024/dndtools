// Thin wrapper around engine/rules/5e/preparedSpells.js, same pattern as
// src/utils/checks.js. Imports the leaf rule file directly — NOT the
// engine/index.js barrel (see combatTurn.js's header comment). It reads
// class data via plain JSON require (bundled by webpack), no fs/path.
const preparedSpellsEngine = require('../../engine/rules/5e/preparedSpells')

export const isPreparedCaster = preparedSpellsEngine.isPreparedCaster
export const preparedSpellLimit = preparedSpellsEngine.preparedSpellLimit
