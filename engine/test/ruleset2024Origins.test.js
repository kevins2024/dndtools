// 2024 species, backgrounds and feats. Expectations are transcribed from the
// Player's Handbook (2024) pages on dnd2024.wikidot.com.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const {
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
  traitsFor,
} = require('../rules/5e/species')
const {
  loadBackground,
  listBackgrounds,
  applyBackgroundBonus,
} = require('../rules/5e/backgrounds')
const { loadFeat, listFeats } = require('../rules/5e/grants')
const { evaluatePrerequisite } = require('../rules/5e/featPrerequisites')
const { applyFeatChoice, resolveAsiOrFeat } = require('../rules/5e/asiFeat')

const names = (xs) => xs.map((x) => x.name)

// ── Species ─────────────────────────────────────────────────────────────

test('2024 species have no ability score bonus — that moved to backgrounds', () => {
  for (const n of [
    'Human',
    'Elf',
    'Dwarf',
    'Halfling',
    'Dragonborn',
    'Gnome',
    'Goliath',
    'Orc',
    'Tiefling',
    'Aasimar',
  ]) {
    const sp = loadSpecies(n, '2024')
    assert.equal(sp.ruleset, '2024', n)
    assert.equal(sp.ability_score_bonus, undefined, n)
  }
  // 2014 is untouched: an Elf still gets +2 Dexterity.
  assert.deepEqual(loadSpecies('Elf').ability_score_bonus, { dex: 2 })
})

test('2024 Elf: Humanoid, Medium, speed 30, five traits', () => {
  const elf = loadSpecies('Elf', '2024')
  assert.equal(elf.creature_type, 'Humanoid')
  assert.equal(elf.speed, 30)
  assert.deepEqual(names(elf.traits), [
    'Darkvision',
    'Elven Lineage',
    'Fey Ancestry',
    'Keen Senses',
    'Trance',
  ])
  const lineages = elf.tables
    .find((t) => /Lineage/.test(t.title))
    .rows.map((r) => r[0])
  assert.deepEqual(
    lineages.filter((l) => l !== 'Lineage'),
    ['Drow', 'High Elf', 'Wood Elf']
  )
})

test('2024 species trait lists and speeds', () => {
  const traits = (n) => names(loadSpecies(n, '2024').traits)
  assert.deepEqual(traits('Human'), ['Resourceful', 'Skillful', 'Versatile'])
  assert.deepEqual(traits('Halfling'), [
    'Brave',
    'Halfling Nimbleness',
    'Luck',
    'Naturally Stealthy',
  ])
  assert.deepEqual(traits('Orc'), [
    'Adrenaline Rush',
    'Darkvision',
    'Relentless Endurance',
  ])
  assert.deepEqual(traits('Dwarf'), [
    'Darkvision',
    'Dwarven Resilience',
    'Dwarven Toughness',
    'Stonecunning',
  ])
  assert.deepEqual(traits('Goliath'), [
    'Giant Ancestry',
    'Large Form',
    'Powerful Build',
  ])
  assert.equal(loadSpecies('Goliath', '2024').speed, 35)
  assert.equal(loadSpecies('Dwarf', '2024').speed, 30)
})

test('traitsFor under 2024 resolves the species traits', () => {
  assert.ok(
    names(traitsFor('Orc', null, '2024')).includes('Relentless Endurance')
  )
})

test('a species the 2024 PHB dropped (Half-Elf, Half-Orc) loads as legacy under 2024', () => {
  const he = loadSpecies('Half-Elf', '2024')
  assert.ok(he)
  assert.equal(he.legacy, true)
  assert.equal(loadSpecies('Half-Elf').legacy, undefined)
})

test('listSpecies(2024): rewritten species once, legacy ones kept', () => {
  const list = names(listSpecies('2024'))
  assert.ok(
    list.includes('Orc') &&
      list.includes('Half-Elf') &&
      list.includes('Half-Orc')
  )
  assert.equal(list.filter((n) => n === 'Elf').length, 1)
  assert.equal(listSpecies().length, 11) // 2014 list unchanged
})

