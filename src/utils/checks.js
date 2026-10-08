// Thin wrapper around engine/rules/5e/checks.js, same pattern and same
// reasoning as src/utils/combatTurn.js: saves/skills/initiative/spell DC
// are recomputed on nearly every character-sheet render, not a rules-
// catalog lookup, so this skips the /api/engine/* routes entirely and
// requires the engine file directly.
//
// Imports rules/5e/checks.js directly — NOT the engine/index.js barrel,
// which several rule modules break webpack for via fs/path at require-time
// (see combatTurn.js's own header comment for the full story). checks.js's
// dependencies (characterStats.js, abilities.js, proficiency.js,
// progression.js) are all themselves zero-fs/path-dependency leaf modules,
// so this is safe the same way combatTurn.js is.
const checksEngine = require('../../engine/rules/5e/checks')

export const savingThrow = checksEngine.savingThrow
export const savingThrowBreakdown = checksEngine.savingThrowBreakdown
export const allSavingThrows = checksEngine.allSavingThrows
export const SKILL_MAP = checksEngine.SKILL_MAP
export const skill = checksEngine.skill
export const skillBreakdown = checksEngine.skillBreakdown
export const allSkills = checksEngine.allSkills
export const passivePerception = checksEngine.passivePerception
export const passivePerceptionBreakdown =
  checksEngine.passivePerceptionBreakdown
export const initiative = checksEngine.initiative
export const hasInitiativeAdvantage = checksEngine.hasInitiativeAdvantage
export const skillAdvantage = checksEngine.skillAdvantage
export const spellAttackBonus = checksEngine.spellAttackBonus
export const spellAttackBonusBreakdown = checksEngine.spellAttackBonusBreakdown
export const spellSaveDC = checksEngine.spellSaveDC
export const spellSaveDCBreakdown = checksEngine.spellSaveDCBreakdown
