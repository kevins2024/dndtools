const fs = require('fs')
const path = require('path')

// This is the one place in engine/ that reaches OUTSIDE engine/data — spell
// TEXT (as opposed to class progression rules) already lives in src/data and
// copying it here would just be a second copy to drift out of sync. See the
// note at the top of engine/CHECKLIST.md.
const SRC_DATA = path.join(__dirname, '..', '..', 'src', 'data')

let cache = null

function normalize(name) {
  return name.toLowerCase().trim()
}

function buildIndex() {
  if (cache) return cache
  const index = new Map()

  const srd = JSON.parse(
    fs.readFileSync(
      path.join(SRC_DATA, 'api_data_cache', 'srd_spells_full.json'),
      'utf8'
    )
  )
  const published = JSON.parse(
    fs.readFileSync(path.join(SRC_DATA, 'published_spells.json'), 'utf8')
  )

  // published_spells.json now holds real non-SRD content and homebrew spells
  // side by side (each entry's own `homebrew` flag tells them apart) — so
  // this is the only override tier needed on top of the SRD cache.
  for (const s of srd) index.set(normalize(s.name), s)
  for (const s of published) index.set(normalize(s.name), s)

  cache = index
  return index
}

function findSpellRecord(spellName) {
  return buildIndex().get(normalize(spellName)) || null
}

// Returns true/false if we know, or null if the spell isn't found at all or
// has no `classes` data yet (an "I don't know" that callers should treat as
// non-blocking, not as a silent false).
function isSpellOnClassList(className, spellName) {
  const record = findSpellRecord(spellName)
  if (!record || !Array.isArray(record.classes)) return null
  return record.classes.includes(className)
}

module.exports = { findSpellRecord, isSpellOnClassList }
