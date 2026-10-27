const metamagic2014 = require('../../data/5e/metamagic.json')
const { normalizeRuleset, loadRulesetJson } = require('./ruleset')

// 2024 has its own file (Sorcerer's ten options); 2014 requests get the old one.
const optionsFile = (ruleset) =>
  normalizeRuleset(ruleset) === '2024'
    ? loadRulesetJson('2024', 'metamagic.json') ?? metamagic2014
    : metamagic2014

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

// Mirrors fightingStyles.js's stylesForClass/listFightingStyles/
// loadFightingStyle exactly — same shape of problem (a named catalog of
// options scoped per class), just with a variable pick-count per grant
// instead of always picking 1.
function optionsForClass(className, ruleset) {
  const metamagicOptions = optionsFile(ruleset)
  const key = Object.keys(metamagicOptions).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(className)
  )
  return key ? metamagicOptions[key] : null
}

function listMetamagicOptions(className, ruleset) {
  const options = optionsForClass(className, ruleset)
  if (!options) return []
  return Object.entries(options).map(([name, data]) => ({ name, ...data }))
}

function loadMetamagicOption(className, optionName, ruleset) {
  const options = optionsForClass(className, ruleset)
  if (!options) return null
  if (options[optionName]) return { name: optionName, ...options[optionName] }
  const key = Object.keys(options).find(
    (k) => normalizeName(k) === normalizeName(optionName)
  )
  return key ? { name: key, ...options[key] } : null
}

module.exports = { listMetamagicOptions, loadMetamagicOption }
