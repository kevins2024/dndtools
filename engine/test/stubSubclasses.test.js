const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const engine = require('../index')

// 2026-09-02: project owner wants every real subclass visible in the Level
// Up tool's picker (not just roster-driven ones) so character creation
// never has to reach for something unbuilt — see engine/CHECKLIST.md
// Phase 7. These 72 are a first pass: only the class's FIRST subclass tier
// is filled in (marked `stub: true`), written from training knowledge
// rather than the full 2-source-verified treatment the fully-built
// subclasses get (Artificer, Rogue, Paladin, and the earlier roster-driven
// ones). Good enough to browse and pick from; still needs the deeper pass
// (remaining tiers + spell tables + source verification) before being
// trusted the way the complete ones are.
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
  assert.ok(
    files.length >= 72,
    `expected at least 72 stub subclass files, found ${files.length}`
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
  assert.ok(
    stubFeatures.length >= 72,
    `expected at least 72 stub features, found ${stubFeatures.length}`
  )
  for (const f of stubFeatures) {
    assert.ok(f.verification, `${f.name} should carry a verification note`)
    assert.ok(
      f.description,
      `${f.name} should still have real description text, not a null stub`
    )
  }
})
