// Thin wrapper around engine/rules/5e/hurlSomething.js, same pattern as
// unarmedAttacks.js: requires the leaf engine file directly (zero fs/path
// dependencies), never the engine/index.js barrel.
const hurlEngine = require('../../engine/rules/5e/hurlSomething')

const hurlYourselfEngine = require('../../engine/rules/5e/hurlYourself')

export const hurlSomething = hurlEngine.hurlSomething
export const hurlYourself = hurlYourselfEngine.hurlYourself
export const hurlYourselfDamage = hurlYourselfEngine.hurlYourselfDamage
export const HURL_YOURSELF_MULTIPLIER =
  hurlYourselfEngine.HURL_YOURSELF_MULTIPLIER
