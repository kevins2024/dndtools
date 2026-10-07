const test = require('node:test')
const assert = require('node:assert/strict')
const { computeAC } = require('../rules/5e/armorClass')

function baseChar(overrides = {}) {
  return {
    name: 'Test',
    stat_str: 10,
    stat_dex: 16, // +3 mod
    stat_con: 14, // +2 mod
    stat_int: 12, // +1 mod
    stat_wis: 10,
    stat_cha: 10,
    features: [],
    ...overrides,
  }
}

test('unarmored, no items: 10 + DEX', () => {
  const { value } = computeAC(baseChar(), [])
  assert.equal(value, 13) // 10 + 3
})

test('light armor: full DEX applies', () => {
  const items = [
    {
      type: 'armor',
      slot: 'body',
      armor_type: 'leather',
      name: 'Leather Armor',
    },
  ]
  const { value } = computeAC(baseChar(), items)
  assert.equal(value, 14) // base 11 + DEX 3
})

test('medium armor: DEX capped at +2 even with a higher DEX mod', () => {
  const items = [
    {
      type: 'armor',
      slot: 'body',
      armor_type: 'breastplate',
      name: 'Breastplate',
    },
  ]
  const { value } = computeAC(baseChar(), items)
  assert.equal(value, 16) // base 14 + DEX capped at 2 (not 3)
})

test('heavy armor: no DEX at all', () => {
  const items = [
    { type: 'armor', slot: 'body', armor_type: 'plate', name: 'Plate Armor' },
  ]
  const { value } = computeAC(baseChar(), items)
  assert.equal(value, 18) // base 18, DEX irrelevant
})

test('armor enhancement bonus adds on top of the base', () => {
  const items = [
    {
      type: 'armor',
      slot: 'body',
      armor_type: 'plate',
      name: 'Plate Armor +2',
      enhancement_bonus: 2,
    },
  ]
  const { value } = computeAC(baseChar(), items)
  assert.equal(value, 20)
})

test('shield adds +2 base plus its own enhancement', () => {
  const items = [
    { armor_type: 'shield', name: 'Shield +1', enhancement_bonus: 1 },
  ]
  const { value, breakdown } = computeAC(baseChar(), items)
  assert.equal(value, 16) // 10 + DEX 3 + shield 3
  assert.ok(breakdown.some((s) => s.label === 'Shield +1' && s.amount === 3))
})

test('monk/barbarian unarmored formulas use the stated ability mod instead of a flat 10+DEX', () => {
  const monk = computeAC(baseChar({ unarmored_ac_formula: 'monk' }), [])
  assert.equal(monk.value, 13) // 10 + DEX 3 + WIS 0 (stat 10 -> mod 0)
  const barb = computeAC(baseChar({ unarmored_ac_formula: 'barbarian' }), [])
  assert.equal(barb.value, 15) // 10 + DEX 3 + CON 2
})

test('REGRESSION (2026-09-30 bug fix): a feature-granted flat AC bonus is counted exactly once, not twice', () => {
  const character = baseChar({
    features: [{ name: 'Fighting Style: Defense', stat_bonuses: { ac: 1 } }],
  })
  const items = [
    { type: 'armor', slot: 'body', armor_type: 'plate', name: 'Plate Armor' },
  ]
  const { value, breakdown } = computeAC(character, items)
  // Base 18 (heavy, no dex) + 1 from the fighting style = 19, NOT 20.
  assert.equal(value, 19)
  // The breakdown still shows the feature as its own line, for the tooltip.
  const featureLines = breakdown.filter(
    (s) => s.label === 'Fighting Style: Defense'
  )
  assert.equal(featureLines.length, 1)
  assert.equal(featureLines[0].amount, 1)
})

test('item-granted flat AC bonus (ring of protection style) is counted once', () => {
  const items = [{ name: 'Ring of Protection', stat_bonuses: { ac: 1 } }]
  const { value } = computeAC(baseChar(), items)
  assert.equal(value, 14) // 10 + DEX 3 + 1
})

test('Dual Wielder +1 only applies when actually dual-wielding two one-handed melee weapons, no shield', () => {
  const dualWielderFeature = [{ name: 'Dual Wielder', type: 'feat' }]
  const twoSwords = [
    { type: 'weapon', slot: 'melee1h', equipped_by: 'Test', name: 'Sword A' },
    { type: 'weapon', slot: 'melee1h', equipped_by: 'Test', name: 'Sword B' },
  ]
  const withFeat = computeAC(
    baseChar({ features: dualWielderFeature }),
    twoSwords
  )
  assert.equal(withFeat.value, 14) // 10 + DEX 3 + 1 dual wielder
  const withoutFeat = computeAC(baseChar(), twoSwords)
  assert.equal(withoutFeat.value, 13) // no bonus without the feat
})

test('Bladesong adds INT mod when active, via the options flag', () => {
  const { value, breakdown } = computeAC(baseChar(), [], {
    bladesongActive: true,
  })
  assert.equal(value, 14) // 10 + DEX 3 + INT 1
  assert.ok(
    breakdown.some((s) => s.label === 'Bladesong INT' && s.amount === 1)
  )
})

// ── Unarmored Defense inferred from class + feature ─────────────────────

const unarmoredChar = (overrides = {}) => ({
  name: 'U',
  stat_str: 10,
  stat_dex: 14, // +2
  stat_con: 18, // +4
  stat_int: 10,
  stat_wis: 16, // +3
  stat_cha: 10,
  features: [{ name: 'Unarmored Defense' }],
  classes: [{ name: 'Barbarian', level: 1 }],
  ...overrides,
})

test('computeAC: a Barbarian with Unarmored Defense gets 10 + DEX + CON with no formula field set', () => {
  assert.strictEqual(computeAC(unarmoredChar(), []).value, 10 + 2 + 4)
})

test('computeAC: a Monk with Unarmored Defense gets 10 + DEX + WIS with no formula field set', () => {
  const monk = unarmoredChar({ classes: [{ name: 'Monk', level: 1 }] })
  assert.strictEqual(computeAC(monk, []).value, 10 + 2 + 3)
})

test('computeAC: an explicit unarmored_ac_formula always wins, including "default"', () => {
  assert.strictEqual(
    computeAC(unarmoredChar({ unarmored_ac_formula: 'default' }), []).value,
    10 + 2
  )
})

test('computeAC: no Unarmored Defense feature means no special formula, whatever the class', () => {
  assert.strictEqual(computeAC(unarmoredChar({ features: [] }), []).value, 10 + 2)
})

test('computeAC: a feature with unarmored_defense gives 10 + the listed modifiers, and armor replaces it', () => {
  const ward = {
    name: 'Elegant Ward',
    unarmored_defense: { abilities: ['dex', 'int'] },
  }
  const c = baseChar({ stat_int: 20, features: [ward] }) // DEX +3, INT +5
  const unarmored = computeAC(c, [])
  assert.equal(unarmored.value, 18)
  assert.deepEqual(unarmored.breakdown, [
    { label: 'Elegant Ward (10 + DEX + INT)', amount: 18 },
  ])
  const leather = {
    type: 'armor',
    slot: 'body',
    armor_type: 'leather',
    name: 'Leather Armor',
  }
  assert.equal(computeAC(c, [leather]).value, 11 + 3) // armor (11 + DEX), not the ward
})

test('computeAC: an explicit formula beats a feature-defined unarmored defense', () => {
  const c = baseChar({
    unarmored_ac_formula: 'default',
    features: [{ name: 'X', unarmored_defense: { abilities: ['int'] } }],
  })
  assert.equal(computeAC(c, []).value, 13)
})
