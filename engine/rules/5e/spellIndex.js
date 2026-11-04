// The spell index under the 2024 rules: every spell the 2024 books rewrote (src/data/spells_2024.json, with
// its 2024 class lists) over the 2014 spells that were not, which stay usable and are tagged `legacy: true`.
// Published and homebrew spells (published_spells.json) sit over the 2014 SRD ones as before.
//
// Pure: takes the three data arrays, so the server (spellLists.js, which reads the files) and the browser
// (src/utils/spells2024.js, which imports them) build the same index with one implementation.
//
// No fs/path, so browser code may use it.

const normalize = (name) => name.toLowerCase().trim()

// srd: the 2014 SRD cache, published: non-SRD and homebrew, spells2024: the 2024 spell data.
// Returns { legacyIndex, index2024 }: Maps keyed by lowercase name.
function buildSpellIndexes(srd, published, spells2024) {
  const legacyIndex = new Map()
  for (const s of srd) legacyIndex.set(normalize(s.name), s)
  for (const s of published) legacyIndex.set(normalize(s.name), s)
  const index2024 = new Map()
  for (const [k, rec] of legacyIndex) index2024.set(k, { ...rec, legacy: true })
  for (const s of spells2024) index2024.set(normalize(s.name), s)
  return { legacyIndex, index2024 }
}

// The spells on a class's list, [{ index, name, level }], by level then name.
function classSpellList(index, className) {
  return [...index.values()]
    .filter((s) => Array.isArray(s.classes) && s.classes.includes(className))
    .map((s) => ({
      index: s.index ?? normalize(s.name).replace(/[^a-z0-9]+/g, '-'),
      name: s.name,
      level: s.level,
    }))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

module.exports = { buildSpellIndexes, classSpellList, normalize }
