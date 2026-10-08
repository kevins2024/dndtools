const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

// Bug 2.11 / the four duplicate spells removed earlier: published_*.json is
// hand-edited, and a duplicated id or name makes lookups ambiguous (and broke
// the spell browser's list keys). These fail the moment one comes back.
const data = (name) =>
  require(path.join(__dirname, '..', '..', 'src', 'data', name))

const duplicates = (list) => {
  const seen = new Set()
  const dupes = new Set()
  for (const x of list) (seen.has(x) ? dupes : seen).add(x)
  return [...dupes]
}

test('published_features.json: every id is unique', () => {
  const ids = data('published_features.json')
    .map((f) => f.id)
    .filter(Boolean)
  assert.deepStrictEqual(duplicates(ids), [])
})

test('published_spells.json: every spell name is unique', () => {
  const names = data('published_spells.json').map((s) => s.name.toLowerCase())
  assert.deepStrictEqual(duplicates(names), [])
})

test('published_monsters.json: every monster name is unique', () => {
  const names = data('published_monsters.json').map((m) => m.name.toLowerCase())
  assert.deepStrictEqual(duplicates(names), [])
})

test('the feature catalog and the published library agree on a feature\'s name', () => {
  const catalog = require('../data/5e/feature-catalog.json')
  const mismatched = data('published_features.json')
    .filter((f) => f.id && catalog[f.id] && catalog[f.id] !== f.name)
    .map((f) => `${f.id}: catalog "${catalog[f.id]}" vs library "${f.name}"`)
  // Two older conflicts (Thunderous/Thunderbolt Strike, Unyielding Spirit/Saint)
  // are known and tracked in TODO.md; anything beyond them is new.
  const known = ['pub_thunderous-strike', 'pub_unyielding-spirit']
  const unexpected = mismatched.filter((m) => !known.some((k) => m.startsWith(k)))
  assert.deepStrictEqual(unexpected, [])
})
