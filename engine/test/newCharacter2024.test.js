// Creating a 2024 character (rules/5e/newCharacter.js): species, background, ability scores and the
// starting class, up to level 1 taken through the ordinary level-up engine.
//
// The expectations are the 2024 Player's Handbook, written out here (a Sage gives Arcana and History;
// a High Elf knows Prestidigitation; a Fighter has 10 + CON modifier hit points at level 1), not read back
// from the engine's own tables. Characters are made up; no test reads characters.json.
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createCharacter2024,
  listNewCharacterSpecies,
} = require('../rules/5e/newCharacter')
const { autoLevelUp } = require('../rules/5e/choiceProtocol')
const { characterGrants } = require('../rules/5e/featureGrants')

const SCORES = { str: 8, dex: 14, con: 14, int: 15, wis: 10, cha: 8 } // point buy: 0+7+7+9+2+0 = 25
const sageWizard = (over = {}) => ({
  name: 'Test',
  species: 'Elf',
  background: 'Sage',
  className: 'Wizard',
  speciesPicks: {
    lineage: 'High Elf',
    spellAbility: 'int',
    keenSenses: 'Perception',
  },
  backgroundBonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' },
  featPicks: {
    background: {
      cantrip_1: 'Light',
      cantrip_2: 'Mage Hand',
      spell_1: 'Magic Missile',
      ability: 'int',
    },
  },
  languages: ['Dwarvish', 'Giant'],
  scoreMethod: 'pointBuy',
  scores: SCORES,
  classSkills: ['Investigation', 'Medicine'],
  equipment: { class: 'A', background: 'A' },
  ...over,
})
const ids = (r) => r.pending.map((p) => p.id)

test('with nothing answered, every open step is listed and the character is an empty level 0 sheet', () => {
  const r = createCharacter2024({})
  for (const id of [
    'species',
    'background',
    'className',
    'scores',
    'languages',
  ])
    assert.ok(ids(r).includes(id), id)
  assert.equal(r.character.level, 0)
  assert.equal(r.character.hp_max, 0)
})

test('the 2024 species can be created, plus the legacy Half-Elf and Half-Orc (the 2024 books do not retire them) and the playable homebrew species, never the uncontacted Dhovari', () => {
  const names = listNewCharacterSpecies()
  assert.deepEqual(
    names.sort(),
    [
      'Aasimar',
      'Catrin',
      'Drevani',
      'Dragonborn',
      'Dwarf',
      'Elf',
      'Gnome',
      'Goliath',
      'Half-Elf',
      'Half-Orc',
      'Halfling',
      "Hei'ugar",
      'Human',
      'Orc',
      'Tiefling',
    ].sort()
  )
})

test('a fully answered High Elf Sage Wizard is built from the book: skills, tool, languages, saves, scores, spells', () => {
  const r = createCharacter2024(sageWizard())
  assert.deepEqual(r.pending, [])
  assert.deepEqual(r.warnings, [])
  const c = r.character
  // Sage: Arcana and History, Calligrapher's Supplies, Magic Initiate (Wizard). Keen Senses: Perception.
  // Wizard: choose 2 more (Arcana and History are already taken, so they were not on offer).
  assert.deepEqual(
    c.skill_proficiencies.sort(),
    ['Arcana', 'History', 'Investigation', 'Medicine', 'Perception'].sort()
  )
  assert.deepEqual(c.tool_proficiencies, ["Calligrapher's Supplies"])
  assert.deepEqual(c.languages, ['Common', 'Dwarvish', 'Giant'])
  assert.deepEqual(c.saving_throws, ['int', 'wis'])
  assert.deepEqual(c.armor_proficiencies, [])
  // 15 + 2 INT, 14 + 1 CON from the background; everything else as bought.
  assert.deepEqual(
    [c.stat_str, c.stat_dex, c.stat_con, c.stat_int, c.stat_wis, c.stat_cha],
    [8, 14, 15, 17, 10, 8]
  )
  assert.deepEqual(c.ability_base, SCORES)
  assert.deepEqual(
    c.ability_score_history.map((h) => [h.ability, h.amount, h.source]),
    [
      ['int', 2, 'Sage'],
      ['con', 1, 'Sage'],
    ]
  )
  const spells = c.spells.map((s) => s.name).sort()
  assert.deepEqual(spells, [
    'Light',
    'Mage Hand',
    'Magic Missile',
    'Prestidigitation',
  ])
  assert.equal(c.speed, 30)
  assert.equal(characterGrants(c).darkvision, 60)
  assert.deepEqual(c.classes, [{ name: 'Wizard', level: 0, started: true }])
})

