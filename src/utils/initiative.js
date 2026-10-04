// Thin wrapper around engine/rules/5e/initiative.js, same pattern as
// src/utils/d20Test.js: initiative is rapid-click, session-local state with
// no reason to round-trip a server call. Imports the leaf rule file
// directly — NOT the engine/index.js barrel (see combatTurn.js's header
// comment). initiative.js depends only on d20Test.js, a zero-dependency
// leaf.
const initiativeEngine = require('../../engine/rules/5e/initiative')

export const rollInitiativeFor = initiativeEngine.rollInitiativeFor
export const rollInitiativeOrder = initiativeEngine.rollInitiativeOrder
export const sortByInitiative = initiativeEngine.sortByInitiative
