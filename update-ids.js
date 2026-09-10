// update-ids.js
// Assigns sequential IDs to every item in the target data files.
// Usage: node update-ids.js  (or: npm run update-ids)
//
// SCOPE — only files where `id` is a synthetic, self-contained primary key
// (used for Vue :key and for UPDATE_TABLE_ITEM/UPDATE_ITEM's find-by-id
// store mutations) with NOTHING else in the codebase referencing that exact
// id VALUE. This app's real convention for cross-file linking is matching
// by NAME (equipped_by/carried_by, owner, people[], location strings) —
// these array-of-records files never needed id to be anything more than
// "unique within this file," which is exactly what makes blind positional
// reassignment safe for them.
//
// Audited 2026-09-09 before adding companions/relationships — every
// src/data/*.json file with an array-of-objects-with-id shape was checked
// for cross-file id references before being included or excluded below.
//
// DO NOT add these, even though they also have an `id` field — their ids
// are real cross-references, not throwaway synthetic keys, and renumbering
// them would silently break the reference:
//   - published_features.json — ids are referenced BY VALUE from
//     engine/data/classes/*.json and engine/data/subclasses/*.json
//     (features_by_level, option_catalog) and engine/data/feature-catalog.json.
//     This is the app's core "features are referenced by id, not name"
//     convention (see CLAUDE.md) — renumbering here breaks class/subclass
//     feature resolution app-wide.
//   - materials.json — ids are semantic names ("vixivirite"), referenced
//     by value from published_features.json and at least one homebrew
//     subclass file (engine/data/subclasses/druid-circle-of-the-moon.json).
//   - maps.json — ids (including nested region ids like "fynesmarch") are
//     semantic and referenced by value from MapViewer.vue.
//   - lore.json — explicitly out of scope per project owner (2026-09-09):
//     its ids are hand-authored, meaningful slugs assigned during lore
//     extraction, not throwaway sequential keys.

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'src/data')

const FILES = {
  characters: 'characters.json',
  npcs: 'npcs.json',
  items: 'party_items.json',
  assets: 'assets.json',
  companions: 'companions.json',
  rel: 'relationships.json',
}

const BOM = Buffer.from([0xef, 0xbb, 0xbf])

function readJSON(fp) {
  let buf = fs.readFileSync(fp)
  while (buf.slice(0, 3).equals(BOM)) buf = buf.slice(3)
  return JSON.parse(buf.toString('utf8'))
}

for (const [prefix, filename] of Object.entries(FILES)) {
  const fp = path.join(DATA_DIR, filename)

  if (!fs.existsSync(fp)) {
    console.log(`Skipping ${filename} — not found`)
    continue
  }

  let data
  try {
    data = readJSON(fp)
  } catch (e) {
    console.error(`ERROR reading ${filename}: ${e.message}`)
    continue
  }

  if (!Array.isArray(data)) {
    console.log(`Skipping ${filename} — not an array`)
    continue
  }

  const updated = data.map((item, i) => ({ ...item, id: `${prefix}_${i}` }))
  fs.writeFileSync(fp, JSON.stringify(updated, null, 2))
  console.log(`Updated ${filename} (${updated.length} entries)`)
}
