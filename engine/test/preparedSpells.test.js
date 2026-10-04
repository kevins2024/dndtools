const test = require('node:test')
const assert = require('node:assert')
const {
  isPreparedCaster,
  preparedSpellLimit,
} = require('../rules/5e/preparedSpells')
const { preparedSpellCount } = require('../rules/5e/spellcasting')

const scores = { str: 10, dex: 10, con: 10, int: 18, wis: 16, cha: 14 }

test('preparedSpellLimit: full casters add ability modifier + class level', () => {
  const wiz = { classes: [{ name: 'Wizard', level: 9 }] }
  const r = preparedSpellLimit(wiz, scores)
  assert.strictEqual(r.max, 4 + 9)
  assert.deepStrictEqual(r.classes[0].ability, 'int')
  const cleric = { classes: [{ name: 'Cleric', level: 5 }] }
  assert.strictEqual(preparedSpellLimit(cleric, scores).max, 3 + 5)
})

test('preparedSpellLimit: Paladin and Artificer use half class level, rounded down', () => {
  assert.strictEqual(
    preparedSpellLimit({ classes: [{ name: 'Paladin', level: 9 }] }, scores)
      .max,
    2 + 4
  )
  assert.strictEqual(
    preparedSpellLimit({ classes: [{ name: 'Artificer', level: 9 }] }, scores)
      .max,
    4 + 4
  )
})

test('preparedSpellLimit: minimum of 1 per class, shown in the breakdown', () => {
  const weak = { ...scores, cha: 6 } // -2
  const r = preparedSpellLimit(
    { classes: [{ name: 'Paladin', level: 2 }] },
    weak
  )
  assert.strictEqual(r.max, 1)
  assert.ok(r.breakdown.some((l) => l.label === 'Minimum 1'))
})

test('preparedSpellLimit: multiclass works each class out separately with its own ability and level', () => {
  // Barbarian 6 / Paladin 3 — old UI math applied Paladin's formula at total level 9.
  const r = preparedSpellLimit(
    {
      classes: [
        { name: 'Barbarian', level: 6 },
        { name: 'Paladin', level: 3 },
      ],
    },
    scores
  )
  assert.strictEqual(r.max, 2 + 1) // CHA mod +2, half of 3 rounded down
  assert.strictEqual(r.classes.length, 1)
  const two = preparedSpellLimit(
    {
      classes: [
        { name: 'Cleric', level: 4 },
        { name: 'Wizard', level: 4 },
      ],
    },
    scores
  )
  assert.strictEqual(two.max, 3 + 4 + (4 + 4))
})

test('preparedSpellLimit: known-spell casters and non-casters prepare nothing', () => {
  assert.strictEqual(
    preparedSpellLimit({ classes: [{ name: 'Bard', level: 5 }] }, scores),
    null
  )
  assert.strictEqual(
    preparedSpellLimit({ classes: [{ name: 'Fighter', level: 5 }] }, scores),
    null
  )
  // 2014 Ranger knows spells (spellcasting.js's own spells_known table).
  assert.strictEqual(
    preparedSpellLimit({ classes: [{ name: 'Ranger', level: 9 }] }, scores),
    null
  )
  assert.strictEqual(preparedSpellLimit({}, scores), null)
})

test('isPreparedCaster agrees with preparedSpellLimit', () => {
  assert.ok(isPreparedCaster({ classes: [{ name: 'Wizard', level: 1 }] }))
  assert.ok(!isPreparedCaster({ classes: [{ name: 'Ranger', level: 5 }] }))
  assert.ok(!isPreparedCaster({ classes: [{ name: 'Sorcerer', level: 5 }] }))
  assert.ok(!isPreparedCaster({}))
})

test('preparedSpellLimit matches spellcasting.js preparedSpellCount for single-class prepared casters', () => {
  for (const [name, ability] of [
    ['Cleric', 'wis'],
    ['Druid', 'wis'],
    ['Wizard', 'int'],
    ['Paladin', 'cha'],
    ['Artificer', 'int'],
  ]) {
    for (let level = 1; level <= 20; level++) {
      const mod = Math.floor((scores[ability] - 10) / 2)
      assert.strictEqual(
        preparedSpellLimit({ classes: [{ name, level }] }, scores).max,
        preparedSpellCount(name, level, mod),
        `${name} ${level}`
      )
    }
  }
})
