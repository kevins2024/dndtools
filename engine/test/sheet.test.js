// The character sheet's calculated numbers and the lines that explain them.
// Every expected number below was worked out by hand from the rules text (the
// arithmetic is in the comments), not copied from the engine's output.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  characterSheet,
  formatBreakdown,
  eachLeaf,
} = require('../rules/5e/sheet')
const { hydrateCharacter } = require('../rules/5e/derive')

const sum = (b) => b.reduce((n, l) => n + l.amount, 0)
const line = (leafObj, text) =>
  leafObj.breakdown.find((l) => l.label.includes(text))

// Human Fighter (Champion) 5, 2024 rules.
//   base 15/13/14/8/12/10; background +2 STR +1 CON; ASI at 4: +2 STR
//   => STR 19 (+4)  DEX 13 (+1)  CON 15 (+2)  INT 8 (-1)  WIS 12 (+1)  CHA 10 (+0)
//   hit dice recorded 10 + 7 + 4 + 9 + 6 = 36;  max HP = 36 + 2 x 5 = 46
//   proficiency bonus at level 5 = +3
const fighter = (over = {}) => ({
  name: 'Test Fighter',
  ruleset: '2024',
  genus: 'Human',
  level: 5,
  classes: [{ name: 'Fighter', subclass: 'Champion', level: 5, started: true }],
  ability_base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
  ability_score_history: [
    { ability: 'str', amount: 2, source: 'Background' },
    { ability: 'con', amount: 1, source: 'Background' },
    {
      ability: 'str',
      amount: 2,
      source: 'Ability Score Improvement',
      level_gained: 4,
      class: 'Fighter',
    },
  ],
  level_history: [10, 7, 4, 9, 6].map((die, i) => ({
    kind: 'level',
    class: 'Fighter',
    level: i + 1,
    hp: { die },
  })),
  features: [],
  saving_throws: ['str', 'con'],
  skill_proficiencies: ['Athletics', 'Perception'],
  skill_expertise: [],
  hp_current: 46,
  ...over,
})
const chainMail = {
  name: 'Chain Mail',
  type: 'armor',
  slot: 'body',
  armor_type: 'chain mail',
} // base 16, heavy: no DEX
const shield = {
  name: 'Shield',
  type: 'armor',
  slot: 'off_hand',
  armor_type: 'shield',
} // +2
const amulet = { name: 'Amulet of Health', stat_overrides: { con: 19 } }

test('ability scores are the base plus every recorded change, and the modifier follows', () => {
  const s = characterSheet(fighter())
  const scores = Object.fromEntries(
    Object.entries(s.abilities).map(([k, v]) => [k, v.score.value])
  )
  assert.deepEqual(scores, {
    str: 19,
    dex: 13,
    con: 15,
    int: 8,
    wis: 12,
    cha: 10,
  })
  const mods = Object.fromEntries(
    Object.entries(s.abilities).map(([k, v]) => [k, v.modifier.value])
  )
  assert.deepEqual(mods, { str: 4, dex: 1, con: 2, int: -1, wis: 1, cha: 0 })
  assert.deepEqual(
    s.abilities.str.score.breakdown.map((l) => [l.label, l.amount]),
    [
      ['Base score', 15],
      ['Background', 2],
      ['Ability Score Improvement, level 4', 2],
    ]
  )
})

test('maximum HP = recorded hit dice + CON modifier x levels (46)', () => {
  const s = characterSheet(fighter())
  assert.equal(s.hp.max.value, 46)
  assert.equal(
    s.hp.max.tooltip,
    'Hit dice rolled or averaged (+36)\nCON modifier +2 x 5 levels (+10)\n= 46'
  )
  assert.equal(s.hp.hitDice.total, 5)
  assert.equal(s.hp.hitDice.tooltip, '5d10')
})

