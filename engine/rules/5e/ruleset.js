const fs = require('fs')
const path = require('path')

// Which edition's rules a piece of data or a character follows. The campaign
// started on the 2014 rules and is moving to the 2024 revision; both live in
// one engine so legacy content (a 2014 subclass that was never rewritten, an
// untouched spell) keeps working and a character can be migrated on its own
// schedule. See 2024_CONVERSION_PLAN.md at the repo root.
//
// Data layout: data/5e/ is the 2014 tree, untouched. data/5e2024/ mirrors its
// structure and holds only content that the 2024 rules rewrote. A 2024 request
// that finds no file in data/5e2024/ is served the 2014 file instead — that is
// how unrewritten ("legacy") content stays usable without being copied.
const RULESETS = ['2014', '2024']
const DEFAULT_RULESET = '2014'

const DATA_ROOT = path.join(__dirname, '..', '..', 'data')
const TREE = {
  2014: path.join(DATA_ROOT, '5e'),
  2024: path.join(DATA_ROOT, '5e2024'),
}

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

// A character stays on 2014 until it is explicitly migrated.
function rulesetOf(character) {
  return normalizeRuleset(character?.ruleset)
}

// True when a 2024 lookup has no file of its own and is being served by the
// 2014 file (i.e. the content is legacy).
function isLegacyFallback(ruleset, relPath) {
  return (
    normalizeRuleset(ruleset) === '2024' &&
    !fs.existsSync(path.join(TREE['2024'], relPath))
  )
}

function dataFilePath(ruleset, relPath) {
  const rs = normalizeRuleset(ruleset)
  if (rs === '2024') {
    const own = path.join(TREE['2024'], relPath)
    if (fs.existsSync(own)) return own
  }
  return path.join(TREE['2014'], relPath)
}

const jsonCache = new Map()

// Parsed JSON for a ruleset-relative path (e.g. 'classes/fighter.json'), or
// null if neither tree has it. Cached per resolved file, so a 2024 request
// served by a legacy file shares that file's parsed object with 2014.
function loadRulesetJson(ruleset, relPath) {
  const file = dataFilePath(ruleset, relPath)
  if (jsonCache.has(file)) return jsonCache.get(file)
  if (!fs.existsSync(file)) return null
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  jsonCache.set(file, data)
  return data
}

module.exports = {
  RULESETS,
  DEFAULT_RULESET,
  normalizeRuleset,
  rulesetOf,
  dataFilePath,
  loadRulesetJson,
  isLegacyFallback,
}
