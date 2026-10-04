const test = require('node:test')
const assert = require('node:assert')
const {
  tableValueAtLevel,
  sneakAttackDice,
  martialArtsDie,
  unarmedStrike,
  psychicBlades,
} = require('../rules/5e/unarmedAttacks')

test('tableValueAtLevel: highest key at or below level', () => {
  const t = { 1: 4, 5: 6, 11: 8, 17: 10 }
  assert.strictEqual(tableValueAtLevel(t, 1), 4)
  assert.strictEqual(tableValueAtLevel(t, 4), 4)
  assert.strictEqual(tableValueAtLevel(t, 5), 6)
  assert.strictEqual(tableValueAtLevel(t, 20), 10)
  assert.strictEqual(tableValueAtLevel(t, 0), null)
})

test('sneakAttackDice: matches ceil(level/2) at every Rogue level; null for non-Rogue', () => {
  for (let lvl = 1; lvl <= 20; lvl++) {
    const c = { classes: [{ name: 'Rogue', level: lvl }] }
    assert.strictEqual(
      sneakAttackDice(c),
      `${Math.ceil(lvl / 2)}d6`,
      `level ${lvl}`
    )
  }
  assert.strictEqual(
    sneakAttackDice({ classes: [{ name: 'Fighter', level: 5 }] }),
    null
  )
  assert.strictEqual(sneakAttackDice({}), null)
})

test('sneakAttackDice: multiclass uses Rogue levels only', () => {
  const c = {
    classes: [
      { name: 'Fighter', level: 6 },
      { name: 'Rogue', level: 3 },
    ],
  }
  assert.strictEqual(sneakAttackDice(c), '2d6')
})

test('martialArtsDie: auto scales with Monk level at the PHB breakpoints', () => {
  const at = (lvl) =>
    martialArtsDie({
      martial_arts_die: 'auto',
      level: lvl,
      classes: [{ name: 'Monk', level: lvl }],
    })
  assert.strictEqual(at(1), '1d4')
  assert.strictEqual(at(4), '1d4')
  assert.strictEqual(at(5), '1d6')
  assert.strictEqual(at(10), '1d6')
  assert.strictEqual(at(11), '1d8')
  assert.strictEqual(at(16), '1d8')
  assert.strictEqual(at(17), '1d10')
})

test('martialArtsDie: multiclass uses Monk level, not total level', () => {
  const c = {
    martial_arts_die: 'auto',
    level: 11,
    classes: [
      { name: 'Monk', level: 5 },
      { name: 'Fighter', level: 6 },
    ],
  }
  assert.strictEqual(martialArtsDie(c), '1d6')
})

test('martialArtsDie: fixed die string is used as-is; absent means null', () => {
  assert.strictEqual(martialArtsDie({ martial_arts_die: '1d8' }), '1d8')
  assert.strictEqual(martialArtsDie({}), null)
})

const monkChar = {
  name: 'Mo',
  level: 5,
  martial_arts_die: 'auto',
  classes: [{ name: 'Monk', level: 5 }],
  stat_str: 8,
  stat_dex: 16, // +3
  stat_con: 10,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
}

test('unarmedStrike: best of STR/DEX + proficiency, die from Monk level', () => {
  const u = unarmedStrike(monkChar, [])
  assert.strictEqual(u.die, '1d6')
  assert.strictEqual(u.attack.value, 3 + 3) // dex +3, prof +3 at level 5
  assert.strictEqual(u.damage.value, 3)
  assert.strictEqual(u.attack.breakdown[0].amount, 3)
})

test('unarmedStrike: item unarmed bonuses count once and show as named lines', () => {
  const gloves = {
    name: 'Gloves of Striking',
    equipped_by: 'Mo',
    stat_bonuses: { unarmed_attack: 1, unarmed_damage: 2 },
  }
  const u = unarmedStrike(monkChar, [gloves])
  assert.strictEqual(u.attack.value, 7)
  assert.strictEqual(u.damage.value, 5)
  assert.ok(
    u.attack.breakdown.some(
      (l) => l.label === 'Gloves of Striking' && l.amount === 1
    )
  )
  assert.ok(
    u.damage.breakdown.some(
      (l) => l.label === 'Gloves of Striking' && l.amount === 2
    )
  )
})

test('unarmedStrike: extra damage only from items that apply to unarmed', () => {
  const items = [
    {
      name: 'Flame Wraps',
      extra_damage: { applies_to: 'unarmed', die: '1d4', type: 'fire' },
    },
    {
      name: 'Sword',
      extra_damage: { applies_to: 'weapon', die: '1d6', type: 'cold' },
    },
  ]
  const u = unarmedStrike(monkChar, items)
  assert.deepStrictEqual(u.extras, [
    { source: 'Flame Wraps', die: '1d4', type: 'fire', trigger: 'on hit' },
  ])
})

test('unarmedStrike: null without Martial Arts', () => {
  assert.strictEqual(unarmedStrike({ level: 3 }, []), null)
})

const soulknife = {
  name: 'Tor',
  level: 9,
  psychic_blades: true,
  classes: [{ name: 'Rogue', level: 9 }],
  stat_str: 10,
  stat_dex: 18, // +4
  stat_con: 10,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
}

test('psychicBlades: finesse stat + prof, fixed dice that do not scale', () => {
  const [main, bonus] = psychicBlades(soulknife, [])
  assert.strictEqual(main.die, '1d6')
  assert.strictEqual(bonus.die, '1d4')
  assert.strictEqual(main.attack.value, 4 + 4) // prof +4 at level 9
  assert.strictEqual(main.damage.value, 4)
  assert.strictEqual(main.thrown.normal, 60)
  assert.strictEqual(bonus.thrown, null)
})

test('psychicBlades: dedicated blade bonuses from items apply to both blades', () => {
  const ring = {
    name: 'Mind Ring',
    equipped_by: 'Tor',
    stat_bonuses: { psychic_blade_attack: 1, psychic_blade_damage: 1 },
  }
  const [main, bonus] = psychicBlades(soulknife, [ring])
  assert.strictEqual(main.attack.value, 9)
  assert.strictEqual(bonus.damage.value, 5)
})

test('psychicBlades: null for a character without them', () => {
  assert.strictEqual(psychicBlades({ level: 5 }, []), null)
})
