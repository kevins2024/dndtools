const test = require('node:test')
const assert = require('node:assert/strict')
const {
  exhaustionEffects,
  speedAfterExhaustion,
} = require('../rules/5e/exhaustion')

test('2024 Exhaustion: -2 per level to D20 Tests, -5 ft Speed per level, death at 6', () => {
  const e3 = exhaustionEffects(3, '2024')
  assert.deepEqual(
    [e3.d20Penalty, e3.speedPenaltyFeet, e3.dead],
    [-6, 15, false]
  )
  assert.equal(exhaustionEffects(1, '2024').d20Penalty, -2)
  assert.equal(exhaustionEffects(0, '2024').d20Penalty, 0)
  assert.equal(exhaustionEffects(6, '2024').dead, true)
  assert.equal(exhaustionEffects(9, '2024').level, 6) // clamped
  assert.equal(speedAfterExhaustion(30, 2, '2024'), 20)
  assert.equal(speedAfterExhaustion(30, 6, '2024'), 0)
  assert.equal(speedAfterExhaustion(10, 3, '2024'), 0) // never negative
})

// ── the penalty on the numbers a roll uses (2024: every D20 Test is reduced by 2 per level) ──
const { buildCharacter } = require('./helpers/autoLevel')
const {
  savingThrowBreakdown,
  skillBreakdown,
  abilityCheckBreakdown,
  initiativeBreakdown,
  passivePerceptionBreakdown,
  spellAttackBonusBreakdown,
} = require('../rules/5e/checks')
const { attackBonusBreakdown } = require('../rules/5e/weaponAttack')

const sheet = () => ({
  ...buildCharacter({
    className: 'Cleric',
    subclass: 'Life Domain',
    toLevel: 5,
  }).character,
  spellcasting_ability: 'wis',
})

test('exhaustion lowers saves, skill and ability checks, initiative and attacks by 2 per level, with its own line', () => {
  const c = sheet()
  const tired = { ...c, exhaustion_level: 3 }
  const pairs = [
    [savingThrowBreakdown(c, 'wis'), savingThrowBreakdown(tired, 'wis')],
    [skillBreakdown(c, 'Perception'), skillBreakdown(tired, 'Perception')],
    [abilityCheckBreakdown(c, 'str'), abilityCheckBreakdown(tired, 'str')],
    [initiativeBreakdown(c), initiativeBreakdown(tired)],
    [spellAttackBonusBreakdown(c), spellAttackBonusBreakdown(tired)],
    [
      attackBonusBreakdown(c, { name: 'Mace' }, []),
      attackBonusBreakdown(tired, { name: 'Mace' }, []),
    ],
  ]
  assert.equal(pairs.length, 6)
  for (const [rested, exhausted] of pairs) {
    assert.equal(exhausted.value, rested.value - 6)
    assert.deepEqual(exhausted.breakdown.at(-1), {
      label: 'Exhaustion (level 3)',
      amount: -6,
    })
    assert.equal(rested.breakdown.length + 1, exhausted.breakdown.length)
  }
})

test('exhaustion does not change a passive score, a spell save DC, or a rested character', () => {
  const c = sheet()
  const tired = { ...c, exhaustion_level: 2 }
  assert.equal(
    passivePerceptionBreakdown(tired).value,
    passivePerceptionBreakdown(c).value
  )
  assert.equal(
    savingThrowBreakdown({ ...c, exhaustion_level: 0 }, 'dex').breakdown.length,
    savingThrowBreakdown(c, 'dex').breakdown.length
  )
})

test('the 2014 rules have no number on the roll (their exhaustion is disadvantage and halved Speed)', () => {
  const c = { ...sheet(), ruleset: '2014', exhaustion_level: 3 }
  assert.ok(
    !savingThrowBreakdown(c, 'wis').breakdown.some((l) =>
      /Exhaustion/.test(l.label)
    )
  )
})