test('Magic Initiate offers only spells from its list, never one the character already knows', () => {
  const r = createCharacter2024(
    sageWizard({
      speciesPicks: {
        lineage: 'High Elf',
        spellAbility: 'int',
        keenSenses: 'Perception',
      },
      featPicks: { background: {} },
    })
  )
  const first = r.pending.find((p) => p.id === 'featPicks.background.cantrip_1')
  const names = first.options.map((o) => o.value)
  assert.ok(names.includes('Mage Hand'))
  assert.ok(!names.includes('Prestidigitation'), 'the High Elf already has it')
  assert.ok(!names.includes('Guidance'), 'a Cleric/Druid cantrip, not Wizard')
  const spell = r.pending.find((p) => p.id === 'featPicks.background.spell_1')
  assert.ok(spell.options.some((o) => o.value === 'Shield'))
  assert.ok(!spell.options.some((o) => o.value === 'Bless'), 'a Cleric spell')
})

test('Elven lineages: Drow sees 120 feet, Wood Elf has Speed 35 and Druidcraft, High Elf has Prestidigitation', () => {
  const build = (lineage) =>
    createCharacter2024(
      sageWizard({
        speciesPicks: { lineage, spellAbility: 'wis', keenSenses: 'Insight' },
        featPicks: undefined,
      })
    ).character
  const drow = build('Drow')
  assert.equal(characterGrants(drow).darkvision, 120)
  assert.ok(drow.spells.some((s) => s.name === 'Dancing Lights'))
  const wood = build('Wood Elf')
  assert.equal(wood.speed, 35)
  assert.ok(wood.spells.some((s) => s.name === 'Druidcraft'))
  assert.equal(characterGrants(wood).darkvision, 60)
  assert.ok(build('High Elf').spells.some((s) => s.name === 'Prestidigitation'))
})

test('the background bonus must be +2/+1 on two different listed abilities, or +1 on all three', () => {
  const bonus = (b) =>
    createCharacter2024(sageWizard({ backgroundBonus: b })).pending.map(
      (p) => p.id
    )
  // Sage's abilities are Constitution, Intelligence and Wisdom.
  assert.ok(
    bonus({ mode: 'twoOne', plus2: 'int', plus1: 'int' }).includes(
      'backgroundBonus'
    )
  )
  assert.ok(
    bonus({ mode: 'twoOne', plus2: 'int', plus1: 'str' }).includes(
      'backgroundBonus'
    )
  )
  assert.ok(
    !bonus({ mode: 'twoOne', plus2: 'wis', plus1: 'con' }).includes(
      'backgroundBonus'
    )
  )
  const r = createCharacter2024(
    sageWizard({ backgroundBonus: { mode: 'oneOneOne' } })
  )
  assert.deepEqual(r.pending, [])
  assert.deepEqual(
    [r.character.stat_con, r.character.stat_int, r.character.stat_wis],
    [15, 16, 11]
  )
})

test('ability scores: point buy over 27 points, a wrong standard array, and an out-of-range roll are refused with a reason', () => {
  const over = createCharacter2024(
    sageWizard({
      scores: { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 },
    })
  )
  assert.ok(ids(over).includes('scores'))
  assert.match(over.warnings.join(' '), /budget/)
  const badArray = createCharacter2024(
    sageWizard({
      scoreMethod: 'standardArray',
      scores: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 },
    })
  )
  assert.ok(ids(badArray).includes('scores'))
  const goodArray = createCharacter2024(
    sageWizard({
      scoreMethod: 'standardArray',
      scores: { str: 8, dex: 13, con: 14, int: 15, wis: 12, cha: 10 },
    })
  )
  assert.ok(!ids(goodArray).includes('scores'))
  assert.equal(goodArray.character.ability_score_method, 'standard array')
  const rolled = createCharacter2024(
    sageWizard({
      scoreMethod: 'rolled',
      scores: { str: 18, dex: 17, con: 3, int: 12, wis: 14, cha: 9 },
    })
  )
  assert.ok(!ids(rolled).includes('scores'))
  assert.equal(rolled.character.ability_score_method, 'rolled')
  assert.ok(
    ids(
      createCharacter2024(
        sageWizard({
          scoreMethod: 'rolled',
          scores: { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        })
      )
    ).includes('scores')
  )
})

