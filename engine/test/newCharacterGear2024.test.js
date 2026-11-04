// Creating a 2024 character, part two (rules/5e/newCharacter.js): the homebrew species, the class tool
// proficiencies, starting equipment, and the lineage spells that arrive at character levels 3 and 5.
//
// Expectations are written from the 2024 Player's Handbook (class tool lines, the equipment packages,
// the Elven Lineage / Fiendish Legacy tables) and the campaign's homebrew species text, not read back
// from the engine's own tables. Characters are made up; no test reads characters.json.
const test = require('node:test')
const assert = require('node:assert/strict')
const { createCharacter2024 } = require('../rules/5e/newCharacter')
const { autoLevelUp } = require('../rules/5e/choiceProtocol')
const { characterGrants } = require('../rules/5e/featureGrants')
const {
  lineageSpellsDue,
  missingLineageSpells,
} = require('../rules/5e/lineageSpells')

const plain = (over = {}) => ({
  name: 'Plain',
  species: 'Human',
  background: 'Soldier',
  className: 'Fighter',
  speciesPicks: { skillful: 'Arcana', versatile: 'Alert' },
  backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
  backgroundTool: 'Dice Set',
  languages: ['Elvish', 'Dwarvish'],
  scoreMethod: 'standardArray',
  scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
  classSkills: ['Acrobatics', 'Perception'],
  equipment: { class: 'A', background: 'A' },
  ...over,
})
const ids = (r) => r.pending.map((p) => p.id)
const names = (items) => items.map((i) => i.name)

const sageCatrin = (speciesPicks) =>
  createCharacter2024(
    plain({
      species: 'Catrin',
      speciesPicks,
      background: 'Sage',
      className: 'Wizard',
      backgroundTool: undefined,
      classSkills: ['Investigation', 'Medicine'],
      featPicks: {
        background: {
          cantrip_1: 'Light',
          cantrip_2: 'Mage Hand',
          spell_1: 'Magic Missile',
          ability: 'int',
        },
      },
      backgroundBonus: { mode: 'oneOneOne' },
    })
  )

test('homebrew species are offered like any 2024 species: no ability bonus, and the Origin feat comes from the background', () => {
  const r = createCharacter2024(plain({ species: 'Catrin', speciesPicks: {} }))
  assert.deepEqual(r.pending, [])
  const c = r.character
  // 15 + 2 (background +2 STR), 14 + 1 (background +1 CON); the old Catrin +2 CON / +1 WIS is not applied
  assert.deepEqual([c.stat_str, c.stat_con, c.stat_wis], [17, 15, 10])
  assert.equal(c.speed, 30)
  assert.ok(c.skill_proficiencies.includes('History'), 'Long Memory')
  assert.ok(c.languages.includes('Catrinese'))
  assert.ok(
    c.features.some(
      (f) => f.name === 'Brace' && f.id === 'homebrew_species_catrin-brace'
    )
  )
  // exactly one Origin feat: the Soldier's
  assert.deepEqual(
    c.features.filter((f) => f.type === 'feat').map((f) => f.name),
    ['Savage Attacker']
  )
})

test('a homebrew skill the background already gave is replaced by a pick of the player', () => {
  // Sage already gives History
  assert.ok(ids(sageCatrin({})).includes('species.skillAlt'))
  const c = sageCatrin({ skillAlt: 'Religion' }).character
  assert.ok(c.skill_proficiencies.includes('Religion'))
})

test("Hei'ugar has darkvision 60 and Gust of Wind once per long rest, the player names the ability; Drevani has speed 25", () => {
  const open = createCharacter2024(
    plain({ species: "Hei'ugar", speciesPicks: {} })
  )
  assert.ok(ids(open).includes('species.spellAbility'))
  const c = createCharacter2024(
    plain({ species: "Hei'ugar", speciesPicks: { spellAbility: 'wis' } })
  ).character
  assert.equal(characterGrants(c).darkvision, 60)
  const gust = c.spells.find((s) => s.name === 'Gust of Wind')
  assert.equal(gust.level, 2)
  assert.deepEqual(
    [gust.uses_max, gust.uses_current, gust.recharge],
    [1, 1, 'long_rest']
  )
  assert.equal(
    c.features.find((f) => f.name === 'Gust of Wind').ability_choice,
    'wis'
  )
  assert.equal(
    createCharacter2024(plain({ species: 'Drevani', speciesPicks: {} }))
      .character.speed,
    25
  )
})

