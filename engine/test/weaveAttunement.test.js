const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

test("Weave Attunement (fully homebrew) organizes Iyani's already-self-described features without inventing anything", () => {
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))
  const iyani = characters.find((c) => c.name === 'Iyani')
  const sub = engine.loadSubclass('Sorcerer', 'Weave Attunement')
  assert.ok(sub)
  // Iyani is level 9 — only the 1st/6th-level features should be on her sheet
  // yet. 14th/18th (Weave Empowerment, Unraveling) were prepped ahead of need
  // and aren't unlocked for anyone yet, so they're deliberately NOT checked
  // against her current feature list.
  const unlockedSoFar = [
    ...sub.features_by_level['1'],
    ...sub.features_by_level['6'],
  ]
  for (const name of unlockedSoFar) {
    assert.ok(
      iyani.features.some((f) => f.name === name),
      `${name} should be one of Iyani's actual features`
    )
  }
  // Mother's Whim's own inline text says "Subclass level 6 feature" — confirm
  // that's exactly where this file places it.
  assert.ok(sub.features_by_level['6'].includes("Mother's Whim"))
})

test('Weave Attunement 14th/18th-level features exist and are correctly NOT yet on any character (prepped ahead of need)', () => {
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))
  const sub = engine.loadSubclass('Sorcerer', 'Weave Attunement')
  assert.deepEqual(sub.features_by_level['14'], ['Weave Empowerment'])
  assert.deepEqual(sub.features_by_level['18'], ['Unraveling'])
  for (const name of ['Weave Empowerment', 'Unraveling']) {
    const onAnyone = characters.some((c) =>
      (c.features || []).some((f) => f.name === name)
    )
    assert.equal(onAnyone, false, `${name} shouldn't be on anyone's sheet yet`)
  }
})

// weave_grid is meant to hand a brand-new Weave Attunement sorcerer a real,
// ready-to-play default grid (not just Iyani's personal picks) — so every
// entry has to actually resolve to a real spell, and has to genuinely belong
// to one of its phase's two associated schools, not just look right.
test("Weave Attunement weave_grid: every entry resolves to a real spell in the phase's associated schools", () => {
  const sub = engine.loadSubclass('Sorcerer', 'Weave Attunement')
  assert.ok(sub.weave_grid, 'weave_grid should exist on the subclass')

  const phaseEntries = Object.entries(sub.weave_grid).filter(
    ([key]) => key !== '_notes'
  )
  assert.equal(phaseEntries.length, 3, 'should have exactly 3 phases')

  for (const [phase, entry] of phaseEntries) {
    const schools = entry.schools
    assert.ok(
      Array.isArray(schools) && schools.length === 2,
      `${phase} should list its two associated schools`
    )
    for (const level of ['1', '2', '3', '4', '5']) {
      const spellName = entry[level]
      const record = engine.findSpellRecord(spellName)
      assert.ok(
        record,
        `${phase} level ${level} ("${spellName}") should resolve to a real spell`
      )
      assert.equal(
        record.level,
        Number(level),
        `${spellName} should actually be a level-${level} spell`
      )
      assert.ok(
        schools.includes(record.school),
        `${spellName} (${
          record.school
        }) should belong to one of ${phase}'s schools: ${schools.join(', ')}`
      )
    }
  }
})
