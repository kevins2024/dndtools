const test = require('node:test')
const assert = require('node:assert')
const {
  usesFullClassList,
  normalizeItemSpellGrant,
  getBonusSpells,
  getBonusSpellsAtLevel,
  getCharacterSpells,
  characterHasSpells,
} = require('../rules/5e/characterSpells')
const { listSubclasses } = require('../rules/5e/subclasses')

const subclasses = listSubclasses()
const names = (spells) => spells.map((s) => s.name)

test('normalizeItemSpellGrant: bare string inherits the item action_type', () => {
  const g = normalizeItemSpellGrant('Light', { action_type: 'bonus_action' })
  assert.strictEqual(g.name, 'Light')
  assert.strictEqual(g.actionType, 'bonus_action')
  assert.strictEqual(g.chargeCost, null)
  assert.strictEqual(g.materialComponentRequired, false)
})

test('normalizeItemSpellGrant: object keeps its own cost/uses/choice group', () => {
  const g = normalizeItemSpellGrant(
    {
      name: 'Fly',
      action_type: 'action',
      charge_cost: { min: 1, max: 3 },
      uses_max: 2,
      uses_current: 1,
      recharge: 'long_rest',
      material_component_required: true,
      choice_group: 'bead',
    },
    { action_type: 'bonus_action' }
  )
  assert.deepStrictEqual(g, {
    name: 'Fly',
    actionType: 'action',
    chargeCost: { min: 1, max: 3 },
    usesMax: 2,
    usesCurrent: 1,
    recharge: 'long_rest',
    materialComponentRequired: true,
    choiceGroup: 'bead',
  })
})

test('usesFullClassList: Cleric/Druid/Paladin/Artificer yes; Wizard/Bard no', () => {
  const has = (n) => usesFullClassList({ classes: [{ name: n }] })
  assert.ok(has('Cleric'))
  assert.ok(has('Druid'))
  assert.ok(has('Paladin'))
  assert.ok(has('Artificer'))
  assert.ok(!has('Wizard'))
  assert.ok(!has('Bard'))
  assert.ok(!usesFullClassList(null))
})

test('getBonusSpells: cleric domain spells unlock by CLASS level, gated to the cleric class', () => {
  const lvl3 = {
    classes: [{ name: 'Cleric', subclass: 'Tempest Domain', level: 3 }],
  }
  assert.deepStrictEqual(names(getBonusSpells(lvl3, subclasses)), [
    'Fog Cloud',
    'Thunderwave',
    'Gust of Wind',
    'Shatter',
  ])
  // Same subclass name on a non-cleric class entry yields nothing.
  const wrongClass = {
    classes: [{ name: 'Fighter', subclass: 'Tempest Domain', level: 9 }],
  }
  assert.deepStrictEqual(getBonusSpells(wrongClass, subclasses), [])
  assert.deepStrictEqual(
    getBonusSpells({ classes: [{ name: 'Cleric', level: 5 }] }, subclasses),
    []
  )
})

test('getBonusSpells: artificer expanded list derives spell level from the class level', () => {
  const c = {
    classes: [{ name: 'Artificer', subclass: 'Artillerist', level: 5 }],
  }
  const bonus = getBonusSpells(c, subclasses)
  assert.ok(bonus.length > 0)
  for (const s of bonus) assert.ok(s.level >= 1)
})

test('getBonusSpellsAtLevel: exact-level lookup, class-gated', () => {
  const tempest = subclasses.find((s) => s.name === 'Tempest Domain')
  assert.deepStrictEqual(getBonusSpellsAtLevel(tempest, 'Cleric', 3), [
    'Gust of Wind',
    'Shatter',
  ])
  assert.deepStrictEqual(getBonusSpellsAtLevel(tempest, 'Cleric', 2), [])
  assert.deepStrictEqual(getBonusSpellsAtLevel(tempest, 'Fighter', 3), [])
  assert.deepStrictEqual(getBonusSpellsAtLevel(null, 'Cleric', 3), [])
})

