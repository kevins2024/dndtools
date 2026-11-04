// The 2024 species traits as rules the engine applies. Each expectation is the Player's Handbook text,
// written out here (Healing Hands rolls a number of d4s equal to the Proficiency Bonus; Breath Weapon's
// DC is 8 + Constitution modifier + Proficiency Bonus; Luck rerolls a 1), not read back from the data.
// Characters are made up with the creation tool and the level-up engine; nothing here reads characters.json.
const test = require('node:test')
const assert = require('node:assert/strict')
const { createCharacter2024 } = require('../rules/5e/newCharacter')
const { autoLevelUp } = require('../rules/5e/choiceProtocol')
const { characterGrants } = require('../rules/5e/featureGrants')
const {
  useFeature,
  endActiveEffect,
  featureAction,
} = require('../rules/5e/featureUse')
const { rollD20Test } = require('../rules/5e/d20Test')
const rest = require('../rules/5e/rest')
const sr = require('../rules/5e/speciesRules')
const { speedBreakdown, flySpeedBreakdown } = require('../rules/5e/speed')
const { characterSheet } = require('../rules/5e/sheet')
const {
  swapLineageCantrip,
  missingLineageSpells,
} = require('../rules/5e/lineageSpells')

// Fighter 15 STR 12 DEX 14 CON 8 INT 10 WIS 13 CHA, Soldier (+2 STR +1 CON): CON 15 (+2), CHA 13 (+1).
const BASE = {
  name: 'Sim',
  background: 'Soldier',
  className: 'Fighter',
  backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
  scoreMethod: 'standardArray',
  scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
  languages: ['Elvish', 'Orc'],
  backgroundTool: 'Dice Set',
  classSkills: ['Acrobatics', 'Athletics'],
  equipment: { class: 'A', background: 'A' },
}
function build(species, picks, level) {
  let c = createCharacter2024({
    ...BASE,
    species,
    speciesPicks: picks,
  }).character
  for (let to = 1; to <= level; to++)
    c = {
      ...c,
      ...autoLevelUp(c, {
        className: 'Fighter',
        toLevel: to,
        hpMethod: 'average',
      }).patch,
    }
  return c
}
const merge = (c, patch) => ({ ...c, ...patch })
const low = () => 0 // every die shows 1
const high = () => 0.999 // every die shows its maximum
const feature = (c, id) => c.features.find((f) => f.id === id)

// ── Halfling ──────────────────────────────────────────────────────────────────────────────────────

test('Halfling Luck: a 1 on the d20 of a D20 Test is rerolled and the new die is kept', () => {
  const halfling = build('Halfling', {}, 1)
  assert.deepEqual(characterGrants(halfling).d20RerollOn, [1])
  assert.deepEqual(characterGrants(build('Orc', {}, 1)).d20RerollOn, [])
  const seq = [0, 0.5] // a 1, then an 11
  let i = 0
  const roll = rollD20Test({
    rerollOn: [1],
    modifier: 2,
    rng: () => seq[i++],
  })
  assert.equal(roll.natural, 11)
  assert.equal(roll.value, 13)
  assert.deepEqual(roll.rerolls, [{ from: 1, to: 11 }])
  // only a 1 is rerolled
  const seq2 = [1 / 20] // a 2
  let j = 0
  assert.equal(rollD20Test({ rerollOn: [1], rng: () => seq2[j++] }).natural, 2)
  // with advantage each die gets the reroll: 1 -> 4 and 1 -> 2 keeps the 4
  const seq3 = [0, 3 / 20, 0, 1 / 20]
  let k = 0
  const adv = rollD20Test({
    advantage: true,
    rerollOn: [1],
    rng: () => seq3[k++],
  })
  assert.deepEqual(adv.rolls, [4, 2])
  assert.equal(adv.natural, 4)
})

