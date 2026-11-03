// The 2024 class and subclass FEATURES as the book prints them: names by level, subclass levels,
// always-prepared subclass spells, the third-caster tables, and how many picks each feature grants.
// Written out here independently of the engine's data files (see bookTables2024.test.js for the
// numeric class tables), so a wrong level or a missing feature in `data/5e2024/` fails a test
// instead of agreeing with itself.
//
// Sources, read 2026-11-02:
//  - D&D Beyond Basic Rules (2024), "Character Classes", the Features table and level headings of
//    every class, plus the 12 subclasses the Basic Rules include.
//  - dnd2024.wikidot.com (Player's Handbook pages): Evoker, Eldritch Knight, Arcane Trickster,
//    Battle Master. The Eldritch Knight table read cleanly on a second request (columns: level,
//    prepared, 1st-4th; no cantrip column, so cantrips come from the text: 2, 3 at level 10).
// Both were read through a page summarizer. If one of these fails, re-read the page before changing
// either side. Rows the book shows as "Ability Score Improvement", "Epic Boon" or "Subclass feature"
// are covered by bookTables2024.test.js (ASI levels) and by the subclass checks below.
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadClass } = require('../rules/5e/classFeatures')
const { loadSubclass } = require('../rules/5e/subclasses')
const {
  cantripsKnownForClass,
  preparedSpellCount,
  spellSlotsForClassAtLevel,
} = require('../rules/5e/spellcasting')
const { buildCharacter } = require('./helpers/autoLevel')

const RS = '2024'
// Curly apostrophes and hyphens are typography, not a different name.
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const byLevel = (map) =>
  Object.fromEntries(
    Object.entries(map)
      .map(([lvl, names]) => [lvl, names.map(norm).sort()])
      .sort((a, b) => Number(a[0]) - Number(b[0]))
  )

// ── class features, by level (the book's "Class Features" column) ────────