test('applySpeciesBonus is a no-op under 2024 (legacy species included)', () => {
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  assert.deepEqual(applySpeciesBonus(scores, 'Elf', {}, '2024').scores, scores)
  assert.deepEqual(
    applySpeciesBonus(scores, 'Half-Orc', {}, '2024').scores,
    scores
  )
  assert.equal(applySpeciesBonus(scores, 'Elf', {}).scores.dex, 12) // 2014 unchanged
})

// ── Backgrounds ─────────────────────────────────────────────────────────

test('2024 backgrounds: the sixteen PHB backgrounds, each with ability scores, an origin feat, two skills', () => {
  const all = listBackgrounds('2024').filter((b) => b.ruleset === '2024')
  assert.equal(all.length, 16)
  const soldier = loadBackground('Soldier', '2024')
  assert.deepEqual(soldier.ability_scores, ['str', 'dex', 'con'])
  assert.equal(soldier.feat, 'Savage Attacker')
  assert.deepEqual(soldier.skill_proficiencies, ['athletics', 'intimidation'])
  assert.equal(loadBackground('Sage', '2024').feat, 'Magic Initiate (Wizard)')
  assert.deepEqual(loadBackground('Criminal', '2024').ability_scores, [
    'dex',
    'con',
    'int',
  ])
  assert.equal(soldier.equipment.B.gold, 50)
})

test('a 2014 background (Mercenary Veteran) is still available as legacy under 2024', () => {
  const mv = loadBackground('Mercenary Veteran', '2024')
  assert.ok(mv)
  assert.equal(mv.legacy, true)
})

test('background ability bonus: +2/+1 or +1/+1/+1 across its three listed abilities, capped at 20', () => {
  const base = { str: 15, dex: 14, con: 13, int: 10, wis: 10, cha: 8 }
  const r = applyBackgroundBonus(base, 'Soldier', {
    plus2: 'str',
    plus1: 'dex',
  })
  assert.deepEqual([r.scores.str, r.scores.dex, r.scores.con], [17, 15, 13])
  assert.deepEqual(r.deltas, [
    { ability: 'str', amount: 2 },
    { ability: 'dex', amount: 1 },
  ])
  const all = applyBackgroundBonus(base, 'Soldier', { all: true })
  assert.deepEqual(
    [all.scores.str, all.scores.dex, all.scores.con],
    [16, 15, 14]
  )
  assert.throws(
    () => applyBackgroundBonus(base, 'Soldier', { plus2: 'int', plus1: 'dex' }),
    /Soldier/
  )
  assert.throws(
    () => applyBackgroundBonus(base, 'Soldier', { plus2: 'str', plus1: 'str' }),
    /different/
  )
  const capped = applyBackgroundBonus({ ...base, str: 19 }, 'Soldier', {
    plus2: 'str',
    plus1: 'dex',
  })
  assert.equal(capped.scores.str, 20)
  assert.equal(capped.deltas[0].amount, 1)
})

// ── Feats ───────────────────────────────────────────────────────────────

test('2024 feat catalog: 10 origin, 43 general, 10 fighting style, 12 epic boon feats from the PHB', () => {
  const all = listFeats('2024').filter((f) => f.ruleset === '2024')
  const count = (c) => all.filter((f) => f.category === c).length
  assert.deepEqual(
    [
      count('origin'),
      count('general'),
      count('fighting_style'),
      count('epic_boon'),
    ],
    [10, 43, 10, 12]
  )
})

test('feats default to the 2014 catalog; 2024 returns the rewrite, or the legacy 2014 feat if unrewritten', () => {
  assert.equal(loadFeat('Alert').stat_bonuses.initiative, 5)
  assert.equal(loadFeat('Alert', '2024').category, 'origin')
  const legacy = loadFeat('Metamagic Adept', '2024')
  assert.ok(legacy)
  assert.equal(legacy.legacy, true)
  assert.equal(loadFeat('No Such Feat', '2024'), null)
})

