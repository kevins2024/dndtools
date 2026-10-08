const test = require('node:test')
const assert = require('node:assert')
const { transferItemToCharacter } = require('../rules/5e/itemTransfer')

test('a carried item moves to the new bearer', () => {
  const item = { id: 'items_1', name: 'Rope', carried_by: 'Lenn' }
  const out = transferItemToCharacter(item, 'Pirra')
  assert.strictEqual(out.carried_by, 'Pirra')
  assert.strictEqual(out.equipped_by, null)
  assert.strictEqual(item.carried_by, 'Lenn') // original not mutated
})

test('an equipped, attuned weapon arrives unequipped, unattuned and out of the old loadout', () => {
  const item = {
    id: 'items_2',
    carried_by: 'Lenn',
    equipped_by: 'Lenn',
    attuned: true,
    needs_attunement: true,
    weapon_set: 2,
    hand: 'main',
    charges_current: 3,
    enhancement_bonus: 1,
  }
  const out = transferItemToCharacter(item, 'Siv')
  assert.strictEqual(out.carried_by, 'Siv')
  assert.strictEqual(out.equipped_by, null)
  assert.strictEqual(out.attuned, false)
  assert.strictEqual(out.weapon_set, null)
  assert.strictEqual(out.hand, null)
  // facts about the item itself survive
  assert.strictEqual(out.charges_current, 3)
  assert.strictEqual(out.enhancement_bonus, 1)
  assert.strictEqual(out.needs_attunement, true)
})

test('a party-pool or stored item can be handed straight to a character', () => {
  const pool = { id: 'a', carried_by: 'party', party_id: 'party_1' }
  const poolOut = transferItemToCharacter(pool, 'Petra')
  assert.strictEqual(poolOut.carried_by, 'Petra')
  assert.strictEqual(poolOut.party_id, null)

  const stored = { id: 'b', carried_by: null, stored_at: 'The Wanderer' }
  const storedOut = transferItemToCharacter(stored, 'Petra')
  assert.strictEqual(storedOut.carried_by, 'Petra')
  assert.strictEqual(storedOut.stored_at, null)
})

test('dropping an item on the character who already carries it is a no-op', () => {
  assert.strictEqual(
    transferItemToCharacter({ id: 'c', carried_by: 'Lenn' }, 'Lenn'),
    null
  )
})

test('dropping an equipped item on its own wielder is also a no-op', () => {
  assert.strictEqual(
    transferItemToCharacter(
      { id: 'd', carried_by: 'Lenn', equipped_by: 'Lenn' },
      'Lenn'
    ),
    null
  )
})

test('bad targets are rejected', () => {
  assert.strictEqual(transferItemToCharacter({ id: 'e' }, ''), null)
  assert.strictEqual(transferItemToCharacter({ id: 'e' }, 'party'), null)
  assert.strictEqual(transferItemToCharacter(null, 'Lenn'), null)
})