test("class tool proficiencies: Bard 3 instruments, Monk 1 artisan's tool or instrument, Rogue Thieves' Tools, Druid Herbalism Kit, Artificer Thieves' + Tinker's + 1 artisan's tool", () => {
  const made = (className, extra = {}) =>
    createCharacter2024(
      plain({
        className,
        background: 'Guide', // gives Cartographer's Tools
        backgroundTool: undefined,
        ...extra,
      })
    )
  const bardAsk = made('Bard').pending.find((p) => p.id === 'classTools')
  assert.equal(bardAsk.min, 3)
  assert.ok(
    bardAsk.options.every((o) => o.value !== "Smith's Tools"),
    'instruments only'
  )
  assert.deepEqual(
    made('Bard', {
      classTools: ['Lute', 'Flute', 'Drum'],
    }).character.tool_proficiencies.sort(),
    ["Cartographer's Tools", 'Drum', 'Flute', 'Lute'].sort()
  )
  const monk = made('Monk').pending.find((p) => p.id === 'classTools')
  assert.equal(monk.min, 1)
  assert.ok(monk.options.some((o) => o.value === "Smith's Tools"))
  assert.ok(monk.options.some((o) => o.value === 'Lute'))
  assert.ok(!monk.options.some((o) => o.value === 'Dice Set'))
  assert.ok(
    made('Rogue').character.tool_proficiencies.includes("Thieves' Tools")
  )
  assert.ok(
    made('Druid').character.tool_proficiencies.includes('Herbalism Kit')
  )
  const art = made('Artificer', { classTools: ["Smith's Tools"] }).character
  assert.deepEqual(
    art.tool_proficiencies.sort(),
    [
      "Cartographer's Tools",
      "Smith's Tools",
      "Thieves' Tools",
      "Tinker's Tools",
    ].sort()
  )
  // Tinker's Tools is already held, so it is not offered again as the artisan's tool
  assert.ok(
    !made('Artificer')
      .pending.find((p) => p.id === 'classTools')
      .options.some((o) => o.value === "Tinker's Tools")
  )
  assert.deepEqual(made('Fighter').character.tool_proficiencies, [
    "Cartographer's Tools",
  ])
})

test('starting equipment: one class package and one background package, items and gold from both', () => {
  const r = createCharacter2024(plain())
  assert.deepEqual(r.pending, [])
  // Fighter A: Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, 4 GP
  // Soldier A: Spear, Shortbow, 20 Arrows, Gaming Set (same as above), Healer's Kit, Quiver, Traveler's Clothes, 14 GP
  const { items, gold } = r.equipment
  assert.equal(gold, 18)
  assert.deepEqual(names(items), [
    'Chain Mail',
    'Greatsword',
    'Flail',
    'Javelin',
    "Dungeoneer's Pack",
    'Spear',
    'Shortbow',
    'Arrows',
    'Dice Set',
    "Healer's Kit",
    'Quiver',
    "Traveler's Clothes",
  ])
  const by = (n) => items.find((i) => i.name === n)
  assert.equal(by('Javelin').quantity, 8)
  assert.equal(by('Arrows').quantity, 20)
  assert.equal(by('Chain Mail').armor_type, 'chain mail')
  assert.equal(by('Greatsword').slot, 'melee2h')
  assert.equal(by('Shortbow').slot, 'ranged')
  assert.ok(
    by("Dungeoneer's Pack").description.includes('Caltrops'),
    '2024 pack contents'
  )
  assert.ok(items.every((i) => i.carried_by === 'Plain'))
  assert.equal(by('Chain Mail').equipped_by, null, 'carried, not yet worn')
  assert.equal(by("Healer's Kit").equipped_by, 'disallowed')
})

test("starting equipment: the gold-only packages and the Fighter's third package", () => {
  const take = (cls, bg) =>
    createCharacter2024(plain({ equipment: { class: cls, background: bg } }))
      .equipment
  assert.equal(take('B', 'B').gold, 11 + 50)
  assert.equal(take('C', 'B').gold, 155 + 50)
  assert.deepEqual(take('C', 'B').items, [])
  assert.ok(!names(take('C', 'A').items).includes('Chain Mail'))
  // a package that is not on offer leaves the pick owed
  assert.ok(
    ids(
      createCharacter2024(plain({ equipment: { class: 'Z', background: 'A' } }))
    ).includes('equipment.class')
  )
})

