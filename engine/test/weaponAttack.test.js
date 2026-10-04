const test = require('node:test')
const assert = require('node:assert/strict')
const {
  weaponStatMod,
  gripDie,
  attackBonus,
  attackBonusBreakdown,
  damageBonus,
  damageBonusBreakdown,
  rageDamageBonus,
} = require('../rules/5e/weaponAttack')
const { isProficientWithWeapon } = require('../rules/5e/weapons')

function baseChar(overrides = {}) {
  return {
    level: 9,
    proficiency_bonus: 4,
    stat_str: 16, // +3
    stat_dex: 14, // +2
    stat_con: 12,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 10,
    weapon_proficiencies: [],
    conditions: [],
    classes: [],
    features: [],
    ...overrides,
  }
}

test('weaponStatMod: a finesse weapon uses the higher of STR/DEX', () => {
  const dagger = { weapon_category: 'dagger' } // finesse
  assert.equal(weaponStatMod(baseChar(), dagger, []), 3) // STR 3 > DEX 2
})

test('weaponStatMod: a ranged weapon uses DEX, a non-finesse melee weapon uses STR', () => {
  const longbow = { weapon_category: 'longbow' }
  assert.equal(weaponStatMod(baseChar(), longbow, []), 2)
  const greatsword = { weapon_category: 'greatsword' }
  assert.equal(weaponStatMod(baseChar(), greatsword, []), 3)
})

test('gripDie: non-versatile weapon always returns its flat damage die', () => {
  const dagger = { weapon_category: 'dagger' }
  assert.equal(gripDie(baseChar(), dagger, []), '1d4')
})

test('gripDie: versatile weapon uses the 2h die when explicitly in the melee2h slot', () => {
  const longsword = { weapon_category: 'longsword', slot: 'melee2h' }
  assert.equal(gripDie(baseChar(), longsword, []), '1d10')
})

test('gripDie: versatile weapon in melee1h uses the 2h die UNLESS a second melee1h weapon is also equipped', () => {
  const longsword = { weapon_category: 'longsword', slot: 'melee1h' }
  assert.equal(gripDie(baseChar(), longsword, []), '1d10') // both hands free
  const dualWielding = [{ slot: 'melee1h' }, { slot: 'melee1h' }]
  assert.equal(gripDie(baseChar(), longsword, dualWielding), '1d8') // one-handed grip
})

test('attackBonus combines stat mod, proficiency, magic enhancement, and a type-specific flat bonus', () => {
  const greatsword = { weapon_category: 'greatsword', enhancement_bonus: 1 }
  const character = baseChar()
  const items = [{ stat_bonuses: { melee_attack: 1 } }]
  assert.equal(attackBonus(character, greatsword, items), 3 + 4 + 1 + 1)
})

test('isProficientWithWeapon: category proficiency, specific-name proficiency, and counts_as_proficiency alias all work', () => {
  const rapier = { weapon_category: 'rapier' }
  assert.equal(
    isProficientWithWeapon(
      baseChar({ weapon_proficiencies: ['martial'] }),
      rapier
    ),
    true
  )
  assert.equal(
    isProficientWithWeapon(
      baseChar({ weapon_proficiencies: ['rapier'] }),
      rapier
    ),
    true
  )
  assert.equal(isProficientWithWeapon(baseChar(), rapier), false)

  const saber = { weapon_category: 'saber' }
  const homebrew = {
    saber: { category: 'martial', counts_as_proficiency: 'rapier' },
  }
  assert.equal(
    isProficientWithWeapon(
      baseChar({ weapon_proficiencies: ['rapier'] }),
      saber,
      homebrew
    ),
    true
  )
})

