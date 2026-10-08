const test = require('node:test')
const assert = require('node:assert')
const {
  hitDieSides,
  shortRestHealEstimate,
  rollShortRestHealing,
  shortRestRecharges,
  applyShortRest,
  shortRestPreview,
  longRestPreview,
  hitDiceRecoveredOnLongRest,
  applyLongRest,
  rechargeItems,
  LONG_REST_RECHARGE_TYPES,
} = require('../rules/5e/rest')
const { rollDiceExpr, isDiceExpr } = require('../rules/5e/dice')

// Deterministic rng: always lands on a given face of a die.
const faceRng = (sides, face) => () => (face - 1) / sides + 0.0001

test('rollDiceExpr: sums dice plus modifier, pinned rng', () => {
  assert.strictEqual(rollDiceExpr('2d6+1', faceRng(6, 4)), 9)
  assert.strictEqual(rollDiceExpr('1d4-1', faceRng(4, 1)), 0)
  assert.strictEqual(rollDiceExpr('1d4-5', faceRng(4, 2)), 0) // clamped
  assert.strictEqual(rollDiceExpr('nonsense'), 0)
  assert.ok(isDiceExpr('1d6+1'))
  assert.ok(!isDiceExpr('long_rest'))
})

test('hitDieSides: parses "d10", falls back to 8', () => {
  assert.strictEqual(hitDieSides('d10'), 10)
  assert.strictEqual(hitDieSides(undefined), 8)
  assert.strictEqual(hitDieSides('garbage'), 8)
})

const fighter = {
  level: 5,
  hit_die: 'd10',
  stat_con: 14, // +2
  hp_max: 50,
  hp_current: 30,
}

test('shortRestHealEstimate: average roll + CON per die, capped at missing HP', () => {
  // avg d10 = 5.5, +2 = 7.5/die; 2 dice = 15
  assert.strictEqual(shortRestHealEstimate(fighter, 2), 15)
  // 5 dice would be 37.5 -> 38, but only 20 missing
  assert.strictEqual(shortRestHealEstimate(fighter, 5), 20)
  assert.strictEqual(shortRestHealEstimate(fighter, 0), 0)
})

test('rollShortRestHealing: each die adds CON mod, capped at missing HP', () => {
  const r = rollShortRestHealing(fighter, 2, faceRng(10, 6))
  assert.deepStrictEqual(r.rolls, [6, 6])
  assert.strictEqual(r.hpGained, 16)
  const capped = rollShortRestHealing(
    { ...fighter, hp_current: 45 },
    2,
    faceRng(10, 6)
  )
  assert.strictEqual(capped.hpGained, 5)
})

test('rollShortRestHealing: negative CON total floors at 0 gained', () => {
  const r = rollShortRestHealing({ ...fighter, stat_con: 6 }, 1, faceRng(10, 1))
  assert.strictEqual(r.hpGained, 0) // 1 + (-2) = -1 -> 0
})

test('applyShortRest: spends dice, heals, refills only short-rest resources', () => {
  const c = {
    ...fighter,
    hit_dice_current: 4,
    features: [
      {
        name: 'Fighter — Second Wind (1/rest)',
        recharge: 'short_rest',
        uses_max: 1,
        uses_current: 0,
      },
      {
        name: 'Indomitable',
        recharge: 'long_rest',
        uses_max: 1,
        uses_current: 0,
      },
    ],
    pact_magic: { recharge: 'short_rest', current: 0, max: 2, slot_level: 2 },
    spells: [
      {
        name: 'Misty Step',
        recharge: 'short_rest',
        uses_max: 1,
        uses_current: 0,
      },
    ],
    resources: [
      { name: 'Sorcery Points', recharge: 'long_rest', max: 5, current: 1 },
    ],
  }
  const { patch, recharged } = applyShortRest(c, { diceSpent: 2, hpGained: 14 })
  assert.strictEqual(patch.hp_current, 44)
  assert.strictEqual(patch.hit_dice_current, 2)
  assert.strictEqual(patch.features[0].uses_current, 1)
  assert.strictEqual(patch.features[1].uses_current, 0)
  assert.strictEqual(patch.pact_magic.current, 2)
  assert.strictEqual(patch.spells[0].uses_current, 1)
  assert.strictEqual(patch.resources[0].current, 1)
  assert.deepStrictEqual(recharged, ['Second Wind', 'Pact Magic'])
})

test('applyShortRest: HP never exceeds hp_max; hit dice never go negative', () => {
  const { patch } = applyShortRest(
    { hp_max: 20, hp_current: 18, hit_dice_current: 1 },
    { diceSpent: 3, hpGained: 99 }
  )
  assert.strictEqual(patch.hp_current, 20)
  assert.strictEqual(patch.hit_dice_current, 0)
})