test('Halfling Nimbleness and Naturally Stealthy: one size larger than a Small halfling', () => {
  const h = build('Halfling', {}, 1)
  assert.equal(sr.baseSize(h), 'Small')
  assert.equal(sr.canMoveThroughSpace(h, 'Medium'), true)
  assert.equal(sr.canMoveThroughSpace(h, 'Large'), true)
  assert.equal(sr.canMoveThroughSpace(h, 'Small'), false)
  assert.equal(sr.canHideBehind(h, 'Medium'), true)
  assert.equal(sr.canHideBehind(h, 'Small'), false)
  assert.equal(sr.canHideBehind(build('Orc', {}, 1), 'Large'), false)
})

// ── Human, Elf ────────────────────────────────────────────────────────────────────────────────────

test('Human Resourceful: a Long Rest gives Heroic Inspiration; nobody else gets it', () => {
  const human = {
    hp_max: 10,
    hp_current: 4,
    features: [{ name: 'Resourceful', id: 'pub24_species_human-resourceful' }],
  }
  assert.equal(rest.applyLongRest(human).patch.heroic_inspiration, true)
  assert.equal(rest.longRestPreview(human).heroicInspiration, true)
  assert.equal(
    rest.applyLongRest({ hp_max: 10, features: [] }).patch.heroic_inspiration,
    undefined
  )
})

test('Elf Trance: no sleep, magic cannot put you to sleep, a Long Rest takes 4 hours', () => {
  const elf = build(
    'Elf',
    { lineage: 'Wood Elf', spellAbility: 'wis', keenSenses: 'Perception' },
    1
  )
  const g = characterGrants(elf)
  assert.equal(g.needsSleep, false)
  assert.ok(g.conditionImmunities.includes('magical_sleep'))
  assert.equal(g.longRestHours, 4)
  assert.equal(rest.longRestPreview(elf).hours, 4)
  const orc = characterGrants(build('Orc', {}, 1))
  assert.equal(orc.needsSleep, true)
  assert.equal(orc.longRestHours, 8)
})

test('High Elf may replace its cantrip with another Wizard cantrip after a Long Rest', () => {
  const elf = build(
    'Elf',
    { lineage: 'High Elf', spellAbility: 'int', keenSenses: 'Perception' },
    3
  )
  assert.deepEqual(missingLineageSpells(elf), [])
  const ok = swapLineageCantrip(elf, 'Mage Hand')
  assert.equal(ok.ok, true)
  assert.equal(ok.from, 'Prestidigitation')
  assert.ok(merge(elf, ok.patch).spells.some((s) => s.name === 'Mage Hand'))
  // Druidcraft is a Druid cantrip; Fire Bolt a Wizard one; a leveled spell is no cantrip
  assert.equal(swapLineageCantrip(elf, 'Druidcraft').ok, false)
  assert.equal(swapLineageCantrip(elf, 'Magic Missile').ok, false)
  const wood = build(
    'Elf',
    { lineage: 'Wood Elf', spellAbility: 'wis', keenSenses: 'Perception' },
    1
  )
  assert.equal(swapLineageCantrip(wood, 'Mage Hand').ok, false)
})

// ── Aasimar ───────────────────────────────────────────────────────────────────────────────────────

test('Aasimar Light Bearer: knows Light, cast with Charisma', () => {
  const a = build('Aasimar', {}, 1)
  assert.ok(a.spells.some((s) => s.name === 'Light'))
  const sheet = characterSheet(a)
  const src = sheet.featureSpellcasting.find((x) => x.source === 'Light Bearer')
  assert.equal(src.ability, 'cha')
  // 8 + Charisma modifier (13 -> +1) + Proficiency Bonus (+2 at level 1)
  assert.equal(src.saveDC.value, 8 + 1 + 2)
})

