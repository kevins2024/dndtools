const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

const CHARACTERS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'characters.json'
)
const characters = require(CHARACTERS_PATH)

function find(name) {
  const c = characters.find((x) => x.name === name)
  if (!c)
    throw new Error(`fixture character "${name}" not found in characters.json`)
  return c
}

test('validateCharacter does NOT check prepared-spell or cantrip caps (deprioritized per project owner)', () => {
  // Lyria is still 1-over on prepared and 6-over on cantrips in the raw data —
  // this test exists to document that those are intentionally not surfaced
  // right now, not to claim she's legal.
  const lyria = find('Lyria')
  const issues = engine.validateCharacter(lyria)
  assert.ok(!issues.some((i) => /prepared/.test(i.message)))
  assert.ok(!issues.some((i) => /cantrip/.test(i.message)))
})

test('validateCharacter finds no known-spell-cap issues on Enauweyn (already RAW-audited this project)', () => {
  const enauweyn = find('Enauweyn')
  const issues = engine.validateCharacter(enauweyn)
  assert.ok(!issues.some((i) => /spells known/.test(i.message)))
})

test("validateCharacter finds no known-spell-cap issues on Therynv'l (built + RAW-audited this project)", () => {
  const therynvl = find("Therynv'l")
  const issues = engine.validateCharacter(therynvl)
  assert.ok(!issues.some((i) => /spells known/.test(i.message)))
})

test('validateCharacter finds no known-spell-cap issues on Rith, now that Bless is tagged as his Divine Magic bonus spell', () => {
  const rith = find('Rith')
  const issues = engine.validateCharacter(rith)
  assert.deepEqual(
    issues.filter((i) => /spells known/.test(i.message)),
    []
  )
})

test('validateCharacter checks saving throws against the `started: true` class for multiclass characters', () => {
  // Originally used the real Kerra as a fixture (2026-08-26: `started: true`
  // moved from Warlock to Fighter, surfacing a real saving_throws mismatch —
  // wis/cha recorded instead of the expected str/con). That bug was fixed
  // for real during her 2026-09-11 from-scratch rebuild (saving_throws now
  // correctly str/con), which broke this test — a real roster character is
  // a moving target, not a stable fixture for "a bug exists" regression
  // tests. Switched to a synthetic fixture (same shape as the two tests
  // below) so this test still verifies the validation logic itself without
  // depending on some real character staying broken indefinitely.
  const fakeMulticlass = {
    name: 'Test Fixture',
    level: 9,
    proficiency_bonus: 4,
    classes: [
      { name: 'Fighter', level: 4, started: true },
      { name: 'Warlock', level: 5 },
    ],
    saving_throws: ['wis', 'cha'], // Warlock's, not Fighter's str/con
  }
  const issues = engine.validateCharacter(fakeMulticlass)
  assert.ok(
    issues.some(
      (i) =>
        i.severity === 'warning' &&
        /saving throw/.test(i.message) &&
        /str|con/.test(i.message)
    )
  )
})

test('validateCharacter reports "no started class marked" rather than guessing, when a multiclass character has no `started` tag', () => {
  const fakeMulticlass = {
    name: 'Test Fixture',
    level: 6,
    proficiency_bonus: 3,
    classes: [
      { name: 'Barbarian', level: 4 },
      { name: 'Paladin', level: 2 },
    ],
    saving_throws: ['str', 'con', 'wis', 'cha'],
  }
  const issues = engine.validateCharacter(fakeMulticlass)
  assert.ok(issues.some((i) => /no class marked `started/.test(i.message)))
  assert.ok(!issues.some((i) => /saving throw proficiency/.test(i.message)))
})

test('validateCharacter flags a missing expected saving throw but not an extra feat-granted one', () => {
  const fakeWizard = {
    name: 'Test Fixture',
    level: 5,
    proficiency_bonus: 3,
    stat_int: 16,
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 5 }],
    saving_throws: ['int', 'con'], // has an extra CON (e.g. from Resilient), missing WIS
    spells: [],
  }
  const issues = engine.validateCharacter(fakeWizard)
  assert.ok(
    issues.some((i) =>
      i.message.includes(
        'Missing expected Wizard saving throw proficiency: wis'
      )
    )
  )
  assert.ok(!issues.some((i) => i.message.toLowerCase().includes('extra')))
})

test('describeLevelUp: Paladin 8->9 gains no ASI, no new features, but does gain a 3rd-level slot', () => {
  const result = engine.describeLevelUp({
    className: 'Paladin',
    subclassName: 'Oath of the Crown',
    fromLevel: 8,
    toLevel: 9,
    abilityModifierAtLevel: () => 3,
  })
  assert.deepEqual(result.asiOrFeatLevels, [])
  assert.deepEqual(result.baseFeaturesGained, [])
  assert.deepEqual(result.spellcasting.slotsBefore, [4, 3])
  assert.deepEqual(result.spellcasting.slotsAfter, [4, 3, 2])
})

test('describeLevelUp: Druid 1->2 flags a subclass choice is needed when none is given', () => {
  const result = engine.describeLevelUp({
    className: 'Druid',
    subclassName: null,
    fromLevel: 1,
    toLevel: 2,
  })
  assert.equal(result.subclassChoiceNeeded, true)
})

test('describeLevelUp: Fighter 3->4 surfaces the ASI level and the Martial Archetype choice level together', () => {
  const result = engine.describeLevelUp({
    className: 'Fighter',
    subclassName: 'Battle Master',
    fromLevel: 2,
    toLevel: 4,
  })
  assert.deepEqual(result.asiOrFeatLevels, [4])
  // level 3 is Fighter's subclass_choice_level — since a subclass name WAS given,
  // this should show up as a subclass feature slot, not a "choice needed" flag
  assert.equal(result.subclassChoiceNeeded, false)
})
