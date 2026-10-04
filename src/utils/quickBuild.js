// Thin wrapper around engine/rules/5e/quickBuild.js, same pattern as
// src/utils/checks.js. Imports the zero-dependency leaf file directly — NOT
// the engine/index.js barrel (see combatTurn.js's header comment).
const quickBuildEngine = require('../../engine/rules/5e/quickBuild')

export const priorityAbilitiesForClass = quickBuildEngine.priorityAbilitiesForClass