test('Healing Hands rolls a d4 for each point of Proficiency Bonus, once per Long Rest', () => {
  const a = build('Aasimar', {}, 5) // Proficiency Bonus +3
  const id = 'pub24_species_aasimar-healing-hands'
  const r = useFeature(a, id, { rng: high })
  assert.equal(r.ok, true)
  assert.deepEqual(r.effects, [
    {
      kind: 'heal',
      target: 'a creature you touch',
      dice: '3d4',
      rolls: [4, 4, 4],
      total: 12,
    },
  ])
  assert.equal(feature(merge(a, r.patch), id).uses_current, 0)
  assert.equal(useFeature(merge(a, r.patch), id).ok, false)
  // the level-1 character rolls 2d4
  const l1 = build('Aasimar', {}, 1)
  assert.equal(useFeature(l1, id, { rng: low }).effects[0].dice, '2d4')
})

test('Celestial Revelation (level 3): one form for a minute, extra damage equal to the Proficiency Bonus', () => {
  const REV = 'pub24_species_aasimar-celestial-revelation'
  const two = build('Aasimar', {}, 2)
  assert.match(useFeature(two, REV, { option: 'x' }).error, /level 3/)
  const a = build('Aasimar', {}, 5)
  assert.deepEqual(
    featureAction(a, feature(a, REV)).options.map((o) => o.name),
    ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud']
  )
  assert.match(useFeature(a, REV).error, /choose one of/)

  // Heavenly Wings: a Fly Speed equal to the Speed; the extra damage is radiant
  const wings = useFeature(a, REV, {
    option: 'pub24_species_aasimar-heavenly-wings',
  })
  const flying = merge(a, wings.patch)
  assert.equal(flySpeedBreakdown(flying).value, speedBreakdown(flying).value)
  assert.equal(flySpeedBreakdown(a), null)
  const effect = characterGrants(flying).activeEffects[0]
  assert.equal(effect.extraDamage.amount.value, 3)
  assert.equal(effect.extraDamage.type, 'radiant')
  assert.equal(
    useFeature(flying, REV, { option: 'pub24_species_aasimar-inner-radiance' })
      .ok,
    false
  )

  // Inner Radiance: 10 ft. bright and 10 ft. dim light, radiant damage each turn end equal to PB
  const rad = merge(
    a,
    useFeature(a, REV, { option: 'pub24_species_aasimar-inner-radiance' }).patch
  )
  const radGrants = characterGrants(rad)
  assert.deepEqual(radGrants.light, { bright_feet: 10, dim_feet: 10 })
  assert.equal(radGrants.activeEffects[0].aura.damage.amount.value, 3)
  assert.equal(radGrants.activeEffects[0].aura.radiusFeet, 10)

  // Necrotic Shroud: Charisma save, DC 8 + CHA modifier (+1) + PB (+3) = 12; the extra damage is necrotic
  const shroud = useFeature(a, REV, {
    option: 'pub24_species_aasimar-necrotic-shroud',
  })
  const save = shroud.effects.find((e) => e.kind === 'area_save')
  assert.equal(save.dc.value, 12)
  assert.equal(save.ability, 'cha')
  assert.equal(save.onFailure.condition, 'Frightened')
  assert.equal(
    characterGrants(merge(a, shroud.patch)).activeEffects[0].extraDamage.type,
    'necrotic'
  )

  // ended by the player, or by a rest
  assert.deepEqual(
    merge(flying, endActiveEffect(flying, REV).patch).active_effects,
    []
  )
  assert.deepEqual(
    merge(flying, rest.applyShortRest(flying).patch).active_effects,
    []
  )
})

// ── Dragonborn, Dwarf, Goliath ────────────────────────────────────────────────────────────────────

