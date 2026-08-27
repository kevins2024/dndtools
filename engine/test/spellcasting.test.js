const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test("full-caster slots at level 9 match Rith/Therynv'l (Druid) in characters.json", () => {
  assert.deepEqual(
    engine.spellSlotsForClassAtLevel('Druid', 9),
    [4, 3, 3, 3, 1]
  )
  assert.deepEqual(
    engine.spellSlotsForClassAtLevel('Wizard', 9),
    [4, 3, 3, 3, 1]
  )
})

test('half-caster slots at level 9 match Enauweyn (Paladin) in characters.json exactly', () => {
  assert.deepEqual(engine.spellSlotsForClassAtLevel('Paladin', 9), [4, 3, 2])
})

test('artificer slots at level 9 match Jaygar in characters.json exactly', () => {
  assert.deepEqual(engine.spellSlotsForClassAtLevel('Artificer', 9), [4, 3, 2])
})

test('pact magic scales by slot level, not slot count, as Warlock levels up', () => {
  assert.deepEqual(engine.pactMagicForLevel(1), { slots: 1, slot_level: 1 })
  assert.deepEqual(engine.pactMagicForLevel(11), { slots: 3, slot_level: 5 })
  assert.deepEqual(engine.pactMagicForLevel(20), { slots: 4, slot_level: 5 })
})

test('mystic arcanum accumulates the higher spell levels as the warlock levels up', () => {
  assert.deepEqual(engine.mysticArcanumLevelsKnownAt(10), [])
  assert.deepEqual(engine.mysticArcanumLevelsKnownAt(11), [6])
  assert.deepEqual(engine.mysticArcanumLevelsKnownAt(17), [6, 7, 8, 9])
})

test('cantrips known follows breakpoints per class', () => {
  assert.equal(engine.cantripsKnownForClass('Wizard', 1), 3)
  assert.equal(engine.cantripsKnownForClass('Wizard', 3), 3)
  assert.equal(engine.cantripsKnownForClass('Wizard', 4), 4)
  assert.equal(engine.cantripsKnownForClass('Wizard', 9), 4)
  assert.equal(engine.cantripsKnownForClass('Wizard', 10), 5)
  assert.equal(engine.cantripsKnownForClass('Artificer', 9), 2)
  assert.equal(engine.cantripsKnownForClass('Artificer', 10), 3)
  assert.equal(engine.cantripsKnownForClass('Artificer', 14), 4)
})

test('spells known (fixed-list casters) matches verified tables', () => {
  assert.equal(engine.spellsKnownForClass('Bard', 9), 12)
  assert.equal(engine.spellsKnownForClass('Bard', 10), 14)
  assert.equal(engine.spellsKnownForClass('Sorcerer', 9), 10)
  assert.equal(engine.spellsKnownForClass('Warlock', 9), 10)
  assert.equal(engine.spellsKnownForClass('Ranger', 9), 6)
})

test('prepared-caster classes return null from spellsKnownForClass (they prepare instead)', () => {
  assert.equal(engine.spellsKnownForClass('Cleric', 9), null)
  assert.equal(engine.spellsKnownForClass('Druid', 9), null)
  assert.equal(engine.spellsKnownForClass('Wizard', 9), null)
})

test("preparedSpellCount: Therynv'l (Druid 9, WIS 18 -> +4) should prepare 13 spells", () => {
  assert.equal(engine.preparedSpellCount('Druid', 9, 4), 13)
})

test('preparedSpellCount: half-casters use half level rounded down', () => {
  // Paladin 9, CHA mod +3 (Enauweyn's actual CHA 17 -> +3) -> 3 + floor(9/2) = 3+4 = 7
  assert.equal(engine.preparedSpellCount('Paladin', 9, 3), 7)
})

test('preparedSpellCount never drops below 1 even for a negative modifier', () => {
  assert.equal(engine.preparedSpellCount('Wizard', 1, -1), 1)
})

test("known-caster classes return null from preparedSpellCount (they don't prepare)", () => {
  assert.equal(engine.preparedSpellCount('Bard', 9, 3), null)
  assert.equal(engine.preparedSpellCount('Sorcerer', 9, 3), null)
})
