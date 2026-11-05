// Thin wrapper around engine/rules/5e/heroicInspiration.js (a leaf file with no fs/path, so browser code
// requires it directly; see src/utils/combatTurn.js for why).
const engine = require('../../engine/rules/5e/heroicInspiration')

export const HEROIC_INSPIRATION_RULE = engine.RULE
export const hasHeroicInspiration = engine.hasHeroicInspiration
export const grantHeroicInspiration = engine.grantHeroicInspiration
export const spendHeroicInspiration = engine.spendHeroicInspiration