const CLASS_FEATURES = {
  Barbarian: {
    1: ['Rage', 'Unarmored Defense', 'Weapon Mastery'],
    2: ['Danger Sense', 'Reckless Attack'],
    3: ['Primal Knowledge'],
    5: ['Extra Attack', 'Fast Movement'],
    7: ['Feral Instinct', 'Instinctive Pounce'],
    9: ['Brutal Strike'],
    11: ['Relentless Rage'],
    13: ['Improved Brutal Strike'],
    15: ['Persistent Rage'],
    17: ['Improved Brutal Strike'],
    18: ['Indomitable Might'],
    20: ['Primal Champion'],
  },
  Bard: {
    1: ['Bardic Inspiration', 'Spellcasting'],
    2: ['Expertise', 'Jack of All Trades'],
    5: ['Font of Inspiration'],
    7: ['Countercharm'],
    9: ['Expertise'],
    10: ['Magical Secrets'],
    18: ['Superior Inspiration'],
    20: ['Words of Creation'],
  },
  Cleric: {
    1: ['Spellcasting', 'Divine Order'],
    2: ['Channel Divinity'],
    5: ['Sear Undead'],
    7: ['Blessed Strikes'],
    10: ['Divine Intervention'],
    14: ['Improved Blessed Strikes'],
    20: ['Greater Divine Intervention'],
  },
  Druid: {
    1: ['Spellcasting', 'Druidic', 'Primal Order'],
    2: ['Wild Shape', 'Wild Companion'],
    5: ['Wild Resurgence'],
    7: ['Elemental Fury'],
    15: ['Improved Elemental Fury'],
    18: ['Beast Spells'],
    20: ['Archdruid'],
  },
  Fighter: {
    1: ['Fighting Style', 'Second Wind', 'Weapon Mastery'],
    2: ['Action Surge (One Use)', 'Tactical Mind'],
    5: ['Extra Attack', 'Tactical Shift'],
    9: ['Indomitable (One Use)', 'Tactical Master'],
    11: ['Two Extra Attacks'],
    13: ['Indomitable (Two Uses)', 'Studied Attacks'],
    17: ['Action Surge (Two Uses)', 'Indomitable (Three Uses)'],
    20: ['Three Extra Attacks'],
  },
  Monk: {
    1: ['Martial Arts', 'Unarmored Defense'],
    2: ["Monk's Focus", 'Unarmored Movement', 'Uncanny Metabolism'],
    3: ['Deflect Attacks'],
    4: ['Slow Fall'],
    5: ['Extra Attack', 'Stunning Strike'],
    6: ['Empowered Strikes'],
    7: ['Evasion'],
    9: ['Acrobatic Movement'],
    10: ['Heightened Focus', 'Self-Restoration'],
    13: ['Deflect Energy'],
    14: ['Disciplined Survivor'],
    15: ['Perfect Focus'],
    18: ['Superior Defense'],
    20: ['Body and Mind'],
  },
  Paladin: {
    1: ['Lay On Hands', 'Spellcasting', 'Weapon Mastery'],
    2: ['Fighting Style', "Paladin's Smite"],
    3: ['Channel Divinity'],
    5: ['Extra Attack', 'Faithful Steed'],
    6: ['Aura of Protection'],
    9: ['Abjure Foes'],
    10: ['Aura of Courage'],
    11: ['Radiant Strikes'],
    14: ['Restoring Touch'],
    18: ['Aura Expansion'],
  },
  Ranger: {
    1: ['Spellcasting', 'Favored Enemy', 'Weapon Mastery'],
    2: ['Deft Explorer', 'Fighting Style'],
    5: ['Extra Attack'],
    6: ['Roving'],
    9: ['Expertise'],
    10: ['Tireless'],
    13: ['Relentless Hunter'],
    14: ["Nature's Veil"],
    17: ['Precise Hunter'],
    18: ['Feral Senses'],
    20: ['Foe Slayer'],
  },
  Rogue: {
    1: ['Expertise', 'Sneak Attack', "Thieves' Cant", 'Weapon Mastery'],
    2: ['Cunning Action'],
    3: ['Steady Aim'],
    5: ['Cunning Strike', 'Uncanny Dodge'],
    6: ['Expertise'],
    7: ['Evasion', 'Reliable Talent'],
    11: ['Improved Cunning Strike'],
    14: ['Devious Strikes'],
    15: ['Slippery Mind'],
    18: ['Elusive'],
    20: ['Stroke of Luck'],
  },
  Sorcerer: {
    1: ['Spellcasting', 'Innate Sorcery'],
    2: ['Font of Magic', 'Metamagic'],
    5: ['Sorcerous Restoration'],
    7: ['Sorcery Incarnate'],
    10: ['Metamagic'],
    17: ['Metamagic'],
    20: ['Arcane Apotheosis'],
  },
  Warlock: {
    1: ['Eldritch Invocations', 'Pact Magic'],
    2: ['Magical Cunning'],
    9: ['Contact Patron'],
    11: ['Mystic Arcanum (Level 6 Spell)'],
    13: ['Mystic Arcanum (Level 7 Spell)'],
    15: ['Mystic Arcanum (Level 8 Spell)'],
    17: ['Mystic Arcanum (Level 9 Spell)'],
    20: ['Eldritch Master'],
  },
  Wizard: {
    1: ['Spellcasting', 'Ritual Adept', 'Arcane Recovery'],
    2: ['Scholar'],
    5: ['Memorize Spell'],
    18: ['Spell Mastery'],
    20: ['Signature Spells'],
  },
}

for (const [name, expected] of Object.entries(CLASS_FEATURES)) {
  test(`${name}: the class features by level are the book's`, () => {
    assert.deepEqual(
      byLevel(loadClass(name, RS).features_by_level),
      byLevel(expected)
    )
  })
}

// The levels at which each class gets subclass features (the "Subclass feature" rows, with the
// level 3 "<Class> Subclass" row itself first).
const SUBCLASS_LEVELS = {
  Barbarian: [3, 6, 10, 14],
  Bard: [3, 6, 14],
  Cleric: [3, 6, 17],
  Druid: [3, 6, 10, 14],
  Fighter: [3, 7, 10, 15, 18],
  Monk: [3, 6, 11, 17],
  Paladin: [3, 7, 15, 20],
  Ranger: [3, 7, 11, 15],
  Rogue: [3, 9, 13, 17],
  Sorcerer: [3, 6, 14, 18],
  Warlock: [3, 6, 10, 14],
  Wizard: [3, 6, 10, 14],
}

for (const [name, levels] of Object.entries(SUBCLASS_LEVELS)) {
  test(`${name}: the subclass is chosen at level 3 and features arrive at ${levels.join(
    ', '
  )}`, () => {
    const c = loadClass(name, RS)
    assert.equal(c.subclass_choice_level, 3)
    assert.deepEqual(c.subclass_feature_levels, levels)
  })
}

// ── the subclasses the Basic Rules print (one per class) ─────────────────

