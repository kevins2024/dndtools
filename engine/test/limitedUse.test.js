const test = require('node:test')
const assert = require('node:assert')
const {
  usesRemaining,
  canSpendUse,
  spendUse,
  restoreUse,
  spendCharge,
  restoreCharge,
  spendGrantUse,
  restoreGrantUse,
} = require('../rules/5e/limitedUse')

test('usesRemaining: absent uses_current means full; no uses_max means not limited', () => {
  assert.strictEqual(usesRemaining({ uses_max: 3 }), 3)
  assert.strictEqual(usesRemaining({ uses_max: 3, uses_current: 1 }), 1)
  assert.strictEqual(usesRemaining({ uses_max: 3, uses_current: 0 }), 0)
  assert.strictEqual(usesRemaining({ name: 'passive' }), null)
})

test('spendUse: first spend works without uses_current, floors at 0', () => {
  assert.strictEqual(spendUse({ uses_max: 2 }).uses_current, 1)
  assert.strictEqual(spendUse({ uses_max: 2, uses_current: 0 }).uses_current, 0)
})

test('restoreUse: caps at uses_max', () => {
  assert.strictEqual(
    restoreUse({ uses_max: 2, uses_current: 1 }).uses_current,
    2
  )
  assert.strictEqual(
    restoreUse({ uses_max: 2, uses_current: 2 }).uses_current,
    2
  )
  assert.strictEqual(restoreUse({ uses_max: 2 }).uses_current, 2)
})

test('spendUse/restoreUse: non-limited entries come back untouched', () => {
  const passive = { name: 'Darkvision' }
  assert.strictEqual(spendUse(passive), passive)
  assert.strictEqual(restoreUse(passive), passive)
})

test('spendUse does not mutate its input', () => {
  const f = { uses_max: 2, uses_current: 2 }
  spendUse(f)
  assert.strictEqual(f.uses_current, 2)
})

test('canSpendUse: respects amount', () => {
  assert.ok(canSpendUse({ uses_max: 2 }))
  assert.ok(!canSpendUse({ uses_max: 2, uses_current: 0 }))
  assert.ok(!canSpendUse({ uses_max: 3, uses_current: 1 }, 2))
  assert.ok(!canSpendUse({ name: 'passive' }))
})

test('spendCharge / restoreCharge: variable amount, clamped to [0, max]', () => {
  const wand = { charges_current: 5, charges_max: 7 }
  assert.strictEqual(spendCharge(wand, 3).charges_current, 2)
  assert.strictEqual(spendCharge(wand, 9).charges_current, 0)
  assert.strictEqual(restoreCharge(wand).charges_current, 6)
  assert.strictEqual(restoreCharge(wand, 9).charges_current, 7)
})

const beads = [
  'Light',
  { name: 'Cure Wounds', choice_group: 'curing', uses_max: 1, uses_current: 1 },
  {
    name: 'Lesser Restoration',
    choice_group: 'curing',
    uses_max: 1,
    uses_current: 1,
  },
  { name: 'Bless', uses_max: 2, uses_current: 2 },
]

test('spendGrantUse: choice_group entries spend together, others untouched', () => {
  const out = spendGrantUse(beads, { choiceGroup: 'curing' })
  assert.strictEqual(out[1].uses_current, 0)
  assert.strictEqual(out[2].uses_current, 0)
  assert.strictEqual(out[3].uses_current, 2)
  assert.strictEqual(out[0], 'Light')
})

test('spendGrantUse: without a group, matches by spell name; floors at 0', () => {
  const once = spendGrantUse(beads, { spellName: 'Bless' })
  assert.strictEqual(once[3].uses_current, 1)
  assert.strictEqual(once[1].uses_current, 1)
  const spent = spendGrantUse(spendGrantUse(once, { spellName: 'Bless' }), {
    spellName: 'Bless',
  })
  assert.strictEqual(spent[3].uses_current, 0)
})

test('restoreGrantUse: caps at uses_max', () => {
  const spent = spendGrantUse(beads, { choiceGroup: 'curing' })
  const back = restoreGrantUse(spent, { choiceGroup: 'curing' })
  assert.strictEqual(back[1].uses_current, 1)
  assert.strictEqual(
    restoreGrantUse(back, { choiceGroup: 'curing' })[1].uses_current,
    1
  )
})
