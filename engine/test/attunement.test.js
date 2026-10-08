const test = require('node:test')
const assert = require('node:assert')
const { applyAttunement, isAttunementActive } = require('../rules/5e/attunement')
const { resolveEffectiveStats } = require('../rules/5e/characterStats')
const { computeAC } = require('../rules/5e/armorClass')
const { attackBonus } = require('../rules/5e/weaponAttack')
const { isProficientWithWeapon } = require('../rules/5e/weapons')

const char = (o = {}) => ({
  name: 'T', level: 5, stat_str: 12, stat_dex: 14, stat_con: 12,
  stat_int: 10, stat_wis: 10, stat_cha: 10, features: [], ...o,
})

test('an item that does not need attunement, or is attuned, passes through untouched', () => {
  const free = { name: 'Sword +2', enhancement_bonus: 2, stat_bonuses: { ac: 1 } }
  const attuned = { name: 'Belt', needs_attunement: true, attuned: true, stat_overrides: { str: 21 } }
  assert.deepStrictEqual(applyAttunement([free, attuned]), [free, attuned])
  assert.strictEqual(isAttunementActive(free), true)
})

test('an unattuned item keeps its +N enchantment but loses every special effect', () => {
  const sword = {
    name: 'Rapier +2 (Psychic)', needs_attunement: true, attuned: false,
    enhancement_bonus: 2, weapon_category: 'rapier', slot: 'melee1h',
    extra_damage: { die: '1d6' }, weapon_effects: [{ name: 'x' }],
    stat_bonuses: { melee_attack: 1 },
  }
  const [out] = applyAttunement([sword])
  assert.strictEqual(out.enhancement_bonus, 2)
  assert.strictEqual(out.weapon_category, 'rapier')
  assert.strictEqual(out.extra_damage, undefined)
  assert.strictEqual(out.weapon_effects, undefined)
  assert.strictEqual(out.stat_bonuses, undefined)
  assert.strictEqual(sword.extra_damage.die, '1d6') // the original isn't mutated
})

test('an unattuned Belt of Giant Strength / bracers grant no bonus, an attuned one does', () => {
  const belt = (attuned) => ({ needs_attunement: true, attuned, stat_overrides: { str: 21 } })
  const bracers = (attuned) => ({ needs_attunement: true, attuned, unarmored_stat_bonuses: { ac: 2 } })
  const strWith = (attuned) =>
    resolveEffectiveStats(char(), applyAttunement([belt(attuned)])).scores.str
  assert.strictEqual(strWith(false), 12)
  assert.strictEqual(strWith(true), 21)
  const acWith = (attuned) => computeAC(char(), applyAttunement([bracers(attuned)])).value
  assert.strictEqual(acWith(false), 12) // 10 + DEX +2
  assert.strictEqual(acWith(true), 14)
})

test('Full Plate +2 keeps its +2 AC even unattuned', () => {
  const plate = {
    type: 'armor', slot: 'body', armor_type: 'plate', name: 'Full Plate +2',
    enhancement_bonus: 2, needs_attunement: true, attuned: false,
  }
  assert.strictEqual(computeAC(char(), applyAttunement([plate])).value, 18 + 2)
})

test('Bracers of Archery grant longbow proficiency only while attuned (Sorra)', () => {
  const longbow = { weapon_category: 'longbow', slot: 'ranged2h' }
  const sorra = char({ weapon_proficiencies: ['simple', 'rapier'], level: 9 })
  const bracers = (attuned) => ({
    needs_attunement: true, attuned, grants_weapon_proficiency: ['longbow', 'shortbow'],
  })
  const worn = applyAttunement([bracers(true), longbow])
  const unworn = applyAttunement([bracers(false), longbow])
  assert.strictEqual(isProficientWithWeapon(sorra, longbow, {}, []), false)
  assert.strictEqual(isProficientWithWeapon(sorra, longbow, {}, worn), true)
  assert.strictEqual(isProficientWithWeapon(sorra, longbow, {}, unworn), false)
  // and the attack bonus follows: DEX +2, proficiency +4 only when proficient
  assert.strictEqual(attackBonus(sorra, longbow, worn), 2 + 4)
  assert.strictEqual(attackBonus(sorra, longbow, unworn), 2)
})
