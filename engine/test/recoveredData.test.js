const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

test('Vow of the Open Road no longer a placeholder — recovered mechanical text from git history', () => {
  const publishedFeatures = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'published_features.json'
  ))
  const entry = publishedFeatures.find(
    (f) => f.name === 'Channel Divinity: Vow of the Open Road'
  )
  assert.ok(entry)
  assert.ok(!/not fully specified|confirm with dm/i.test(entry.description))
  assert.match(entry.description, /Wisdom saving throw/)
  assert.equal(entry.homebrew, true)
})

test('the Oath of the Open Road subclass loads and gives features at level 3', () => {
  const sub = engine.loadSubclass('Paladin', 'Oath of the Open Road')
  assert.ok(sub)
  assert.ok(sub.features_by_level['3'].length > 0)
})

// The "Torrin's rebuilt feature list..." test that used to live here checked
// a historical data-recovery fix on the old homebrew dual-subclass
// (Soulknife + Mastermind) "Torrin (Old)" record. That record was deleted
// 2026-09-22 once the real Torrin's clean single-subclass rebuild was
// confirmed good (see git history) — the dual-subclass build it tested
// no longer exists anywhere in this app's data, so the regression it guarded
// against can't recur. Removed rather than synthesized into a fixture, since
// there's no real character left with that shape to keep it honest against.
