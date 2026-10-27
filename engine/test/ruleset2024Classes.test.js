// 2024 (5.5e) class chassis. Expectations here are transcribed from the
// Barbarian page on dnd2024.wikidot.com (Player's Handbook 2024), not from the
// data files — if one of these fails, check the page before the data.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  loadClass,
  listClasses,
  featuresGainedAtLevel,
  allFeaturesUpToLevel,
} = require('../rules/5e/classFeatures')
const { describeLevelUp } = require('../rules/5e/levelUp')

const atOrBelow = (table, level) => {
  let v
  let best = -Infinity
  for (const [k, val] of Object.entries(table)) {
    if (Number(k) <= level && Number(k) > best) {
      best = Number(k)
      v = val
    }
  }
  return v
}

test('loadClass defaults to the 2024 rules; the 2014 file is only the legacy fallback', () => {
  const b = loadClass('Barbarian')
  assert.equal(b.ruleset, '2024')
  assert.deepEqual(b.features_by_level['9'], ['Brutal Strike'])
  assert.equal(
    loadClass('Barbarian', '2014').features_by_level['9'][0],
    'Brutal Critical (1 die)'
  )
})

test('2024 Barbarian: features by level match the PHB table', () => {
  const b = loadClass('Barbarian', '2024')
  assert.equal(b.ruleset, '2024')
  const names = (lvl) => b.features_by_level[String(lvl)] ?? []
  assert.deepEqual(names(1), ['Rage', 'Unarmored Defense', 'Weapon Mastery'])
  assert.deepEqual(names(2), ['Danger Sense', 'Reckless Attack'])
  assert.deepEqual(names(3), ['Primal Knowledge'])
  assert.deepEqual(names(5), ['Extra Attack', 'Fast Movement'])
  assert.deepEqual(names(7), ['Feral Instinct', 'Instinctive Pounce'])
  assert.deepEqual(names(9), ['Brutal Strike'])
  assert.deepEqual(names(11), ['Relentless Rage'])
  assert.deepEqual(names(13), ['Improved Brutal Strike'])
  assert.deepEqual(names(15), ['Persistent Rage'])
  assert.deepEqual(names(17), ['Improved Brutal Strike'])
  assert.deepEqual(names(18), ['Indomitable Might'])
  assert.deepEqual(names(20), ['Primal Champion'])
  // Gone in 2024:
  const all = allFeaturesUpToLevel('Barbarian', 20, '2024').map((f) => f.name)
  assert.ok(!all.some((n) => /Brutal Critical/.test(n)))
})

test('2024 Barbarian: the two Improved Brutal Strike grants have distinct ids', () => {
  const b = loadClass('Barbarian', '2024')
  assert.notEqual(
    b.features_by_level_ids['13'][0],
    b.features_by_level_ids['17'][0]
  )
})

test('2024 Barbarian: rages, rage damage and weapon mastery tables', () => {
  const b = loadClass('Barbarian', '2024')
  const rages = (l) => atOrBelow(b.rages_by_level, l)
  assert.deepEqual(
    [1, 2, 3, 5, 6, 11, 12, 16, 17, 20].map(rages),
    [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]
  )
  const dmg = (l) => atOrBelow(b.rage_damage_by_level, l)
  assert.deepEqual([1, 8, 9, 15, 16, 20].map(dmg), [2, 2, 3, 3, 4, 4])
  const mastery = (l) => atOrBelow(b.weapon_mastery_by_level, l)
  assert.deepEqual([1, 3, 4, 9, 10, 20].map(mastery), [2, 2, 3, 3, 4, 4])
})

test('2024 Barbarian: chassis facts', () => {
  const b = loadClass('Barbarian', '2024')
  assert.deepEqual(b.saving_throw_proficiencies, ['str', 'con'])
  assert.deepEqual(b.armor_proficiencies, ['light', 'medium', 'shields'])
  assert.deepEqual(b.weapon_proficiencies, ['simple', 'martial'])
  assert.equal(b.skill_choices.count, 2)
  assert.deepEqual(b.skill_choices.options, [
    'animal_handling',
    'athletics',
    'intimidation',
    'nature',
    'perception',
    'survival',
  ])
  assert.equal(b.subclass_choice_level, 3)
  assert.deepEqual(b.subclass_feature_levels, [3, 6, 10, 14])
  assert.equal(b.spellcasting.type, 'none')
  // "(A) Greataxe, 4 Handaxes, Explorer's Pack, and 15 GP; or (B) 75 GP"
  assert.equal(b.starting_equipment.A.gold, 15)
  assert.deepEqual(
    b.starting_equipment.A.items.find((i) => i.name === 'Handaxes'),
    {
      name: 'Handaxes',
      qty: 4,
    }
  )
  assert.equal(b.starting_equipment.B.gold, 75)
})

test('all 13 classes have a 2024 file (Artificer from Eberron: Forge of the Artificer)', () => {
  for (const name of listClasses('2024')) {
    const c = loadClass(name, '2024')
    assert.equal(c.ruleset, '2024', name)
    assert.equal(c.legacy, undefined, name)
  }
  assert.equal(listClasses('2024').length, 13)
  assert.equal(loadClass('Artificer').legacy, undefined)
})

test('listClasses(2024) still lists every class — rewritten ones plus legacy ones', () => {
  const names = listClasses('2024')
  assert.ok(names.includes('Barbarian'))
  assert.ok(names.includes('Artificer'))
  assert.equal(new Set(names).size, names.length)
  assert.equal(listClasses().length, 13)
})

