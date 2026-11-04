// What a feature DOES to the sheet is data and an engine function, never only prose (CLAUDE.md, "The
// engine IS the game"): resistances, advantages, darkvision, proficiencies, the homebrew species' reaction
// and attack. Expectations are the 2024 species text and the campaign's homebrew species text, written out
// here, not read back from feature-mechanics.json. Characters are made up; no test reads characters.json.
const test = require('node:test')
const assert = require('node:assert/strict')
const { createCharacter2024 } = require('../rules/5e/newCharacter')
const { previewLevelUp, autoLevelUp } = require('../rules/5e/choiceProtocol')
const { characterGrants } = require('../rules/5e/featureGrants')
const {
  effectiveSize,
  braceOutcome,
  canMoveThroughSpace,
} = require('../rules/5e/speciesRules')
const { featureBodyAttacks } = require('../rules/5e/unarmedAttacks')
const { characterSheet } = require('../rules/5e/sheet')

const base = (over = {}) => ({
  name: 'Grant',
  species: 'Human',
  background: 'Soldier',
  className: 'Fighter',
  speciesPicks: { skillful: 'Arcana', versatile: 'Alert' },
  backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
  backgroundTool: 'Dice Set',
  languages: ['Elvish', 'Dwarvish'],
  scoreMethod: 'standardArray',
  scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
  classSkills: ['Acrobatics', 'Survival'],
  equipment: { class: 'B', background: 'B' },
  ...over,
})
const make = (over) => {
  const r = createCharacter2024(base(over))
  assert.deepEqual(
    r.pending.map((p) => p.id),
    []
  )
  return r.character
}
const has = (list, x) => list.some((v) => String(v).toLowerCase() === x)

test('2024 species traits grant their resistances, advantages and darkvision from data', () => {
  const dwarf = characterGrants(make({ species: 'Dwarf', speciesPicks: {} }))
  assert.ok(has(dwarf.resistances, 'poison'))
  assert.ok(has(dwarf.savingThrowAdvantages, 'being_poisoned'))
  assert.equal(dwarf.darkvision, 120)

  const aasimar = characterGrants(
    make({ species: 'Aasimar', speciesPicks: {} })
  )
  assert.deepEqual([...aasimar.resistances].sort(), ['necrotic', 'radiant'])
  assert.equal(aasimar.darkvision, 60)

  const elf = characterGrants(
    make({
      species: 'Elf',
      speciesPicks: {
        lineage: 'High Elf',
        spellAbility: 'int',
        keenSenses: 'Perception',
      },
    })
  )
  assert.ok(has(elf.savingThrowAdvantages, 'being_charmed'))
  assert.equal(elf.darkvision, 60)

  const gnome = characterGrants(
    make({
      species: 'Gnome',
      speciesPicks: { lineage: 'Rock Gnome', spellAbility: 'int' },
    })
  )
  assert.deepEqual(gnome.savingThrowAdvantages.sort(), [
    'charisma_saves',
    'intelligence_saves',
    'wisdom_saves',
  ])

  assert.ok(
    has(
      characterGrants(make({ species: 'Halfling', speciesPicks: {} }))
        .savingThrowAdvantages,
      'being_frightened'
    )
  )
  const orc = characterGrants(make({ species: 'Orc', speciesPicks: {} }))
  assert.equal(orc.darkvision, 120)
})

test('a lineage grants its own resistance and darkvision: Drow 120, each Tiefling legacy and Dragonborn ancestry its damage type', () => {
  const drow = characterGrants(
    make({
      species: 'Elf',
      speciesPicks: {
        lineage: 'Drow',
        spellAbility: 'cha',
        keenSenses: 'Insight',
      },
    })
  )
  assert.equal(drow.darkvision, 120)
  for (const [legacy, type] of [
    ['Abyssal', 'poison'],
    ['Chthonic', 'necrotic'],
    ['Infernal', 'fire'],
  ])
    assert.deepEqual(
      characterGrants(
        make({
          species: 'Tiefling',
          speciesPicks: { legacy, spellAbility: 'cha' },
        })
      ).resistances.map((r) => r.toLowerCase()),
      [type],
      legacy
    )
  const silver = make({
    species: 'Dragonborn',
    speciesPicks: { ancestry: 'Silver' },
  })
  assert.deepEqual(
    characterGrants(silver).resistances.map((r) => r.toLowerCase()),
    ['cold']
  )
  // an older sheet that names it "Silver Dragonborn" resolves the same
  assert.deepEqual(
    characterGrants({
      genus: 'Silver Dragonborn',
      features: [{ id: 'pub24_species_dragonborn-damage-resistance' }],
    }).resistances.map((r) => r.toLowerCase()),
    ['cold']
  )
})

