const test = require('node:test')
const assert = require('node:assert')
const { preparedSpellStatus } = require('../rules/5e/preparedStatus')
const { characterSheet } = require('../rules/5e/sheet')
const { auditCharacter } = require('../rules/5e/auditCharacter')

const spell = (name, level, extra = {}) => ({
  name,
  level,
  prepared: true,
  ...extra,
})
const LEVELED = [
  'Bless',
  'Shield of Faith',
  'Cure Wounds',
  'Bane',
  'Guiding Bolt',
  'Healing Word',
  'Sanctuary',
  'Command',
]

// 2024 PHB, Cleric table: Prepared Spells 6 at level 3, 9 at level 5.
const cleric = (level, spells) => ({
  name: 'T',
  classes: [{ name: 'Cleric', level }],
  spells,
  features: [],
})

test('a caster with every prepared spell picked is complete', () => {
  const s = preparedSpellStatus(
    cleric(3, [
      spell('Light', 0),
      ...LEVELED.slice(0, 6).map((n) => spell(n, 1)),
    ])
  )
  assert.deepStrictEqual(s, { have: 6, want: 6, missing: 0, state: 'complete' })
})

test('a caster missing prepared spells is short, and says by how many', () => {
  const s = preparedSpellStatus(
    cleric(
      5,
      LEVELED.slice(0, 6).map((n) => spell(n, 1))
    )
  )
  assert.deepStrictEqual(s, { have: 6, want: 9, missing: 3, state: 'short' })
})

test('spells marked prepared: false do not count; cantrips never count', () => {
  const s = preparedSpellStatus(
    cleric(3, [
      spell('Light', 0),
      spell('Guidance', 0),
      ...LEVELED.slice(0, 6).map((n, i) => spell(n, 1, { prepared: i < 4 })),
    ])
  )
  assert.strictEqual(s.have, 4)
  assert.strictEqual(s.state, 'short')
})

test('too many prepared spells reads as over', () => {
  const s = preparedSpellStatus(
    cleric(
      3,
      LEVELED.map((n) => spell(n, 1))
    )
  )
  assert.strictEqual(s.state, 'over')
  assert.strictEqual(s.missing, 0)
})

test('granted spells (feature, flag) do not count toward the class picks', () => {
  const c = cleric(3, [
    ...LEVELED.slice(0, 5).map((n) => spell(n, 1)),
    spell('Misty Step', 2, { featureGranted: true }),
    spell('Detect Magic', 1), // named by a feature's spells_granted below
  ])
  c.features = [{ name: 'Fey Touched', spells_granted: ['Detect Magic'] }]
  const s = preparedSpellStatus(c)
  assert.strictEqual(s.have, 5)
  assert.strictEqual(s.want, 6)
})

test('a Wizard linked to a spellbook counts the book spells it has prepared', () => {
  const wiz = {
    name: 'W',
    classes: [{ name: 'Wizard', level: 1 }], // 2024 Wizard table: 4 prepared at level 1
    spellbook_id: 'book-1',
    prepared_spells: ['Shield', 'Magic Missile', 'Sleep'],
    features: [],
  }
  const spellbooks = [
    {
      id: 'book-1',
      spells: [
        { name: 'Shield', level: 1 },
        { name: 'Magic Missile', level: 1 },
        { name: 'Sleep', level: 1 },
        { name: 'Mage Armor', level: 1 },
        { name: 'Light', level: 0 },
      ],
    },
  ]
  assert.deepStrictEqual(preparedSpellStatus(wiz, { spellbooks }), {
    have: 3,
    want: 4,
    missing: 1,
    state: 'short',
  })
  // Without the book the count would read 0, so there is no answer rather than a wrong one.
  assert.strictEqual(preparedSpellStatus(wiz, { spellbooks: [] }), null)
})

test('a character who casts no spells has no status', () => {
  assert.strictEqual(
    preparedSpellStatus({
      name: 'F',
      classes: [{ name: 'Fighter', level: 5 }],
      spells: [],
    }),
    null
  )
})

test('a multiclass wants the sum of both class tables', () => {
  const c = {
    name: 'M',
    classes: [
      { name: 'Cleric', level: 3 }, // 6
      { name: 'Wizard', level: 1 }, // 4
    ],
    spells: [],
    features: [],
  }
  assert.strictEqual(preparedSpellStatus(c).want, 10)
})

test('the audit and the status count the same way', () => {
  // A Bard re-chooses only on a level-up, so the audit reports a gap for it (a Cleric's is play).
  const bard = {
    name: 'B',
    ruleset: '2024',
    classes: [{ name: 'Bard', level: 3 }],
    spells: LEVELED.slice(0, 4).map((n) => spell(n, 1)),
    features: [],
  }
  const status = preparedSpellStatus(bard)
  const issue = auditCharacter(bard).find((i) => i.code === 'prepared-count')
  assert.ok(issue, 'the audit reports the gap')
  assert.ok(
    issue.message.startsWith(
      `${status.have} spells prepared, the 2024 class tables give ${status.want}`
    ),
    issue.message
  )
})

// ── Grapple and Shove save DC ──────────────────────────────────────────

const fighter = (str, dex, level = 5) => ({
  name: 'F',
  classes: [{ name: 'Fighter', level }],
  stat_str: str,
  stat_dex: dex,
  stat_con: 10,
  stat_int: 10,
  stat_wis: 10,
  stat_cha: 10,
  features: [],
})

test('Grapple/Shove DC is 8 + Strength modifier + Proficiency Bonus', () => {
  // Fighter 5: proficiency +3, STR 16 is +3.
  const { grappleDC } = characterSheet(fighter(16, 10))
  assert.strictEqual(grappleDC.value, 8 + 3 + 3)
  assert.deepStrictEqual(
    grappleDC.breakdown.map((l) => [l.label, l.amount]),
    [
      ['Base', 8],
      ['STR mod', 3],
      ['Proficiency', 3],
    ]
  )
})

test('Grapple/Shove DC: a non-Monk uses Strength even with a better Dexterity', () => {
  assert.strictEqual(characterSheet(fighter(8, 20)).grappleDC.value, 8 - 1 + 3)
})

test('Grapple/Shove DC rises with the Proficiency Bonus', () => {
  // Level 9 is +4.
  assert.strictEqual(
    characterSheet(fighter(10, 10, 9)).grappleDC.value,
    8 + 0 + 4
  )
})

test('Grapple/Shove DC: a Monk may use Dexterity instead (Dexterous Attacks)', () => {
  const monk = {
    ...fighter(10, 18),
    classes: [{ name: 'Monk', level: 5 }],
    martial_arts_die: 'auto',
  }
  const dc = characterSheet(monk).grappleDC
  assert.strictEqual(dc.value, 8 + 4 + 3)
  assert.ok(dc.breakdown.some((l) => /DEX/.test(l.label)))
  // ...but takes Strength when it is the better one.
  const strong = { ...monk, stat_str: 18, stat_dex: 12 }
  assert.strictEqual(characterSheet(strong).grappleDC.value, 8 + 4 + 3)
  assert.ok(
    characterSheet(strong).grappleDC.breakdown.some((l) => /STR/.test(l.label))
  )
})
