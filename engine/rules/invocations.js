const invocations = require('../data/invocations.json')
const pactBoons = require('../data/pact-boons.json')
const tables = require('../data/spellcasting-tables.json')
const { resolveBreakpoint } = require('./spellcasting')
const { evaluatePrerequisite } = require('./featPrerequisites')

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

function listInvocations() {
  return Object.entries(invocations)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, data]) => ({ name, ...data }))
}

// Case-insensitive lookup — the UI passes back whatever exact string it was
// given, but a hand-typed "Other" fallback (same escape hatch the feat
// picker has) could differ in case.
function loadInvocation(name) {
  if (invocations[name]) return invocations[name]
  const key = Object.keys(invocations).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(name)
  )
  return key ? invocations[key] : null
}

// { met, reason, unknown } — same shape meetsFeatPrerequisites returns,
// reusing the SAME evaluator (see featPrerequisites.js's header comment for
// why this file doesn't have its own parallel checker).
function meetsInvocationPrerequisite(character, invocationName) {
  const inv = loadInvocation(invocationName)
  if (!inv) return { met: true, reason: null, unknown: true }
  return evaluatePrerequisite(character, inv.prerequisite)
}

// Warlock only — no other class/subclass currently grants this mechanic.
function invocationsKnownForLevel(level) {
  const map = tables.invocations_known.Warlock
  if (!map) return 0
  return resolveBreakpoint(map, level)
}

function listPactBoons() {
  return Object.entries(pactBoons)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, data]) => ({ name, ...data }))
}

function loadPactBoon(name) {
  if (pactBoons[name]) return pactBoons[name]
  const key = Object.keys(pactBoons).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(name)
  )
  return key ? pactBoons[key] : null
}

module.exports = {
  listInvocations,
  loadInvocation,
  meetsInvocationPrerequisite,
  invocationsKnownForLevel,
  listPactBoons,
  loadPactBoon,
}
