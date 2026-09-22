const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')

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

test('diffLevelUp: a class name with no rules data returns no patch and a clear warning instead of guessing', () => {
  const result = diffLevelUp(baseWizard(), { className: 'Necromancer' })
  assert.equal(result.patch, null)
  assert.ok(
    result.warnings[0].includes('No rules data for class "Necromancer"')
  )
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
  // patch.features is the FULL merged list (existing + new), not a diff —
  // so it's no longer simply undefined: this Wizard fixture doesn't already
  // have the Caster Prestidigitation house-rule feature (unrelated to
  // Potent Cantrip's own dedup, which this test is actually about), so that
  // gets added on top of the pre-seeded Potent Cantrip. Assert Potent
  // Cantrip appears exactly ONCE (the real thing this test guards), not
  // that patch.features is empty outright.
  const names = (result.patch.features || []).map((f) => f.name)
  assert.deepEqual(
    names.filter((n) => n === 'Potent Cantrip'),
    ['Potent Cantrip']
  )
  assert.ok(names.includes('Caster Prestidigitation'))
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
  // Also picks up Caster Prestidigitation (house rule, unrelated to Potent
  // Cantrip) since this Wizard fixture starts with an empty features[].
  assert.deepEqual(result.newFeatures.map((f) => f.name).sort(), [
    'Caster Prestidigitation',
    'Potent Cantrip',
  ])
})

// Real bug caught auditing a live character (Siv, Rogue 9): the dedup above
// used to match on name alone, so a character who already had "Expertise"
// on their sheet from level 1 silently never got their real, distinct
// level-6 Expertise grant — Rogue (and Bard) are the only classes that name
// the exact same feature twice at different levels, RAW.
test('diffLevelUp: a same-named feature genuinely granted again at a later level (Rogue Expertise, 1 and 6) is NOT deduped away', () => {
  const character = {
    name: 'Test Rogue',
    level: 5,
    proficiency_bonus: 3,
    stat_str: 10,
    stat_dex: 16,
    stat_con: 12,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 10,
    hp_max: 30,
    hp_current: 30,
    hit_dice_current: 5,
    spellcasting_ability: null,
    features: [
      { name: 'Expertise', id: 'rogue-expertise-1', level_gained: 1 },
      { name: 'Sneak Attack', level_gained: 1 },
      { name: "Thieves' Cant", level_gained: 1 },
      { name: 'Cunning Action', level_gained: 2 },
      { name: 'Uncanny Dodge', level_gained: 5 },
    ],
    spells: [],
    classes: [{ name: 'Rogue', subclass: 'Thief', level: 5 }],
  }
  const result = diffLevelUp(character, {
    className: 'Rogue',
    toLevel: 6,
    hpMethod: 'average',
  })
  const names = (result.patch.features || []).map((f) => f.name)
  assert.ok(
    names.includes('Expertise'),
    'the level-6 Expertise grant should be added, not silently dropped'
  )
  // patch.features is the full merged list (existing + new), so it
  // legitimately has 2 "Expertise" entries now (level 1 and level 6) — the
  // real check is that newFeatures (just what's NEW this level-up) has
  // exactly the one level-6 grant, not a re-added level-1 duplicate.
  const newExpertise = result.newFeatures.filter((f) => f.name === 'Expertise')
  assert.equal(newExpertise.length, 1)
  assert.equal(newExpertise[0].level_gained, 6)
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
  const tables = require('../data/5e/spellcasting-tables.json')
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
  const tables = require('../data/5e/spellcasting-tables.json')
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

// ── Multiclassing: picking up a brand-new class ─────────────────────────────

function baseFighter(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 5,
    proficiency_bonus: 3,
    stat_str: 16,
    stat_dex: 12,
    stat_con: 14,
    stat_int: 13,
    stat_wis: 10,
    stat_cha: 8,
    hp_max: 44,
    hp_current: 44,
    hit_dice_current: 5,
    spellcasting_ability: null,
    features: [],
    spells: [],
    classes: [{ name: 'Fighter', subclass: 'Champion', level: 5 }],
    ...overrides,
  }
}

test('diffLevelUp: picking up a brand-new class via multiclassing produces a real patch, not a warning-only refusal', () => {
  const result = diffLevelUp(baseFighter(), {
    className: 'Wizard',
    hpMethod: 'average',
  })
  assert.ok(result.patch, 'should produce a real patch')
  assert.equal(result.patch.classes.length, 2)
  assert.deepEqual(result.patch.classes[1], {
    name: 'Wizard',
    level: 1,
    subclass: null,
  })
  // Total character level goes 5 -> 6, not the new class's own level (1)
  assert.equal(result.patch.level, 6)
  assert.equal(result.patch.proficiency_bonus, engine.proficiencyBonus(6))
})

test('diffLevelUp: multiclass pickup HP is never forced to max, even though it is level 1 for that class', () => {
  // Wizard's hit die is d6 (avg 4). If this incorrectly used the "1st level
  // is always max HP" rule, it would grant 6, not 4.
  const conMod = engine.abilityModifier(baseFighter().stat_con)
  const result = diffLevelUp(baseFighter(), {
    className: 'Wizard',
    hpMethod: 'average',
  })
  const gained = result.patch.hp_max - baseFighter().hp_max
  assert.equal(gained, 4 + conMod)
})

test('diffLevelUp: multiclass pickup grants only the REDUCED proficiency list, and never a new saving throw', () => {
  // Fighter's own full starting list includes heavy armor; the reduced
  // multiclass grant does not.
  const result = diffLevelUp(
    baseFighter({ classes: [{ name: 'Cleric', level: 5 }] }),
    {
      className: 'Fighter',
      hpMethod: 'average',
    }
  )
  assert.deepEqual(result.patch.armor_proficiencies.sort(), [
    'light',
    'medium',
    'shields',
  ])
  assert.ok(!result.patch.armor_proficiencies.includes('heavy'))
  assert.deepEqual(result.patch.weapon_proficiencies.sort(), [
    'martial',
    'simple',
  ])
  assert.equal(result.patch.saving_throws, undefined)
})

test('diffLevelUp: multiclass pickup warns (but does not block) when the prerequisite ability score is not met', () => {
  // Rogue needs DEX 13+; this Fighter's DEX is 12.
  const result = diffLevelUp(baseFighter(), {
    className: 'Rogue',
    hpMethod: 'average',
  })
  assert.ok(
    result.patch,
    'should still produce a patch — a soft warning, not a hard block'
  )
  assert.ok(
    result.warnings.some((w) => w.includes('DEX 13')),
    `expected a DEX 13 prerequisite warning, got: ${JSON.stringify(
      result.warnings
    )}`
  )
})

test('diffLevelUp: multiclass pickup has no prerequisite warning when the ability score IS met', () => {
  // This Fighter's STR is 16 — well above Barbarian's STR 13 requirement.
  const result = diffLevelUp(baseFighter(), {
    className: 'Barbarian',
    hpMethod: 'average',
  })
  assert.ok(
    !result.warnings.some((w) => w.toLowerCase().includes('prerequisite'))
  )
})

test("diffLevelUp: Fighter's multiclass prerequisite is STR 13 OR DEX 13 (any_of, not all_of)", () => {
  // DEX 12, STR 8 — fails STR but the Fighter table entry is STR-or-DEX, and
  // DEX 12 also fails... use a character whose DEX alone clears it.
  const character = baseFighter({
    classes: [{ name: 'Wizard', level: 5 }],
    stat_str: 8,
    stat_dex: 14,
  })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    hpMethod: 'average',
  })
  assert.ok(
    !result.warnings.some((w) => w.toLowerCase().includes('prerequisite')),
    "DEX 14 alone should satisfy Fighter's STR-or-DEX prerequisite"
  )
})

