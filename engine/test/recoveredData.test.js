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

test("Torrin's rebuilt feature list now includes all real 3rd/9th-level Soulknife + Mastermind features (not just half of each)", () => {
  const torrin = characters.find((c) => c.name === 'Torrin')
  const soulknife = engine.loadSubclass('Rogue', 'Soulknife')
  const mastermind = engine.loadSubclass('Rogue', 'Mastermind')
  assert.ok(soulknife)
  assert.ok(mastermind)

  const expectedByLevel12 = [
    ...soulknife.features_by_level['3'],
    ...soulknife.features_by_level['9'],
    ...mastermind.features_by_level['3'],
    ...mastermind.features_by_level['9'],
  ]
  for (const name of expectedByLevel12) {
    assert.ok(
      torrin.features.some((f) => f.name === name),
      `Torrin should have ${name}`
    )
  }
  // 13th/17th-level features should NOT be present — he's capped at level 12
  const tooHighLevel = [
    ...soulknife.features_by_level['13'],
    ...soulknife.features_by_level['17'],
    ...mastermind.features_by_level['13'],
    ...mastermind.features_by_level['17'],
  ]
  for (const name of tooHighLevel) {
    assert.ok(
      !torrin.features.some((f) => f.name === name),
      `Torrin (capped at 12) should NOT have ${name}`
    )
  }
})
