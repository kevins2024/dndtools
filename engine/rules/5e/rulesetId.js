// Which edition's rules a piece of data or a character follows — the pure,
// dependency-free half of ruleset.js. Browser code (weapons.js,
// weaponAttack.js...) imports THIS file; ruleset.js adds the fs-based data
// lookups and must stay server-side. See 2024_CONVERSION_PLAN.md.
const RULESETS = ['2014', '2024']
const DEFAULT_RULESET = '2014'

function normalizeRuleset(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_RULESET
  const s = String(value)
  if (!RULESETS.includes(s)) {
    throw new Error(
      `Unknown ruleset "${value}" — expected one of ${RULESETS.join(', ')}.`
    )
  }
  return s
}

// A character stays on 2014 until it is explicitly migrated.
function rulesetOf(character) {
  return normalizeRuleset(character?.ruleset)
}

module.exports = { RULESETS, DEFAULT_RULESET, normalizeRuleset, rulesetOf }