test('RAW: an item that sets Constitution changes max HP at once and retroactively, and taking it off takes it away', () => {
  // Amulet of Health sets CON 19 (+4): 36 dice + 4 x 5 = 56, not 46 + something at "equip time"
  const worn = characterSheet(fighter(), { equippedItems: [amulet] })
  assert.equal(worn.hp.max.value, 56)
  assert.equal(worn.abilities.con.score.value, 19)
  assert.deepEqual(
    worn.abilities.con.score.breakdown.map((l) => l.amount),
    [14, 1, 4]
  ) // 14 base + 1 background + 4 to reach 19
  assert.match(
    worn.hp.max.tooltip,
    /Amulet of Health: CON 15 -> 19 \(modifier \+2 x 5 levels\) \(\+10\)/
  )
  const removed = characterSheet(fighter())
  assert.equal(removed.hp.max.value, 46)
  // already 19 or higher: no effect (RAW)
  const strong = characterSheet(
    fighter({
      ability_base: { str: 15, dex: 13, con: 19, int: 8, wis: 12, cha: 10 },
    }),
    { equippedItems: [amulet] }
  )
  // base 19 + 1 background = CON 20 (+5): the amulet changes nothing
  assert.equal(strong.abilities.con.score.value, 20)
  assert.equal(strong.hp.max.value, 36 + 5 * 5)
})

test('Tough adds 2 HP per level; Draconic Resilience adds 1 per Sorcerer level; Dwarven Toughness 1 per level', () => {
  assert.equal(
    characterSheet(fighter({ features: [{ name: 'Tough', type: 'feat' }] })).hp
      .max.value,
    46 + 2 * 5
  )
  const sorc = fighter({
    classes: [{ name: 'Sorcerer', level: 5, started: true }],
    features: [{ name: 'Draconic Resilience' }],
    level_history: [6, 3, 4, 5, 2].map((die, i) => ({
      kind: 'level',
      class: 'Sorcerer',
      level: i + 1,
      hp: { die },
    })),
  })
  // dice 20 + CON(+2) x 5 + Draconic 5 = 35
  assert.equal(characterSheet(sorc).hp.max.value, 35)
  const dwarf = characterSheet(fighter({ genus: 'Dwarf' }))
  assert.equal(dwarf.hp.max.value, 46 + 5)
})

test('hp_max_modifier and 2014 Exhaustion change the effective maximum, not the maximum', () => {
  const s = characterSheet(fighter({ hp_max_modifier: 5 }))
  assert.equal(s.hp.max.value, 46)
  assert.equal(s.hp.effectiveMax.value, 51)
  const tired = characterSheet(
    fighter({ ruleset: '2014', exhaustion_level: 4 })
  )
  assert.equal(tired.hp.effectiveMax.value, 23) // 2014 level 4: maximum halved
  assert.equal(sum(tired.hp.effectiveMax.breakdown), 23)
})

test('proficiency bonus comes from the level, whatever number is stored', () => {
  assert.equal(
    characterSheet(fighter({ proficiency_bonus: 6 })).proficiencyBonus.value,
    3
  )
  assert.equal(
    characterSheet(fighter({ proficiency_bonus_override: 6 })).proficiencyBonus
      .value,
    6
  )
  assert.equal(
    characterSheet(
      fighter({ classes: [{ name: 'Fighter', level: 9, started: true }] })
    ).proficiencyBonus.value,
    4
  )
})

test('armor class, saving throws, skills, initiative and passive Perception', () => {
  const s = characterSheet(fighter(), { equippedItems: [chainMail, shield] })
  assert.equal(s.ac.value, 18) // chain mail 16 (heavy: no DEX) + shield 2
  assert.equal(s.savingThrows.str.value, 4 + 3) // proficient
  assert.equal(s.savingThrows.dex.value, 1) // not proficient
  assert.equal(s.savingThrows.con.value, 2 + 3)
  assert.equal(s.skills.Athletics.value, 4 + 3)
  assert.equal(s.skills.Stealth.value, 1) // DEX only
  assert.equal(s.initiative.value, 1)
  assert.equal(s.passivePerception.value, 10 + 1 + 3) // WIS +1, proficient +3
})

