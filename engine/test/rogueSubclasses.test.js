const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const engine = require('../index')

// Thief, Scout, and Phantom were missing entirely (only Assassin,
// Inquisitive, Mastermind, Soulknife, Swashbuckler existed) — added
// 2026-09-01, verified against two independent sources each. Arcane
// Trickster deliberately NOT included here: it's the first Rogue subclass
// that would need real spellcasting, and nothing in this engine currently
// supports a subclass granting spellcasting a base class doesn't have
// (spellSlotsForClassAtLevel etc. only ever look at the class, never the
// subclass) — that's real engine work, not a data-entry job like these three.
test('Thief, Scout, and Phantom all resolve with the correct 4 subclass_feature_levels', () => {
  const rogue = engine.loadClass('Rogue')
  for (const name of ['Thief', 'Scout', 'Phantom']) {
    const sub = engine.loadSubclass('Rogue', name)
    assert.ok(sub, `${name} should resolve`)
    const levels = Object.keys(sub.features_by_level).map(Number)
    assert.deepEqual(
      levels.sort((a, b) => a - b),
      [3, 9, 13, 17]
    )
    for (const lvl of levels) {
      assert.ok(
        rogue.subclass_feature_levels.includes(lvl),
        `${name}'s level ${lvl} should be one of Rogue's real subclass_feature_levels`
      )
    }
  }
})

test('Every Thief/Scout/Phantom feature name has a matching entry in published_features.json', () => {
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
  for (const subclassName of ['Thief', 'Scout', 'Phantom']) {
    const sub = engine.loadSubclass('Rogue', subclassName)
    for (const names of Object.values(sub.features_by_level)) {
      for (const name of names) {
        assert.ok(
          byName.has(name),
          `"${name}" (${subclassName}) should have a published_features.json entry`
        )
      }
    }
  }
})