test('shortRestRecharges: lists nothing when everything is already full', () => {
  const c = {
    features: [
      { name: 'X', recharge: 'short_rest', uses_max: 1, uses_current: 1 },
    ],
    ki_points: { current: 3, max: 3 },
  }
  assert.deepStrictEqual(shortRestRecharges(c), [])
})

test('hitDiceRecoveredOnLongRest: half max rounded down, minimum 1', () => {
  assert.strictEqual(hitDiceRecoveredOnLongRest(1), 1)
  assert.strictEqual(hitDiceRecoveredOnLongRest(5), 2)
  assert.strictEqual(hitDiceRecoveredOnLongRest(20), 10)
})

test('applyLongRest: full refill, half hit dice, -1 exhaustion, conditions cleared', () => {
  const c = {
    level: 9,
    hp_max: 60,
    hp_current: 10,
    hit_dice_current: 2,
    exhaustion_level: 2,
    conditions: [
      'Poisoned',
      'Exhaustion',
      { name: 'Exhaustion' },
      { name: 'Blinded' },
    ],
    spell_slots: {
      level_1: { max: 4, current: 0 },
      level_2: { max: 3, current: 1 },
    },
    pact_magic: { max: 2, current: 0 },
    ki_points: { max: 5, current: 1 },
    features: [
      { name: 'A', recharge: 'short_rest', uses_max: 2, uses_current: 0 },
      { name: 'B', uses_max: 1, uses_current: 0 }, // no recharge: untouched
    ],
    resources: [{ name: 'SP', recharge: 'long_rest', max: 9, current: 2 }],
  }
  const { patch } = applyLongRest(c)
  assert.strictEqual(patch.hp_current, 60)
  assert.strictEqual(patch.spell_slots.level_1.current, 4)
  assert.strictEqual(patch.spell_slots.level_2.current, 3)
  assert.strictEqual(patch.pact_magic.current, 2)
  assert.strictEqual(patch.ki_points.current, 5)
  assert.strictEqual(patch.features[0].uses_current, 2)
  assert.strictEqual(patch.features[1].uses_current, 0)
  assert.strictEqual(patch.resources[0].current, 9)
  assert.strictEqual(patch.hit_dice_current, 6) // 2 + floor(9/2)=4
  assert.strictEqual(patch.exhaustion_level, 1)
  assert.deepStrictEqual(patch.conditions, [
    'Exhaustion',
    { name: 'Exhaustion' },
  ])
})

test('applyLongRest: hit dice cap at level', () => {
  const { patch } = applyLongRest({ level: 4, hp_max: 10, hit_dice_current: 4 })
  assert.strictEqual(patch.hit_dice_current, 4)
})

test('applyLongRest: interrupted gives no benefit, +1 exhaustion_level (cap 6)', () => {
  const c = { hp_max: 30, hp_current: 5, exhaustion_level: 1 }
  const { patch } = applyLongRest(c, { interrupted: true })
  assert.deepStrictEqual(patch, { exhaustion_level: 2 })
  assert.strictEqual(
    applyLongRest({ exhaustion_level: 6 }, { interrupted: true }).patch
      .exhaustion_level,
    6
  )
  assert.strictEqual(
    applyLongRest({}, { interrupted: true }).patch.exhaustion_level,
    1
  )
})

test('rechargeItems: fixed recharge refills to max; dice recharge rolls, capped', () => {
  const items = [
    { id: 'a', charges_current: 0, charges_max: 7, charges_recharge: 'daily' },
    { id: 'b', charges_current: 5, charges_max: 7, charges_recharge: '1d6+1' },
    { id: 'c', charges_current: 1, charges_max: 3, charges_recharge: 'none' },
  ]
  const out = rechargeItems(items, ['daily'], faceRng(6, 6))
  assert.strictEqual(out[0].charges_current, 7)
  assert.strictEqual(out[1].charges_current, 7) // 5 + 7 capped at 7
  assert.strictEqual(out[2].charges_current, 1)
})

test('rechargeItems: respects rest type, covers spell grants and weapon effects', () => {
  const items = [
    {
      id: 'x',
      charges_current: 0,
      charges_max: 3,
      charges_recharge: 'long_rest',
      spells_granted: [
        'Light',
        {
          name: 'Shield',
          uses_max: 2,
          uses_current: 0,
          recharge: 'short_rest',
        },
        { name: 'Fly', uses_max: 1, uses_current: 0, recharge: 'long_rest' },
      ],
      weapon_effects: [
        { name: 'Storm', uses_max: 1, uses_current: 0, recharge: 'dawn' },
      ],
    },
  ]
  const short = rechargeItems(items, ['short_rest'])[0]
  assert.strictEqual(short.charges_current, 0)
  assert.strictEqual(short.spells_granted[1].uses_current, 2)
  assert.strictEqual(short.spells_granted[2].uses_current, 0)
  assert.strictEqual(short.weapon_effects[0].uses_current, 0)

  const long = rechargeItems(items, [
    'daily',
    'short_rest',
    'long_rest',
    'dawn',
  ])[0]
  assert.strictEqual(long.charges_current, 3)
  assert.strictEqual(long.spells_granted[2].uses_current, 1)
  assert.strictEqual(long.weapon_effects[0].uses_current, 1)
})

