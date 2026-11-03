// Which Ability Score Improvement slots a sheet has and what each holds (rules/5e/asiSlots.js),
// and how the ability-score breakdown reports the ones nothing records.
//
// Slot levels are the PHB class tables (2024 and 2014 agree): most classes 4, 8, 12, 16, 19;
// Fighter also 6 and 14; Rogue also 10. Characters here are made up; no test reads characters.json.
const test = require('node:test')
const assert = require('node:assert/strict')
const { asiSlotStatus } = require('../rules/5e/asiSlots')
const { abilityScoreBreakdown } = require('../rules/5e/abilityScoreBreakdown')

const sheet = (classes, extra = {}) => ({
  classes,
  features: [],
  ability_score_history: [],
  stat_str: 10,
  stat_dex: 10,
  stat_con: 10,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
  ...extra,
})
const states = (c) =>
  asiSlotStatus(c).map((s) => `${s.class[0]}${s.level}:${s.state}`)

test('slots come at the PHB levels for the class', () => {
  const lv = (name, level) =>
    asiSlotStatus(sheet([{ name, level }])).map((s) => s.level)
  assert.deepEqual(lv('Wizard', 9), [4, 8])
  assert.deepEqual(lv('Fighter', 14), [4, 6, 8, 12, 14])
  assert.deepEqual(lv('Rogue', 10), [4, 8, 10])
  assert.deepEqual(lv('Cleric', 3), [])
})

test('a sheet with nothing recorded has every slot open', () => {
  assert.deepEqual(states(sheet([{ name: 'Wizard', level: 9 }])), [
    'W4:open',
    'W8:open',
  ])
})

test('a feat with no class, species or origin source fills an open slot; a granted feat does not', () => {
  const c = sheet([{ name: 'Wizard', level: 9 }], {
    features: [
      { name: 'Alert', type: 'feat', _grant: 'origin', _source: 'Guard' },
      { name: 'Skilled', type: 'feat', _grant: 'species', _source: 'Human' },
      { name: 'Observant', type: 'feat' },
    ],
  })
  assert.deepEqual(states(c), ['W4:feat', 'W8:open'])
})

test('one slot is never both a recorded improvement and a feat: the feat moves to the next open slot', () => {
  const c = sheet([{ name: 'Wizard', level: 9 }], {
    features: [{ name: 'Observant', type: 'feat' }],
    ability_score_history: [
      {
        ability: 'int',
        amount: 2,
        source: 'Ability Score Improvement',
        level_gained: 4,
      },
    ],
  })
  assert.deepEqual(
    asiSlotStatus(c).map((s) => [s.state, s.detail]),
    [
      ['ability', '+2 INT'],
      ['feat', 'Observant'],
    ]
  )
})

test('a feat that names its level takes that slot', () => {
  const c = sheet([{ name: 'Fighter', level: 9 }], {
    features: [{ name: 'Durable', type: 'feat', level_gained: 8 }],
  })
  assert.deepEqual(states(c), ['F4:open', 'F6:open', 'F8:feat'])
})

test('feats beyond the slots, and feats on a sheet with no slots, are ignored rather than invented', () => {
  const three = [1, 2, 3].map((n) => ({ name: `Feat ${n}`, type: 'feat' }))
  assert.deepEqual(
    states(sheet([{ name: 'Wizard', level: 9 }], { features: three })),
    ['W4:feat', 'W8:feat']
  )
  assert.deepEqual(
    states(sheet([{ name: 'Wizard', level: 3 }], { features: three })),
    []
  )
})

test('on a multiclass sheet an improvement that names its class fills only that class; an older entry with no class fills the slot at that class level in each class', () => {
  const classes = [
    { name: 'Barbarian', level: 6, started: true },
    { name: 'Paladin', level: 4 },
  ]
  const entry = {
    ability: 'str',
    amount: 2,
    source: 'Ability Score Improvement',
    level_gained: 4,
  }
  assert.deepEqual(
    states(
      sheet(classes, {
        ability_score_history: [{ ...entry, class: 'Barbarian' }],
      })
    ),
    ['B4:ability', 'P4:open']
  )
  assert.deepEqual(states(sheet(classes, { ability_score_history: [entry] })), [
    'B4:ability',
    'P4:ability',
  ])
})

test('a feat from a class that names its level takes that class slot, whatever its source label', () => {
  const c = sheet([{ name: 'Artificer', level: 9 }], {
    features: [
      {
        name: 'Fade Away',
        type: 'feat',
        _source: 'Artificer',
        level_gained: 8,
      },
    ],
  })
  assert.deepEqual(states(c), ['A4:open', 'A8:feat'])
})