const SUBCLASSES = {
  'Barbarian/Path of the Berserker': {
    3: ['Frenzy'],
    6: ['Mindless Rage'],
    10: ['Retaliation'],
    14: ['Intimidating Presence'],
  },
  'Bard/College of Lore': {
    3: ['Bonus Proficiencies', 'Cutting Words'],
    6: ['Magical Discoveries'],
    14: ['Peerless Skill'],
  },
  'Cleric/Life Domain': {
    3: ['Disciple of Life', 'Life Domain Spells', 'Preserve Life'],
    6: ['Blessed Healer'],
    17: ['Supreme Healing'],
  },
  'Druid/Circle of the Land': {
    3: ['Circle of the Land Spells', "Land's Aid"],
    6: ['Natural Recovery'],
    10: ["Nature's Ward"],
    14: ["Nature's Sanctuary"],
  },
  'Fighter/Champion': {
    3: ['Improved Critical', 'Remarkable Athlete'],
    7: ['Additional Fighting Style'],
    10: ['Heroic Warrior'],
    15: ['Superior Critical'],
    18: ['Survivor'],
  },
  'Fighter/Battle Master': {
    3: ['Combat Superiority', 'Student of War'],
    7: ['Know Your Enemy'],
    10: ['Improved Combat Superiority'],
    15: ['Relentless'],
    18: ['Ultimate Combat Superiority'],
  },
  'Monk/Warrior of the Open Hand': {
    3: ['Open Hand Technique'],
    6: ['Wholeness of Body'],
    11: ['Fleet Step'],
    17: ['Quivering Palm'],
  },
  'Paladin/Oath of Devotion': {
    3: ['Oath of Devotion Spells', 'Sacred Weapon'],
    7: ['Aura of Devotion'],
    15: ['Smite of Protection'],
    20: ['Holy Nimbus'],
  },
  'Ranger/Hunter': {
    3: ["Hunter's Lore", "Hunter's Prey"],
    7: ['Defensive Tactics'],
    11: ["Superior Hunter's Prey"],
    15: ["Superior Hunter's Defense"],
  },
  'Rogue/Thief': {
    3: ['Fast Hands', 'Second-Story Work'],
    9: ['Supreme Sneak'],
    13: ['Use Magic Device'],
    17: ["Thief's Reflexes"],
  },
  'Rogue/Arcane Trickster': {
    3: ['Spellcasting', 'Mage Hand Legerdemain'],
    9: ['Magical Ambush'],
    13: ['Versatile Trickster'],
    17: ['Spell Thief'],
  },
  'Fighter/Eldritch Knight': {
    3: ['Spellcasting', 'War Bond'],
    7: ['War Magic'],
    10: ['Eldritch Strike'],
    15: ['Arcane Charge'],
    18: ['Improved War Magic'],
  },
  'Sorcerer/Draconic Sorcery': {
    3: ['Draconic Resilience', 'Draconic Spells'],
    6: ['Elemental Affinity'],
    14: ['Dragon Wings'],
    18: ['Dragon Companion'],
  },
  'Warlock/Fiend Patron': {
    3: ["Dark One's Blessing", 'Fiend Spells'],
    6: ["Dark One's Own Luck"],
    10: ['Fiendish Resilience'],
    14: ['Hurl Through Hell'],
  },
  'Wizard/Evoker': {
    3: ['Evocation Savant', 'Potent Cantrip'],
    6: ['Sculpt Spells'],
    10: ['Empowered Evocation'],
    14: ['Overchannel'],
  },
}

for (const [key, expected] of Object.entries(SUBCLASSES)) {
  const [className, subclass] = key.split('/')
  test(`${subclass} (${className}): features by level are the book's`, () => {
    const data = loadSubclass(className, subclass, RS)
    assert.ok(data, `${subclass} not found`)
    assert.deepEqual(byLevel(data.features_by_level), byLevel(expected))
  })
}

// The subclass's own feature levels are the class's "Subclass feature" levels (a feature only
// ever arrives on one of them).
test('every subclass feature the engine lists falls on a level the class table allows', () => {
  for (const key of Object.keys(SUBCLASSES)) {
    const [className, subclass] = key.split('/')
    const allowed = new Set(loadClass(className, RS).subclass_feature_levels)
    for (const lvl of Object.keys(
      loadSubclass(className, subclass, RS).features_by_level
    ))
      assert.ok(
        allowed.has(Number(lvl)),
        `${subclass} has a level ${lvl} feature`
      )
  }
})

