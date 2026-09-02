const fs = require('fs')
const path = require('path')

// A flat id -> name index, engine-local (see scripts/assign-feature-ids.py —
// merges src/data/published_features.json's ids with the SRD features
// cache's own `index` field). Kept as its own small file INSIDE engine/data
// rather than read live from src/data, so engine/ stays self-contained/
// portable (the one deliberate exception to that is spellLists.js reading
// spell TEXT, documented there — this mirrors the same reasoning: copying a
// lightweight index in is cheaper than a second live cross-boundary read for
// something this gets hit on every feature lookup).
//
// Regenerate by re-running scripts/assign-feature-ids.py if new ids are
// ever added to published_features.json or the SRD cache without updating
// this file.
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'feature-catalog.json')

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
