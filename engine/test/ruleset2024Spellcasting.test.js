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

// ── Third casters (Eldritch Knight / Arcane Trickster) ──────────────────

test('2024 Eldritch Knight: cantrips 2 (3rd) -> 3 (10th); prepared spells and slots from its own table', () => {
  assert.deepEqual([3, 9, 10, 20].map((l) => sc.cantripsKnownForClass('Fighter', l, 'Eldritch Knight', '2024')), [2, 2, 3, 3])
  assert.deepEqual([3, 4, 7, 10, 13, 16, 19, 20].map((l) => sc.preparedSpellCount('Fighter', l, 3, 'Eldritch Knight', '2024')), [3, 4, 5, 7, 9, 11, 12, 13])
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Fighter', 3, 'Eldritch Knight', '2024'), [2])
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Fighter', 7, 'Eldritch Knight', '2024'), [4, 2])
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Fighter', 19, 'Eldritch Knight', '2024'), [4, 3, 3, 1])
  assert.equal(sc.spellsKnownForClass('Fighter', 7, 'Eldritch Knight', '2024'), null)
  // A plain Champion still casts nothing.
  assert.equal(sc.resolveSpellcasting('Fighter', 'Champion', '2024'), null)
})

test('2024 Arcane Trickster: Mage Hand plus two cantrips (3), a fourth at 10', () => {
  assert.deepEqual([3, 9, 10].map((l) => sc.cantripsKnownForClass('Rogue', l, 'Arcane Trickster', '2024')), [3, 3, 4])
  assert.equal(sc.preparedSpellCount('Rogue', 3, 3, 'Arcane Trickster', '2024'), 3)
})

test('2014 third casters are untouched', () => {
  assert.deepEqual(sc.spellSlotsForClassAtLevel('Fighter', 3, 'Eldritch Knight'), [2])
  assert.equal(typeof sc.spellsKnownForClass('Fighter', 7, 'Eldritch Knight'), 'number')
})

// ── Multiclass spellcasting contributions (2024 PHB "Multiclassing") ────

const { casterLevelContribution, multiclassCasterLevel, meetsMulticlassPrerequisites } = require('../rules/5e/multiclass')

test('2024: Paladin/Ranger contribute HALF their levels rounded UP (so level 1 counts); third casters round down', () => {
  assert.equal(casterLevelContribution({ name: 'Ranger', level: 1 }, '2024'), 1)
  assert.equal(casterLevelContribution({ name: 'Paladin', level: 5 }, '2024'), 3)
  assert.equal(casterLevelContribution({ name: 'Ranger', level: 4 }, '2024'), 2)
  assert.equal(casterLevelContribution({ name: 'Fighter', level: 8, subclass: 'Eldritch Knight' }, '2024'), 2)
  assert.equal(casterLevelContribution({ name: 'Fighter', level: 8, subclass: 'Champion' }, '2024'), 0)
  assert.equal(casterLevelContribution({ name: 'Warlock', level: 8 }, '2024'), 0)
  assert.equal(casterLevelContribution({ name: 'Bard', level: 4 }, '2024'), 4)
  // 2014: floor, and nothing at level 1.
  assert.equal(casterLevelContribution({ name: 'Ranger', level: 1 }), 0)
  assert.equal(casterLevelContribution({ name: 'Paladin', level: 5 }), 2)
})

test("2024 rules example: level 4 Ranger / level 3 Sorcerer counts as level 5 -> four 1st, three 2nd, two 3rd slots", () => {
  const classes = [
    { name: 'Ranger', level: 4 },
    { name: 'Sorcerer', level: 3 },
  ]
  assert.equal(multiclassCasterLevel(classes, '2024'), 5)
  assert.deepEqual(multiclassSpellSlots(classes, '2024'), [4, 3, 2])
})

test('2024 multiclass prerequisite: Monk needs Dexterity AND Wisdom 13; Fighter needs Strength OR Dexterity', () => {
  const scores = (o) => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...o })
  assert.equal(meetsMulticlassPrerequisites('Monk', scores({ dex: 14 }), '2024').met, false)
  assert.equal(meetsMulticlassPrerequisites('Monk', scores({ dex: 14, wis: 13 }), '2024').met, true)
  assert.equal(meetsMulticlassPrerequisites('Fighter', scores({ dex: 13 }), '2024').met, true)
})
