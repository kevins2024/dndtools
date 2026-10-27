// Which data tree a lookup reads — the pure, dependency-free half of ruleset.js.
// The rules are the 2024 rules: everything asks for 2024 by default and gets the 2014
// file only where the 2024 books did not rewrite it (tagged `legacy`). '2014' as an
// explicit value exists to read that old tree directly (tests, migration of old sheets).
// The 2014 mechanics themselves are retired; they live at tag `ruleset-2014-final`. Browser code (weapons.js,
// weaponAttack.js...) imports THIS file; ruleset.js adds the fs-based data
// lookups and must stay server-side. See 2024_CONVERSION_PLAN.md.
const RULESETS = ['2014', '2024']
const DEFAULT_RULESET = '2024'

function normalizeRuleset(value) {
  if (value === undefined || value === null || value === '')
    return DEFAULT_RULESET
  const s = String(value)
  if (!RULESETS.includes(s)) {
    throw new Error(
      `Unknown ruleset "${value}" — expected one of ${RULESETS.join(', ')}.`
    )
  }
  return s
}

// A sheet that predates the `ruleset` field is a 2024 sheet.
function rulesetOf(character) {
  return normalizeRuleset(character?.ruleset)
}

module.exports = { RULESETS, DEFAULT_RULESET, normalizeRuleset, rulesetOf }