test('initiative: 2024 Alert adds the proficiency bonus, 2014 Alert +5, Jack of All Trades half, Dread Ambusher WIS', () => {
  assert.equal(
    characterSheet(fighter({ features: [{ name: 'Alert', type: 'feat' }] }))
      .initiative.value,
    1 + 3
  )
  const old = characterSheet(
    fighter({
      ruleset: '2014',
      features: [
        { name: 'Alert', type: 'feat', stat_bonuses: { initiative: 5 } },
      ],
    })
  )
  assert.equal(old.initiative.value, 1 + 5)
  assert.equal(
    characterSheet(fighter({ features: [{ name: 'Jack of All Trades' }] }))
      .initiative.value,
    1 + 1
  ) // half of +3, rounded down
  const ranger = fighter({
    classes: [{ name: 'Ranger', level: 5, started: true }],
    features: [{ name: 'Dread Ambusher' }],
  })
  assert.equal(characterSheet(ranger).initiative.value, 1 + 1) // DEX +1, WIS +1
  const t = characterSheet(
    fighter({ features: [{ name: 'Alert', type: 'feat' }] })
  ).initiative
  assert.equal(
    t.tooltip,
    'DEX mod (+1)\nAlert (Initiative Proficiency) (+3)\n= 4'
  )
})

test('speed: species, Fast Movement, Unarmored Movement, Mobile, items, and Exhaustion by ruleset', () => {
  const spd = (c, items) =>
    characterSheet(c, { equippedItems: items }).speed.value
  const barb = fighter({
    classes: [{ name: 'Barbarian', level: 5, started: true }],
  })
  assert.equal(spd(barb), 40) // 30 + Fast Movement 10
  assert.equal(
    spd(barb, [
      {
        name: 'Half Plate',
        type: 'armor',
        slot: 'body',
        armor_type: 'half plate',
      },
    ]),
    40
  ) // medium armor is fine
  assert.equal(spd(barb, [chainMail]), 30) // heavy armor: no Fast Movement
  const monk = fighter({ classes: [{ name: 'Monk', level: 6, started: true }] })
  assert.equal(spd(monk), 30 + 15) // Unarmored Movement at 6th: +15
  assert.equal(spd(monk, [shield]), 30) // a Shield switches it off
  assert.equal(
    spd(fighter({ features: [{ name: 'Mobile', type: 'feat' }] })),
    40
  )
  assert.equal(
    spd(fighter(), [
      { name: 'Bracers of Swiftness', stat_bonuses: { speed: 10 } },
    ]),
    40
  )
  assert.equal(spd(fighter({ exhaustion_level: 2 })), 30 - 10) // 2024: -5 ft per level
  assert.equal(spd(fighter({ ruleset: '2014', exhaustion_level: 2 })), 15) // 2014: halved from level 2
  assert.equal(spd(fighter({ ruleset: '2014', exhaustion_level: 5 })), 0)
  assert.equal(spd(fighter({ genus: 'Halfling', ruleset: '2014' })), 25) // 2014 Halfling
  assert.equal(spd(fighter({ genus: 'Halfling' })), 30) // 2024 Halfling
  assert.equal(
    spd(fighter({ genus: 'Elf', subgenus: 'Wood Elf', ruleset: '2014' })),
    35
  )
  assert.equal(spd(fighter({ genus: 'Goliath' })), 35)
})

