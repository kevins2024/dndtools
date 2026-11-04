// Thin wrapper around engine/rules/5e/featureGrants.js (what a character's features grant the sheet:
// resistances, save/skill advantage, darkvision), same pattern as src/utils/unarmedAttacks.js: it needs
// only plain data (no fs/path), so the browser requires the leaf file directly.
const grantsEngine = require('../../engine/rules/5e/featureGrants')

export const characterGrants = grantsEngine.characterGrants