// ── always-prepared subclass spells ──────────────────────────────────────

const SUBCLASS_SPELLS = [
  [
    'Cleric',
    'Life Domain',
    'domain_spells_by_level',
    {
      3: ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'],
      5: ['Mass Healing Word', 'Revivify'],
      7: ['Aura of Life', 'Death Ward'],
      9: ['Greater Restoration', 'Mass Cure Wounds'],
    },
  ],
  [
    'Paladin',
    'Oath of Devotion',
    'oath_spells_by_level',
    {
      3: ['Protection from Evil and Good', 'Shield of Faith'],
      5: ['Aid', 'Zone of Truth'],
      9: ['Beacon of Hope', 'Dispel Magic'],
      13: ['Freedom of Movement', 'Guardian of Faith'],
      17: ['Commune', 'Flame Strike'],
    },
  ],
  [
    'Sorcerer',
    'Draconic Sorcery',
    'bonus_spells_by_level',
    {
      3: ['Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"],
      5: ['Fear', 'Fly'],
      7: ['Arcane Eye', 'Charm Monster'],
      9: ['Legend Lore', 'Summon Dragon'],
    },
  ],
  [
    'Warlock',
    'Fiend Patron',
    'patron_spells_by_level',
    {
      3: ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'],
      5: ['Fireball', 'Stinking Cloud'],
      7: ['Fire Shield', 'Wall of Fire'],
      9: ['Geas', 'Insect Plague'],
    },
  ],
]

for (const [className, subclass, field, expected] of SUBCLASS_SPELLS) {
  test(`${subclass}: the always-prepared spells by level are the book's`, () => {
    assert.deepEqual(
      byLevel(loadSubclass(className, subclass, RS)[field]),
      byLevel(expected)
    )
  })
}

test("Circle of the Land: the spells for each land are the book's", () => {
  const expected = {
    Arid: {
      3: ['Blur', 'Burning Hands', 'Fire Bolt'],
      5: ['Fireball'],
      7: ['Blight'],
      9: ['Wall of Stone'],
    },
    Polar: {
      3: ['Fog Cloud', 'Hold Person', 'Ray of Frost'],
      5: ['Sleet Storm'],
      7: ['Ice Storm'],
      9: ['Cone of Cold'],
    },
    Temperate: {
      3: ['Misty Step', 'Shocking Grasp', 'Sleep'],
      5: ['Lightning Bolt'],
      7: ['Freedom of Movement'],
      9: ['Tree Stride'],
    },
    Tropical: {
      3: ['Acid Splash', 'Ray of Sickness', 'Web'],
      5: ['Stinking Cloud'],
      7: ['Polymorph'],
      9: ['Insect Plague'],
    },
  }
  const got = loadSubclass(
    'Druid',
    'Circle of the Land',
    RS
  ).land_spells_by_type
  assert.deepEqual(Object.keys(got).sort(), Object.keys(expected).sort())
  for (const land of Object.keys(expected))
    assert.deepEqual(byLevel(got[land]), byLevel(expected[land]), land)
})

// ── Eldritch Knight and Arcane Trickster (third casters) ─────────────────

// Fighter / Rogue level 3..20. Both use the same slots and prepared-spell counts; only the cantrips
// differ (Eldritch Knight 2, Arcane Trickster 3, one more of each at level 10).
const THIRD_CASTER = {
  prepared: [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  slots: [
    [2],
    [3],
    [3],
    [3],
    [4, 2],
    [4, 2],
    [4, 2],
    [4, 3],
    [4, 3],
    [4, 3],
    [4, 3, 2],
    [4, 3, 2],
    [4, 3, 2],
    [4, 3, 3],
    [4, 3, 3],
    [4, 3, 3],
    [4, 3, 3, 1],
    [4, 3, 3, 1],
  ],
}
const THIRD_CASTERS = [
  ['Fighter', 'Eldritch Knight', 2],
  ['Rogue', 'Arcane Trickster', 3],
]
const LEVELS_3_TO_20 = Array.from({ length: 18 }, (_, i) => i + 3)

for (const [className, subclass, baseCantrips] of THIRD_CASTERS) {
  test(`${subclass}: cantrips, prepared spells and slots by level are the book's`, () => {
    assert.deepEqual(
      LEVELS_3_TO_20.map((l) =>
        cantripsKnownForClass(className, l, subclass, RS)
      ),
      LEVELS_3_TO_20.map((l) => baseCantrips + (l >= 10 ? 1 : 0))
    )
    assert.deepEqual(
      LEVELS_3_TO_20.map((l) =>
        preparedSpellCount(className, l, 0, subclass, RS)
      ),
      THIRD_CASTER.prepared
    )
    assert.deepEqual(
      LEVELS_3_TO_20.map((l) =>
        spellSlotsForClassAtLevel(className, l, subclass, RS)
      ),
      THIRD_CASTER.slots
    )
  })
}

// ── how many picks each feature grants (played through the level-up tool) ─

// A simulated character, levelled through the real tool. Features record the level they came at.
const picksAt = (character, type) => {
  const out = {}
  for (const f of character.features)
    if (f.type === type) out[f.level_gained] = (out[f.level_gained] || 0) + 1
  return out
}

test('Battle Master learns 3 maneuvers at 3, then 2 more at 7, 10 and 15 (3, 5, 7, 9 known)', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Battle Master',
    toLevel: 20,
  })
  assert.deepEqual(picksAt(character, 'maneuver'), { 3: 3, 7: 2, 10: 2, 15: 2 })
})

