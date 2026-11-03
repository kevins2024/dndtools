// Bugs found by building the roster one level at a time and auditing every level (2026-10-31).
// Each test pins the behaviour of the level-up tool, not of any one character.
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildCharacter } = require('./helpers/autoLevel')
const { previewLevelUp, autoLevelUp } = require('../rules/5e/choiceProtocol')
const { spellListClasses } = require('../rules/5e/subclasses')
const { auditCharacter } = require('../rules/5e/auditCharacter')

const optionNames = (choice) => choice.options.map((o) => o.value)

test('a subclass can widen or replace the spell list it draws from, by data', () => {
  assert.deepEqual(spellListClasses('Sorcerer', 'Divine Soul'), [
    'Sorcerer',
    'Cleric',
  ])
  assert.deepEqual(spellListClasses('Fighter', 'Eldritch Knight'), ['Wizard'])
  assert.deepEqual(spellListClasses('Rogue', 'Arcane Trickster'), ['Wizard'])
  assert.deepEqual(spellListClasses('Sorcerer', 'Draconic Sorcery'), [
    'Sorcerer',
  ])
  assert.deepEqual(spellListClasses('Wizard', null), ['Wizard'])
})

test('a Divine Soul Sorcerer is offered Cleric cantrips and spells; a Draconic one is not', () => {
  const ask = (subclass) => {
    const { character } = buildCharacter({
      className: 'Sorcerer',
      subclass,
      toLevel: 3,
    })
    return previewLevelUp(character, {
      className: 'Sorcerer',
      toLevel: 4,
      hpMethod: 'average',
    })
  }
  const divine = ask('Divine Soul')
  const draconic = ask('Draconic Sorcery')
  const cantrips = (r) =>
    optionNames(r.choices.find((c) => c.type === 'newCantrips'))
  assert.ok(
    cantrips(divine).includes('Sacred Flame'),
    'Cleric cantrip on offer'
  )
  assert.ok(!cantrips(draconic).includes('Sacred Flame'))
})

test('a feature that grants extra cantrips has the level-up ask for them', () => {
  // Legendary Repertoire (homebrew, feature-mechanics): 3 cantrips beyond the Druid table.
  const feature = {
    name: 'Legendary Repertoire',
    id: 'hb_tackett_legendary_cantrips',
    type: 'feature',
  }
  const base = {
    ...buildCharacter({ className: 'Druid', toLevel: 0 }).character,
    features: [feature],
  }
  const r = previewLevelUp(base, {
    className: 'Druid',
    toLevel: 1,
    hpMethod: 'average',
  })
  const ask = r.choices.find((c) => c.type === 'newCantrips')
  assert.equal(ask.min, 2 + 3, 'the Druid table gives 2, the feature adds 3')
})

test('extra cantrips from a boon do not change what the level-up asks for', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 3,
  })
  const boon = {
    ...character,
    spells: [
      ...character.spells,
      { name: 'Light', level: 0, prepared: true, type: 'boon' },
      { name: 'Prestidigitation', level: 0, prepared: true, type: 'boon' },
    ],
  }
  const asked = (c) =>
    previewLevelUp(c, { className: 'Wizard', toLevel: 4, hpMethod: 'average' })
      .choices.filter((x) => x.type === 'newCantrips')
      .reduce((n, x) => n + x.min, 0)
  assert.equal(asked(boon), asked(character))
  assert.equal(asked(boon), 1)
  // ...and the audit notes the extras but does not call them an error.
  const found = auditCharacter(boon).find((i) => i.code === 'cantrips-many')
  assert.equal(found.severity, 'warn')
})

test('a class spell pick cannot land on a spell a feat grants in the same level-up', () => {
  const { character } = buildCharacter({
    className: 'Sorcerer',
    subclass: 'Draconic Sorcery',
    toLevel: 3,
  })
  const c = {
    ...character,
    spells: character.spells.filter((s) => s.name !== 'Misty Step'),
  }
  const opts = { className: 'Sorcerer', toLevel: 4, hpMethod: 'average' }
  const first = previewLevelUp(c, opts)
  const asi = first.choices.find((x) => x.kind === 'asiOrFeat')
  const fey = asi.feats.find((f) => f.name === 'Fey Touched')
  const featAnswer = {
    type: 'feat',
    featName: 'Fey Touched',
    abilityChoice: (fey.abilityChoices || [])[0],
    choices: Object.fromEntries(
      (fey.choices || []).map((ch) => [
        ch.id,
        (ch.options || [])
          .filter((o) => o.value !== 'Misty Step')
          .slice(0, ch.count)
          .map((o) => o.value),
      ])
    ),
  }
  const known = first.choices.find((x) => x.type === 'newKnownSpells')
  const answers = {
    [asi.id]: featAnswer,
    [known.id]: ['Misty Step'],
  }
  const r = previewLevelUp(c, opts, answers)
  const problem = r.problems.find((p) => p.id === known.id)
  assert.ok(problem, 'the Misty Step pick is refused')
  assert.match(problem.error, /not available/)
})

test('a multiclass skill is "already proficient" however the sheet spells it', () => {
  const { character } = buildCharacter({ className: 'Fighter', toLevel: 1 })
  const sheet = {
    ...character,
    skill_proficiencies: [...character.skill_proficiencies, 'SleightOfHand'],
    classes: [
      ...character.classes,
      { name: 'Rogue', subclass: null, level: 0 },
    ],
  }
  const r = previewLevelUp(sheet, {
    className: 'Rogue',
    toLevel: 1,
    hpMethod: 'average',
  })
  const pick = r.choices.find((c) => c.type === 'multiclassSkillChoice')
  const o = pick.options.find((x) => x.value === 'sleight_of_hand')
  assert.equal(o.disabled, true)
})

