const test = require('node:test')
const assert = require('node:assert')
const {
  resolveMode,
  resolveD20Test,
  rollD20Test,
} = require('../rules/5e/d20Test')

test('resolveMode: advantage and disadvantage cancel to normal', () => {
  assert.strictEqual(resolveMode({}), 'normal')
  assert.strictEqual(resolveMode({ advantage: true }), 'advantage')
  assert.strictEqual(resolveMode({ disadvantage: true }), 'disadvantage')
  assert.strictEqual(
    resolveMode({ advantage: true, disadvantage: true }),
    'normal'
  )
})

test('resolveD20Test: normal roll adds modifier, breakdown lists both', () => {
  const r = resolveD20Test([12], { modifier: 5 })
  assert.strictEqual(r.value, 17)
  assert.strictEqual(r.natural, 12)
  assert.deepStrictEqual(r.breakdown, [
    { label: 'd20', amount: 12 },
    { label: 'Modifier', amount: 5 },
  ])
})

test('resolveD20Test: zero modifier omits the modifier line', () => {
  const r = resolveD20Test([8])
  assert.strictEqual(r.value, 8)
  assert.strictEqual(r.breakdown.length, 1)
})

test('resolveD20Test: negative modifier', () => {
  assert.strictEqual(resolveD20Test([10], { modifier: -2 }).value, 8)
})

test('resolveD20Test: advantage keeps higher, disadvantage keeps lower', () => {
  const adv = resolveD20Test([4, 15], { mode: 'advantage', modifier: 3 })
  assert.strictEqual(adv.natural, 15)
  assert.strictEqual(adv.value, 18)
  assert.strictEqual(adv.breakdown[0].label, 'd20, advantage (4 / 15)')

  const dis = resolveD20Test([4, 15], { mode: 'disadvantage', modifier: 3 })
  assert.strictEqual(dis.natural, 4)
  assert.strictEqual(dis.value, 7)
})

test('rollD20Test: rolls two dice only with advantage/disadvantage', () => {
  for (let i = 0; i < 50; i++) {
    const n = rollD20Test({ modifier: 1 })
    assert.strictEqual(n.rolls.length, 1)
    assert.ok(n.natural >= 1 && n.natural <= 20)
    assert.strictEqual(n.value, n.natural + 1)
    assert.strictEqual(rollD20Test({ advantage: true }).rolls.length, 2)
    assert.strictEqual(
      rollD20Test({ advantage: true, disadvantage: true }).rolls.length,
      1
    )
  }
})