test('Sorcerer learns 2 Metamagic options at 2, then 2 more at 10 and at 17 (2, 4, 6 known)', () => {
  const { character } = buildCharacter({
    className: 'Sorcerer',
    subclass: 'Draconic Sorcery',
    toLevel: 20,
  })
  assert.deepEqual(picksAt(character, 'metamagic'), { 2: 2, 10: 2, 17: 2 })
})

// Expertise: Rogue 2 at 1 and 2 at 6; Bard 2 at 2 and 2 at 9; Ranger 1 (Deft Explorer) at 2 and
// 2 at 9; Wizard 1 (Scholar) at 2.
const EXPERTISE_PICKS = [
  ['Rogue', 'Thief', { 1: 2, 6: 2 }],
  ['Bard', 'College of Lore', { 2: 2, 9: 2 }],
  ['Ranger', 'Hunter', { 2: 1, 9: 2 }],
  ['Wizard', 'Evoker', { 2: 1 }],
]
for (const [className, subclass, expected] of EXPERTISE_PICKS) {
  test(`${className}: Expertise picks by level are the book's`, () => {
    const { character } = buildCharacter({
      className,
      subclass,
      toLevel: 20,
    })
    const got = {}
    for (const f of character.features)
      if (f.type === 'expertise')
        got[f.level_gained] = f.name
          .replace(/^Expertise: /, '')
          .split(', ').length
    assert.deepEqual(got, expected)
    assert.equal(
      character.skill_expertise.length,
      Object.values(expected).reduce((a, b) => a + b, 0)
    )
  })
}

// ── spells a feat or species grants never count against the class ────────
//
// Basic Rules (2024), "Spells": "a spell that you always have prepared doesn't count against the
// number of spells on that list." Magic Initiate / Fey Touched / Elven Lineage give a spell that
// is always prepared (or a cantrip learned by the feat), so none of them is one of the class's
// cantrips known or spells prepared.
test('spells granted by a feat or species are not counted against the class tables', () => {
  const { previewLevelUp } = require('../rules/5e/choiceProtocol')
  const { auditCharacter } = require('../rules/5e/auditCharacter')
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 3,
  })
  const grant = (name, level, source) => ({
    name,
    level,
    prepared: true,
    featureGranted: true,
    _source: source,
  })
  const withFeats = {
    ...character,
    spells: [
      ...character.spells,
      grant('Guidance', 0, 'Magic Initiate'),
      grant('Druidcraft', 0, 'Magic Initiate'),
      grant('Cure Wounds', 1, 'Magic Initiate'),
      grant('Misty Step', 2, 'Fey Touched'),
      grant('Command', 1, 'Fey Touched'),
    ],
  }
  const counts = (c) =>
    previewLevelUp(c, { className: 'Wizard', toLevel: 4, hpMethod: 'average' })
      .choices.filter((x) => /Cantrip|Spell/i.test(x.type))
      .map((x) => [x.type, x.min, x.max])
  assert.ok(
    counts(character).some(([type]) => type === 'newCantrips'),
    'level 4 asks for a cantrip'
  )
  assert.deepEqual(counts(withFeats), counts(character))
  const flagged = (c) =>
    auditCharacter(c)
      .filter((i) => /cantrip|known|prepared/.test(i.code))
      .map((i) => i.code)
  assert.deepEqual(flagged(withFeats), flagged(character))
})