test("spellcasting: save DC, attack bonus, slots, cantrips and prepared spells per class, by that class's own ability", () => {
  // 2024 Wizard 9, INT 17 (+3), proficiency +4: DC 8+3+4 = 15, attack +3+4 = +7
  const wiz = {
    name: 'W',
    ruleset: '2024',
    genus: 'Human',
    level: 9,
    classes: [{ name: 'Wizard', level: 9, started: true }],
    ability_base: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 },
    ability_score_history: [
      { ability: 'int', amount: 2, source: 'Background' },
    ],
    level_history: [],
    hp_unrecorded_dice: 0,
    features: [],
  }
  const w = characterSheet(wiz).spellcasting
  assert.equal(w.classes[0].saveDC.value, 15)
  assert.equal(w.classes[0].attackBonus.value, 7)
  assert.deepEqual(
    w.slots.map((x) => x.max),
    [4, 3, 3, 3, 1]
  )
  assert.equal(w.classes[0].cantripsKnown.value, 4)
  assert.equal(w.classes[0].preparedLimit.value, 14)

  // Cleric 3 / Sorcerer 3 (caster level 6: 4/3/3 slots), WIS 16 (+3) and CHA 14 (+2), proficiency +3
  const multi = {
    name: 'M',
    ruleset: '2024',
    genus: 'Human',
    level: 6,
    classes: [
      { name: 'Cleric', subclass: 'Life Domain', level: 3, started: true },
      { name: 'Sorcerer', subclass: 'Wild Magic Sorcery', level: 3 },
    ],
    ability_base: { str: 8, dex: 10, con: 14, int: 8, wis: 16, cha: 14 },
    ability_score_history: [],
    level_history: [],
    hp_unrecorded_dice: 0,
    features: [],
  }
  const m = characterSheet(multi).spellcasting
  assert.equal(
    m.classes.find((c) => c.class === 'Cleric').saveDC.value,
    8 + 3 + 3
  )
  assert.equal(
    m.classes.find((c) => c.class === 'Sorcerer').saveDC.value,
    8 + 2 + 3
  )
  assert.equal(
    m.classes.find((c) => c.class === 'Sorcerer').attackBonus.value,
    2 + 3
  )
  assert.deepEqual(
    m.slots.map((x) => x.max),
    [4, 3, 3]
  )

  // 2014 Cleric 5, WIS 16 (+3): prepared = level 5 + 3 = 8
  const old = {
    ...multi,
    ruleset: '2014',
    level: 5,
    classes: [
      { name: 'Cleric', subclass: 'Life Domain', level: 5, started: true },
    ],
  }
  const o = characterSheet(old).spellcasting.classes[0].preparedLimit
  assert.equal(o.value, 8)
  assert.equal(sum(o.breakdown), 8)

  // Warlock 5: Pact Magic 2 slots of 3rd level
  const lock = {
    ...wiz,
    classes: [{ name: 'Warlock', level: 5, started: true }],
    level: 5,
  }
  assert.deepEqual(characterSheet(lock).spellcasting.pact, {
    level: 3,
    slots: 2,
  })
  // a Fighter has no spellcasting
  assert.equal(characterSheet(fighter()).spellcasting, null)
})

test('every explained number adds up to its value, and the tooltip is those lines joined', () => {
  const s = characterSheet(
    fighter({
      features: [
        { name: 'Tough', type: 'feat' },
        { name: 'Alert', type: 'feat' },
      ],
    }),
    {
      equippedItems: [
        chainMail,
        shield,
        amulet,
        { name: 'Bracers of Swiftness', stat_bonuses: { speed: 10 } },
      ],
    }
  )
  let leaves = 0
  eachLeaf(s, (leafObj, path) => {
    leaves++
    assert.equal(sum(leafObj.breakdown), leafObj.value, path)
    assert.equal(leafObj.tooltip, formatBreakdown(leafObj), path)
  })
  assert.ok(leaves > 40, `${leaves} leaves`)
  assert.equal(
    formatBreakdown({
      value: 7,
      breakdown: [
        { label: 'STR mod', amount: 4 },
        { label: 'Proficiency', amount: 3 },
      ],
    }),
    'STR mod (+4)\nProficiency (+3)\n= 7'
  )
  assert.equal(
    formatBreakdown({
      value: -1,
      breakdown: [{ label: 'Score 8', amount: -1 }],
    }),
    'Score 8 (-1)\n= -1'
  )
})

test('hydrating a record calculates scores and max HP from the facts, whatever the file says', () => {
  const stale = fighter({
    stat_str: 3,
    hp_max: 1,
    proficiency_bonus: 9,
    hp_current: 500,
  })
  const h = hydrateCharacter(stale)
  assert.equal(h.stat_str, 19)
  assert.equal(h.hp_max, 46)
  assert.equal(h.proficiency_bonus, 3)
  assert.equal(h.hp_current, 46)
})