test('class skill picks: the count is the class table, skills already held are not offered, wrong picks stay open', () => {
  // Rogue chooses 4; a Criminal already has Sleight of Hand and Stealth.
  const rogue = createCharacter2024({
    name: 'R',
    species: 'Dwarf',
    background: 'Criminal',
    className: 'Rogue',
  })
  const p = rogue.pending.find((x) => x.id === 'classSkills')
  assert.equal(p.min, 4)
  const offered = p.options.map((o) => o.value)
  assert.ok(!offered.includes('Stealth'))
  assert.ok(!offered.includes('Sleight of Hand'))
  assert.ok(offered.includes('Perception'))
  assert.ok(!offered.includes('Arcana'), 'not a Rogue skill')
  const wrong = createCharacter2024({
    name: 'R',
    species: 'Dwarf',
    background: 'Criminal',
    className: 'Rogue',
    classSkills: ['Perception', 'Arcana', 'Insight', 'Deception'],
  })
  assert.ok(ids(wrong).includes('classSkills'))
})

test('Human: Skillful adds one skill, Versatile an Origin feat with its own picks', () => {
  const r = createCharacter2024({
    name: 'H',
    species: 'Human',
    background: 'Soldier',
    className: 'Fighter',
  })
  assert.ok(ids(r).includes('species.skillful'))
  assert.ok(ids(r).includes('species.versatile'))
  const skillful = r.pending.find((p) => p.id === 'species.skillful')
  assert.ok(
    !skillful.options.some((o) => o.value === 'Athletics'),
    'a Soldier already has it'
  )
  const done = createCharacter2024({
    name: 'H',
    species: 'Human',
    background: 'Soldier',
    className: 'Fighter',
    speciesPicks: { skillful: 'Perception', versatile: 'Skilled' },
    featPicks: {
      versatile: { skills_or_tools: ['History', 'Arcana', "Thieves' Tools"] },
    },
  })
  const c = done.character
  assert.ok(c.skill_proficiencies.includes('Perception'))
  for (const s of ['History', 'Arcana'])
    assert.ok(c.skill_proficiencies.includes(s))
  assert.ok(c.tool_proficiencies.includes("Thieves' Tools"))
  // Soldier gives Savage Attacker; Versatile gave Skilled.
  assert.deepEqual(
    c.features.filter((f) => f.type === 'feat').map((f) => [f.name, f._grant]),
    [
      ['Savage Attacker', 'origin'],
      ['Skilled', 'species'],
    ]
  )
})

test('a background that lets you choose a tool asks for a real instrument, gaming set or artisan tool', () => {
  const r = createCharacter2024({
    species: 'Dwarf',
    background: 'Entertainer',
    className: 'Bard',
  })
  const t = r.pending.find((p) => p.id === 'background.tool')
  assert.ok(t.options.some((o) => o.value === 'Lute'))
  assert.ok(!t.options.some((o) => o.value === 'Dice Set'))
  const musician = createCharacter2024({
    species: 'Dwarf',
    background: 'Entertainer',
    className: 'Bard',
    backgroundTool: 'Lute',
    featPicks: { background: { tools: ['Flute', 'Drum', 'Horn'] } },
  })
  assert.ok(
    ['Lute', 'Flute', 'Drum', 'Horn'].every((x) =>
      musician.character.tool_proficiencies.includes(x)
    )
  )
})

