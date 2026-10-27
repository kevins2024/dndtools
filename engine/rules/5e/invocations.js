const invocations2014 = require('../../data/5e/invocations.json')
const { normalizeRuleset, loadRulesetJson, rulesetOf } = require('./ruleset')

// 2024 invocations are their own list (no Pact Boon — the Pacts are invocations).
const invocationsFor = (ruleset) =>
  normalizeRuleset(ruleset) === '2024'
    ? loadRulesetJson('2024', 'invocations.json') ?? invocations2014
    : invocations2014
const pactBoons = require('../../data/5e/pact-boons.json')
const tables = require('../../data/5e/spellcasting-tables.json')
const { resolveBreakpoint } = require('./spellcasting')
const { loadClass } = require('./classFeatures')
const { evaluatePrerequisite } = require('./featPrerequisites')

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

function listInvocations(ruleset) {
  return Object.entries(invocationsFor(ruleset))
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, data]) => ({ name, ...data }))
}

// Case-insensitive lookup — the UI passes back whatever exact string it was
// given, but a hand-typed "Other" fallback (same escape hatch the feat
// picker has) could differ in case.
function loadInvocation(name, ruleset) {
  const invocations = invocationsFor(ruleset)
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
  const inv = loadInvocation(invocationName, rulesetOf(character))
  if (!inv) return { met: true, reason: null, unknown: true }
  return evaluatePrerequisite(character, inv.prerequisite)
}

// Warlock only — no other class/subclass currently grants this mechanic.
function invocationsKnownForLevel(level, ruleset) {
  const map =
    loadClass('Warlock', ruleset)?.eldritch_invocations_by_level ??
    tables.invocations_known.Warlock
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
