// 2024 spellcasting numbers, transcribed from the class tables on
// dnd2024.wikidot.com (Wizard, Paladin, Ranger, Warlock pages).
const test = require('node:test')
const assert = require('node:assert/strict')
const sc = require('../rules/5e/spellcasting')
const { multiclassSpellSlots, multiclassPactSlots } = require('../rules/5e/multiclass')

test('2024 Wizard: cantrips, prepared spells and slots follow the class table', () => {
  assert.deepEqual([1, 3, 4, 9, 10, 20].map((l) => sc.cantripsKnownForClass('Wizard', l, null, '2024')), [3, 3, 4, 4, 5, 5])
  assert.deepEqual([1, 2, 5, 9, 16, 20].map((l) => sc.preparedSpellCount('Wizard', l, 3, null, '2024')), [4, 5, 9, 14, 21, 25])
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Wizard', 1, null, '2024'), [2])
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Wizard', 3, null, '2024'), [4, 2])
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Wizard', 20, null, '2024'), [4, 3, 3, 3, 3, 2, 2, 1, 1])
})

test('2024 prepared spells do not depend on the ability modifier', () => {
  assert.equal(sc.preparedSpellCount('Wizard', 5, -1, null, '2024'), 9)
  assert.equal(sc.preparedSpellCount('Wizard', 5, 5, null, '2024'), 9)
  // 2014: ability modifier + level.
  assert.equal(sc.preparedSpellCount('Wizard', 5, 3), 8)
})

test('2024 Bard/Sorcerer/Ranger/Warlock prepare spells instead of knowing a fixed list', () => {
  for (const cls of ['Bard', 'Sorcerer', 'Ranger', 'Warlock']) {
    assert.equal(sc.spellsKnownForClass(cls, 5, null, '2024'), null, cls)
    assert.equal(typeof sc.preparedSpellCount(cls, 5, 3, null, '2024'), 'number', cls)
  }
  assert.equal(typeof sc.spellsKnownForClass('Bard', 5), 'number') // 2014 unchanged
})

test('2024 Paladin and Ranger cast from level 1, with the half-caster slot table', () => {
  assert.deepEqual([1, 2, 3, 5, 9, 17].map((l) => sc.spellSlotsForClassAtLevel('Paladin', l, null, '2024')), [[2], [2], [3], [4, 2], [4, 3, 2], [4, 3, 3, 3, 1]])
  assert.deepEqual([1, 2, 3].map((l) => sc.spellSlotsForClassAtLevel('Ranger', l, null, '2024')), [[2], [2], [3]])
  assert.deepEqual([1, 2, 3, 5, 9, 11, 17].map((l) => sc.preparedSpellCount('Paladin', l, 0, null, '2024')), [2, 3, 4, 6, 9, 10, 14])
  assert.deepEqual([1, 2, 3, 5].map((l) => sc.preparedSpellCount('Ranger', l, 0, null, '2024')), [2, 3, 4, 6])
  // 2014 Paladin has no slots at level 1.
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Paladin', 1), [])
})

test('2024 Warlock: pact slots and invocation counts', () => {
  assert.deepEqual([1, 2, 3, 5, 11, 17].map((l) => sc.pactMagicForLevel(l, '2024')), [
    { slots: 1, slot_level: 1 },
    { slots: 2, slot_level: 1 },
    { slots: 2, slot_level: 2 },
    { slots: 2, slot_level: 3 },
    { slots: 3, slot_level: 5 },
    { slots: 4, slot_level: 5 },
  ])
  const { invocationsKnownForLevel } = require('../rules/5e/invocations')
  assert.deepEqual([1, 2, 5, 7, 9, 12, 15, 18].map((l) => invocationsKnownForLevel(l, '2024')), [1, 3, 5, 6, 7, 8, 9, 10])
})

test('2024 multiclass spellcasting: full-caster levels add; Pact Magic stays separate', () => {
  const classes = [
    { name: 'Wizard', level: 5, subclass: null },
    { name: 'Cleric', level: 3, subclass: null },
  ]
  assert.deepEqual(multiclassSpellSlots(classes, '2024'), [4, 3, 3, 2]) // caster level 8
  assert.deepEqual(multiclassPactSlots([{ name: 'Warlock', level: 5 }], '2024'), { slots: 2, slot_level: 3 })
})