test('an answer naming an unavailable option is refused, not applied', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 1,
  })
  const opts = { className: 'Wizard', toLevel: 2, hpMethod: 'average' }
  const ask = previewLevelUp(character, opts).choices.find(
    (c) => c.type === 'spellbookAdditions'
  )
  const owned = character.spells.find((s) => s.level === 1)
  const r = previewLevelUp(character, opts, {
    [ask.id]: [owned.name, owned.name],
  })
  assert.ok(
    r.problems.some((p) => p.id === ask.id),
    'refused'
  )
  assert.equal(r.complete, false)
})

test('autoLevelUp still completes every sorcerer level with the stricter option check', () => {
  const { character } = buildCharacter({
    className: 'Sorcerer',
    subclass: 'Divine Soul',
    toLevel: 8,
  })
  const r = autoLevelUp(character, {
    className: 'Sorcerer',
    toLevel: 9,
    hpMethod: 'average',
  })
  assert.deepEqual(r.problems, [])
  assert.equal(r.complete, true)
})

test('a spellbook-linked wizard audited without its book is not reported as having 0 cantrips', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 5,
  })
  const spellbooks = [
    {
      id: 'sb_test',
      spells: character.spells.map((s) => ({ name: s.name, level: s.level })),
    },
  ]
  // A sheet that keeps its spells in a book has no spells of its own.
  const linked = {
    ...character,
    spells: undefined,
    spellbook_id: 'sb_test',
    prepared_spells: character.spells
      .filter((s) => s.prepared)
      .map((s) => s.name),
  }
  const bare = auditCharacter(linked)
  assert.ok(bare.some((i) => i.code === 'spellbook-not-loaded'))
  assert.ok(!bare.some((i) => i.code === 'cantrips-few'))
  const full = auditCharacter(linked, { spellbooks })
  assert.deepEqual(
    full.filter((i) => /cantrip|known/.test(i.code)),
    []
  )
})

test('Blessed Strikes is a choice, and a legacy domain adds no second Divine Strike or Potent Spellcasting', () => {
  const { character } = buildCharacter({
    className: 'Cleric',
    subclass: 'Tempest Domain',
    toLevel: 6,
  })
  const opts = { className: 'Cleric', toLevel: 7, hpMethod: 'average' }
  const ask = previewLevelUp(character, opts).choices.find(
    (c) => c.type === 'blessedStrikesChoice'
  )
  assert.deepEqual(optionNames(ask), ['Divine Strike', 'Potent Spellcasting'])
  const l8 = buildCharacter({
    className: 'Cleric',
    subclass: 'Tempest Domain',
    toLevel: 8,
  })
  const names = l8.character.features.map((f) => f.name)
  assert.ok(names.some((n) => n.startsWith('Blessed Strikes:')))
  assert.ok(!names.includes('Divine Strike'), 'the domain adds none of its own')
})

test('a cantrip a species grants is not counted against the class when the wizard keeps its spells in a book', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 9,
  })
  const own = character.spells.filter((s) => s.level === 0 && s.prepared)
  // The species cantrip is in the book like any other, but only the sheet knows where it came from.
  const species = {
    name: 'Minor Illusion',
    level: 0,
    prepared: true,
    featureGranted: true,
    _source: 'High Elf',
  }
  const spellbooks = [
    {
      id: 'sb_species',
      spells: [
        ...character.spells.map((s) => ({ name: s.name, level: s.level })),
        { name: species.name, level: 0 },
      ],
    },
  ]
  const linked = {
    ...character,
    spells: [species],
    spellbook_id: 'sb_species',
    prepared_spells: [...own.map((s) => s.name), species.name],
  }
  const codes = auditCharacter(linked, { spellbooks }).map((i) => i.code)
  assert.ok(!codes.includes('cantrips-many'), codes.join())
  // ...while a fifth cantrip with no source is still reported.
  const extra = {
    ...linked,
    spells: [],
    prepared_spells: linked.prepared_spells,
  }
  assert.ok(
    auditCharacter(extra, { spellbooks })
      .map((i) => i.code)
      .includes('cantrips-many')
  )
})

test("today's prepared spells of a daily preparer are play, not build, so they are not audited; a Sorcerer's picks are", () => {
  const codes = (c) => auditCharacter(c).map((i) => i.code)
  const cleric = buildCharacter({
    className: 'Cleric',
    subclass: 'Life Domain',
    toLevel: 9,
  }).character
  const prepared = cleric.spells.filter((s) => s.level > 0 && s.prepared)
  const fewer = {
    ...cleric,
    spells: cleric.spells.map((s) =>
      s === prepared[prepared.length - 1] ? { ...s, prepared: false } : s
    ),
  }
  assert.ok(!codes(fewer).includes('prepared-count'))
  const sorcerer = buildCharacter({
    className: 'Sorcerer',
    subclass: 'Draconic Sorcery',
    toLevel: 9,
  }).character
  const picks = sorcerer.spells.filter((s) => s.level > 0 && !s.featureGranted)
  const forgot = {
    ...sorcerer,
    spells: sorcerer.spells.filter((s) => s !== picks[0]),
  }
  assert.ok(codes(forgot).includes('prepared-count'))
})
