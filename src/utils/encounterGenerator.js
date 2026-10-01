// Thin wrapper around engine/rules/encounterGenerator.js, same pattern and
// same reasoning as src/utils/combatTurn.js: encounter_utils.js re-exports
// these for its existing consumers (EncounterGenerator.vue, CombatContext.vue)
// so this is the one place in src/ that touches this engine file directly.
//
// Imports rules/encounterGenerator.js directly — NOT the engine/index.js
// barrel, which several rule modules break webpack for via fs/path at
// require-time (see combatTurn.js's own header comment for the full
// story). rules/encounterGenerator.js's only dependencies are
// rules/5e/abilities.js and rules/5e/progression.js, both already proven
// zero-fs/path-dependency leaf modules (see src/utils/abilities.js and
// src/utils/progression.js), so this is safe the same way combatTurn.js is.
const encounterGeneratorEngine = require('../../engine/rules/encounterGenerator')

export const TARGET_HIT_PCT = encounterGeneratorEngine.TARGET_HIT_PCT
export const analyzeParty = encounterGeneratorEngine.analyzeParty
export const enemyBenchmarks = encounterGeneratorEngine.enemyBenchmarks
export const estimatePartyHP = encounterGeneratorEngine.estimatePartyHP
