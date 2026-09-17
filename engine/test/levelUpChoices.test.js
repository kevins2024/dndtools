const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')
const { multiclassSpellSlots } = require('../rules/5e/multiclass')
const { spellSlotsForClassAtLevel } = require('../rules/5e/spellcasting')
const { validateCharacter } = require('../rules/validateCharacter')

// ---- HP roll vs average ----

test('hpGainForLevel: average is floor(die/2)+1 for every hit die size on the roster', () => {
  assert.equal(engine.hpGainForLevel('Sorcerer', 'average'), 4) // d6
  assert.equal(engine.hpGainForLevel('Wizard', 'average'), 4) // d6
  assert.equal(engine.hpGainForLevel('Bard', 'average'), 5) // d8
  assert.equal(engine.hpGainForLevel('Fighter', 'average'), 6) // d10
  assert.equal(engine.hpGainForLevel('Barbarian', 'average'), 7) // d12
})

test('hpGainForLevel: level 1 is always max hit die, regardless of method or a supplied roll', () => {
  assert.equal(engine.hpGainForLevel('Fighter', 'roll', null, 1), 10)
  assert.equal(engine.hpGainForLevel('Fighter', 'average', null, 1), 10)
  // A rolled value is simply ignored at level 1 rather than erroring — the
  // rule always wins over whatever method/value was passed in.
  assert.equal(engine.hpGainForLevel('Fighter', 'roll', 3, 1), 10)
  assert.equal(engine.hpGainForLevel('Barbarian', 'roll', null, 1), 12)
})

test('describeLevelUp: a from-scratch 0->1 level-up reports max hit die HP, labeled "max"', () => {
  const result = engine.describeLevelUp({
    className: 'Fighter',
    fromLevel: 0,
    toLevel: 1,
    hpMethod: 'roll',
  })
  assert.deepEqual(result.hp, [{ level: 1, gained: 10, method: 'max' }])
  assert.equal(result.totalHpGained, 10)
})

test('hpGainForLevel: "roll" (the default) returns a value in range, and honors a supplied roll', () => {
  const rolled = engine.hpGainForLevel('Fighter') // default method, no value supplied
  assert.ok(Number.isInteger(rolled) && rolled >= 1 && rolled <= 10)

  assert.equal(engine.hpGainForLevel('Fighter', 'roll', 7), 7)
  assert.throws(() => engine.hpGainForLevel('Fighter', 'roll', 11)) // d10 max is 10
  assert.throws(() => engine.hpGainForLevel('Fighter', 'roll', 0))
  assert.throws(() => engine.hpGainForLevel('Fighter', 'nonsense'))
})

test('describeLevelUp: HP defaults to "roll" method and reports one entry per level gained', () => {
  const result = engine.describeLevelUp({
    className: 'Fighter',
    subclassName: 'Champion',
    fromLevel: 3,
    toLevel: 5,
  })
  assert.equal(result.hp.length, 2)
  assert.equal(result.hp[0].level, 4)
  assert.equal(result.hp[0].method, 'roll')
  assert.ok(result.hp.every((h) => h.gained >= 1 && h.gained <= 10))
  assert.equal(
    result.totalHpGained,
    result.hp.reduce((sum, h) => sum + h.gained, 0)
  )
})

test('describeLevelUp: HP method "average" and explicit hpRolls are both honored per level', () => {
  const avg = engine.describeLevelUp({
    className: 'Wizard',
    fromLevel: 1,
    toLevel: 3,
    hpMethod: 'average',
  })
  assert.deepEqual(
    avg.hp.map((h) => h.gained),
    [4, 4]
  )

  const explicit = engine.describeLevelUp({
    className: 'Wizard',
    fromLevel: 1,
    toLevel: 3,
    hpMethod: 'roll',
    hpRolls: [6, 2],
  })
  assert.deepEqual(
    explicit.hp.map((h) => h.gained),
    [6, 2]
  )
})

// ---- ASI / feat choice ----