// ── Artificer (Eberron: Forge of the Artificer) ──────────────────────────
//
// Not in the Player's Handbook or the Basic Rules, so there is ONE source: dnd2024.wikidot.com
// `artificer:main`, read 2026-11-02 through a page summarizer. The numbers follow the usual
// half-caster shape (same slots as the Paladin and Ranger), which is a second, indirect check.
test("Artificer: features, subclass levels and the table columns are the book's", () => {
  const {
    proficiencyBonus,
    hitDieForClass,
    asiLevelsForClass,
  } = require('../rules/5e/progression')
  const c = loadClass('Artificer', RS)
  assert.deepEqual(
    byLevel(c.features_by_level),
    byLevel({
      1: ['Spellcasting', "Tinker's Magic"],
      2: ['Replicate Magic Item'],
      6: ['Magic Item Tinker'],
      7: ['Flash of Genius'],
      10: ['Magic Item Adept'],
      11: ['Spell-Storing Item'],
      14: ['Advanced Artifice'],
      18: ['Magic Item Master'],
      20: ['Soul of Artifice'],
    })
  )
  assert.equal(c.subclass_choice_level, 3)
  assert.deepEqual(c.subclass_feature_levels, [3, 5, 9, 15])
  assert.equal(hitDieForClass('Artificer', RS), 8)
  assert.deepEqual(c.saving_throw_proficiencies.sort(), ['con', 'int'])
  assert.deepEqual(c.armor_proficiencies, ['light', 'medium', 'shields'])
  assert.deepEqual(c.weapon_proficiencies, ['simple'])
  assert.equal(c.skill_choices.count, 2)
  assert.deepEqual(c.skill_choices.options.sort(), [
    'arcana',
    'history',
    'investigation',
    'medicine',
    'nature',
    'perception',
    'sleight_of_hand',
  ])
  assert.deepEqual(asiLevelsForClass('Artificer', RS), [4, 8, 12, 16, 19])

  const L = Array.from({ length: 20 }, (_, i) => i + 1)
  const col = (field) =>
    L.map((l) => {
      let v
      for (const [k, val] of Object.entries(c[field]))
        if (Number(k) <= l) v = val
      return v === '-' ? 0 : v
    })
  assert.deepEqual(
    col('plans_known_by_level'),
    [0, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8]
  )
  assert.deepEqual(
    col('magic_items_by_level'),
    [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6]
  )
  assert.deepEqual(
    L.map((l) => cantripsKnownForClass('Artificer', l, null, RS)),
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4]
  )
  assert.deepEqual(
    L.map((l) => preparedSpellCount('Artificer', l, 0, null, RS)),
    [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]
  )
  assert.deepEqual(
    L.map((l) => spellSlotsForClassAtLevel('Artificer', l, null, RS)),
    [
      [2],
      [2],
      [3],
      [3],
      [4, 2],
      [4, 2],
      [4, 3],
      [4, 3],
      [4, 3, 2],
      [4, 3, 2],
      [4, 3, 3],
      [4, 3, 3],
      [4, 3, 3, 1],
      [4, 3, 3, 1],
      [4, 3, 3, 2],
      [4, 3, 3, 2],
      [4, 3, 3, 3, 1],
      [4, 3, 3, 3, 1],
      [4, 3, 3, 3, 2],
      [4, 3, 3, 3, 2],
    ]
  )
  assert.deepEqual(
    L.map(proficiencyBonus),
    [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]
  )
})

test("Artificer: the multiclass proficiencies are the book's (Tinker's Tools, one class skill, Light and Medium armor and Shields)", () => {
  const mc = require('../data/5e2024/multiclass-proficiencies.json').Artificer
  assert.deepEqual(mc.armor, ['light', 'medium', 'shields'])
  assert.deepEqual(mc.tools, ["tinker's tools"])
  assert.equal(mc.skills.choose, 1)
  assert.deepEqual(mc.weapons, [])
})

test("Artificer: the six subclasses are the book's", () => {
  const { listSubclasses } = require('../rules/5e/subclasses')
  const names = listSubclasses(RS)
    .filter((s) => s.class === 'Artificer' && s.ruleset === RS)
    .map((s) => s.name)
    .sort()
  assert.deepEqual(names, [
    'Alchemist',
    'Armorer',
    'Artillerist',
    'Battle Smith',
    'Cartographer',
    'Reanimator',
  ])
})
