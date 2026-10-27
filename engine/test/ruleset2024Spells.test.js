// 2024 spell data (the 391 Player's Handbook spells) and ruleset-aware lookups.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  findSpellRecord,
  isSpellOnClassList,
  listSpellsForClass,
  listFeatSpellChoices,
  effectiveMaxSpellLevel,
} = require('../rules/5e/spellLists')

test('2024 PHB spell counts by level: 34 cantrips, 64/63/52/41/48/34/21/18/16 for levels 1-9', () => {
  const all = listSpellsForClass('x', {
    pool: 'any',
    ruleset: '2024',
    maxLevel: 9,
  }).concat(
    listSpellsForClass('x', {
      pool: 'any',
      ruleset: '2024',
      cantripsOnly: true,
    })
  )
  const phb = all
    .map((s) => findSpellRecord(s.name, '2024'))
    .filter((r) => r.ruleset === '2024')
  const by = (l) => phb.filter((r) => r.level === l).length
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(by),
    [34, 64, 63, 52, 41, 48, 34, 21, 18, 16]
  )
})

test('Fireball (2024): level 3 Evocation on the Sorcerer and Wizard lists, 150 feet, +1d6 per slot above 3rd', () => {
  const f = findSpellRecord('Fireball', '2024')
  assert.deepEqual(
    [f.level, f.school, f.range, f.classes, f.ruleset],
    [3, 'Evocation', '150 feet', ['Sorcerer', 'Wizard'], '2024']
  )
  assert.match(f.higher_level, /1d6 for each spell slot level above 3/)
  assert.deepEqual(f.components, ['V', 'S', 'M'])
  assert.match(f.material, /bat guano/)
})

test('class lists follow the 2024 pages: Bless is Cleric/Paladin, Detect Magic is a Ritual with Concentration', () => {
  assert.deepEqual(findSpellRecord('Bless', '2024').classes, [
    'Cleric',
    'Paladin',
  ])
  const dm = findSpellRecord('Detect Magic', '2024')
  assert.equal(dm.ritual, true)
  assert.equal(dm.concentration, true)
  assert.equal(findSpellRecord('Acid Splash', '2024').level, 0)
  assert.ok(
    findSpellRecord('Acid Splash', '2024').classes.includes('Artificer')
  )
  assert.equal(isSpellOnClassList('Cleric', 'Bless', '2024'), true)
  assert.equal(isSpellOnClassList('Wizard', 'Bless', '2024'), false)
})

test('lookups default to 2024 and fall back to a 2014 spell the PHB did not carry, tagged legacy', () => {
  assert.equal(findSpellRecord('Fireball', '2014').ruleset, undefined)
  assert.match(findSpellRecord('Fireball', '2014').range, /150/)
  const old = findSpellRecord("Abi-Dalzim's Horrid Wilting")
  assert.ok(old)
  assert.equal(old.legacy, true)
  assert.equal(findSpellRecord('Not A Spell'), null)
})

test('spell pickers use the 2024 class lists', () => {
  const wizard1 = listSpellsForClass('Wizard', {
    maxLevel: 1,
    ruleset: '2024',
  }).map((s) => s.name)
  assert.ok(wizard1.includes('Magic Missile') && wizard1.includes('Shield'))
  const cantrips = listSpellsForClass('Bard', {
    cantripsOnly: true,
    ruleset: '2024',
  }).map((s) => s.name)
  assert.ok(
    cantrips.includes('Vicious Mockery') && cantrips.includes('Thunderclap')
  )
  const ritual = listFeatSpellChoices({
    className: 'Wizard',
    level: 1,
    ritualOnly: true,
    ruleset: '2024',
  }).map((s) => s.name)
  assert.ok(ritual.includes('Detect Magic'))
})

test('effectiveMaxSpellLevel under 2024: a level-1 Paladin already has 1st-level slots', () => {
  assert.equal(
    effectiveMaxSpellLevel({ className: 'Paladin', level: 1, ruleset: '2024' }),
    1
  )
  assert.equal(
    effectiveMaxSpellLevel({ className: 'Warlock', level: 5, ruleset: '2024' }),
    3
  )
})
