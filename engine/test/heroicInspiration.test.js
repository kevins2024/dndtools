// 2024 PHB, Playing the Game: "You can never have more than one instance of Heroic Inspiration. If something
// gives you Heroic Inspiration and you already have it, you can give it to a player character in your group
// who lacks it." and "Human characters start each day with Heroic Inspiration."
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  RULE,
  hasHeroicInspiration,
  grantHeroicInspiration,
  spendHeroicInspiration,
} = require('../rules/5e/heroicInspiration')
const { gainsHeroicInspiration } = require('../rules/5e/rest')

test('the rule text says what it does and that there is only ever one', () => {
  const text = RULE.text.join(' ')
  assert.match(text, /reroll any die immediately after rolling it/)
  assert.match(text, /never have more than one/)
})

test('granting gives it; granting again changes nothing and names who in the party lacks it', () => {
  const denna = { name: 'Denna' }
  const first = grantHeroicInspiration(denna)
  assert.equal(first.granted, true)
  assert.deepEqual(first.patch, { heroic_inspiration: true })

  const held = { name: 'Denna', heroic_inspiration: true }
  const party = [
    held,
    { name: 'Brick' },
    { name: 'Vaz', heroic_inspiration: true },
    { name: 'Sorra', heroic_inspiration: false },
  ]
  const again = grantHeroicInspiration(held, party)
  assert.equal(again.granted, false)
  assert.deepEqual(again.patch, {})
  assert.deepEqual(again.recipients, ['Brick', 'Sorra'])
})

test('spending removes it, and you cannot spend what you do not have', () => {
  const held = { name: 'Brick', heroic_inspiration: true }
  assert.equal(hasHeroicInspiration(held), true)
  assert.deepEqual(spendHeroicInspiration(held), {
    spent: true,
    patch: { heroic_inspiration: false },
  })
  const none = spendHeroicInspiration({ name: 'Brick' })
  assert.equal(none.spent, false)
  assert.deepEqual(none.patch, {})
})

test('Human Resourceful gives it on a Long Rest, but not when the Human already has it', () => {
  const human = {
    name: 'Brick',
    features: [{ id: 'pub24_species_human-resourceful', name: 'Resourceful' }],
  }
  assert.equal(gainsHeroicInspiration(human), true)
  assert.equal(
    gainsHeroicInspiration({ ...human, heroic_inspiration: true }),
    false
  )
})
