const test = require('node:test')
const assert = require('node:assert')
const {
  isPreparedCaster,
  preparedSpellLimit,
} = require('../rules/5e/preparedSpells')
const { preparedSpellCount } = require('../rules/5e/spellcasting')

// Values are the "Prepared Spells" columns printed in the 2024 PHB class tables,
// not read back from the engine's own data.
const BOOK = {
  Wizard: { 1: 4, 5: 9, 9: 14, 20: 25 },
  Cleric: { 1: 4, 5: 9, 9: 14, 20: 22 },
  Druid: { 1: 4, 5: 9, 9: 14, 20: 22 },
  Paladin: { 1: 2, 5: 6, 9: 9, 20: 15 },
  Ranger: { 1: 2, 5: 6, 9: 9, 20: 15 },
}

test('preparedSpellLimit: each class reads its 2024 table, not modifier + level', () => {
  for (const [name, rows] of Object.entries(BOOK)) {
    for (const [level, want] of Object.entries(rows)) {
      const r = preparedSpellLimit({
        classes: [{ name, level: Number(level) }],
      })
      assert.strictEqual(r.max, want, `${name} ${level}`)
    }
  }
})

test('preparedSpellLimit: Rangers prepare spells in 2024', () => {
  assert.strictEqual(
    preparedSpellLimit({ classes: [{ name: 'Ranger', level: 9 }] }).max,
    9
  )
  assert.ok(isPreparedCaster({ classes: [{ name: 'Ranger', level: 5 }] }))
})

test('preparedSpellLimit: the ability scores no longer matter', () => {
  const wiz = { classes: [{ name: 'Wizard', level: 9 }] }
  assert.strictEqual(
    preparedSpellLimit(wiz, { int: 30 }).max,
    preparedSpellLimit(wiz, { int: 1 }).max
  )
})

test('preparedSpellLimit: multiclass works each class out separately with its own level', () => {
  // Barbarian 6 / Paladin 3: only the Paladin levels count, at Paladin 3 (4 prepared).
  const r = preparedSpellLimit({
    classes: [
      { name: 'Barbarian', level: 6 },
      { name: 'Paladin', level: 3 },
    ],
  })
  assert.strictEqual(r.max, 4)
  assert.strictEqual(r.classes.length, 1)
  const two = preparedSpellLimit({
    classes: [
      { name: 'Cleric', level: 4 },
      { name: 'Wizard', level: 4 },
    ],
  })
  assert.strictEqual(two.max, 7 + 7)
  assert.strictEqual(two.breakdown.length, 2)
})

test('preparedSpellLimit: classes that choose only on a level-up, and non-casters, prepare nothing here', () => {
  for (const name of ['Bard', 'Sorcerer', 'Warlock', 'Fighter']) {
    assert.strictEqual(
      preparedSpellLimit({ classes: [{ name, level: 5 }] }),
      null,
      name
    )
  }
  assert.strictEqual(preparedSpellLimit({}), null)
})

test('preparedSpellLimit agrees with the engine class tables (spellcasting.js)', () => {
  for (const name of [
    'Wizard',
    'Cleric',
    'Druid',
    'Paladin',
    'Ranger',
    'Artificer',
  ]) {
    for (let level = 1; level <= 20; level++) {
      assert.strictEqual(
        preparedSpellLimit({ classes: [{ name, level }] }).max,
        preparedSpellCount(name, level, 0, null, '2024'),
        `${name} ${level}`
      )
    }
  }
})

test('isPreparedCaster agrees with preparedSpellLimit', () => {
  assert.ok(isPreparedCaster({ classes: [{ name: 'Wizard', level: 1 }] }))
  assert.ok(!isPreparedCaster({ classes: [{ name: 'Sorcerer', level: 5 }] }))
  assert.ok(!isPreparedCaster({}))
})
