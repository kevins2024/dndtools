const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')
const { loadSubclass } = require('../rules/5e/subclasses')

const catalog = require('../data/5e/feature-catalog.json')

function referencedIds() {
  const out = []
  for (const dir of ['classes', 'subclasses']) {
    const full = path.join(__dirname, '..', 'data', '5e', dir)
    for (const file of fs.readdirSync(full)) {
      if (!file.endsWith('.json')) continue
      const data = JSON.parse(fs.readFileSync(path.join(full, file), 'utf8'))
      for (const ids of Object.values(data.features_by_level ?? {})) {
        for (const id of ids) out.push({ file, id })
      }
    }
  }
  return out
}

test('every feature id a class or subclass file grants resolves to a name in the catalog (an unresolved id shows up on the sheet as its raw id)', () => {
  const missing = referencedIds()
    .filter(({ id }) => !catalog[id])
    .map(({ file, id }) => `${file}: ${id}`)
  assert.deepStrictEqual(missing, [])
})

// ── Rage uses come from the class table ─────────────────────────────────

const barb = (level, extra = {}) => ({
  name: 'B',
  level,
  stat_str: 18,
  stat_dex: 12,
  stat_con: 16,
  stat_int: 8,
  stat_wis: 10,
  stat_cha: 8,
  hp_max: 10 * level,
  hp_current: 10 * level,
  hit_dice_current: level,
  features: [],
  spells: [],
  classes: [
    {
      name: 'Barbarian',
      subclass: level >= 3 ? 'Path of the Berserker' : null,
      level,
    },
  ],
  ...extra,
})

const RAGE_ID = 'pub24_barbarian-rage'

test('Rage is stamped with its use count from the Barbarian rages_by_level table, as a bonus-action long-rest pool', () => {
  const cases = [
    [1, 2],
    [3, 3],
    [6, 4],
    [8, 4],
    [12, 5],
    [17, 6],
  ]
  for (const [toLevel, uses] of cases) {
    const from = barb(toLevel - 1)
    from.classes[0].subclass = toLevel - 1 >= 3 ? 'Path of the Berserker' : null
    // a character already holding Rage (so level-ups re-stamp it)
    const withRage =
      toLevel === 1
        ? from
        : {
            ...from,
            features: [
              {
                name: 'Rage',
                id: RAGE_ID,
                type: 'feature',
                level_gained: 1,
              },
            ],
          }
    const r = diffLevelUp(
      toLevel === 3
        ? {
            ...withRage,
            classes: [
              {
                name: 'Barbarian',
                subclass: 'Path of the Berserker',
                level: 2,
              },
            ],
          }
        : withRage,
      { className: 'Barbarian', toLevel, hpMethod: 'average' }
    )
    const rage = r.patch.features.find((f) => f.id === RAGE_ID)
    assert.ok(rage, `Rage present at ${toLevel}`)
    assert.strictEqual(rage.uses_max, uses, `level ${toLevel}`)
    assert.strictEqual(rage.action_type, 'bonus_action')
    assert.strictEqual(rage.recharge, 'long_rest')
  }
})

test('Rage at 20th level is still 6 uses (2024 has no unlimited Rage)', () => {
  const c = barb(19, {
    features: [
      {
        name: 'Rage',
        id: RAGE_ID,
        type: 'feature',
        level_gained: 1,
        uses_max: 6,
        uses_current: 6,
      },
    ],
  })
  c.classes[0].subclass = 'Path of the Berserker'
  const r = diffLevelUp(c, {
    className: 'Barbarian',
    toLevel: 20,
    hpMethod: 'average',
  })
  const rage = r.patch.features.find((f) => f.id === RAGE_ID)
  assert.strictEqual(rage.uses_max, 6)
})

// ── Chronurgy Magic ─────────────────────────────────────────────────────

test("Chronurgy Magic loads with its five Explorer's Guide to Wildemount features at the right wizard levels", () => {
  const sub = loadSubclass('Wizard', 'Chronurgy Magic')
  assert.deepStrictEqual(sub.features_by_level, {
    3: ['Chronal Shift', 'Temporal Awareness'],
    6: ['Momentary Stasis'],
    10: ['Arcane Abeyance'],
    14: ['Convergent Future'],
  })
})

test('a Wizard taking Chronurgy Magic gets Chronal Shift x2 at 3rd and, at 6th, Momentary Stasis = INT modifier uses', () => {
  const base = {
    name: 'C',
    level: 1,
    stat_str: 8,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 20, // +5
    stat_wis: 10,
    stat_cha: 10,
    hp_max: 8,
    hp_current: 8,
    hit_dice_current: 1,
    spellcasting_ability: 'int',
    features: [],
    spells: [],
    classes: [{ name: 'Wizard', subclass: 'Chronurgy Magic', level: 1 }],
  }
  const at2 = {
    ...base,
    level: 2,
    classes: [{ name: 'Wizard', subclass: 'Chronurgy Magic', level: 2 }],
  }
  const lvl3 = diffLevelUp(at2, {
    className: 'Wizard',
    toLevel: 3,
    hpMethod: 'average',
  })
  const shift = lvl3.patch.features.find((f) => f.name === 'Chronal Shift')
  assert.strictEqual(shift.uses_max, 2)
  assert.strictEqual(shift.action_type, 'reaction')
  const awareness = lvl3.patch.features.find(
    (f) => f.name === 'Temporal Awareness'
  )
  assert.strictEqual(awareness.adds_ability_to_initiative, 'int')

  const at5 = {
    ...base,
    level: 5,
    classes: [{ name: 'Wizard', subclass: 'Chronurgy Magic', level: 5 }],
  }
  const lvl6 = diffLevelUp(at5, {
    className: 'Wizard',
    toLevel: 6,
    hpMethod: 'average',
  })
  const stasis = lvl6.patch.features.find((f) => f.name === 'Momentary Stasis')
  assert.strictEqual(stasis.uses_max, 5)
  assert.strictEqual(stasis.action_type, 'action')
})

test('College of Eloquence has its five features at the right bard levels, with Universal Speech once per long rest', () => {
  const sub = loadSubclass('Bard', 'College of Eloquence')
  assert.deepStrictEqual(sub.features_by_level, {
    3: ['Silver Tongue', 'Unsettling Words'],
    6: ['Unfailing Inspiration', 'Universal Speech'],
    14: ['Infectious Inspiration'],
  })
  const base = {
    name: 'E',
    level: 5,
    stat_str: 8,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 18, // +4
    hp_max: 30,
    hp_current: 30,
    hit_dice_current: 5,
    spellcasting_ability: 'cha',
    features: [],
    spells: [],
    classes: [{ name: 'Bard', subclass: 'College of Eloquence', level: 5 }],
  }
  const lvl6 = diffLevelUp(base, {
    className: 'Bard',
    toLevel: 6,
    hpMethod: 'average',
  })
  const speech = lvl6.patch.features.find((f) => f.name === 'Universal Speech')
  assert.strictEqual(speech.uses_max, 1)
  assert.strictEqual(speech.action_type, 'action')
  assert.strictEqual(speech.recharge, 'long_rest')
  const unfailing = lvl6.patch.features.find(
    (f) => f.name === 'Unfailing Inspiration'
  )
  assert.ok(unfailing, 'Unfailing Inspiration granted at 6th')
  assert.strictEqual(unfailing.uses_max, undefined)
})
