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
  classes: [{ name: 'Barbarian', subclass: level >= 3 ? 'Berserker' : null, level }],
  ...extra,
})

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
    from.classes[0].subclass = toLevel - 1 >= 3 ? 'Berserker' : null
    // a character already holding Rage (so level-ups re-stamp it)
    const withRage = toLevel === 1 ? from : { ...from, features: [{ name: 'Rage', id: 'rage', type: 'feature', level_gained: 1 }] }
    const r = diffLevelUp(
      toLevel === 3 ? { ...withRage, classes: [{ name: 'Barbarian', subclass: 'Berserker', level: 2 }] } : withRage,
      { className: 'Barbarian', toLevel, hpMethod: 'average' }
    )
    const rage = r.patch.features.find((f) => f.id === 'rage')
    assert.ok(rage, `Rage present at ${toLevel}`)
    assert.strictEqual(rage.uses_max, uses, `level ${toLevel}`)
    assert.strictEqual(rage.action_type, 'bonus_action')
    assert.strictEqual(rage.recharge, 'long_rest')
  }
})

test('Rage at 20th level (unlimited) has no use counter', () => {
  const c = barb(19, {
    features: [{ name: 'Rage', id: 'rage', type: 'feature', level_gained: 1, uses_max: 6, uses_current: 6 }],
  })
  c.classes[0].subclass = 'Berserker'
  const r = diffLevelUp(c, { className: 'Barbarian', toLevel: 20, hpMethod: 'average' })
  const rage = r.patch.features.find((f) => f.id === 'rage')
  assert.ok(rage.uses_max == null)
})

// ── Chronurgy Magic ─────────────────────────────────────────────────────

test('Chronurgy Magic loads with its five Explorer\'s Guide to Wildemount features at the right wizard levels', () => {
  const sub = loadSubclass('Wizard', 'Chronurgy Magic')
  assert.deepStrictEqual(sub.features_by_level, {
    2: ['Chronal Shift', 'Temporal Awareness'],
    6: ['Momentary Stasis'],
    10: ['Arcane Abeyance'],
    14: ['Convergent Future'],
  })
})

test('a Wizard taking Chronurgy Magic gets Chronal Shift x2 and, at 6th, Momentary Stasis = INT modifier uses', () => {
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
  const lvl2 = diffLevelUp(base, { className: 'Wizard', toLevel: 2, hpMethod: 'average' })
  const shift = lvl2.patch.features.find((f) => f.name === 'Chronal Shift')
  assert.strictEqual(shift.uses_max, 2)
  assert.strictEqual(shift.action_type, 'reaction')
  const awareness = lvl2.patch.features.find((f) => f.name === 'Temporal Awareness')
  assert.strictEqual(awareness.adds_ability_to_initiative, 'int')

  const at5 = { ...base, level: 5, classes: [{ name: 'Wizard', subclass: 'Chronurgy Magic', level: 5 }] }
  const lvl6 = diffLevelUp(at5, { className: 'Wizard', toLevel: 6, hpMethod: 'average' })
  const stasis = lvl6.patch.features.find((f) => f.name === 'Momentary Stasis')
  assert.strictEqual(stasis.uses_max, 5)
  assert.strictEqual(stasis.action_type, 'action')
})
