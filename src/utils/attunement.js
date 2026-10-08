// Thin wrapper around engine/rules/5e/attunement.js (same pattern as
// unarmedAttacks.js): requires the leaf engine file directly, never the
// engine/index.js barrel. No fs/path dependencies.
const attunementEngine = require('../../engine/rules/5e/attunement')

export const applyAttunement = attunementEngine.applyAttunement
export const isAttunementActive = attunementEngine.isAttunementActive
