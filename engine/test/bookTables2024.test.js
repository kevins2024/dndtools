// The 2024 class tables as the book prints them, written out here independently of the engine's
// own data files, so a wrong number in `data/5e2024/` fails a test instead of agreeing with itself.
//
// Source: D&D Beyond Basic Rules (2024), "Character Classes" — each class's Features table and
// "Core <Class> Traits" table, read 2026-11-01. Values are the player-facing numbers only (no
// character on the roster is involved). Artificer is not in the PHB and is not covered here.
//
// If one of these fails, check the book first: either the engine data is wrong, or this
// transcription is. Do not edit a number here to make a test pass without re-reading the page.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  cantripsKnownForClass,
  spellSlotsForClassAtLevel,
  preparedSpellCount,
  pactMagicForLevel,
  mysticArcanumLevelsKnownAt,
} = require('../rules/5e/spellcasting')
const {
  proficiencyBonus,
  hitDieForClass,
  asiLevelsForClass,
} = require('../rules/5e/progression')
const { loadClass } = require('../rules/5e/classFeatures')

const RS = '2024'
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)
const cls = (name) => loadClass(name, RS)
// A `*_by_level` column in the class data: stored as breakpoints, so read it at every level.
const column = (name, field) => {
  const col = cls(name)[field]
  assert.ok(col, `${name} has no ${field}`)
  return LEVELS.map((lvl) => {
    let v
    for (const [k, val] of Object.entries(col)) if (Number(k) <= lvl) v = val
    // The data writes "none yet" as "-" and dice as "D6"; the book table uses a number.
    if (v === '-' || v == null) return 0
    if (/^D\d+$/.test(v)) return Number(v.slice(1))
    return v
  })
}

// ── tables common to every class ─────────────────────────────────────────

const PROFICIENCY = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]

test('proficiency bonus by character level', () => {
  assert.deepEqual(LEVELS.map(proficiencyBonus), PROFICIENCY)
})

const BASICS = {
  // class: [hit die, saves, skills chosen, armor training, weapon training, ASI levels]
  Barbarian: [
    12,
    ['str', 'con'],
    2,
    ['light', 'medium', 'shields'],
    ['simple', 'martial'],
    [4, 8, 12, 16],
  ],
  Bard: [8, ['dex', 'cha'], 3, ['light'], ['simple'], [4, 8, 12, 16]],
  Cleric: [
    8,
    ['wis', 'cha'],
    2,
    ['light', 'medium', 'shields'],
    ['simple'],
    [4, 8, 12, 16],
  ],
  Druid: [
    8,
    ['int', 'wis'],
    2,
    ['light', 'shields'],
    ['simple'],
    [4, 8, 12, 16],
  ],
  Fighter: [
    10,
    ['str', 'con'],
    2,
    ['light', 'medium', 'heavy', 'shields'],
    ['simple', 'martial'],
    [4, 6, 8, 12, 14, 16],
  ],
  Monk: [8, ['str', 'dex'], 2, [], ['simple', 'martial:light'], [4, 8, 12, 16]],
  Paladin: [
    10,
    ['wis', 'cha'],
    2,
    ['light', 'medium', 'heavy', 'shields'],
    ['simple', 'martial'],
    [4, 8, 12, 16],
  ],
  Ranger: [
    10,
    ['str', 'dex'],
    3,
    ['light', 'medium', 'shields'],
    ['simple', 'martial'],
    [4, 8, 12, 16],
  ],
  Rogue: [
    8,
    ['dex', 'int'],
    4,
    ['light'],
    ['simple', 'martial:finesse_or_light'],
    [4, 8, 10, 12, 16],
  ],
  Sorcerer: [6, ['con', 'cha'], 2, [], ['simple'], [4, 8, 12, 16]],
  Warlock: [8, ['wis', 'cha'], 2, ['light'], ['simple'], [4, 8, 12, 16]],
  Wizard: [6, ['int', 'wis'], 2, [], ['simple'], [4, 8, 12, 16]],
}

for (const [name, [die, saves, skills, armor, weapons, asi]] of Object.entries(
  BASICS
)) {
  test(`${name}: hit die, saving throws, skills, starting training, Ability Score Improvement levels`, () => {
    const c = cls(name)
    assert.equal(hitDieForClass(name), die)
    assert.deepEqual(c.saving_throw_proficiencies, saves)
    assert.equal(c.skill_choices.count, skills)
    assert.deepEqual(c.armor_proficiencies, armor)
    assert.deepEqual(c.weapon_proficiencies, weapons)
    // Epic Boon at 19 is the book's ASI-level feature for every class.
    assert.deepEqual(asiLevelsForClass(name), [...asi, 19])
    // 2024: every class chooses its subclass at level 3.
    assert.equal(c.subclass_choice_level, 3)
  })
}

// ── spell slots ──────────────────────────────────────────────────────────

const FULL_SLOTS = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]
const HALF_SLOTS = [
  [2],
  [2],
  [3],
  [3],
  [4, 2],
  [4, 2],
  [4, 3],
  [4, 3],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
]