test('resolveAsiOrFeat: a standard +1/+1 or +2 ASI applies correctly and rejects a bad total', () => {
  const scores = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }

  const split = engine.resolveAsiOrFeat(scores, {
    type: 'asi',
    increases: { str: 1, dex: 1 },
  })
  assert.deepEqual(split.scores, { ...scores, str: 15, dex: 13 })

  const single = engine.resolveAsiOrFeat(scores, {
    type: 'asi',
    increases: { con: 2 },
  })
  assert.equal(single.scores.con, 16)

  assert.throws(() =>
    engine.resolveAsiOrFeat(scores, { type: 'asi', increases: { str: 1 } })
  )
  assert.throws(() =>
    engine.resolveAsiOrFeat(scores, { type: 'asi', increases: { str: 3 } })
  )
})

test('resolveAsiOrFeat: ASI increases cap at 20 and note when they do', () => {
  const scores = { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = engine.resolveAsiOrFeat(scores, {
    type: 'asi',
    increases: { str: 2 },
  })
  assert.equal(result.scores.str, 20)
  assert.ok(result.notes.some((n) => n.includes('capped at 20')))
})

test('resolveAsiOrFeat: a catalogued feat with a choice_of ability bump requires the choice and applies it', () => {
  const scores = { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 }

  assert.throws(() =>
    engine.resolveAsiOrFeat(scores, { type: 'feat', featName: 'Fey Touched' })
  )

  const result = engine.resolveAsiOrFeat(scores, {
    type: 'feat',
    featName: 'Fey Touched',
    abilityChoice: 'int',
  })
  assert.equal(result.scores.int, 13)
})

test('resolveAsiOrFeat: an uncatalogued feat records a note instead of crashing or guessing', () => {
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = engine.resolveAsiOrFeat(scores, {
    type: 'feat',
    featName: 'Made Up Feat',
  })
  assert.deepEqual(result.scores, scores)
  assert.ok(result.notes[0].includes("isn't in the feat catalog"))
})

// ---- Multiclass spell slots: single real caster among noncaster levels ----

test("multiclassSpellSlots: Elucyne-shaped roster data (Ranger5/Rogue2/Fighter-Champion2) uses Ranger's OWN half-caster table, not the combined-table formula", () => {
  const classes = [
    { name: 'Ranger', level: 5, subclass: 'Gloom Stalker' },
    { name: 'Rogue', level: 2, subclass: null },
    { name: 'Fighter', level: 2, subclass: 'Champion' },
  ]
  const result = multiclassSpellSlots(classes)
  const rangerOwnTable = spellSlotsForClassAtLevel('Ranger', 5)
  assert.deepEqual(result, rangerOwnTable)
  assert.deepEqual(result, [4, 2]) // real PHB Ranger 5 slots — NOT full_caster_slots[floor(5/2)=2], which is [3]
})

test('multiclassSpellSlots: a genuine two-caster combo (Cleric3/Wizard2) DOES use the combined full-caster table', () => {
  const classes = [
    { name: 'Cleric', level: 3 },
    { name: 'Wizard', level: 2 },
  ]
  // Both full casters, combined level 5 -> full_caster_slots["5"]
  const tables = require('../data/5e/spellcasting-tables.json')
  assert.deepEqual(multiclassSpellSlots(classes), tables.full_caster_slots['5'])
})

test('describeLevelUp: multiclass slots via otherClasses match multiclassSpellSlots directly', () => {
  const result = engine.describeLevelUp({
    className: 'Wizard',
    fromLevel: 1,
    toLevel: 2,
    otherClasses: [{ name: 'Cleric', level: 3 }],
  })
  assert.deepEqual(
    result.spellcasting.slotsBefore,
    multiclassSpellSlots([
      { name: 'Cleric', level: 3 },
      { name: 'Wizard', level: 1 },
    ])
  )
  assert.deepEqual(
    result.spellcasting.slotsAfter,
    multiclassSpellSlots([
      { name: 'Cleric', level: 3 },
      { name: 'Wizard', level: 2 },
    ])
  )
})

test('describeLevelUp: Warlock pact slots are now actually computed, not left null', () => {
  const result = engine.describeLevelUp({
    className: 'Warlock',
    fromLevel: 4,
    toLevel: 5,
  })
  assert.equal(result.spellcasting.slotsBefore, null)
  assert.equal(result.spellcasting.slotsAfter, null)
  assert.ok(result.spellcasting.pactSlotsBefore.slots > 0)
  assert.ok(result.spellcasting.pactSlotsAfter.slots > 0)
  assert.notDeepEqual(
    result.spellcasting.pactSlotsBefore,
    result.spellcasting.pactSlotsAfter
  )
})

// ---- Homebrew subclass feature at a non-standard level ----

test('describeLevelUp: Circle of the Moon 7->8 surfaces the homebrew "Wild Symbiosis" feature, even though 8 isn\'t one of Druid\'s normal subclass_feature_levels', () => {
  const result = engine.describeLevelUp({
    className: 'Druid',
    subclassName: 'Circle of the Moon',
    fromLevel: 7,
    toLevel: 8,
  })
  const at8 = result.subclassFeaturesGained.find((f) => f.level === 8)
  assert.ok(at8, 'expected a subclass feature entry at level 8')
  assert.ok(at8.names.includes('Wild Symbiosis'))
})

test("describeLevelUp: Circle of the Moon 5->6 still only gets the real RAW features at 6, doesn't leak Wild Symbiosis early", () => {
  const result = engine.describeLevelUp({
    className: 'Druid',
    subclassName: 'Circle of the Moon',
    fromLevel: 5,
    toLevel: 6,
  })
  const names = result.subclassFeaturesGained.flatMap((f) => f.names)
  assert.ok(!names.includes('Wild Symbiosis'))
})

// ---- Known-spell-cap check now covers every class, not just classes[0] ----

test('validateCharacter: known-spell-cap check still catches a real overage when the known-caster class is classes[0] (Kessara-style)', () => {
  const character = {
    name: 'Test Overage',
    level: 5,
    proficiency_bonus: 3,
    classes: [{ name: 'Sorcerer', level: 5, started: true }],
    saving_throws: ['con', 'cha'],
    spells: Array.from({ length: 10 }, (_, i) => ({
      name: `Spell ${i}`,
      level: 1,
    })),
  }
  const issues = validateCharacter(character)
  assert.ok(
    issues.some(
      (i) => i.severity === 'warning' && i.message.includes('caps at')
    )
  )
})

test('validateCharacter: known-spell-cap check now also catches an overage when the known caster is NOT classes[0]', () => {
  const character = {
    name: 'Test Overage Not First',
    level: 5,
    proficiency_bonus: 3,
    classes: [
      { name: 'Rogue', level: 2, started: true },
      { name: 'Bard', level: 3 },
    ],
    saving_throws: ['dex', 'int'],
    spells: Array.from({ length: 10 }, (_, i) => ({
      name: `Spell ${i}`,
      level: 1,
    })),
  }
  const issues = validateCharacter(character)
  assert.ok(
    issues.some(
      (i) =>
        i.severity === 'warning' &&
        i.message.includes('Bard') &&
        i.message.includes('caps at')
    )
  )
})

test('validateCharacter: two real known-caster classes at once is flagged as info, not guessed at', () => {
  const character = {
    name: 'Test Dual Caster',
    level: 6,
    proficiency_bonus: 3,
    classes: [
      { name: 'Bard', level: 3, started: true },
      { name: 'Sorcerer', level: 3 },
    ],
    saving_throws: ['dex', 'cha'],
    spells: [{ name: 'Whatever', level: 1 }],
  }
  const issues = validateCharacter(character)
  assert.ok(
    issues.some(
      (i) =>
        i.severity === 'info' &&
        i.message.includes('Multiple known-spell-cap classes')
    )
  )
  assert.ok(
    !issues.some(
      (i) => i.severity === 'warning' && i.message.includes('caps at')
    )
  )
})

test('validateCharacter: real roster Elucyne (Ranger/Rogue/Fighter) produces no known-spell-cap false positive after the fix', () => {
  const characters = require('../../src/data/characters.json')
  const list = Array.isArray(characters)
    ? characters
    : Object.values(characters)[0]
  const elucyne = list.find((c) => c.name === 'Elucyne')
  const issues = validateCharacter(elucyne)
  assert.ok(!issues.some((i) => i.message.includes('caps at')))
})
