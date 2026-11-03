const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')

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