test('2024 feat prerequisites: character level, ability scores, "or" lists, spellcasting', () => {
  const ch = (o) => ({
    stat_str: 10,
    stat_dex: 10,
    stat_con: 10,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 10,
    level: 5,
    classes: [{ name: 'Fighter', level: 5 }],
    ...o,
  })
  const gwm = loadFeat('Great Weapon Master', '2024').prerequisite
  assert.equal(evaluatePrerequisite(ch({ stat_str: 13 }), gwm).met, true)
  assert.equal(evaluatePrerequisite(ch({ stat_str: 12 }), gwm).met, false)
  assert.equal(
    evaluatePrerequisite(
      ch({ stat_str: 13, level: 3, classes: [{ name: 'Fighter', level: 3 }] }),
      gwm
    ).met,
    false
  )
  const polearm = loadFeat('Polearm Master', '2024').prerequisite
  assert.equal(evaluatePrerequisite(ch({ stat_dex: 13 }), polearm).met, true)
  const boon = loadFeat('Boon of Combat Prowess', '2024').prerequisite
  assert.equal(evaluatePrerequisite(ch({ level: 19 }), boon).met, true)
  assert.equal(evaluatePrerequisite(ch({ level: 18 }), boon).met, false)
  const fs = loadFeat('Archery', '2024').prerequisite
  assert.equal(evaluatePrerequisite(ch({}), fs).met, true) // a Fighter has the Fighting Style feature
  assert.equal(
    evaluatePrerequisite(ch({ classes: [{ name: 'Wizard', level: 5 }] }), fs)
      .met,
    false
  )
  assert.equal(
    evaluatePrerequisite(ch({ classes: [{ name: 'Paladin', level: 1 }] }), fs)
      .met,
    false
  ) // Paladin gets it at 2
  assert.equal(
    evaluatePrerequisite(ch({ classes: [{ name: 'Paladin', level: 2 }] }), fs)
      .met,
    true
  )
  const sc = loadFeat('War Caster', '2024').prerequisite
  assert.equal(
    evaluatePrerequisite(ch({ spellcasting_ability: 'wis' }), sc).met,
    true
  )
})

test('2024 feats raise an ability by 1 (cap 20; Epic Boons cap 30); the cap comes from the feat', () => {
  const scores = { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const gwm = applyFeatChoice(
    scores,
    'Great Weapon Master',
    'str',
    null,
    '2024'
  )
  assert.equal(gwm.scores.str, 20)
  const capped = applyFeatChoice(
    { ...scores, str: 20 },
    'Great Weapon Master',
    'str',
    null,
    '2024'
  )
  assert.equal(capped.scores.str, 20)
  assert.equal(capped.deltas[0].amount, 0)
  const boon = applyFeatChoice(
    { ...scores, str: 20 },
    'Boon of Combat Prowess',
    'str',
    null,
    '2024'
  )
  assert.equal(boon.scores.str, 21)
  const res = resolveAsiOrFeat(
    scores,
    { type: 'feat', featName: 'Athlete', abilityChoice: 'dex' },
    '2024'
  )
  assert.equal(res.scores.dex, 11)
  assert.throws(
    () =>
      resolveAsiOrFeat(
        scores,
        { type: 'feat', featName: 'Athlete', abilityChoice: 'cha' },
        '2024'
      ),
    /Athlete/
  )
})

test('every 2024 feat has a published_features entry and a catalog name, and vice versa', () => {
  const published = require(
    path.join(__dirname, '..', '..', 'src', 'data', 'published_features.json')
  )
  const catalog = require('../data/5e/feature-catalog.json')
  const feats = listFeats('2024').filter((f) => f.ruleset === '2024')
  const pub = published.filter(
    (e) => e.category === 'feat' && e.ruleset === '2024'
  )
  assert.deepEqual(
    pub.map((e) => e.name).sort(),
    feats.map((f) => f.name).sort()
  )
  for (const f of feats) assert.equal(catalog[f.id], f.name, f.name)
})
