// Thin wrapper around engine/rules/5e/d20Test.js, same pattern and reasoning
// as src/utils/abilityScoreRoll.js: DiceRoller's rolls are rapid-click,
// session-local state with no reason to round-trip a server call per roll.
//
// Imports rules/5e/d20Test.js directly — NOT the engine/index.js barrel,
// which breaks webpack via fs/path at require-time (see combatTurn.js's
// header comment). d20Test.js has zero dependencies, so this is safe.
const d20TestEngine = require('../../engine/rules/5e/d20Test')

export const d20Test = {
  resolveMode: d20TestEngine.resolveMode,
  resolveD20Test: d20TestEngine.resolveD20Test,
  rollD20Test: d20TestEngine.rollD20Test,
}
