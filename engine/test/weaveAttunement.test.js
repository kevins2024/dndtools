const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

test('Weave Attunement has its 14th- and 18th-level features', () => {
  const sub = engine.loadSubclass('Sorcerer', 'Weave Attunement')
  assert.deepEqual(sub.features_by_level['14'], ['Weave Empowerment'])
  assert.deepEqual(sub.features_by_level['18'], ['Unraveling'])
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
