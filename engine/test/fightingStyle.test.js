const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')
const fightingStyles = require('../data/5e/fighting-styles.json')
const featureCatalog = require('../data/5e/feature-catalog.json')
const srdFeatures = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'api_data_cache',
  'features.json'
))

const srdById = new Map(srdFeatures.map((f) => [f.index, f]))

function classStyles(name) {
  return Object.entries(fightingStyles[name]).map(([styleName, data]) => ({
    name: styleName,
    ...data,
  }))
}

test("fighting-styles.json has the real per-class option counts (Fighter 11, Paladin 7, Ranger 8) — 6/4/4 PHB-only plus Tasha's Cauldron's 7 additions, split unevenly since 2 of the 7 (Blessed Warrior, Druidic Warrior) are single-class-exclusive (2026-09-17)", () => {
  assert.equal(classStyles('Fighter').length, 11)
  assert.equal(classStyles('Paladin').length, 7)
  assert.equal(classStyles('Ranger').length, 8)
})

const publishedById = new Map(
  require('../../src/data/published_features.json').map((f) => [f.id, f])
)

test("every fighting-style id resolves to itself in feature-catalog.json AND to a real backing entry (SRD cache for PHB styles, published_features.json for Tasha's Cauldron ones) with matching name", () => {
  for (const className of ['Fighter', 'Paladin', 'Ranger']) {
    for (const style of classStyles(className)) {
      assert.equal(
        featureCatalog[style.id],
        `Fighting Style: ${style.name}`,
        `${className}'s ${style.name} id "${style.id}" should resolve to its display name in feature-catalog.json`
      )
      if (style.source === "Player's Handbook") {
        const srd = srdById.get(style.id)
        assert.ok(srd, `${style.id} should exist in the SRD feature cache`)
        assert.equal(srd.name, `Fighting Style: ${style.name}`)
      } else {
        // Tasha's Cauldron of Everything isn't SRD content — these live in
        // published_features.json instead (see fighting-styles.json's own
        // _schema.tce_additions note).
        const pub = publishedById.get(style.id)
        assert.ok(pub, `${style.id} should exist in published_features.json`)
        assert.equal(pub.name, `Fighting Style: ${style.name}`)
      }
    }
  }
})
