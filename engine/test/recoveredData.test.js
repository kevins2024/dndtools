const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

const characters = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'characters.json'
))

test('Vow of the Open Road no longer a placeholder — recovered mechanical text from git history', () => {
  const publishedFeatures = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'published_features.json'
  ))
  const entry = publishedFeatures.find((f) => f.name === 'Vow of the Open Road')
  assert.ok(entry)
  assert.ok(!/not fully specified|confirm with dm/i.test(entry.description))
  assert.match(entry.description, /Wisdom saving throw/)
  assert.equal(entry.homebrew, true)
})

test("Oath of the Open Road subclass file loads and matches Ferghus's actual features", () => {
  const ferghus = characters.find((c) => c.name === 'Ferghus')
  const sub = engine.loadSubclass('Paladin', 'Oath of the Open Road')
  assert.ok(sub)
  const at3 = sub.features_by_level['3']
  for (const name of at3) {
    assert.ok(
      ferghus.features.some((f) => f.name === name),
      `Ferghus should have ${name}`
    )
  }
})

// The "Torrin's rebuilt feature list..." test that used to live here checked
// a historical data-recovery fix on the old homebrew dual-subclass
// (Soulknife + Mastermind) "Torrin (Old)" record. That record was deleted
// 2026-09-22 once the real Torrin's clean single-subclass rebuild was
// confirmed good (see TODO_ARCHIVE.md) — the dual-subclass build it tested
// no longer exists anywhere in this app's data, so the regression it guarded
// against can't recur. Removed rather than synthesized into a fixture, since
// there's no real character left with that shape to keep it honest against.
