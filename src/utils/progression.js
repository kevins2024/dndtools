// Thin wrapper around engine/rules/5e/progression.js, same pattern and same
// reasoning as src/utils/combatTurn.js: proficiency bonus is a hot, pure
// calculation needed on nearly every character/enemy render, not a
// rules-catalog lookup, so this skips the /api/engine/* routes entirely and
// requires the engine file directly.
//
// Found 2026-09-30: `Math.ceil(level / 4) + 1` (mathematically equivalent to
// the real proficiency-bonus-by-level table, but re-derived rather than
// looked up) had been independently hand-typed in dnd_utils.js and 4 more
// spots in encounter_utils.js, instead of calling this already-existing
// engine function — which reads the real table (engine/data/5e/leveling.json)
// rather than re-deriving it. See engine/CHECKLIST.md's 2026-09-30 entry.
//
// Imports rules/5e/progression.js directly — NOT the engine/index.js
// barrel, which several rule modules break webpack for via fs/path at
// require-time (see combatTurn.js's own header comment for the full
// story). progression.js's only dependency is a plain `require('...json')`
// of engine/data/5e/leveling.json — a static import webpack bundles fine at
// build time, unlike classFeatures.js's DYNAMIC fs.readFileSync/path.join
// directory reads, which is the actual disqualifying pattern. So this is
// safe the same way combatTurn.js is.
const progressionEngine = require('../../engine/rules/5e/progression')

export const proficiencyBonus = progressionEngine.proficiencyBonus
export const asiLevelsForClass = progressionEngine.asiLevelsForClass
export const isAsiLevel = progressionEngine.isAsiLevel
export const hitDieForClass = progressionEngine.hitDieForClass
export const hpGainForLevel = progressionEngine.hpGainForLevel
