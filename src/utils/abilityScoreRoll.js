// Thin wrapper around engine/rules/5e/abilityScoreRoll.js, same pattern and
// same reasoning as src/utils/combatTurn.js: the New Character tool's
// roll-and-animate ability score UI is rapid-click, session-local state
// with no reason to round-trip a server call per die roll, so this skips
// the /api/engine/* routes entirely and requires the engine file directly.
//
// Imports rules/5e/abilityScoreRoll.js directly — NOT the engine/index.js
// barrel, which several rule modules break webpack for via fs/path at
// require-time (see combatTurn.js's own header comment for the full
// story). abilityScoreRoll.js has zero dependencies — no fs, no path, no
// other rule file — so this is safe the same way combatTurn.js is.
const abilityScoreRollEngine = require('../../engine/rules/5e/abilityScoreRoll')

export const abilityScoreRoll = {
  abilityScoreFromDice: abilityScoreRollEngine.abilityScoreFromDice,
  rollD6: abilityScoreRollEngine.rollD6,
  rollAbilityScore: abilityScoreRollEngine.rollAbilityScore,
  rollAbilityScoreSet: abilityScoreRollEngine.rollAbilityScoreSet,
}
