const maneuvers = require('../../data/5e/maneuvers.json')

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

// Mirrors metamagic.js's optionsForClass/listMetamagicOptions/
// loadMetamagicOption exactly — same shape of problem (a named catalog of
// options scoped per class).
function maneuversForClass(className) {
  const key = Object.keys(maneuvers).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(className)
  )
  return key ? maneuvers[key] : null
}

function listManeuvers(className) {
  const options = maneuversForClass(className)
  if (!options) return []
  return Object.entries(options).map(([name, data]) => ({ name, ...data }))
}

function loadManeuver(className, maneuverName) {
  const options = maneuversForClass(className)
  if (!options) return null
  if (options[maneuverName])
    return { name: maneuverName, ...options[maneuverName] }
  const key = Object.keys(options).find(
    (k) => normalizeName(k) === normalizeName(maneuverName)
  )
  return key ? { name: key, ...options[key] } : null
}

module.exports = { listManeuvers, loadManeuver }
