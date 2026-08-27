const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')
const { diffLevelUp } = require('../rules/diffLevelUp')

function baseWizard(overrides = {}) {
  return {
    name: 'Test Wizard',
    level: 4,
    proficiency_bonus: 2,
    stat_str: 8,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 16,
    stat_wis: 10,
    stat_cha: 10,
    hp_max: 24,
    hp_current: 24,
    hit_dice_current: 4,
    spellcasting_ability: 'int',
    features: [],
    spells: [],
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 4 }],
    ...overrides,
  }
}

test('diffLevelUp: unknown class returns no patch and a clear warning instead of guessing', () => {
  const result = diffLevelUp(baseWizard(), { className: 'Sorcerer' })
  assert.equal(result.patch, null)
  assert.ok(result.warnings[0].includes('no "Sorcerer" class'))
})

test('diffLevelUp: single-class HP/level/proficiency math with deterministic "average" HP', () => {
  const character = baseWizard()
  const result = diffLevelUp(character, {
    className: 'Wizard',
    hpMethod: 'average',
  })
  // d6 average = 4, CON mod for con 14 = +2 -> 6 gained
  assert.equal(result.patch.hp_max, 30)
  assert.equal(result.patch.hp_current, 30)
  assert.equal(result.patch.level, 5)
  assert.equal(result.patch.proficiency_bonus, engine.proficiencyBonus(5))
  assert.equal(result.patch.classes[0].level, 5)
  assert.equal(result.patch.hit_dice_current, 5)
})

test('diffLevelUp: crossing an ASI level without a resolution is a pending choice, not a guess', () => {
  const character = baseWizard({
    level: 3,
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 3 }],
  })
  const result = diffLevelUp(character, { className: 'Wizard', toLevel: 4 })
  assert.ok(
    result.pendingChoices.some((p) => p.type === 'asiOrFeat' && p.level === 4)
  )
  // scores unchanged since nothing was resolved
  assert.equal(result.patch.stat_int, 16)
})

test('diffLevelUp: a supplied ASI resolution at the crossed level is applied to the patch', () => {
  const character = baseWizard({
    level: 3,
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 3 }],
  })
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 4,
    asiOrFeatResolutions: { 4: { type: 'asi', increases: { int: 2 } } },
  })
  assert.equal(result.patch.stat_int, 18)
  assert.ok(!result.pendingChoices.some((p) => p.type === 'asiOrFeat'))
})

test('diffLevelUp: new features are added, but a feature the character already has is not duplicated', () => {
  // Evocation grants "Potent Cantrip" at level 6 — pre-seed it as already
  // present (as if it were entered by hand earlier) and confirm the 5->6
  // level-up doesn't add a second copy.
  const character = baseWizard({
    level: 5,
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 5 }],
    features: [{ name: 'Potent Cantrip', type: 'feature' }],
  })
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 6,
    hpMethod: 'average',
  })
  // patch.features is only present when there's something NEW to add — since
  // the only level-6 feature (Potent Cantrip) is already on the sheet, the
  // patch should omit `features` entirely rather than re-add a duplicate.
  assert.equal(result.patch.features, undefined)
})

test('diffLevelUp: a genuinely new feature IS added when the character does not already have it', () => {
  const character = baseWizard({
    level: 5,
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 5 }],
    features: [],
  })
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 6,
    hpMethod: 'average',
  })
  const names = (result.patch.features || []).map((f) => f.name)
  assert.ok(names.includes('Potent Cantrip'))
  assert.deepEqual(
    result.newFeatures.map((f) => f.name),
    ['Potent Cantrip']
  )
})

test('diffLevelUp: multiclass spell slots use the combined table when another class also contributes', () => {
  const character = {
    name: 'Test Multi',
    level: 5,
    proficiency_bonus: 3,
    stat_str: 10,
    stat_dex: 10,
    stat_con: 12,
    stat_int: 10,
    stat_wis: 16,
    stat_cha: 10,
    hp_max: 30,
    hp_current: 30,
    hit_dice_current: 5,
    spellcasting_ability: 'wis',
    features: [],
    spells: [],
    classes: [
      { name: 'Cleric', level: 3 },
      { name: 'Wizard', level: 2 },
    ],
  }
  // Leveling the Wizard side from 2->3 while Cleric stays at 3: combined
  // caster level becomes 3+3=6 -> full_caster_slots["6"]
  const result = diffLevelUp(character, {
    className: 'Wizard',
    hpMethod: 'average',
  })
  const tables = require('../data/spellcasting-tables.json')
  const expectedSlots = tables.full_caster_slots['6']
  expectedSlots.forEach((max, i) => {
    assert.equal(result.patch.spell_slots[`level_${i + 1}`].max, max)
    assert.equal(result.patch.spell_slots[`level_${i + 1}`].current, max)
  })
})

test('diffLevelUp: Warlock pact_magic patch uses the real pact magic table, not normal slots', () => {
  const character = baseWizard({
    spellcasting_ability: 'cha',
    classes: [{ name: 'Warlock', subclass: 'Great Old One', level: 4 }],
  })
  const result = diffLevelUp(character, {
    className: 'Warlock',
    hpMethod: 'average',
  })
  assert.equal(result.patch.spell_slots, undefined)
  assert.ok(result.patch.pact_magic.max > 0)
  assert.ok(result.patch.pact_magic.slot_level >= 3) // level 5 Warlock pact slots are 3rd level
})

test('diffLevelUp: known-caster classes report how many new spells are owed as a pending choice', () => {
  const character = baseWizard({
    spellcasting_ability: 'cha',
    classes: [{ name: 'Sorcerer', level: 4 }],
  })
  const result = diffLevelUp(character, {
    className: 'Sorcerer',
    hpMethod: 'average',
  })
  const pending = result.pendingChoices.find((p) => p.type === 'newKnownSpells')
  assert.ok(pending)
  assert.equal(
    pending.count,
    engine.spellsKnownForClass('Sorcerer', 5) -
      engine.spellsKnownForClass('Sorcerer', 4)
  )
})

test('diffLevelUp: real roster smoke test against Lenn (single-class Wizard 9) matches the class table exactly', () => {
  const fs = require('fs')
  const characters = JSON.parse(
    fs.readFileSync(`${__dirname}/../../src/data/characters.json`, 'utf8')
  )
  const list = Array.isArray(characters)
    ? characters
    : Object.values(characters)[0]
  const lenn = list.find((c) => c.name === 'Lenn')

  const result = diffLevelUp(lenn, { className: 'Wizard', hpMethod: 'average' })
  const tables = require('../data/spellcasting-tables.json')
  const expectedSlots = tables.full_caster_slots['10']
  expectedSlots.forEach((max, i) => {
    assert.equal(result.patch.spell_slots[`level_${i + 1}`].max, max)
  })
  assert.equal(result.patch.classes[0].level, 10)
  assert.equal(
    result.patch.hp_max,
    lenn.hp_max + 4 + engine.abilityModifier(lenn.stat_con)
  )
})
