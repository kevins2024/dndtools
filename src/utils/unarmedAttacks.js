// Thin wrapper around engine/rules/5e/unarmedAttacks.js, same pattern as
// src/utils/weaponAttack.js: combat-sheet math is recomputed on nearly
// every render, so this skips the /api/engine/* routes and requires the
// engine file directly.
//
// Imports the leaf rule file directly — NOT the engine/index.js barrel,
// which breaks webpack via fs/path at require-time (see combatTurn.js's
// header comment). unarmedAttacks.js depends only on zero-fs/path leaf
// modules and plain class JSON tables, so this is safe.
const unarmedEngine = require('../../engine/rules/5e/unarmedAttacks')

export const sneakAttackDice = unarmedEngine.sneakAttackDice
export const martialArtsDie = unarmedEngine.martialArtsDie
export const unarmedStrike = unarmedEngine.unarmedStrike
export const psychicBlades = unarmedEngine.psychicBlades
