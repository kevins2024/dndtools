// The engine pieces the screens read (2026-11-04): the shared 2024 spell index, the class save DCs and
// feature spellcasting on the sheet, rests healing to the effective maximum, the legacy species Half-Elf and
// Half-Orc, and the critical-hit dice. Expectations are the 2024 rules written out here.
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildSpellIndexes, classSpellList } = require('../rules/5e/spellIndex')
const { findSpellRecord } = require('../rules/5e/spellLists')
const { characterSheet } = require('../rules/5e/sheet')
const rest = require('../rules/5e/rest')
const { applyHealing } = require('../rules/5e/hitPoints')
const {
  createCharacter2024,
  listNewCharacterSpecies,
} = require('../rules/5e/newCharacter')
const { characterGrants } = require('../rules/5e/featureGrants')
const { criticalDamageDice } = require('../rules/5e/weaponAttack')

test('the spell index: 2024 text over 2014, 2014 spells the 2024 books did not rewrite kept as legacy, published over the SRD', () => {
  const srd = [
    {
      index: 'a',
      name: 'Alpha',
      level: 1,
      classes: ['Wizard'],
      description: '2014 alpha',
    },
    { index: 'b', name: 'Beta', level: 2, classes: ['Wizard', 'Cleric'] },
  ]
  const published = [
    { name: 'Gamma', level: 0, classes: ['Wizard'], source: 'X' },
  ]
  const rewritten = [
    {
      name: 'Alpha',
      level: 1,
      classes: ['Wizard', 'Bard'],
      description: '2024 alpha',
      ruleset: '2024',
    },
  ]
  const { legacyIndex, index2024 } = buildSpellIndexes(
    srd,
    published,
    rewritten
  )
  assert.equal(index2024.get('alpha').description, '2024 alpha')
  assert.equal(index2024.get('alpha').legacy, undefined)
  assert.equal(index2024.get('beta').legacy, true)
  assert.equal(index2024.get('gamma').legacy, true)
  assert.equal(legacyIndex.get('alpha').description, '2014 alpha')
  // a class list is by level then name, from the 2024 class lists
  assert.deepEqual(
    classSpellList(index2024, 'Wizard').map((s) => s.name),
    ['Gamma', 'Alpha', 'Beta']
  )
  assert.deepEqual(
    classSpellList(index2024, 'Bard').map((s) => s.name),
    ['Alpha']
  )
})

test('the real spell data: every 2024 spell is the 2024 record, not the 2014 one', () => {
  const spells2024 = require('../../src/data/spells_2024.json')
  assert.ok(spells2024.length > 300)
  for (const s of spells2024.slice(0, 40)) {
    const rec = findSpellRecord(s.name, '2024')
    assert.equal(rec.ruleset, '2024', s.name)
    assert.equal(rec.legacy, undefined, s.name)
  }
})

const fighter = (subclass, level, over = {}) => ({
  name: 'T',
  classes: [{ name: 'Fighter', level, subclass }],
  level,
  stat_str: 16,
  stat_dex: 14,
  stat_con: 14,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
  features: [],
  ...over,
})

test('class save DCs: Battle Master 8 + better of STR/DEX + Proficiency; Monk Focus uses Wisdom; Rogue Cunning Strike needs level 5', () => {
  const bm = characterSheet(fighter('Battle Master', 3)).saveDCs
  assert.deepEqual(
    bm.map((d) => [d.label, d.ability, d.saveDC.value]),
    [['Maneuver DC', 'str', 8 + 3 + 2]]
  )
  const dexBm = characterSheet(
    fighter('Battle Master', 3, { stat_dex: 18 })
  ).saveDCs
  assert.equal(dexBm[0].ability, 'dex')
  assert.equal(dexBm[0].saveDC.value, 8 + 4 + 2)
  assert.deepEqual(characterSheet(fighter('Champion', 3)).saveDCs, [])
  const monk = characterSheet({
    ...fighter(null, 2),
    classes: [{ name: 'Monk', level: 2 }],
    stat_wis: 16,
  }).saveDCs
  assert.deepEqual(
    monk.map((d) => [d.label, d.saveDC.value]),
    [['Focus DC', 8 + 3 + 2]]
  )
  const rogue = (level) =>
    characterSheet({
      ...fighter(null, level),
      classes: [{ name: 'Rogue', level }],
      stat_dex: 16,
    }).saveDCs
  assert.equal(rogue(4).length, 0)
  assert.equal(rogue(5)[0].saveDC.value, 8 + 3 + 3)
})

