// Thin wrapper around engine/rules/5e/weaponAttack.js and
// engine/rules/5e/weapons.js, same pattern and same reasoning as
// src/utils/combatTurn.js: weapon math is recomputed on nearly every
// combat-sheet render, not a rules-catalog lookup, so this skips the
// /api/engine/* routes entirely and requires the engine files directly.
//
// Imports the leaf rule files directly — NOT the engine/index.js barrel,
// which several rule modules break webpack for via fs/path at require-time
// (see combatTurn.js's own header comment for the full story). Both files'
// dependencies are themselves zero-fs/path-dependency leaf modules, so
// this is safe the same way combatTurn.js is.
const weaponAttackEngine = require('../../engine/rules/5e/weaponAttack')
const weaponsEngine = require('../../engine/rules/5e/weapons')

export const weaponStatMod = weaponAttackEngine.weaponStatMod
export const gripDie = weaponAttackEngine.gripDie
export const attackBonus = weaponAttackEngine.attackBonus
export const attackBonusBreakdown = weaponAttackEngine.attackBonusBreakdown
export const damageBonus = weaponAttackEngine.damageBonus
export const damageBonusBreakdown = weaponAttackEngine.damageBonusBreakdown
export const rageDamageBonus = weaponAttackEngine.rageDamageBonus
export const weaponProps = weaponsEngine.weaponProps
export const isProficientWithWeapon = weaponsEngine.isProficientWithWeapon