test('diffLevelUp: multiclass pickup surfaces a real pendingChoice for its skill grant, and a note for its tool grant (untracked on the character schema)', () => {
  // Rogue's multiclass grant includes a skill choice and thieves' tools.
  const character = baseFighter({ stat_dex: 14 }) // meets Rogue's DEX 13 prereq
  const result = diffLevelUp(character, {
    className: 'Rogue',
    hpMethod: 'average',
  })
  assert.ok(
    result.pendingChoices.some(
      (p) => p.type === 'multiclassSkillChoice' && p.className === 'Rogue'
    ),
    'the skill grant is a real, resolvable choice now — not just a warning'
  )
  assert.ok(result.warnings.some((w) => w.includes("thieves' tools")))
})

test('diffLevelUp: a level-0 placeholder class entry (UI subclass-draft mechanism) is still treated as a fresh pickup, and its drafted subclass carries into the patch', () => {
  // Cleric picks a subclass at level 1 — LevelUpTool.vue has nowhere else to
  // stash that draft before the pickup is confirmed except a level-0 entry
  // in character.classes (see diffLevelUp.js's isMulticlassPickup comment).
  const character = baseFighter({ stat_wis: 14 }) // meets Cleric's WIS 13 prereq
  character.classes.push({ name: 'Cleric', level: 0, subclass: 'Life Domain' })
  const result = diffLevelUp(character, {
    className: 'Cleric',
    hpMethod: 'average',
  })
  assert.ok(result.patch, 'should still produce a real patch, not a refusal')
  // Exactly one Cleric entry in the result — the placeholder must be
  // replaced, not left alongside a second new entry.
  const clericEntries = result.patch.classes.filter((c) => c.name === 'Cleric')
  assert.equal(clericEntries.length, 1)
  assert.deepEqual(clericEntries[0], {
    name: 'Cleric',
    level: 1,
    subclass: 'Life Domain',
  })
  // Reduced multiclass proficiency list still applies — this is a pickup,
  // not a "leveling an existing class" no-op.
  assert.ok(!('saving_throws' in result.patch))
})
