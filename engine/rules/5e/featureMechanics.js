const fs = require('fs')
const path = require('path')

// A real, single source of truth for a feature's MECHANICAL facts
// (action_type/recharge/uses_max/per_turn_cap), separate from
// featureCatalog.js's id->name index. Kept as its own file rather than
// folded into feature-catalog.json's existing shape so this can be adopted
// incrementally, feature by feature, without touching every existing
// consumer of the (much larger, already-relied-upon) name-only catalog —
// see engine/CHECKLIST.md's 2026-09-24 entry and feature-mechanics.json's
// own _schema block for the full design writeup.
const MECHANICS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  '5e',
  'feature-mechanics.json'
)

let mechanics = null

function loadMechanics() {
  if (!mechanics) {
    const raw = JSON.parse(fs.readFileSync(MECHANICS_PATH, 'utf8'))
    delete raw._schema
    mechanics = raw
  }
  return mechanics
}

// Resolves a feature id to its mechanical facts, or null if this feature
// hasn't been migrated into the catalog yet — a missing entry is the
// EXPECTED, common case right now (this catalog is deliberately partial),
// not an error. Callers fall back to today's bare-grant behavior.
function featureMechanics(id) {
  return loadMechanics()[id] ?? null
}

module.exports = { featureMechanics }
