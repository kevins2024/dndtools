// 2024 rests (SRD 5.2 Rules Glossary): a Long Rest restores ALL spent Hit Point
// Dice; features like Rage/Second Wind/Channel Divinity return ONE use on a Short
// Rest and all on a Long Rest.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  applyShortRest,
  applyLongRest,
  hitDiceRecoveredOnLongRest,
  shortRestRecharges,
  shortRestPreview,
} = require('../rules/5e/rest')

const ch = (o = {}) => ({
  ruleset: '2024',
  level: 9,
  hp_max: 90,
  hp_current: 40,
  hit_dice_current: 2,
  classes: [{ name: 'Barbarian', level: 9 }],
  features: [
    {
      name: 'Rage',
      uses_max: 4,
      uses_current: 0,
      recharge: 'long_rest',
      short_rest_regain: 1,
    },
    {
      name: 'Second Wind',
      uses_max: 3,
      uses_current: 1,
      recharge: 'long_rest',
      short_rest_regain: 1,
    },
    {
      name: 'Action Surge',
      uses_max: 1,
      uses_current: 0,
      recharge: 'short_rest',
    },
    {
      name: 'Relentless Rage',
      uses_max: 1,
      uses_current: 0,
      recharge: 'long_rest',
      short_rest_regain: 'all',
    },
  ],
  ...o,
})
const use = (r, name) =>
  r.patch.features.find((f) => f.name === name).uses_current

test('A Long Rest regains ALL spent Hit Point Dice', () => {
  assert.equal(applyLongRest(ch()).patch.hit_dice_current, 9)
  assert.equal(hitDiceRecoveredOnLongRest(9), 9)
})

test('Short Rest returns one use of a short_rest_regain feature, a short_rest feature fully, and "all" fully', () => {
  const r = applyShortRest(ch())
  assert.equal(use(r, 'Rage'), 1)
  assert.equal(use(r, 'Second Wind'), 2)
  assert.equal(use(r, 'Action Surge'), 1)
  assert.equal(use(r, 'Relentless Rage'), 1)
  // never past the maximum
  const full = applyShortRest(
    ch({
      features: [
        {
          name: 'Rage',
          uses_max: 4,
          uses_current: 4,
          recharge: 'long_rest',
          short_rest_regain: 1,
        },
      ],
    })
  )
  assert.equal(full.patch.features[0].uses_current, 4)
})

test('Long Rest refills every use', () => {
  const r = applyLongRest(ch())
  assert.deepEqual(
    r.patch.features.map((f) => f.uses_current),
    [4, 3, 1, 1]
  )
})

test('the rest screens list a regain-one feature while it is below max', () => {
  assert.ok(shortRestRecharges(ch()).includes('Rage'))
  assert.ok(shortRestPreview(ch()).features.includes('Rage'))
  const full = ch({
    features: [
      {
        name: 'Rage',
        uses_max: 4,
        uses_current: 4,
        recharge: 'long_rest',
        short_rest_regain: 1,
      },
    ],
  })
  assert.deepEqual(shortRestRecharges(full), [])
})
