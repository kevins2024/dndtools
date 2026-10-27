// diffLevelUp for a character on the 2024 rules.
const test = require('node:test')
const assert = require('node:assert/strict')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')
const { listClasses } = require('../rules/5e/classFeatures')

const blank = (cls, o = {}) => ({
  name: 'T',
  ruleset: '2024',
  genus: 'Human',
  level: 0,
  stat_str: 16,
  stat_dex: 14,
  stat_con: 14,
  stat_int: 14,
  stat_wis: 14,
  stat_cha: 14,
  hp_max: 0,
  hp_current: 0,
  hit_dice_current: 0,
  features: [],
  spells: [],
  skill_proficiencies: ['Athletics', 'Insight', 'Stealth', 'Perception'],
  skill_expertise: [],
  classes: [{ name: cls, subclass: null, level: 0, started: true }],
  ...o,
})
const apply = (ch, r) => ({ ...ch, ...r.patch, classes: r.patch.classes })
const names = (r) => r.patch.features.map((f) => f.name)
const types = (r) => r.pendingChoices.map((p) => p.type)

test('2024 Barbarian 0 -> 1: Rage, Unarmored Defense, Weapon Mastery; Rage has 2 uses; asks for two mastered weapons', () => {
  const r = diffLevelUp(blank('Barbarian'), { className: 'Barbarian', toLevel: 1, hpMethod: 'average' })
  assert.deepEqual(names(r), ['Rage', 'Unarmored Defense', 'Weapon Mastery'])
  assert.equal(r.patch.features.find((f) => f.name === 'Rage').uses_max, 2)
  assert.deepEqual(types(r), ['weaponMasteryChoice'])
})

test('resolving the Weapon Mastery picks adds them as features', () => {
  const r = diffLevelUp(blank('Barbarian'), {
    className: 'Barbarian',
    toLevel: 1,
    hpMethod: 'average',
    choices2024: { weaponMastery: ['greataxe', 'handaxe'] },
  })
  assert.deepEqual(types(r), [])
  assert.ok(names(r).includes('Weapon Mastery: Greataxe') && names(r).includes('Weapon Mastery: Handaxe'))
})

test('2024 Warlock never asks for a Pact Boon (the Pacts are invocations); invocation counts follow the 2024 table', () => {
  let ch = blank('Warlock')
  const seen = new Set()
  for (const lvl of [1, 2, 3]) {
    const r = diffLevelUp(ch, { className: 'Warlock', toLevel: lvl, hpMethod: 'average' })
    r.pendingChoices.forEach((p) => seen.add(p.type))
    if (lvl === 1) assert.equal(r.pendingChoices.find((p) => p.type === 'invocationChoice').count, 1)
    if (lvl === 2) assert.equal(r.pendingChoices.find((p) => p.type === 'invocationChoice').count, 3)
    ch = apply(ch, r)
  }
  assert.ok(!seen.has('pactBoonChoice'))
  // 2014 still asks at 3rd.
  let old = blank('Warlock', { ruleset: '2014' })
  const r3 = diffLevelUp(old, { className: 'Warlock', toLevel: 3, hpMethod: 'average' })
  assert.ok(types(r3).includes('pactBoonChoice'))
})

test('Cleric Divine Order: Protector adds Martial weapons and Heavy armor to the proficiencies', () => {
  const r = diffLevelUp(blank('Cleric'), { className: 'Cleric', toLevel: 1, hpMethod: 'average', choices2024: { divineOrder: 'Protector' } })
  assert.ok(r.patch.weapon_proficiencies.includes('martial'))
  assert.ok(r.patch.armor_proficiencies.includes('heavy'))
  assert.ok(names(r).includes('Divine Order: Protector'))
})

