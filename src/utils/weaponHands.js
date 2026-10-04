// Thin wrapper around engine/rules/5e/weaponHands.js, same pattern as
// src/utils/weaponAttack.js. Imports the leaf rule file directly — NOT the
// engine/index.js barrel (see combatTurn.js's header comment). weaponHands.js
// depends only on weaponSets.js, a zero-dependency leaf.
const weaponHandsEngine = require('../../engine/rules/5e/weaponHands')

export const isOneHandedWeapon = weaponHandsEngine.isOneHandedWeapon
export const setHand = weaponHandsEngine.setHand
export const nextHand = weaponHandsEngine.nextHand
export const cycleHand = weaponHandsEngine.cycleHand
export const loadoutHands = weaponHandsEngine.loadoutHands