// Cantrips and prepared spells per level, from each class's Features table.
const CASTERS = {
  Bard: {
    slots: FULL_SLOTS,
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    prepared: [
      4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
    ],
  },
  Cleric: {
    slots: FULL_SLOTS,
    cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    prepared: [
      4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
    ],
  },
  Druid: {
    slots: FULL_SLOTS,
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    prepared: [
      4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
    ],
  },
  Sorcerer: {
    slots: FULL_SLOTS,
    cantrips: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    prepared: [
      2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
    ],
  },
  Wizard: {
    slots: FULL_SLOTS,
    cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    prepared: [
      4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25,
    ],
  },
  Paladin: {
    slots: HALF_SLOTS,
    cantrips: null,
    prepared: [
      2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15,
    ],
  },
  Ranger: {
    slots: HALF_SLOTS,
    cantrips: null,
    prepared: [
      2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15,
    ],
  },
}

for (const [name, t] of Object.entries(CASTERS)) {
  test(`${name}: spell slots, ${
    t.cantrips ? 'cantrips, ' : ''
  }prepared spells at every level`, () => {
    assert.deepEqual(
      LEVELS.map((l) => spellSlotsForClassAtLevel(name, l, null, RS)),
      t.slots,
      'spell slots'
    )
    assert.deepEqual(
      LEVELS.map((l) => preparedSpellCount(name, l, 0, null, RS)),
      t.prepared,
      'prepared spells'
    )
    if (t.cantrips)
      assert.deepEqual(
        LEVELS.map((l) => cantripsKnownForClass(name, l, null, RS)),
        t.cantrips,
        'cantrips'
      )
    // Half casters have no cantrips in 2024 either.
    else
      assert.deepEqual(
        LEVELS.map((l) => cantripsKnownForClass(name, l, null, RS)),
        new Array(20).fill(0)
      )
  })
}

test('Warlock: Pact Magic slots and slot level, cantrips, prepared spells, invocations, Mystic Arcanum', () => {
  const slots = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]
  const slotLevel = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
  assert.deepEqual(
    LEVELS.map((l) => pactMagicForLevel(l, RS)),
    LEVELS.map((_, i) => ({ slots: slots[i], slot_level: slotLevel[i] }))
  )
  assert.deepEqual(
    LEVELS.map((l) => cantripsKnownForClass('Warlock', l, null, RS)),
    [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
  )
  assert.deepEqual(
    LEVELS.map((l) => preparedSpellCount('Warlock', l, 0, null, RS)),
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
  )
  assert.deepEqual(
    column('Warlock', 'eldritch_invocations_by_level'),
    [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10]
  )
  // Mystic Arcanum: one 6th-level spell at 11, a 7th at 13, an 8th at 15, a 9th at 17.
  assert.deepEqual(mysticArcanumLevelsKnownAt(10, RS), [])
  assert.deepEqual(mysticArcanumLevelsKnownAt(11, RS), [6])
  assert.deepEqual(mysticArcanumLevelsKnownAt(16, RS), [6, 7, 8])
  assert.deepEqual(mysticArcanumLevelsKnownAt(20, RS), [6, 7, 8, 9])
})

// ── class-specific columns ───────────────────────────────────────────────

const COLUMNS = {
  Barbarian: {
    rages_by_level: [
      2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6,
    ],
    rage_damage_by_level: [
      2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4,
    ],
    weapon_mastery_by_level: [
      2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    ],
  },
  Bard: {
    bardic_die_by_level: [
      6, 6, 6, 6, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 12, 12, 12, 12, 12, 12,
    ],
  },
  Cleric: {
    channel_divinity_by_level: [
      0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4,
    ],
  },
  Druid: {
    wild_shape_by_level: [
      0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4,
    ],
  },
  Fighter: {
    second_wind_by_level: [
      2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    ],
    weapon_mastery_by_level: [
      3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6,
    ],
  },
  Monk: {
    martial_arts_by_level: [
      '1d6',
      '1d6',
      '1d6',
      '1d6',
      '1d8',
      '1d8',
      '1d8',
      '1d8',
      '1d8',
      '1d8',
      '1d10',
      '1d10',
      '1d10',
      '1d10',
      '1d10',
      '1d10',
      '1d12',
      '1d12',
      '1d12',
      '1d12',
    ],
    focus_points_by_level: [
      0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ],
  },
  Paladin: {
    channel_divinity_by_level: [
      0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    ],
  },
  Ranger: {
    favored_enemy_by_level: [
      2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6,
    ],
  },
  Rogue: {
    sneak_attack_by_level: [
      '1d6',
      '1d6',
      '2d6',
      '2d6',
      '3d6',
      '3d6',
      '4d6',
      '4d6',
      '5d6',
      '5d6',
      '6d6',
      '6d6',
      '7d6',
      '7d6',
      '8d6',
      '8d6',
      '9d6',
      '9d6',
      '10d6',
      '10d6',
    ],
  },
  Sorcerer: {
    sorcery_points_by_level: [
      0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ],
  },
}

for (const [name, fields] of Object.entries(COLUMNS))
  for (const [field, expected] of Object.entries(fields))
    test(`${name}: ${field
      .replace(/_by_level$/, '')
      .replace(/_/g, ' ')} at every level`, () => {
      assert.deepEqual(column(name, field), expected)
    })