test('Thaumaturge / Magician add a cantrip to the cantrips owed at 1st level', () => {
  const base = diffLevelUp(blank('Cleric'), { className: 'Cleric', toLevel: 1, hpMethod: 'average', choices2024: { divineOrder: 'Protector' } })
  const th = diffLevelUp(blank('Cleric'), { className: 'Cleric', toLevel: 1, hpMethod: 'average', choices2024: { divineOrder: 'Thaumaturge' } })
  const owed = (r) => r.pendingChoices.find((p) => p.type === 'newCantrips').count
  assert.equal(owed(th), owed(base) + 1)
})

test('Fighter chooses a Fighting Style FEAT at 1st level', () => {
  const r = diffLevelUp(blank('Fighter'), { className: 'Fighter', toLevel: 1, hpMethod: 'average', choices2024: { fightingStyle: 'Defense', weaponMastery: ['greatsword', 'longbow', 'javelin'] } })
  assert.deepEqual(types(r), [])
  const style = r.patch.features.find((f) => f.name === 'Defense')
  assert.equal(style.type, 'feat')
  assert.equal(style.id, 'pub24_feat-defense')
})

test('a 2024 feat at an ASI level applies its own ability bump (Great Weapon Master: +1 Strength)', () => {
  let ch = blank('Fighter', { classes: [{ name: 'Fighter', subclass: null, level: 3 }], level: 3, stat_str: 15, hp_max: 30, hp_current: 30, hit_dice_current: 3 })
  const r = diffLevelUp(ch, {
    className: 'Fighter',
    toLevel: 4,
    hpMethod: 'average',
    asiOrFeatResolutions: { 4: { type: 'feat', featName: 'Great Weapon Master', abilityChoice: 'str' } },
  })
  assert.equal(r.patch.stat_str, 16)
  assert.deepEqual(r.patch.ability_score_history.at(-1), { ability: 'str', amount: 1, source: 'Great Weapon Master', level_gained: 4 })
})

test('level 19 is an Epic Boon under 2024 (flagged), a plain ASI under 2014', () => {
  const mk = (ruleset) => blank('Wizard', { ruleset, classes: [{ name: 'Wizard', subclass: 'Evoker', level: 18 }], level: 18, hp_max: 100, hp_current: 100, hit_dice_current: 18 })
  const r24 = diffLevelUp(mk('2024'), { className: 'Wizard', toLevel: 19, hpMethod: 'average' })
  assert.equal(r24.pendingChoices.find((p) => p.type === 'asiOrFeat').epicBoon, true)
  const r14 = diffLevelUp(mk('2014'), { className: 'Wizard', toLevel: 19, hpMethod: 'average' })
  assert.equal(r14.pendingChoices.find((p) => p.type === 'asiOrFeat').epicBoon, undefined)
})

test('every 2024 class levels 1 -> 20 with no errors, gaining only 2024 features', () => {
  const sub = { Barbarian: 'Path of the Berserker', Bard: 'College of Lore', Cleric: 'Life Domain', Druid: 'Circle of the Moon', Fighter: 'Battle Master', Monk: 'Warrior of the Open Hand', Paladin: 'Oath of Devotion', Ranger: 'Hunter', Rogue: 'Thief', Sorcerer: 'Draconic Sorcery', Warlock: 'Fiend Patron', Wizard: 'Evoker', Artificer: 'Alchemist' }
  for (const cls of listClasses('2024')) {
    let ch = blank(cls)
    for (let lvl = 1; lvl <= 20; lvl++) {
      ch.classes[0].subclass = lvl >= 3 ? sub[cls] : null
      const r = diffLevelUp(ch, { className: cls, toLevel: lvl, hpMethod: 'average' })
      assert.ok(r.patch, `${cls} L${lvl}: ${r.warnings}`)
      ch = apply(ch, r)
    }
    assert.equal(ch.level, 20, cls)
    const stale = ch.features.filter((f) => /Brutal Critical|Favored Enemy \(|Natural Explorer|Pact Boon|^Ki$/.test(f.name))
    assert.deepEqual(stale.map((f) => f.name), [], `${cls} picked up a 2014-only feature`)
  }
})