test('lineage and legacy picks grant their cantrips; Tiefling always knows Thaumaturgy', () => {
  const species = (s, picks) =>
    createCharacter2024({
      species: s,
      background: 'Sage',
      className: 'Fighter',
      speciesPicks: picks,
    }).character
  const infernal = species('Tiefling', {
    legacy: 'Infernal',
    spellAbility: 'cha',
  })
  assert.deepEqual(infernal.spells.map((s) => s.name).sort(), [
    'Fire Bolt',
    'Thaumaturgy',
  ])
  const rock = species('Gnome', { lineage: 'Rock Gnome', spellAbility: 'int' })
  assert.deepEqual(rock.spells.map((s) => s.name).sort(), [
    'Mending',
    'Prestidigitation',
  ])
  const forest = species('Gnome', {
    lineage: 'Forest Gnome',
    spellAbility: 'wis',
  })
  assert.deepEqual(forest.spells.map((s) => [s.name, s.level]).sort(), [
    ['Minor Illusion', 0],
    ['Speak with Animals', 1],
  ])
  // the lineage's own options are not listed as traits; only the pick is
  assert.ok(!rock.features.some((f) => f.name === 'Forest Gnome'))
  assert.ok(rock.features.some((f) => f.name === 'Gnomish Lineage: Rock Gnome'))
  const gold = species('Dragonborn', { ancestry: 'Gold' })
  assert.equal(gold.subgenus, 'Gold')
  assert.ok(gold.features.some((f) => f.name === 'Draconic Ancestry: Gold'))
})

test('Goliath keeps only the chosen giant boon', () => {
  const g = createCharacter2024({
    species: 'Goliath',
    background: 'Sage',
    className: 'Fighter',
    speciesPicks: { ancestry: "Fire's Burn" },
  }).character
  const names = g.features.map((f) => f.name)
  assert.ok(names.includes("Giant Ancestry: Fire's Burn"))
  assert.ok(!names.some((n) => /^Cloud's Jaunt|^Storm's Thunder/.test(n)))
})

test('starting-class proficiencies come from the class table: a Fighter gets every armor, both weapon groups, STR and CON saves', () => {
  const c = createCharacter2024({
    species: 'Dwarf',
    background: 'Soldier',
    className: 'Fighter',
  }).character
  assert.deepEqual(c.saving_throws, ['str', 'con'])
  assert.deepEqual(c.armor_proficiencies, [
    'light',
    'medium',
    'heavy',
    'shields',
  ])
  assert.deepEqual(c.weapon_proficiencies, ['simple', 'martial'])
})

test('the finished level 0 sheet takes level 1 through the level-up engine: Fighter 10 + CON, Wizard 6 + CON', () => {
  const fighter = createCharacter2024({
    name: 'F',
    species: 'Orc',
    background: 'Soldier',
    className: 'Fighter',
    backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
    scoreMethod: 'standardArray',
    scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
    languages: ['Elvish', 'Orc'],
    backgroundTool: 'Dice Set',
    classSkills: ['Acrobatics', 'Perception'],
    equipment: { class: 'A', background: 'A' },
  })
  assert.deepEqual(fighter.pending, [])
  const f = fighter.character
  assert.equal(f.stat_con, 15) // 14 + 1
  const lvl1 = autoLevelUp(f, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  // d10 at first level is taken at the maximum (10) plus the Constitution modifier (+2).
  assert.equal(lvl1.patch.hp_max, 12)

  const wiz = createCharacter2024(sageWizard()).character
  const w1 = autoLevelUp(wiz, {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(w1.patch.hp_max, 8) // d6 maximum 6 + CON modifier +2 (CON 15)
})

test('every pick comes back with its options whether answered or not, grouped by form section', () => {
  const r = createCharacter2024(sageWizard())
  assert.deepEqual(r.pending, [])
  const byId = Object.fromEntries(r.choices.map((c) => [c.id, c]))
  assert.equal(byId.species.answered, true)
  assert.equal(byId.species.answer, 'Elf')
  assert.ok(
    byId.species.options.some((o) => o.value === 'Dwarf'),
    'options stay after answering'
  )
  assert.equal(byId['species.lineage'].section, 'species')
  assert.equal(byId['featPicks.background.spell_1'].section, 'background')
  assert.equal(byId.classSkills.section, 'class')
  assert.equal(byId.languages.section, 'languages')
  assert.equal(byId.scores.section, 'scores')
  assert.deepEqual(byId.classSkills.answer.sort(), [
    'Investigation',
    'Medicine',
  ])
  assert.equal(byId.backgroundBonus.kind, 'abilityBonus')
  const blank = createCharacter2024({})
  assert.ok(blank.choices.every((c) => c.answered === false))
})