test('Breath Weapon: 1d10 at level 1, 2d10 at 5, 3d10 at 11, 4d10 at 17; DC 8 + CON + PB; the ancestry sets the type', () => {
  const BW = 'pub24_species_dragonborn-breath-weapon'
  const expect = {
    1: ['1d10', 2],
    5: ['2d10', 3],
    11: ['3d10', 4],
    17: ['4d10', 6],
  }
  for (const [level, [dice, pb]] of Object.entries(expect)) {
    const d = build('Dragonborn', { ancestry: 'Gold' }, Number(level))
    const r = useFeature(d, BW, { rng: high })
    const e = r.effects[0]
    assert.equal(e.damage.dice, dice, `level ${level}`)
    assert.equal(e.damage.type, 'fire')
    const conMod = Math.floor((d.stat_con - 10) / 2) // the Fighter's ability score improvements raise it
    assert.equal(e.dc.value, 8 + conMod + pb, `DC at level ${level}`)
    assert.equal(e.ability, 'dex')
    assert.equal(e.onSuccess, 'half')
    assert.deepEqual(
      e.shapes.map((s) => [s.shape, s.feet]),
      [
        ['cone', 15],
        ['line', 30],
      ]
    )
    assert.equal(feature(d, BW).uses_max, pb)
  }
  assert.equal(
    useFeature(build('Dragonborn', { ancestry: 'Silver' }, 1), BW).effects[0]
      .damage.type,
    'cold'
  )
})

test('Draconic Flight (level 5): a Fly Speed equal to the Speed for 10 minutes, once per Long Rest', () => {
  const FLIGHT = 'pub24_species_dragonborn-draconic-flight'
  assert.match(
    useFeature(build('Dragonborn', { ancestry: 'Red' }, 4), FLIGHT).error,
    /level 5/
  )
  const d = build('Dragonborn', { ancestry: 'Red' }, 5)
  const r = useFeature(d, FLIGHT)
  assert.equal(r.durationMinutes, 10)
  const flying = merge(d, r.patch)
  assert.equal(flySpeedBreakdown(flying).value, 30)
  assert.equal(
    useFeature(merge(flying, endActiveEffect(flying, FLIGHT).patch), FLIGHT).ok,
    false
  ) // no use left
  assert.equal(
    merge(flying, rest.applyLongRest(flying).patch).active_effects.length,
    0
  )
})

test('Dwarf Stonecunning: Tremorsense 60 ft. for 10 minutes, a number of times equal to the Proficiency Bonus', () => {
  const SC = 'pub24_species_dwarf-stonecunning'
  const d = build('Dwarf', {}, 5)
  assert.equal(feature(d, SC).uses_max, 3)
  assert.equal(characterGrants(d).senses.tremorsense, undefined)
  const on = merge(d, useFeature(d, SC).patch)
  assert.equal(characterGrants(on).senses.tremorsense, 60)
  assert.equal(feature(on, SC).uses_current, 2)
})

test('Dwarven Toughness: +1 maximum Hit Point per level', () => {
  const dwarf = build('Dwarf', {}, 5)
  const orc = build('Orc', {}, 5)
  assert.equal(dwarf.hp_max - orc.hp_max, 5)
  // the species data and the mechanics entry carry the same number
  const species = require('../data/5e2024/species.json').find(
    (s) => s.name === 'Dwarf'
  )
  const trait = species.traits.find((t) => t.name === 'Dwarven Toughness')
  assert.equal(
    require('../data/5e/feature-mechanics.json')[trait.id].grants_hp_per_level,
    trait.grants_hp_per_level
  )
})

test('Goliath Large Form (level 5): Large, +10 ft. Speed, advantage on Strength checks, for 10 minutes', () => {
  const LF = 'pub24_species_goliath-large-form'
  const g = build('Goliath', { ancestry: "Stone's Endurance" }, 5)
  assert.equal(sr.effectiveSize(g, 'current'), 'Medium')
  const on = merge(g, useFeature(g, LF).patch)
  assert.equal(sr.effectiveSize(on, 'current'), 'Large')
  assert.equal(speedBreakdown(on).value, speedBreakdown(g).value + 10)
  assert.ok(
    characterGrants(on).checkAdvantages.some((c) => c.ability === 'str')
  )
  assert.equal(characterSheet(on).size.current, 'Large')
})

