// Thin wrapper around engine/rules/5e/characterSpells.js, same pattern as
// src/utils/checks.js. Imports the zero-dependency leaf file directly — NOT
// the engine/index.js barrel (see combatTurn.js's header comment).
const characterSpellsEngine = require('../../engine/rules/5e/characterSpells')

export const usesFullClassList = characterSpellsEngine.usesFullClassList
export const normalizeItemSpellGrant =
  characterSpellsEngine.normalizeItemSpellGrant
export const getBonusSpells = characterSpellsEngine.getBonusSpells
export const getBonusSpellsAtLevel = characterSpellsEngine.getBonusSpellsAtLevel
export const getCharacterSpells = characterSpellsEngine.getCharacterSpells
export const characterHasSpells = characterSpellsEngine.characterHasSpells
