const fs = require('fs')
const path = require('path')

// A flat id -> name index, engine-local (originally built by a one-time
// migration script, scripts/assign-feature-ids.py — deleted 2026-09-26, since
// it assumed features_by_level still held bare names and would have silently
// corrupted every class/subclass file if re-run against today's
// already-migrated, id-based data; see engine/CHECKLIST.md's 2026-09-26 entry).
// Merges src/data/published_features.json's ids with the SRD features
// cache's own `index` field. Kept as its own small file INSIDE engine/data
// rather than read live from src/data, so engine/ stays self-contained/
// portable (the one deliberate exception to that is spellLists.js reading
// spell TEXT, documented there — this mirrors the same reasoning: copying a
// lightweight index in is cheaper than a second live cross-boundary read for
// something this gets hit on every feature lookup).
//
// A NEW id added going forward (a new class/subclass/species feature, a new
// published_features.json entry) should just be added here by hand at the
// same time — matching the existing prefix convention (pub_/an SRD index/
// gen_ as a last resort) — there's no script to regenerate this file safely
// anymore.
const CATALOG_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  '5e',
  'feature-catalog.json'
)

let catalog = null

function loadCatalog() {
  if (!catalog) {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
  }
  return catalog
}

// Resolves a feature id to its display name. Falls back to returning the id
// itself if it's not in the catalog (rather than throwing or returning
// undefined) — a missing catalog entry shouldn't take down a level-up.
function featureName(id) {
  return loadCatalog()[id] ?? id
}

module.exports = { featureName }