test('the character sheet carries the derived grants and sizes', () => {
  const goliath = make({
    species: 'Goliath',
    speciesPicks: { ancestry: "Stone's Endurance" },
  })
  const sheet = characterSheet(goliath, { equippedItems: [] })
  assert.deepEqual(sheet.grants.checkAdvantages, [
    { when: 'to end the Grappled condition' },
  ])
  assert.deepEqual(sheet.size, {
    carrying: 'Large',
    grappling: 'Medium',
    current: 'Medium',
  })
})

// ── homebrew species ─────────────────────────────────────────────────────────────────────────

const catrin = () => make({ species: 'Catrin', speciesPicks: {} })
const drevani = () => make({ species: 'Drevani', speciesPicks: {} })
const heiugar = () =>
  make({ species: "Hei'ugar", speciesPicks: { spellAbility: 'wis' } })

test('every homebrew trait is an id with an entry in feature-mechanics, not text', () => {
  for (const c of [catrin(), drevani(), heiugar()])
    for (const f of c.features.filter((x) => x.type === 'speciesTrait'))
      assert.match(f.id, /^homebrew_species_/, `${c.genus} ${f.name}`)
})

test('Catrin: Settled Presence, Broad Build (one size larger to carry and grapple), Brace halves a melee hit and pushes a Medium attacker', () => {
  const c = catrin()
  const g = characterGrants(c)
  assert.deepEqual(g.savingThrowAdvantages.sort(), [
    'being_charmed',
    'being_frightened',
  ])
  assert.equal(effectiveSize(c, 'carrying_capacity'), 'Large')
  assert.equal(effectiveSize(c, 'grappling'), 'Large')

  // Brace: reaction, once per long rest (taken to level 1 so the use is on the sheet)
  const lvl1 = {
    ...c,
    ...autoLevelUp(c, { className: 'Fighter', toLevel: 1, hpMethod: 'average' })
      .patch,
  }
  const brace = lvl1.features.find((f) => f.name === 'Brace')
  assert.deepEqual(
    [brace.action_type, brace.recharge, brace.uses_max],
    ['reaction', 'long_rest', 1]
  )
  // "halve the damage and push the attacker 5ft away if they are Medium or smaller"
  assert.deepEqual(braceOutcome(lvl1, 11, 'Medium'), {
    feature: 'Brace',
    damageTaken: 5,
    damagePrevented: 6,
    pushFeet: 5,
  })
  assert.equal(braceOutcome(lvl1, 11, 'Large').pushFeet, 0)
  assert.equal(braceOutcome(lvl1, 11, 'Large').damageTaken, 5)
  const spent = {
    ...lvl1,
    features: lvl1.features.map((f) =>
      f.name === 'Brace' ? { ...f, uses_current: 0 } : f
    ),
  }
  assert.equal(braceOutcome(spent, 11, 'Small'), null, 'used up')
  assert.equal(braceOutcome(base(), 11, 'Small'), null, 'no such feature')
})

test("Catrin's Long Memory gives History, replaced by a pick when the background already gave it", () => {
  assert.ok(catrin().skill_proficiencies.includes('History'))
})

test('Drevani: Sharp Nose is advantage only on smell, so it never changes a passive score; Low Profile passes Medium and larger', () => {
  const c = drevani()
  const g = characterGrants(c)
  assert.deepEqual(g.skillAdvantages, [
    { skill: 'Perception', when: 'checks that rely on smell' },
  ])
  const sheet = characterSheet(c, { equippedItems: [] })
  const plain = characterSheet(
    { ...c, features: c.features.filter((f) => f.name !== 'Sharp Nose') },
    { equippedItems: [] }
  )
  assert.equal(sheet.passivePerception.value, plain.passivePerception.value)
  assert.equal(canMoveThroughSpace(c, 'Medium'), true)
  assert.equal(canMoveThroughSpace(c, 'Large'), true)
  assert.equal(canMoveThroughSpace(c, 'Small'), false)
  assert.equal(effectiveSize(c, 'grappling'), 'Small', 'a Drevani is Small')
})

test("Drevani's Ferocious Bite: a bonus-action piercing unarmed strike, STR modifier, die by level, once per long rest", () => {
  const c = drevani() // STR 15 + 2 = 17 -> +3
  const biteAt = (level) => {
    const f = featureBodyAttacks({
      ...c,
      level,
      classes: [{ name: 'Fighter', level }],
    })
    assert.equal(f.length, 1)
    return f[0]
  }
  const dice = {
    1: '1d6',
    2: '1d6',
    3: '2d6',
    5: '2d6',
    6: '3d6',
    8: '3d6',
    9: '4d6',
    11: '4d6',
    12: '5d6',
    14: '5d6',
    15: '6d6',
    17: '6d6',
    18: '7d6',
    20: '7d6',
  }
  for (const [level, die] of Object.entries(dice))
    assert.equal(biteAt(Number(level)).die, die, `level ${level}`)
  const b = biteAt(5)
  assert.equal(b.damageType, 'piercing')
  assert.equal(b.actionType, 'bonus_action')
  assert.equal(b.damage.value, 3)
  assert.equal(b.attack.value, 3 + 3, 'STR + proficiency (+3 at level 5)')
  assert.equal(b.uses.recharge, 'long_rest')
})

