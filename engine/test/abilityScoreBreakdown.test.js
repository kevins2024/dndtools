const test = require('node:test')
const assert = require('node:assert')
const { abilityScoreBreakdown } = require('../rules/5e/abilityScoreBreakdown')
const { priorityAbilitiesForClass } = require('../rules/5e/quickBuild')

const base = {
  name: 'Z',
  stat_str: 10,
  stat_dex: 14,
  stat_con: 12,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 8,
}
const get = (arr, key) => arr.find((x) => x.key === key)

test('abilityScoreBreakdown: unmodified character reports base and no contributions', () => {
  const dex = get(abilityScoreBreakdown(base, []), 'dex')
  assert.strictEqual(dex.score, 14)
  assert.strictEqual(dex.mod, 2)
  assert.strictEqual(dex.base, 14)
  assert.strictEqual(dex.modified, false)
  assert.deepStrictEqual(dex.contributions, [])
  assert.strictEqual(dex.override, null)
})

test('abilityScoreBreakdown: item and feature bonuses are attributed by name', () => {
  const items = [{ name: 'Belt', stat_bonuses: { con: 2 } }]
  const c = { ...base, features: [{ name: 'Tough', stat_bonuses: { con: 1 } }] }
  const con = get(abilityScoreBreakdown(c, items), 'con')
  assert.strictEqual(con.score, 15)
  assert.strictEqual(con.modified, true)
  assert.deepStrictEqual(con.contributions, [
    { label: 'Belt', amount: 2 },
    { label: 'Tough', amount: 1 },
  ])
})

test('abilityScoreBreakdown: an override item reports the override and its value', () => {
  const items = [{ name: 'Amulet of Health', stat_overrides: { con: 19 } }]
  const con = get(abilityScoreBreakdown(base, items), 'con')
  assert.strictEqual(con.score, 19)
  assert.deepStrictEqual(con.override, { name: 'Amulet of Health', value: 19 })
})

test('abilityScoreBreakdown: history entries come first and the base is stat minus history', () => {
  const c = {
    ...base,
    stat_cha: 14, // final number: 10 base + 2 racial + 2 ASI
    ability_score_history: [
      { ability: 'cha', amount: 2, source: 'Racial', level_gained: 1 },
      { ability: 'cha', amount: 2, source: 'ASI', level_gained: 4 },
      { ability: 'str', amount: 1, source: 'Feat', level_gained: 4 },
    ],
  }
  const cha = get(abilityScoreBreakdown(c, []), 'cha')
  assert.strictEqual(cha.base, 10)
  assert.strictEqual(cha.score, 14)
  assert.strictEqual(cha.modified, true)
  assert.deepStrictEqual(cha.contributions, [
    { label: 'Racial, level 1', amount: 2 },
    { label: 'ASI, level 4', amount: 2 },
  ])
})

test('priorityAbilitiesForClass: caster ability first, then Quick Build, deduped', () => {
  assert.deepStrictEqual(
    priorityAbilitiesForClass({ name: 'Bard', spellcasting: { ability: 'cha' } }),
    ['cha', 'dex']
  )
  assert.deepStrictEqual(priorityAbilitiesForClass({ name: 'Fighter' }), ['str', 'dex', 'con'])
  assert.deepStrictEqual(priorityAbilitiesForClass({ name: 'Homebrewer' }), [])
  assert.deepStrictEqual(priorityAbilitiesForClass(null), [])
})