test('Giant Ancestry: each boon is a rule with its dice, used a Proficiency Bonus number of times', () => {
  const ga = (pick, level = 5) => build('Goliath', { ancestry: pick }, level)
  const use = (pick, rng = high, level) => {
    const c = ga(pick, level)
    const f = c.features.find((x) => x.name === `Giant Ancestry: ${pick}`)
    assert.equal(f.uses_max, level === 1 ? 2 : 3)
    return useFeature(c, f.id, { rng })
  }
  const fire = use("Fire's Burn").effects[0]
  assert.deepEqual(
    [fire.kind, fire.dice, fire.type],
    ['damage', '1d10', 'fire']
  )
  const frost = use("Frost's Chill").effects
  assert.deepEqual([frost[0].dice, frost[0].type], ['1d6', 'cold'])
  assert.deepEqual([frost[1].kind, frost[1].feet], ['speed_reduction', 10])
  const hill = use("Hill's Tumble").effects[0]
  assert.deepEqual([hill.condition, hill.maxTargetSize], ['Prone', 'Large'])
  const storm = use("Storm's Thunder").effects[0]
  assert.deepEqual([storm.dice, storm.type], ['1d8', 'thunder'])
  const cloud = use("Cloud's Jaunt").effects[0]
  assert.deepEqual([cloud.kind, cloud.feet], ['teleport', 30])
  // Stone's Endurance: roll 1d12 and add the Constitution modifier (15 -> +2): 12 + 2 = 14 at most
  const stone = use("Stone's Endurance").effects[0]
  assert.deepEqual([stone.dice, stone.bonus, stone.total], ['1d12', 2, 14])
  const f = ga("Stone's Endurance").features.find((x) => /Stone/.test(x.name))
  assert.equal(f.action_type, 'reaction')
  // a level-1 Goliath has Proficiency Bonus +2
  assert.equal(use("Fire's Burn", high, 1).ok, true)
})

// ── Orc, Tiefling, Gnome ──────────────────────────────────────────────────────────────────────────

test('Orc Adrenaline Rush: Dash as a Bonus Action and Temporary Hit Points equal to the Proficiency Bonus', () => {
  const o = build('Orc', {}, 5)
  const AR = 'pub24_species_orc-adrenaline-rush'
  assert.equal(feature(o, AR).uses_max, 3)
  assert.equal(feature(o, AR).recharge, 'short_rest')
  const r = useFeature(o, AR)
  assert.deepEqual(
    r.effects.map((e) => e.kind),
    ['action', 'temp_hp']
  )
  assert.equal(r.effects[1].amount, 3)
  assert.equal(merge(o, r.patch).hp_temp, 3)
  // a short rest gives the uses back
  const spent = merge(o, {
    features: o.features.map((f) =>
      f.id === AR ? { ...f, uses_current: 0 } : f
    ),
  })
  assert.equal(
    feature(merge(spent, rest.applyShortRest(spent).patch), AR).uses_current,
    3
  )
})

test('Orc Relentless Endurance: dropped to 0 but not killed outright, stay at 1; once per Long Rest', () => {
  const o = build('Orc', {}, 5)
  const hit = merge({ ...o, hp_current: 8, hp_temp: 0 }, {})
  const first = sr.applyDamageWithSurvival(hit, 20)
  assert.equal(first.patch.hp_current, 1)
  assert.equal(first.survivedWith, 'Relentless Endurance')
  const after = merge(hit, first.patch)
  assert.equal(
    feature(after, 'pub24_species_orc-relentless-endurance').uses_current,
    0
  )
  // spent: the next one drops to 0
  const second = sr.applyDamageWithSurvival({ ...after, hp_current: 1 }, 5)
  assert.equal(second.patch.hp_current, 0)
  assert.equal(second.survivedWith, null)
  // killed outright: the damage left after reaching 0 equals the Hit Point maximum
  const outright = sr.applyDamageWithSurvival(hit, 8 + o.hp_max)
  assert.equal(outright.killedOutright, true)
  assert.equal(outright.patch.hp_current, 0)
  // damage that does not reduce to 0 is plain damage
  assert.equal(sr.applyDamageWithSurvival(hit, 3).patch.hp_current, 5)
  // a Human has no such trait
  assert.equal(
    sr.applyDamageWithSurvival({ hp_max: 20, hp_current: 5, features: [] }, 9)
      .patch.hp_current,
    0
  )
})