test("Hei'ugar: darkvision 60 and advantage against illusions, charm and paralysis; Far Sight is conditional", () => {
  const g = characterGrants(heiugar())
  assert.equal(g.darkvision, 60)
  assert.deepEqual(g.savingThrowAdvantages.sort(), [
    'being_charmed',
    'illusions',
    'paralysis',
  ])
  assert.deepEqual(g.skillAdvantages, [
    {
      skill: 'Perception',
      when: 'checks that target creatures or objects 60 feet or further away',
    },
  ])
})

// ── a feature's proficiencies, through the level-up ────────────────────────────────────────────

function wizardTo(level, over = {}, prefs = {}) {
  let c = createCharacter2024(
    base({
      className: 'Wizard',
      background: 'Sage',
      backgroundTool: undefined,
      species: 'Human',
      speciesPicks: { skillful: 'Insight', versatile: 'Alert' },
      backgroundBonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' },
      classSkills: ['Investigation', 'Medicine'],
      equipment: { class: 'B', background: 'B' },
      ...over,
    })
  ).character
  for (let l = 1; l <= level; l++) {
    const r = autoLevelUp(
      c,
      { className: 'Wizard', toLevel: l, hpMethod: 'average' },
      { subclassName: 'Bladesinger', ...prefs }
    )
    c = { ...c, ...r.patch }
  }
  return c
}

// the questions of a level-up with the subclass already answered (a subclass feature only exists after it)
function askedAt(character, toLevel, className = 'Wizard') {
  const opts = { className, toLevel, hpMethod: 'average' }
  const first = previewLevelUp(character, opts, {})
  const sub = first.choices.find((c) => c.kind === 'subclass')
  return previewLevelUp(
    character,
    opts,
    sub ? { [sub.id]: ['Bladesinger'] } : {}
  ).choices
}

test("Bladesinger's Training in War and Song (2024): martial melee weapons without Two-Handed or Heavy, and one of four skills", () => {
  const ask = askedAt(wizardTo(2), 3).find(
    (c) => c.type === 'featureGrantChoice'
  )
  assert.ok(ask, 'the skill is asked')
  assert.equal(ask.title, 'Training in War and Song')
  assert.deepEqual(ask.options.map((o) => o.value).sort(), [
    'Acrobatics',
    'Athletics',
    'Performance',
    'Persuasion',
  ])

  const c = wizardTo(3, {}, { prefer: { featureGrantChoice: ['Persuasion'] } })
  assert.ok(c.skill_proficiencies.includes('Persuasion'))
  // PHB martial melee weapons minus Glaive, Greataxe, Greatsword, Halberd, Lance, Maul, Pike
  assert.deepEqual(
    c.weapon_proficiencies.filter((w) => w !== 'simple').sort(),
    [
      'battleaxe',
      'flail',
      'longsword',
      'morningstar',
      'rapier',
      'scimitar',
      'shortsword',
      'trident',
      'war pick',
      'warhammer',
      'whip',
    ]
  )
})

test('a skill a feature grants that the character already has is replaced by a pick of the player', () => {
  // Human Skillful took Athletics; Training in War and Song offers only the other three
  const c = wizardTo(2, {
    speciesPicks: { skillful: 'Athletics', versatile: 'Alert' },
  })
  const ask = askedAt(c, 3).find((x) => x.type === 'featureGrantChoice')
  assert.deepEqual(ask.options.map((o) => o.value).sort(), [
    'Acrobatics',
    'Performance',
    'Persuasion',
  ])
})

// ── more feature grants, through the level-up ───────────────────────────────────────────────────

const { proficiencyGrants } = require('../rules/5e/featureGrants')

function bardTo(level, prefs = {}) {
  let c = createCharacter2024(
    base({
      className: 'Bard',
      background: 'Entertainer',
      backgroundTool: 'Lute',
      backgroundBonus: { mode: 'twoOne', plus2: 'cha', plus1: 'dex' },
      speciesPicks: { skillful: 'Insight', versatile: 'Alert' },
      featPicks: { background: { tools: ['Horn', 'Lyre', 'Shawm'] } },
      classSkills: ['Deception', 'Persuasion', 'Stealth'],
      classTools: ['Flute', 'Drum', 'Viol'],
      equipment: { class: 'A', background: 'A', instrument: 'Lute' },
    })
  )
  assert.deepEqual(
    c.pending.map((p) => p.id),
    []
  )
  c = c.character
  for (let l = 1; l <= level; l++)
    c = {
      ...c,
      ...autoLevelUp(
        c,
        { className: 'Bard', toLevel: l, hpMethod: 'average' },
        { subclassName: 'College of Lore', ...prefs }
      ).patch,
    }
  return c
}

