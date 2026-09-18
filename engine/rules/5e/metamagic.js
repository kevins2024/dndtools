const metamagicOptions = require('../../data/5e/metamagic.json')

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

// Mirrors fightingStyles.js's stylesForClass/listFightingStyles/
// loadFightingStyle exactly — same shape of problem (a named catalog of
// options scoped per class), just with a variable pick-count per grant
// instead of always picking 1.
function optionsForClass(className) {
  const key = Object.keys(metamagicOptions).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(className)
  )
  return key ? metamagicOptions[key] : null
}

function listMetamagicOptions(className) {
  const options = optionsForClass(className)
  if (!options) return []
  return Object.entries(options).map(([name, data]) => ({ name, ...data }))
}

function loadMetamagicOption(className, optionName) {
  const options = optionsForClass(className)
  if (!options) return null
  if (options[optionName]) return { name: optionName, ...options[optionName] }
  const key = Object.keys(options).find(
    (k) => normalizeName(k) === normalizeName(optionName)
  )
  return key ? { name: key, ...options[key] } : null
}

module.exports = { listMetamagicOptions, loadMetamagicOption }