test('Tiefling Otherworldly Presence: Thaumaturgy, cast with the Fiendish Legacy ability', () => {
  const t = build('Tiefling', { legacy: 'Infernal', spellAbility: 'cha' }, 1)
  assert.ok(t.spells.some((s) => s.name === 'Thaumaturgy'))
  const f = t.features.find((x) => x.name === 'Otherworldly Presence')
  assert.equal(f.ability_choice, 'cha')
  const wis = build('Tiefling', { legacy: 'Abyssal', spellAbility: 'wis' }, 1)
  assert.equal(
    wis.features.find((x) => x.name === 'Otherworldly Presence').ability_choice,
    'wis'
  )
})

test('Forest Gnome casts Speak with Animals a Proficiency Bonus number of times, following the level', () => {
  const uses = (level) =>
    build(
      'Gnome',
      { lineage: 'Forest Gnome', spellAbility: 'wis' },
      level
    ).spells.find((s) => s.name === 'Speak with Animals')
  assert.equal(uses(1).uses_max, 2)
  assert.equal(uses(5).uses_max, 3)
  assert.equal(uses(9).uses_max, 4)
  assert.equal(uses(5).recharge, 'long_rest')
})

test('Rock Gnome: up to three Tiny clockwork devices (AC 5, 1 HP) at a time, gone after a rest', () => {
  const g = build('Gnome', { lineage: 'Rock Gnome', spellAbility: 'int' }, 1)
  assert.deepEqual(
    [
      sr.objectLimit(g, 'Clockwork device').max,
      sr.objectLimit(g, 'Clockwork device').ac,
    ],
    [3, 5]
  )
  let c = g
  for (const effect of ['Ignite', 'Sound', 'Clean']) {
    const r = sr.createObject(c, 'Clockwork device', effect)
    assert.equal(r.ok, true)
    c = merge(c, r.patch)
  }
  assert.equal(sr.createObject(c, 'Clockwork device', 'Chill').ok, false)
  const one = merge(c, sr.dismantleObject(c, 0).patch)
  assert.equal(sr.createObject(one, 'Clockwork device', 'Chill').ok, true)
  assert.deepEqual(merge(c, rest.applyLongRest(c).patch).created_objects, [])
  assert.equal(
    sr.createObject(build('Orc', {}, 1), 'Clockwork device', 'x').ok,
    false
  )
})

test('the Wood Elf lineage sets Speed 35; Drow 120 ft. darkvision; Tiefling legacies and Dragonborn ancestries give their resistance', () => {
  assert.equal(
    speedBreakdown(
      build(
        'Elf',
        { lineage: 'Wood Elf', spellAbility: 'wis', keenSenses: 'Perception' },
        1
      )
    ).value,
    35
  )
  assert.equal(
    characterGrants(
      build(
        'Elf',
        { lineage: 'Drow', spellAbility: 'int', keenSenses: 'Perception' },
        1
      )
    ).darkvision,
    120
  )
  assert.deepEqual(
    characterGrants(
      build('Tiefling', { legacy: 'Chthonic', spellAbility: 'cha' }, 1)
    ).resistances,
    ['necrotic']
  )
  assert.deepEqual(
    characterGrants(build('Dragonborn', { ancestry: 'Blue' }, 1)).resistances,
    ['lightning']
  )
})
