// Thin wrapper around engine/rules/5e/proficiency.js, same pattern as
// src/utils/combatTurn.js. Zero-dependency leaf module, safe to require
// directly from the browser.
const proficiencyEngine = require('../../engine/rules/5e/proficiency')

export const effectiveProficiencyBonus =
  proficiencyEngine.effectiveProficiencyBonus
export const effectiveProficiencyBonusBreakdown =
  proficiencyEngine.effectiveProficiencyBonusBreakdown
