const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

test('multiclassCasterLevel: full casters count in full, sum directly', () => {
  const level = engine.multiclassCasterLevel([
    { name: 'Cleric', level: 6 },
    { name: 'Paladin', level: 4 },
  ])
  // Cleric 6 (full) + Paladin floor(4/2)=2 (half, 2+ levels) = 8
  assert.equal(level, 8)
  assert.deepEqual(
    engine.multiclassSpellSlots([
      { name: 'Cleric', level: 6 },
      { name: 'Paladin', level: 4 },
    ]),
    [4, 3, 3, 2]
  )
})

test('multiclassCasterLevel: Artificer rounds UP, not down (the one exception)', () => {
  const level = engine.multiclassCasterLevel([
    { name: 'Wizard', level: 5 },
    { name: 'Artificer', level: 3 },
  ])
  // Wizard 5 (full) + Artificer ceil(3/2)=2 = 7
  assert.equal(level, 7)
})

test('multiclassCasterLevel: Paladin/Ranger contribute 0 at exactly 1 level (rule requires 2+)', () => {
  const level = engine.multiclassCasterLevel([
    { name: 'Wizard', level: 5 },
    { name: 'Paladin', level: 1 },
  ])
  assert.equal(level, 5)
})

test('multiclassCasterLevel: Fighter/Rogue only contribute via Eldritch Knight/Arcane Trickster at 3+ levels', () => {
  const notEligible = engine.multiclassCasterLevel([
    { name: 'Wizard', level: 5 },
    { name: 'Fighter', level: 4, subclass: 'Champion' }, // wrong subclass
  ])
  assert.equal(notEligible, 5)

  const eligible = engine.multiclassCasterLevel([
    { name: 'Wizard', level: 5 },
    { name: 'Fighter', level: 6, subclass: 'Eldritch Knight' },
  ])
  assert.equal(eligible, 5 + Math.floor(6 / 3))
})

test('multiclassCasterLevel: Warlock never contributes to the combined table', () => {
  const level = engine.multiclassCasterLevel([
    { name: 'Wizard', level: 5 },
    { name: 'Warlock', level: 9 },
  ])
  assert.equal(level, 5)
})

test('Kerra (Fighter Champion 4 / Warlock 5) has ZERO normal slots and pact magic only — matches real 5e multiclassing', () => {
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))
  const kerra = characters.find((c) => c.name === 'Kerra')
  assert.deepEqual(engine.multiclassSpellSlots(kerra.classes), [])
  assert.deepEqual(engine.multiclassPactSlots(kerra.classes), {
    slots: 2,
    slot_level: 3,
  })
})

test('multiclassPactSlots returns null when there are no Warlock levels at all', () => {
  assert.equal(engine.multiclassPactSlots([{ name: 'Wizard', level: 5 }]), null)
})