test('a rest heals to the effective maximum: items that change Constitution add 1 HP per level per point of modifier', () => {
  // CON 14 (+2) -> Amulet of Health sets 19 (+4): +2 per level, 5 levels = +10
  const c = {
    ...fighter(null, 5),
    hp_max: 40,
    hp_current: 12,
    classes: [{ name: 'Fighter', level: 5 }],
  }
  const amulet = {
    name: 'Amulet of Health',
    equipped_by: 'T',
    stat_overrides: { con: 19 },
  }
  assert.equal(rest.maxHp(c), 40)
  assert.equal(rest.maxHp(c, [amulet]), 50)
  assert.equal(rest.applyLongRest(c).patch.hp_current, 40)
  assert.equal(
    rest.applyLongRest(c, { equippedItems: [amulet] }).patch.hp_current,
    50
  )
  assert.equal(rest.hpMissing(c, [amulet]), 38)
  assert.equal(rest.longRestPreview(c, [amulet]).hpMissing, 38)
  // healing stops at the maximum the caller gives
  assert.equal(applyHealing(c, 100, { effectiveMax: 50 }).patch.hp_current, 50)
  assert.equal(applyHealing(c, 100).patch.hp_current, 40)
  // a short rest's healing is capped there too
  assert.equal(
    rest.applyShortRest(c, { hpGained: 100, equippedItems: [amulet] }).patch
      .hp_current,
    50
  )
})

const BASE = {
  name: 'Sim',
  background: 'Soldier',
  className: 'Fighter',
  backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
  scoreMethod: 'standardArray',
  scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
  languages: ['Elvish', 'Orc'],
  backgroundTool: 'Dice Set',
  classSkills: ['Acrobatics', 'Athletics'],
  equipment: { class: 'A', background: 'A' },
}

test('Half-Elf and Half-Orc can be created: their 2014 traits are rules, ability scores come from the background', () => {
  const names = listNewCharacterSpecies()
  assert.ok(names.includes('Half-Elf') && names.includes('Half-Orc'))

  const elf = createCharacter2024({ ...BASE, species: 'Half-Elf' })
  assert.deepEqual(elf.pending.map((p) => p.id).sort(), [
    'classSkills',
    'species.skillChoice',
  ])
  const picked = createCharacter2024({
    ...BASE,
    species: 'Half-Elf',
    classSkills: ['Acrobatics', 'Athletics'],
    speciesPicks: { skillChoice: ['Insight', 'Persuasion'] },
  })
  const e = picked.character
  assert.ok(
    ['Insight', 'Persuasion'].every((s) => e.skill_proficiencies.includes(s))
  )
  const g = characterGrants(e)
  assert.equal(g.darkvision, 60)
  assert.ok(g.savingThrowAdvantages.includes('being_charmed'))
  assert.ok(g.conditionImmunities.includes('magical_sleep'))
  // the species gave no ability score increase: the Soldier's +2 STR +1 CON on 15 and 14
  assert.equal(e.stat_str, 17)
  assert.equal(e.stat_cha, 13)

  const orc = createCharacter2024({ ...BASE, species: 'Half-Orc' }).character
  assert.equal(characterGrants(orc).darkvision, 60)
  // Menacing's Intimidation was already given by the Soldier, so it is replaced by another skill (a question)
  const orcResult = createCharacter2024({ ...BASE, species: 'Half-Orc' })
  assert.ok(orcResult.pending.some((p) => p.id === 'species.skillAlt'))
})

test('Savage Attacks: a melee weapon critical hit rolls one more damage die; ranged does not', () => {
  const orc = createCharacter2024({ ...BASE, species: 'Half-Orc' }).character
  // doubled (1d12 twice) plus one: three d12
  assert.equal(criticalDamageDice(orc, '1d12').dice, '3d12')
  assert.equal(criticalDamageDice(orc, '1d12', { melee: false }).dice, '2d12')
  assert.equal(criticalDamageDice({ features: [] }, '2d6').dice, '4d6')
  assert.equal(criticalDamageDice({ features: [] }, 'nonsense'), null)
})
