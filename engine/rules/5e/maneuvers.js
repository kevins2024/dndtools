const maneuvers2014 = require('../../data/5e/maneuvers.json')
const { normalizeRuleset, loadRulesetJson } = require('./ruleset')
const { mergeLegacy } = require('./legacyMerge')

const maneuversFile = (ruleset) => {
  if (normalizeRuleset(ruleset) !== '2024') return maneuvers2014
  const current = loadRulesetJson('2024', 'maneuvers.json')
  if (!current) return maneuvers2014
  // per class: the 2024 maneuvers, plus 2014 ones with no 2024 version (legacy)
  const out = { ...current }
  for (const [cls, list] of Object.entries(maneuvers2014))
    if (!cls.startsWith('_') && list && typeof list === 'object')
      out[cls] = mergeLegacy(current[cls] ?? {}, list)
  return out
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

// Mirrors metamagic.js's optionsForClass/listMetamagicOptions/
// loadMetamagicOption exactly — same shape of problem (a named catalog of
// options scoped per class).
function maneuversForClass(className, ruleset) {
  const maneuvers = maneuversFile(ruleset)
  const key = Object.keys(maneuvers).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(className)
  )
  return key ? maneuvers[key] : null
}

function listManeuvers(className, ruleset) {
  const options = maneuversForClass(className, ruleset)
  if (!options) return []
  return Object.entries(options).map(([name, data]) => ({ name, ...data }))
}

function loadManeuver(className, maneuverName, ruleset) {
  const options = maneuversForClass(className, ruleset)
  if (!options) return null
  if (options[maneuverName])
    return { name: maneuverName, ...options[maneuverName] }
  const key = Object.keys(options).find(
    (k) => normalizeName(k) === normalizeName(maneuverName)
  )
  return key ? { name: key, ...options[key] } : null
}

module.exports = { listManeuvers, loadManeuver }
