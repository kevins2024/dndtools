const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const engine = require('../index')

// Oath of Devotion, Vengeance, Conquest, Redemption, and Glory were missing
// entirely (only Oath of the Ancients, Oath of the Crown, and homebrew Oath
// of the Open Road existed) — added 2026-09-02 as part of the "full RAW
// content coverage" pass (engine/CHECKLIST.md Phase 7), verified against
// dnd5e.wikidot.com for each. Oathbreaker deliberately NOT included — it's
// a DMG "villain" oath a player doesn't choose at character creation, out
// of scope for the same reason as any other DM-only content.
const NEW_OATH_NAMES = [
  'Oath of Devotion',
  'Oath of Vengeance',
  'Oath of Conquest',
  'Oath of Redemption',
  'Oath of Glory',
]

test("All 5 new Paladin oaths resolve with exactly Paladin's real subclass_feature_levels [3,7,15,20]", () => {
  const paladin = engine.loadClass('Paladin')
  assert.deepEqual(paladin.subclass_feature_levels, [3, 7, 15, 20])
  for (const name of NEW_OATH_NAMES) {
    const sub = engine.loadSubclass('Paladin', name)
    assert.ok(sub, `${name} should resolve`)
    const levels = Object.keys(sub.features_by_level)
      .map(Number)
      .sort((a, b) => a - b)
    assert.deepEqual(levels, [3, 7, 15, 20], `${name} feature levels`)
    // Every oath grants exactly 2 Channel Divinity options at 3rd level
    assert.equal(
      sub.features_by_level['3'].length,
      2,
      `${name} should grant exactly 2 Channel Divinity options at 3rd level`
    )
  }
})

test('Every new oath feature name has a matching published_features.json entry', () => {
  const publishedFeatures = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'src',
        'data',
        'published_features.json'
      ),
      'utf8'
    )
  )
  const byName = new Set(publishedFeatures.map((f) => f.name))
  for (const name of NEW_OATH_NAMES) {
    const sub = engine.loadSubclass('Paladin', name)
    for (const [level, names] of Object.entries(sub.features_by_level)) {
      for (const featureName of names) {
        assert.ok(
          byName.has(featureName),
          `"${featureName}" (${name} level ${level}) should have a published_features.json entry`
        )
      }
    }
  }
})

test("Every new oath's oath_spells_by_level entry resolves to a real spell", () => {
  for (const name of NEW_OATH_NAMES) {
    const sub = engine.loadSubclass('Paladin', name)
    assert.ok(
      sub.oath_spells_by_level,
      `${name} should have oath_spells_by_level`
    )
    const levels = Object.keys(sub.oath_spells_by_level)
      .map(Number)
      .sort((a, b) => a - b)
    assert.deepEqual(levels, [3, 5, 9, 13, 17], `${name} oath spell levels`)
    for (const spellNames of Object.values(sub.oath_spells_by_level)) {
      assert.equal(
        spellNames.length,
        2,
        `${name} should grant exactly 2 spells per tier`
      )
      for (const spellName of spellNames) {
        const record = engine.findSpellRecord(spellName)
        assert.ok(
          record,
          `${name} spell "${spellName}" should resolve to a real spell`
        )
      }
    }
  }
})