test('getCharacterSpells: class spells, then bonus, then feature grants — deduped by name, first wins', () => {
  const c = {
    name: 'Rev',
    classes: [{ name: 'Cleric', subclass: 'Tempest Domain', level: 1 }],
    spells: [
      { name: 'Bless', level: 1, prepared: true },
      { name: 'Fog Cloud', level: 1, prepared: false },
    ],
    features: [
      { name: 'Fey Touched', spells_granted: ['Misty Step', 'Bless'] },
    ],
  }
  const out = getCharacterSpells(c, [], subclasses)
  assert.deepStrictEqual(names(out), [
    'Bless',
    'Fog Cloud',
    'Thunderwave',
    'Misty Step',
  ])
  // Fog Cloud was already a class spell, so the bonus-spell copy is dropped.
  assert.strictEqual(out.find((s) => s.name === 'Fog Cloud').prepared, false)
  assert.strictEqual(out.find((s) => s.name === 'Thunderwave').bonusSpell, true)
  const misty = out.find((s) => s.name === 'Misty Step')
  assert.strictEqual(misty.featureGranted, true)
  assert.strictEqual(misty._source, 'Fey Touched')
})

test('getCharacterSpells: shared Wizard spellbook, prepared comes from the character, not the book', () => {
  const book = {
    id: 'sb1',
    spells: [
      { name: 'Shield', level: 1 },
      { name: 'Fireball', level: 3 },
    ],
  }
  const a = {
    name: 'A',
    spellbook_id: 'sb1',
    prepared_spells: ['Shield'],
    classes: [],
  }
  const b = {
    name: 'B',
    spellbook_id: 'sb1',
    prepared_spells: ['Fireball'],
    classes: [],
  }
  const outA = getCharacterSpells(a, [], [], [book])
  const outB = getCharacterSpells(b, [], [], [book])
  assert.deepStrictEqual(
    outA.map((s) => [s.name, s.prepared]),
    [
      ['Shield', true],
      ['Fireball', false],
    ]
  )
  assert.deepStrictEqual(
    outB.map((s) => [s.name, s.prepared]),
    [
      ['Shield', false],
      ['Fireball', true],
    ]
  )
})

test('getCharacterSpells: item grants need equipping (and attunement) and are NOT deduped against class spells', () => {
  const c = { name: 'Zed', classes: [], spells: [{ name: 'Shield', level: 1 }] }
  const items = [
    { id: 'i1', name: 'Ring', equipped_by: 'Zed', spells_granted: ['Shield'] },
    {
      id: 'i2',
      name: 'Cloak',
      equipped_by: 'Zed',
      needs_attunement: true,
      attuned: false,
      spells_granted: ['Fly'],
    },
    {
      id: 'i3',
      name: 'Staff',
      equipped_by: 'Zed',
      needs_attunement: true,
      attuned: true,
      spells_granted: [{ name: 'Fireball', charge_cost: 3 }],
    },
    {
      id: 'i4',
      name: 'Wand',
      equipped_by: 'Someone Else',
      spells_granted: ['Light'],
    },
  ]
  const out = getCharacterSpells(c, items)
  assert.deepStrictEqual(names(out), ['Shield', 'Shield', 'Fireball'])
  assert.strictEqual(out[1].itemGranted, true)
  assert.strictEqual(out[1]._source, 'Ring')
  assert.strictEqual(out[2].grant.chargeCost, 3)
})

test('characterHasSpells: every source counts, nothing else does', () => {
  assert.ok(!characterHasSpells(null))
  assert.ok(
    !characterHasSpells({ name: 'F', classes: [{ name: 'Fighter', level: 3 }] })
  )
  assert.ok(characterHasSpells({ spellbook_id: 'x' }))
  assert.ok(characterHasSpells({ spells: [{ name: 'Light' }] }))
  assert.ok(characterHasSpells({ features: [{ spells_granted: ['Light'] }] }))
  assert.ok(
    characterHasSpells(
      { classes: [{ name: 'Cleric', subclass: 'Tempest Domain', level: 1 }] },
      [],
      subclasses
    )
  )
  assert.ok(
    characterHasSpells({ name: 'Z' }, [
      { equipped_by: 'Z', spells_granted: ['Light'] },
    ])
  )
  assert.ok(
    !characterHasSpells({ name: 'Z' }, [
      {
        equipped_by: 'Z',
        needs_attunement: true,
        attuned: false,
        spells_granted: ['Light'],
      },
    ])
  )
})
