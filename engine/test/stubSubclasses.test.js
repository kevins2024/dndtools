const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const engine = require('../index')

// 2026-09-02: project owner wants every real subclass visible in the Level
// Up tool's picker (not just roster-driven ones) so character creation
// never has to reach for something unbuilt — see engine/CHECKLIST.md
// Phase 7. These started as 72: a first pass where only the class's FIRST
// subclass tier was filled in (marked `stub: true`), written from training
// knowledge rather than the full 2-source-verified treatment the fully-built
// subclasses get (Artificer, Rogue, Paladin, and the earlier roster-driven
// ones). Good enough to browse and pick from; still needs the deeper pass
// (remaining tiers + spell tables + source verification) before being
// trusted the way the complete ones are. History: 72 -> 66 on 2026-09-04
// (Fighter's 6 stubs — Arcane Archer, Cavalier, Psi Warrior, Purple Dragon
// Knight, Rune Knight, Samurai), 66 -> 57 same day (all 9 Monk stubs — Open
// Hand, Shadow, Four Elements, Kensei, Long Death, Sun Soul, Drunken
// Master, Mercy, Astral Self), 57 -> 49 same day (all 8 Wizard stubs —
// Conjuration, Divination, Enchantment, Illusion, Necromancy,
// Transmutation, War Magic, Order of Scribes), 49 -> 42 same day (all 7
// Barbarian stubs — Ancestral Guardian, Battlerager, Beast, Storm Herald,
// Totem Warrior, Zealot, Wild Magic), 42 -> 36 same day (all 6 Bard
// stubs — Creation, Eloquence, Glamour, Swords, Valor, Whispers), 36 -> 24
// same day (all 12 Cleric Divine Domain stubs), 24 -> 19 same day (all 5
// Druid Circle stubs — Dreams, Shepherd, Spores, Stars, Wildfire), 19 -> 14
// on 2026-09-06 (all 5 Ranger stubs — Beast Master, Fey Wanderer, Horizon
// Walker, Monster Slayer, Swarmkeeper), 14 -> 8 same day (all 6 Sorcerer
// stubs — Aberrant Mind, Clockwork Soul, Draconic Bloodline, Shadow Magic,
// Storm Sorcery, Wild Magic), 8 -> 0 same day (all 8 Warlock stubs — The
// Archfey, The Celestial, The Fathomless, The Fiend, The Genie, The
// Hexblade, The Undead, The Undying). This was the last class — every
// subclass in the app is now fully built out (all real tiers filled in,
// 2-source-verified). The tests below now assert 0 remaining stubs; if
// this ever needs to go back up, something regressed a completed
// subclass back to stub, which would be a real bug, not expected progress.
function loadAllSubclassFiles() {
  const dir = path.join(__dirname, '..', 'data', 'subclasses')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
}

test('Every subclass file (stub or complete) has a description and resolves via loadSubclass', () => {
  const files = loadAllSubclassFiles()
  assert.ok(
    files.length >= 106,
    `expected at least 106 subclass files, found ${files.length}`
  )
  for (const f of files) {
    assert.ok(f.description, `${f.class} / ${f.name} should have a description`)
    const sub = engine.loadSubclass(f.class, f.name)
    assert.ok(sub, `${f.class} / ${f.name} should resolve via loadSubclass`)
  }
})

test("Every stub subclass's first-tier feature(s) match the class's real subclass_choice_level and resolve to a real published_features.json entry", () => {
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
  const files = loadAllSubclassFiles().filter((f) => f.stub)
  assert.equal(
    files.length,
    0,
    `expected 0 stub subclass files (every subclass is now fully built out), found ${files.length}`
  )

  for (const f of files) {
    const cls = engine.loadClass(f.class)
    assert.ok(cls, `${f.class} should be a real class`)
    // Resolve through loadSubclass (not the raw file) so features_by_level
    // is real display names, not the raw ids stored on disk.
    const resolved = engine.loadSubclass(f.class, f.name)
    const levels = Object.keys(resolved.features_by_level).map(Number)
    assert.deepEqual(
      levels,
      [cls.subclass_choice_level],
      `${f.class} / ${f.name} stub should only have its first real subclass_choice_level (${cls.subclass_choice_level}) filled in`
    )
    for (const names of Object.values(resolved.features_by_level)) {
      assert.ok(
        names.length >= 1,
        `${f.class} / ${f.name} should grant at least 1 feature`
      )
      for (const name of names) {
        assert.ok(
          byName.has(name),
          `"${name}" (${f.class} / ${f.name}) should have a published_features.json entry`
        )
      }
    }
  }
})

test('Stub feature entries are honestly flagged as unverified, not presented as fully checked', () => {
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
  const stubFeatures = publishedFeatures.filter(
    (f) => f.category === 'subclass_feature_stub'
  )
  assert.equal(
    stubFeatures.length,
    0,
    `expected 0 stub features (every subclass is now fully built out), found ${stubFeatures.length}`
  )
  for (const f of stubFeatures) {
    assert.ok(f.verification, `${f.name} should carry a verification note`)
    assert.ok(
      f.description,
      `${f.name} should still have real description text, not a null stub`
    )
  }
})
