// Granted spells are never counted against the class: one rule (rules/5e/spellOrigins.js) for the
// audit, the comparison and the level-up's pick lists. Simulated characters only.
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildCharacter } = require('./helpers/autoLevel')
const { previewLevelUp } = require('../rules/5e/choiceProtocol')
const { auditCharacter } = require('../rules/5e/auditCharacter')
const { grantedSpellKeys, isGrantedSpell } = require('../rules/5e/spellOrigins')

const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const codes = (c) => auditCharacter(c).map((i) => i.code)

test('a spell a feature names in spells_granted is granted even when its stored entry has no flag', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 4,
  })
  const base = auditCharacter(character).map((i) => i.code)
  assert.ok(!base.includes('cantrips-many'))
  // A fifth cantrip, written by hand with no flag...
  const withExtra = {
    ...character,
    spells: [
      ...character.spells,
      { name: 'Guidance', level: 0, prepared: true, type: 'chosen' },
    ],
  }
  assert.ok(codes(withExtra).includes('cantrips-many'))
  // ...stops counting once a feature on the sheet is what grants it.
  const explained = {
    ...withExtra,
    features: [
      ...withExtra.features,
      { name: 'Magic Initiate', type: 'feat', spells_granted: ['Guidance'] },
    ],
  }
  assert.ok(!codes(explained).includes('cantrips-many'))
  assert.ok(grantedSpellKeys(explained, '2024').has(key('Guidance')))
})

test("a spell the subclass always prepares at the character's level is granted; at a lower level it is not", () => {
  const at = (level) =>
    buildCharacter({
      className: 'Cleric',
      subclass: 'Life Domain',
      toLevel: level,
    }).character
  assert.ok(grantedSpellKeys(at(3), '2024').has(key('Cure Wounds')))
  assert.ok(!grantedSpellKeys(at(2), '2024').has(key('Cure Wounds')))
})

test('a spell the class always prepares is granted (Paladin: Divine Smite)', () => {
  const { character } = buildCharacter({
    className: 'Paladin',
    subclass: 'Oath of Devotion',
    toLevel: 3,
  })
  const granted = grantedSpellKeys(character, '2024')
  assert.ok(isGrantedSpell({ name: 'Divine Smite', level: 1 }, granted))
  assert.ok(!isGrantedSpell({ name: 'Bless', level: 1 }, granted))
})

test('the level-up does not offer, and a build does not spend a pick on, a spell a feature already grants', () => {
  // The house rule gives every Cleric a free Divine Prestidigitation at level 1.
  const { character } = buildCharacter({
    className: 'Cleric',
    subclass: 'Life Domain',
    toLevel: 0,
  })
  const r = previewLevelUp(character, {
    className: 'Cleric',
    toLevel: 1,
    hpMethod: 'average',
  })
  const ask = r.choices.find((c) => c.type === 'newCantrips')
  const opt = ask.options.find((o) => o.value === 'Divine Prestidigitation')
  assert.ok(!opt || opt.disabled, 'Divine Prestidigitation is not on offer')
  const built = buildCharacter({
    className: 'Cleric',
    subclass: 'Life Domain',
    toLevel: 1,
  }).character
  assert.deepEqual(
    auditCharacter(built)
      .filter((i) => /cantrip/.test(i.code))
      .map((i) => i.code),
    []
  )
})