test('rechargeItems: does not mutate its input', () => {
  const items = [
    { id: 'a', charges_current: 0, charges_max: 3, charges_recharge: 'daily' },
  ]
  rechargeItems(items, ['daily'])
  assert.strictEqual(items[0].charges_current, 0)
})

test('shortRestPreview / longRestPreview: report only what is actually spent', () => {
  const c = {
    hp_max: 40,
    hp_current: 30,
    features: [
      { name: 'Second Wind', recharge: 'short_rest', uses_max: 1, uses_current: 0 },
      { name: 'Rage', recharge: 'long_rest', uses_max: 3, uses_current: 1 },
      { name: 'Full', recharge: 'long_rest', uses_max: 2, uses_current: 2 },
    ],
    pact_magic: { max: 2, current: 1 },
    spell_slots: { level_1: { max: 4, current: 1 }, level_2: { max: 2, current: 2 } },
  }
  assert.deepStrictEqual(shortRestPreview(c), {
    features: ['Second Wind'],
    pactSlotsSpent: 1,
  })
  assert.deepStrictEqual(longRestPreview(c), {
    hpMissing: 10,
    features: ['Rage'],
    spellSlotsSpent: 3,
  })
  assert.deepStrictEqual(shortRestPreview({}), { features: [], pactSlotsSpent: 0 })
})

test('rechargeItems: a dice-expression ("regains X at dawn") recharge does not fire on a short rest', () => {
  const gem = { id: 'g', charges_current: 0, charges_max: 3, charges_recharge: '1d3' }
  assert.strictEqual(
    rechargeItems([gem], ['short_rest'], faceRng(3, 3))[0].charges_current,
    0
  )
  // ...but does on a long rest (which passes through dawn), capped at max.
  assert.strictEqual(
    rechargeItems([gem], LONG_REST_RECHARGE_TYPES, faceRng(3, 2))[0].charges_current,
    2
  )
})

test("a 'manual' recharge (DM's call) is never refilled by a short or long rest", () => {
  const c = {
    level: 1,
    hp_max: 7,
    hp_current: 7,
    features: [
      { name: 'Timeline Freeze', recharge: 'manual', uses_max: 1, uses_current: 0 },
      { name: 'Normal', recharge: 'long_rest', uses_max: 1, uses_current: 0 },
    ],
    spells: [{ name: 'Odd', recharge: 'manual', uses_max: 1, uses_current: 0 }],
  }
  const long = applyLongRest(c).patch
  assert.strictEqual(long.features[0].uses_current, 0)
  assert.strictEqual(long.features[1].uses_current, 1)
  assert.strictEqual(long.spells[0].uses_current, 0)
  const short = applyShortRest(c, {}).patch
  assert.strictEqual(short.features[0].uses_current, 0)
})

test('short rest hit die comes from the classes, not a stored field (bug 2.9)', () => {
  const { characterHitDieSides } = require('../rules/5e/rest')
  assert.strictEqual(characterHitDieSides({ classes: [{ name: 'Wizard', level: 9 }] }), 6)
  assert.strictEqual(characterHitDieSides({ classes: [{ name: 'Barbarian', level: 8 }, { name: 'Fighter', level: 1 }] }), 12)
  // no classes recorded: fall back to a stored die, then d8
  assert.strictEqual(characterHitDieSides({ hit_die: 'd10' }), 10)
  assert.strictEqual(characterHitDieSides({}), 8)
  // a class with level 0 (a not-yet-taken multiclass placeholder) doesn't count
  assert.strictEqual(characterHitDieSides({ classes: [{ name: 'Wizard', level: 3 }, { name: 'Fighter', level: 0 }] }), 6)
})

test('short rest healing uses the effective CON (an Amulet of Health counts), not the base score (bug 2.9)', () => {
  const { averageHitDieHealing, rollShortRestHealing } = require('../rules/5e/rest')
  const c = { classes: [{ name: 'Fighter', level: 5 }], stat_con: 14, hp_max: 60, hp_current: 10 }
  const amulet = [{ stat_overrides: { con: 19 } }]
  assert.strictEqual(averageHitDieHealing(c), 5.5 + 2)
  assert.strictEqual(averageHitDieHealing(c, amulet), 5.5 + 4)
  const rng = () => 0 // every die rolls 1
  assert.strictEqual(rollShortRestHealing(c, 2, rng, amulet).hpGained, 2 * (1 + 4))
})