test('rageDamageBonus: only applies while Raging, only to a Barbarian, only on non-ranged weapons, scales by level', () => {
  const greatsword = { weapon_category: 'greatsword' }
  const longbow = { weapon_category: 'longbow' }
  assert.equal(rageDamageBonus(baseChar(), greatsword), 0) // not raging
  const raging = baseChar({
    conditions: ['Raging'],
    classes: [{ name: 'Barbarian', level: 5 }],
  })
  assert.equal(rageDamageBonus(raging, greatsword), 2)
  assert.equal(rageDamageBonus(raging, longbow), 0) // ranged excluded
  const ragingHighLevel = baseChar({
    conditions: ['Raging'],
    classes: [{ name: 'Barbarian', level: 16 }],
  })
  assert.equal(rageDamageBonus(ragingHighLevel, greatsword), 4)
  const notBarbarian = baseChar({
    conditions: ['Raging'],
    classes: [{ name: 'Fighter', level: 9 }],
  })
  assert.equal(rageDamageBonus(notBarbarian, greatsword), 0)
})

test('damageBonus folds in rageDamageBonus automatically', () => {
  const greatsword = { weapon_category: 'greatsword' }
  const raging = baseChar({
    conditions: ['Raging'],
    classes: [{ name: 'Barbarian', level: 5 }],
  })
  // statMod 3 (STR) + rage 2 = 5
  assert.equal(damageBonus(raging, greatsword, []), 5)
})

// ── Breakdown siblings: value must match the plain function, and a named
// item bonus must show up as its own line without being double-counted.

test('attackBonusBreakdown: value matches attackBonus, and an enchantment/item bonus both appear as named lines', () => {
  const greatsword = {
    name: 'Greatsword +1',
    weapon_category: 'greatsword',
    enhancement_bonus: 1,
  }
  const character = baseChar()
  const items = [
    { name: 'Ring of Precision', stat_bonuses: { melee_attack: 1 } },
  ]
  const { value, breakdown } = attackBonusBreakdown(
    character,
    greatsword,
    items
  )
  assert.equal(value, attackBonus(character, greatsword, items))
  assert.equal(value, 3 + 4 + 1 + 1)
  assert.ok(
    breakdown.some(
      (l) => l.label === 'Greatsword +1 enchantment' && l.amount === 1
    )
  )
  assert.ok(
    breakdown.some((l) => l.label === 'Ring of Precision' && l.amount === 1)
  )
})

test('damageBonusBreakdown: value matches damageBonus, and Raging shows up as its own line', () => {
  const greatsword = { name: 'Greatsword', weapon_category: 'greatsword' }
  const raging = baseChar({
    conditions: ['Raging'],
    classes: [{ name: 'Barbarian', level: 5 }],
  })
  const { value, breakdown } = damageBonusBreakdown(raging, greatsword, [])
  assert.equal(value, damageBonus(raging, greatsword, []))
  assert.ok(breakdown.some((l) => l.label === 'Raging' && l.amount === 2))
})

test('thrownDie: only surfaces when it differs from the current grip die', () => {
  const { thrownDie } = require('../rules/5e/weaponAttack')
  const spear2h = { name: 'Spear', slot: 'melee2h', type: 'weapon', weapon_category: 'spear' }
  const char = { name: 'T', classes: [], stat_str: 10, stat_dex: 10 }
  const die = thrownDie(char, spear2h, [spear2h])
  // spear: thrown, versatile 1d6 / 1d8 — held two-handed, thrown is the base 1d6
  assert.strictEqual(die, '1d6')
  const spear1h = { ...spear2h, slot: 'melee1h' }
  const two = { name: 'Dagger', slot: 'melee1h', type: 'weapon' }
  assert.strictEqual(thrownDie(char, spear1h, [spear1h, two]), null)
  const sword = { name: 'Longsword', type: 'weapon', weapon_category: 'longsword', slot: 'melee1h' }
  assert.strictEqual(thrownDie(char, sword, [sword]), null) // not thrown
})

test('weaponProps: silvered is a per-item property, off unless the item says so', () => {
  const { weaponProps } = require('../rules/5e/weapons')
  assert.strictEqual(
    weaponProps({ weapon_category: 'shortsword', slot: 'melee1h' }).silvered,
    false
  )
  assert.strictEqual(
    weaponProps({ weapon_category: 'shortsword', slot: 'melee1h', silvered: true })
      .silvered,
    true
  )
})
