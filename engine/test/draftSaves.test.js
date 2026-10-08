const test = require('node:test')
const assert = require('node:assert')
const { rowsForAmbientSave, restoreDrafts } = require('../rules/draftSaves')

const saved = [
  { name: 'A', level: 5, hp_current: 30 },
  { name: 'B', level: 5, hp_current: 40 },
]

test('no drafts: an ambient save writes the table untouched', () => {
  const live = [{ name: 'A', level: 5, hp_current: 12 }, saved[1]]
  assert.deepStrictEqual(rowsForAmbientSave(live, saved, []), live)
})

test('a draft level-up is held at its saved baseline while other edits still save (bug 2.1)', () => {
  // A is mid level-up (level 6, unsaved); B just took damage (an ordinary edit).
  const live = [
    { name: 'A', level: 6, hp_current: 30 },
    { name: 'B', level: 5, hp_current: 22 },
  ]
  const out = rowsForAmbientSave(live, saved, ['A'])
  assert.deepStrictEqual(out, [
    { name: 'A', level: 5, hp_current: 30 }, // baseline, NOT the draft
    { name: 'B', level: 5, hp_current: 22 }, // the ordinary edit goes through
  ])
})

test('a brand-new unsaved character is left out of an ambient save entirely', () => {
  const live = [...saved, { name: 'New', level: 1 }]
  const out = rowsForAmbientSave(live, saved, ['New'])
  assert.deepStrictEqual(
    out.map((c) => c.name),
    ['A', 'B']
  )
})

test('restoreDrafts puts the live draft rows back after the merged table replaces memory', () => {
  const merged = [
    { name: 'A', level: 5, hp_current: 30 },
    { name: 'B', level: 5, hp_current: 22 },
  ]
  const live = [
    { name: 'A', level: 6, hp_current: 30 },
    { name: 'B', level: 5, hp_current: 22 },
    { name: 'New', level: 1 },
  ]
  const out = restoreDrafts(merged, live, ['A', 'New'])
  assert.deepStrictEqual(out, [
    { name: 'A', level: 6, hp_current: 30 },
    { name: 'B', level: 5, hp_current: 22 },
    { name: 'New', level: 1 },
  ])
  assert.deepStrictEqual(restoreDrafts(merged, live, []), merged)
})