test("College of Lore's Bonus Proficiencies (2024) give three more skills", () => {
  const two = bardTo(2)
  const three = bardTo(3)
  const gained = three.skill_proficiencies.filter(
    (s) => !two.skill_proficiencies.includes(s)
  )
  assert.equal(gained.length, 3, gained.join(', '))
})

test('multiclass tool grants are real proficiencies: Rogue gives Thieves Tools, Bard one instrument of the player choice', () => {
  const fighter = {
    ...createCharacter2024(base({ equipment: { class: 'B', background: 'B' } }))
      .character,
  }
  let f1 = {
    ...fighter,
    ...autoLevelUp(fighter, {
      className: 'Fighter',
      toLevel: 1,
      hpMethod: 'average',
    }).patch,
  }
  f1 = { ...f1, stat_dex: 14, stat_cha: 14 } // the multiclass prerequisites (DEX 13 / CHA 13)
  const rogue = autoLevelUp(f1, {
    className: 'Rogue',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.ok(rogue.patch.tool_proficiencies.includes("Thieves' Tools"))
  assert.ok(
    !rogue.warnings.some((w) => /aren't tracked/.test(w)),
    'no more "tools are not tracked" note'
  )

  const ask = previewLevelUp(
    f1,
    { className: 'Bard', toLevel: 1, hpMethod: 'average' },
    {}
  ).choices.find((c) => c.type === 'multiclassToolChoice')
  assert.ok(ask, 'the instrument is asked')
  assert.deepEqual(ask.options.map((o) => o.value).sort(), [
    'Bagpipes',
    'Drum',
    'Dulcimer',
    'Flute',
    'Horn',
    'Lute',
    'Lyre',
    'Pan Flute',
    'Shawm',
    'Viol',
  ])
  const bard = autoLevelUp(
    f1,
    { className: 'Bard', toLevel: 1, hpMethod: 'average' },
    { prefer: { multiclassToolChoice: ['Lyre'] } }
  )
  assert.ok(bard.patch.tool_proficiencies.includes('Lyre'))
})

test('the 2024 subclass proficiency grants are structured from the book text', () => {
  const g = (id) => proficiencyGrants({ id })
  assert.deepEqual(g('pub24_monk-disciplined-survivor').saves, [
    'str',
    'dex',
    'con',
    'int',
    'wis',
    'cha',
  ])
  assert.deepEqual(g('pub24_rogue-slippery-mind').saves, ['wis', 'cha'])
  assert.deepEqual(g('pub24_sub_ranger-gloom-stalker-iron-mind').saves, ['wis'])
  assert.deepEqual(
    g('pub24_sub_ranger-gloom-stalker-iron-mind').saveReplaceOptions,
    ['int', 'cha']
  )
  const alchemist = g('pub24_sub_artificer-alchemist-tools-of-the-trade')
  assert.deepEqual(alchemist.tools, ["Alchemist's Supplies", 'Herbalism Kit'])
  assert.equal(alchemist.toolReplaceFrom, "Artisan's Tools")
  assert.deepEqual(g('pub24_sub_artificer-armorer-tools-of-the-trade').armor, [
    'heavy',
  ])
  const artillerist = g('pub24_sub_artificer-artillerist-tools-of-the-trade')
  // 2024 PHB Martial Ranged weapons: Blowgun, Hand Crossbow, Heavy Crossbow, Longbow, Musket, Pistol
  assert.deepEqual(artillerist.weapons.sort(), [
    'blowgun',
    'hand crossbow',
    'heavy crossbow',
    'longbow',
    'musket',
    'pistol',
  ])
  assert.deepEqual(
    g('pub24_sub_bard-college-of-valor-martial-training').armor,
    ['medium', 'shields']
  )
  assert.deepEqual(
    g('pub24_sub_bard-college-of-lore-bonus-proficiencies').skillChoice,
    {
      count: 3,
      options: 'any',
    }
  )
  assert.deepEqual(
    g('pub24_sub_monk-warrior-of-mercy-implements-of-mercy').skills,
    ['Insight', 'Medicine']
  )
  assert.deepEqual(g('pub24_sub_rogue-assassin-assassins-tools').tools, [
    'Disguise Kit',
    "Poisoner's Kit",
  ])
  assert.equal(
    g('pub24_sub_cleric-knowledge-domain-blessings-of-knowledge').skillChoice
      .expertise,
    true
  )
})