test('equipment that names a tool: the Monk gets the tool they are proficient in, the Bard picks an instrument', () => {
  const monk = createCharacter2024(
    plain({
      className: 'Monk',
      classTools: ['Lute'],
      classSkills: ['Acrobatics', 'Stealth'], // Athletics comes from the Soldier
      equipment: { class: 'A', background: 'B' },
    })
  )
  assert.deepEqual(monk.pending, [])
  assert.ok(names(monk.equipment.items).includes('Lute'))
  assert.equal(monk.equipment.gold, 11 + 50)

  const bard = (equipment) =>
    createCharacter2024(
      plain({
        className: 'Bard',
        classTools: ['Lute', 'Flute', 'Drum'],
        classSkills: ['Acrobatics', 'Deception', 'Insight'],
        equipment,
      })
    )
  assert.ok(
    ids(bard({ class: 'A', background: 'B' })).includes('equipment.instrument')
  )
  const done = bard({ class: 'A', background: 'B', instrument: 'Viol' })
  assert.deepEqual(done.pending, [])
  assert.ok(names(done.equipment.items).includes('Viol'))
  assert.ok(names(done.equipment.items).includes('Leather Armor'))
})

test('lineage spells at character levels 3 and 5 are built into level-up: always prepared, one free cast per long rest', () => {
  const drow = createCharacter2024(
    plain({
      species: 'Elf',
      speciesPicks: {
        lineage: 'Drow',
        spellAbility: 'cha',
        keenSenses: 'Perception',
      },
    })
  ).character
  const lineage = (level) =>
    autoLevelUp(drow, {
      className: 'Fighter',
      toLevel: level,
      hpMethod: 'average',
    }).patch.spells?.filter((s) => s._source === 'Elf: Drow' && s.level > 0) ??
    []
  assert.deepEqual(lineage(1), [])
  assert.deepEqual(lineage(2), [])
  const three = lineage(3)
  assert.deepEqual(
    three.map((s) => s.name),
    ['Faerie Fire']
  )
  assert.deepEqual(
    [
      three[0].always,
      three[0].featureGranted,
      three[0].uses_max,
      three[0].recharge,
      three[0].level,
    ],
    [true, true, 1, 'long_rest', 1]
  )
  assert.deepEqual(
    lineage(5).map((s) => s.name),
    ['Faerie Fire', 'Darkness']
  )
})

test('every lineage has its own pair, each spell lands once, and species without lineage spells get none', () => {
  const sheet = (genus, subgenus, level, spells = []) => ({
    ruleset: '2024',
    genus,
    subgenus,
    level,
    spells,
    features: [],
  })
  const pairs = {
    'Elf|High Elf': ['Detect Magic', 'Misty Step'],
    'Elf|Wood Elf': ['Longstrider', 'Pass without Trace'],
    'Tiefling|Abyssal': ['Ray of Sickness', 'Hold Person'],
    'Tiefling|Chthonic': ['False Life', 'Ray of Enfeeblement'],
    'Tiefling|Infernal': ['Hellish Rebuke', 'Darkness'],
  }
  for (const [key, [three, five]] of Object.entries(pairs)) {
    const [genus, sub] = key.split('|')
    assert.deepEqual(
      lineageSpellsDue(sheet(genus, sub, 5), 2, 5).map((s) => s.name),
      [three, five],
      key
    )
    assert.deepEqual(
      missingLineageSpells(sheet(genus, sub, 4)).map((s) => s.name),
      [three],
      key
    )
  }
  const have = sheet('Elf', 'High Elf', 5, [
    { name: 'Detect Magic', _source: 'Elf: High Elf' },
  ])
  assert.deepEqual(
    missingLineageSpells(have).map((s) => s.name),
    ['Misty Step']
  )
  // an older sheet that names the species "Wood Elf" is still an Elf
  assert.deepEqual(
    missingLineageSpells(sheet('Wood Elf', undefined, 3)).map((s) => s.name),
    ['Longstrider']
  )
  assert.deepEqual(missingLineageSpells(sheet('Human', undefined, 9)), [])
  assert.deepEqual(missingLineageSpells(sheet('Gnome', 'Rock Gnome', 9)), [])
})