test('featuresGainedAtLevel uses the 2024 table without being asked', () => {
  assert.deepEqual(featuresGainedAtLevel('Barbarian', 9).named, [
    'Brutal Strike',
  ])
})

test('describeLevelUp for a 2024 Barbarian 8 -> 9 grants Brutal Strike', () => {
  const r = describeLevelUp({
    className: 'Barbarian',
    subclassName: null,
    fromLevel: 8,
    toLevel: 9,
    ruleset: '2024',
    hpMethod: 'average',
  })
  assert.deepEqual(r.baseFeaturesGained.map((f) => f.names).flat(), [
    'Brutal Strike',
  ])
})

// ── Subclasses ──────────────────────────────────────────────────────────

const {
  loadSubclass,
  listSubclasses,
  subclassFeaturesGainedAtLevel,
} = require('../rules/5e/subclasses')

test('2024 Path of the Berserker: Frenzy 3, Mindless Rage 6, Retaliation 10, Intimidating Presence 14', () => {
  const s = loadSubclass('Barbarian', 'Path of the Berserker', '2024')
  assert.equal(s.ruleset, '2024')
  const at = (l) =>
    subclassFeaturesGainedAtLevel(
      'Barbarian',
      'Path of the Berserker',
      l,
      '2024'
    )
  assert.deepEqual(at(3), ['Frenzy'])
  assert.deepEqual(at(6), ['Mindless Rage'])
  assert.deepEqual(at(10), ['Retaliation'])
  assert.deepEqual(at(14), ['Intimidating Presence'])
})

test('the 2014 subclass name still resolves under 2024 via the alias table', () => {
  const s = loadSubclass('Barbarian', 'Berserker', '2024')
  assert.equal(s.name, 'Path of the Berserker')
  // ...and under 2014 it is still the old file, with Retaliation at 14.
  assert.deepEqual(
    subclassFeaturesGainedAtLevel('Barbarian', 'Berserker', 14, '2014'),
    ['Retaliation']
  )
})

test('a subclass the 2024 rules did not rewrite loads as legacy under 2024', () => {
  const s = loadSubclass('Barbarian', 'Path of the Giant', '2024')
  assert.ok(s)
  assert.equal(s.legacy, true)
  assert.equal(
    loadSubclass('Barbarian', 'Path of the Giant', '2014'),
    loadSubclass('Barbarian', 'Path of the Giant', '2014')
  )
})

test('listSubclasses(2024) has each rewritten subclass once and keeps the legacy ones', () => {
  const list = listSubclasses('2024')
  const names = list.filter((s) => s.class === 'Barbarian').map((s) => s.name)
  assert.ok(names.includes('Path of the Berserker'))
  assert.ok(names.includes('Path of the Giant'))
  // 2014 "Berserker" is replaced by its 2024 rewrite, not listed twice.
  assert.ok(!names.includes('Berserker'))
})

// ── Legacy subclasses start at 3rd level under 2024 ─────────────────────

test('a legacy subclass that began before 3rd level has its early features folded into 3rd (2024 picks every subclass at 3)', () => {
  const t14 = loadSubclass('Cleric', 'Tempest Domain', '2014')
  assert.ok(
    Object.keys(t14.features_by_level).some((l) => Number(l) < 3),
    'sanity: the 2014 domain starts at 1'
  )
  const t24 = loadSubclass('Cleric', 'Tempest Domain', '2024')
  assert.equal(t24.legacy, true)
  assert.ok(Object.keys(t24.features_by_level).every((l) => Number(l) >= 3))
  // everything the 2014 domain gave at 1st and 2nd is now at 3rd
  const early14 = Object.entries(t14.features_by_level)
    .filter(([l]) => Number(l) < 3)
    .flatMap(([, n]) => n)
  for (const name of early14)
    assert.ok(t24.features_by_level['3'].includes(name), name)
  assert.equal(
    t24.features_by_level['3'].length,
    t24.features_by_level_ids['3'].length
  )
  // domain spells too
  assert.ok(
    Object.keys(t24.domain_spells_by_level).every((l) => Number(l) >= 3)
  )
  assert.ok(
    t24.domain_spells_by_level['3'].length >
      t14.domain_spells_by_level['3'].length
  )
})

test('describeLevelUp for a 2024 character who takes a legacy Cleric domain at 3rd gets the whole early package then', () => {
  const r = describeLevelUp({
    className: 'Cleric',
    subclassName: 'Tempest Domain',
    fromLevel: 2,
    toLevel: 3,
    ruleset: '2024',
    hpMethod: 'average',
  })
  const names = r.subclassFeaturesGained.flatMap((g) => g.names)
  assert.ok(names.includes('Wrath of the Storm'))
})

test('legacy subclasses that already start at 3rd are untouched; 2014 loads are never shifted', () => {
  const g24 = loadSubclass('Barbarian', 'Path of the Giant', '2024')
  const g14 = loadSubclass('Barbarian', 'Path of the Giant', '2014')
  assert.deepEqual(g24.features_by_level, g14.features_by_level)
  assert.equal(
    loadSubclass('Wizard', 'War Magic', '2014').features_by_level['2'].length >
      0,
    true
  )
  assert.equal(
    loadSubclass('Wizard', 'War Magic', '2024').features_by_level['2'],
    undefined
  )
})
