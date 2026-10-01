const test = require('node:test')
const assert = require('node:assert/strict')
const {
  activeWeaponSet,
  isActiveEquipped,
  isDualWieldingMelee,
} = require('../rules/5e/weaponSets')

test('activeWeaponSet defaults to 1 when the character has no active_weapon_set set', () => {
  assert.equal(activeWeaponSet({}), 1)
  assert.equal(activeWeaponSet({ active_weapon_set: 2 }), 2)
})

test('isActiveEquipped: a weapon in the inactive set is not active even if equipped_by matches', () => {
  const character = { name: 'Test', active_weapon_set: 1 }
  const rangedSet = { equipped_by: 'Test', type: 'weapon', weapon_set: 2 }
  assert.equal(isActiveEquipped(rangedSet, character), false)
})

test('isActiveEquipped: non-weapon items (armor, rings) ignore weapon_set entirely', () => {
  const character = { name: 'Test', active_weapon_set: 2 }
  const ring = { equipped_by: 'Test', type: 'wondrous' }
  assert.equal(isActiveEquipped(ring, character), true)
})

test('isDualWieldingMelee: true with two one-handed melee weapons and no shield', () => {
  const character = { name: 'Test' }
  const items = [
    { equipped_by: 'Test', type: 'weapon', slot: 'melee1h' },
    { equipped_by: 'Test', type: 'weapon', slot: 'melee1h' },
  ]
  assert.equal(isDualWieldingMelee(character, items), true)
})

test('isDualWieldingMelee: false when a shield is equipped (occupies the second hand)', () => {
  const character = { name: 'Test' }
  const items = [
    { equipped_by: 'Test', type: 'weapon', slot: 'melee1h' },
    { equipped_by: 'Test', armor_type: 'shield' },
  ]
  assert.equal(isDualWieldingMelee(character, items), false)
})

test('isDualWieldingMelee: false with only one melee1h weapon', () => {
  const character = { name: 'Test' }
  const items = [{ equipped_by: 'Test', type: 'weapon', slot: 'melee1h' }]
  assert.equal(isDualWieldingMelee(character, items), false)
})
