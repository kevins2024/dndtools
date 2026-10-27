const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const engine = require('../index')

// All 4 real Artificer specialists (Tasha's Cauldron of Everything) — only
// Artillerist existed before 2026-09-02. Alchemist, Armorer, and Battle
// Smith added to support a real RAW-legality audit of Jaygar (previously a
// homebrew Alchemist-flavored Artillerist hybrid, nowhere near RAW-legal).
// Each verified against 2 independent sources (dnd5e.wikidot.com +
// corroborating web search) before being written.
const SUBCLASS_NAMES = ['Alchemist', 'Armorer', 'Battle Smith', 'Artillerist']

test("All 4 Artificer subclasses resolve with exactly Artificer's real subclass_feature_levels [3,5,9,15]", () => {
  const artificer = engine.loadClass('Artificer')
  assert.deepEqual(artificer.subclass_feature_levels, [3, 5, 9, 15])
  for (const name of SUBCLASS_NAMES) {
    const sub = engine.loadSubclass('Artificer', name)
    assert.ok(sub, `${name} should resolve`)
    const levels = Object.keys(sub.features_by_level)
      .map(Number)
      .sort((a, b) => a - b)
    assert.deepEqual(levels, [3, 5, 9, 15], `${name} feature levels`)
  }
})

test('Every Artificer subclass feature name has a matching published_features.json entry', () => {
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
  for (const name of SUBCLASS_NAMES) {
    const sub = engine.loadSubclass('Artificer', name)
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

test("Every subclass's always-prepared spell list resolves to real spells of a level its slots can cast", () => {
  for (const name of SUBCLASS_NAMES) {
    const sub = engine.loadSubclass('Artificer', name)
    assert.ok(
      sub.subclass_spells_by_level,
      `${name} should have subclass_spells_by_level`
    )
    for (const [charLevel, spellNames] of Object.entries(
      sub.subclass_spells_by_level
    )) {
      const maxSpellLevel = Math.ceil(Number(charLevel) / 4) // 3->1, 5->2, 9->3, 13->4, 17->5
      for (const spellName of spellNames) {
        const record = engine.findSpellRecord(spellName)
        assert.ok(
          record,
          `${name} level ${charLevel} spell "${spellName}" should resolve to a real spell`
        )
        assert.ok(
          record.level <= maxSpellLevel,
          `${spellName} (level ${record.level}) is beyond what ${name} can cast at character level ${charLevel}`
        )
      }
    }
  }
})

test('Artillerist has its always-prepared spells at level 3 and they reach the character', () => {
  const sub = engine.loadSubclass('Artificer', 'Artillerist')
  assert.ok(sub.features_by_level['3'].includes('Artillerist Spells'))
  const { getBonusSpells } = require('../rules/5e/characterSpells')
  const names = getBonusSpells(
    { classes: [{ name: 'Artificer', subclass: 'Artillerist', level: 5 }] },
    [{ ...sub, class: 'Artificer' }]
  ).map((s) => s.name)
  assert.deepEqual(names, ['Shield', 'Thunderwave', 'Scorching Ray', 'Shatter'])
})

test('Fortified Position is correctly a 15th-level feature (was mislabeled level 9 in the catalog before this fix)', () => {
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
  const fortifiedPosition = publishedFeatures.find(
    (f) => f.id === 'hb_artillerist_fortified_position'
  )
  assert.equal(fortifiedPosition.level_gained, 15)
})
