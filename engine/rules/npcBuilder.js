// Headless "build a real, leveled combatant" — drives the exact same engine
// that powers LevelUpTool.vue (diffLevelUp), but with an automatic chooser
// standing in for the human clicking through its forms, so a DM can get a
// mechanically real enemy (real class features, real spells, real subclass)
// in one call instead of an hour of manual level-up clicks. Exists because
// encounter_utils.js's synthetic enemy generator is level-insensitive (see
// its own file for the audit) — this is the "real teeth" alternative for the
// handful of role archetypes curated below.
//
// Framework-free, no Vue/store knowledge — same spirit as combatTurn.js,
// though (unlike that module) this one DOES pull in classFeatures.js/
// species.js, which read engine/data/*.json off disk via fs/path, so it's
// NOT eligible for direct browser require() — server.js is the only caller.

const { diffLevelUp } = require('./5e/diffLevelUp')
const { answerChoice } = require('./5e/choiceAnswers')
const { abilityModifier } = require('./5e/abilities')
const { proficiencyBonus } = require('./5e/progression')
const { loadClass } = require('./5e/classFeatures')

function normalizeName(name) {
  return String(name).trim().toLowerCase()
}

// One entry per supported role. `baseScores` is a priority-ordered point-buy
// spread (highest first) assigned to primaryStat, then secondaryStat, then
// the rest in a fixed fallback order — sensible regardless of which species
// ends up applied on top, since species is chosen independently (see
// server.js's build-npc route) rather than fixed per role here.
const ROLE_TABLE = {
  melee_str: {
    label: 'Melee (Strength)',
    className: 'Barbarian',
    subclassName: 'Path of the Berserker',
    primaryStat: 'str',
    secondaryStat: 'con',
    baseScores: [15, 14, 13, 12, 10, 8],
    statOrder: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  },
  melee_dex: {
    label: 'Melee (Dexterity)',
    className: 'Rogue',
    subclassName: 'Assassin',
    primaryStat: 'dex',
    secondaryStat: 'con',
    baseScores: [15, 14, 13, 12, 10, 8],
    statOrder: ['dex', 'con', 'wis', 'int', 'cha', 'str'],
  },
  ranged: {
    label: 'Ranged',
    className: 'Fighter',
    subclassName: 'Champion',
    primaryStat: 'dex',
    secondaryStat: 'con',
    fightingStyle: 'Archery',
    baseScores: [15, 14, 13, 12, 10, 8],
    statOrder: ['dex', 'con', 'str', 'wis', 'cha', 'int'],
  },
  caster_int: {
    label: 'Caster (Intelligence)',
    className: 'Wizard',
    subclassName: 'Evoker',
    primaryStat: 'int',
    secondaryStat: 'con',
    baseScores: [15, 14, 13, 12, 10, 8],
    statOrder: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
    // Order matters — most-wanted first. diffLevelUp only ever takes as many
    // as it actually needs and skips ones already known, so it's safe (and
    // required, at high level) to just hand over the whole list every time.
    cantripPreferences: [
      'Fire Bolt',
      'Ray of Frost',
      'Mage Hand',
      'Minor Illusion',
      'Prestidigitation',
      'Light',
      'Shocking Grasp',
      'Poison Spray',
    ],
    // Wizard's "spellbook additions" grant is a flat +2/level, EVERY level —
    // by level 20 that's ~40+ cumulative entries needed, not just a handful
    // of "greatest hits." Padded well past that so a high-level build never
    // runs the list dry (confirmed by this module's own test suite, which
    // builds up to level 19).
    spellPreferences: [
      'Magic Missile',
      'Shield',
      'Burning Hands',
      'Chromatic Orb',
      'Thunderwave',
      'Detect Magic',
      'Identify',
      'Comprehend Languages',
      'Find Familiar',
      'Scorching Ray',
      'Misty Step',
      'Mirror Image',
      'Web',
      'Suggestion',
      'Alter Self',
      'Invisibility',
      'Fireball',
      'Counterspell',
      'Fly',
      'Haste',
      'Slow',
      'Lightning Bolt',
      'Clairvoyance',
      'Tongues',
      'Dispel Magic',
      'Ice Storm',
      'Greater Invisibility',
      'Fire Shield',
      'Confusion',
      'Polymorph',
      'Stoneskin',
      'Dimension Door',
      'Wall of Fire',
      'Cone of Cold',
      'Wall of Force',
      'Banishment',
      'Black Tentacles',
      'Globe of Invulnerability',
      'Disintegrate',
      'Chain Lightning',
      'Dominate Person',
      "Otiluke's Resilient Sphere",
      'Delayed Blast Fireball',
      'Prismatic Spray',
      'Sunburst',
      'Reverse Gravity',
      'Teleport',
      'Meteor Swarm',
      'Mind Blank',
      'Power Word Stun',
      'Time Stop',
      'Foresight',
      'Power Word Kill',
      'Wish',
    ],
  },
  caster_cha: {
    label: 'Caster (Charisma)',
    className: 'Warlock',
    subclassName: 'Fiend Patron',
    primaryStat: 'cha',
    secondaryStat: 'con',
    pactBoon: 'Pact of the Blade',
    baseScores: [15, 14, 13, 12, 10, 8],
    statOrder: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
    cantripPreferences: [
      'Eldritch Blast',
      'Minor Illusion',
      'Prestidigitation',
      'Mage Hand',
      'Chill Touch',
      'True Strike',
    ],
    invocationPreferences: [
      'Agonizing Blast',
      'Armor of Shadows',
      "Devil's Sight",
      'Thirsting Blade',
      'Repelling Blast',
      'Eldritch Smite',
      'Lifedrinker',
      'Improved Pact Weapon',
      'Mask of Many Faces',
      'One with Shadows',
    ],
    spellPreferences: [
      'Hex',
      'Armor of Agathys',
      'Hellish Rebuke',
      'Misty Step',
      'Suggestion',
      'Fear',
      'Hunger of Hadar',
      'Counterspell',
      'Banishment',
      'Blight',
      'Dimension Door',
      'Hold Monster',
      'Circle of Death',
      'Finger of Death',
      'Investiture of Flame',
    ],
  },
}

function defaultBaseline(scores) {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8, ...scores }
}

// Assigns roleConfig.baseScores (priority order, highest first) across
// roleConfig.statOrder (which ability gets which priority slot).
function assignBaseScores(roleConfig) {
  const scores = defaultBaseline({})
  roleConfig.statOrder.forEach((ability, i) => {
    scores[ability] = roleConfig.baseScores[i] ?? 8
  })
  return scores
}

// A level-0 2024 character: the role's standard-array-style scores with a Background's
// +2/+1 on the primary and secondary stat (the species grants none in 2024), recorded as
// the base scores the level-ups are calculated from.
function buildShell(speciesName, roleConfig) {
  const base = assignBaseScores(roleConfig)
  base[roleConfig.primaryStat] += 2
  base[roleConfig.secondaryStat] += 1
  const classData = loadClass(roleConfig.className)
  const skills = (classData?.skill_choices?.options ?? [])
    .slice(0, classData?.skill_choices?.count ?? 2)
    .map((id) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
  return {
    name: `${roleConfig.label} (${roleConfig.className})`,
    ruleset: '2024',
    genus: speciesName,
    subgenus: null,
    level: 0,
    classes: [{ name: roleConfig.className, level: 0, subclass: null }],
    hp_max: 0,
    hp_current: 0,
    hit_dice_current: 0,
    ability_base: { ...base },
    stat_str: base.str,
    stat_dex: base.dex,
    stat_con: base.con,
    stat_int: base.int,
    stat_wis: base.wis,
    stat_cha: base.cha,
    spellcasting_ability: null,
    saving_throws: classData?.saving_throw_proficiencies ?? [],
    skill_proficiencies: skills,
    skill_expertise: [],
    armor_proficiencies: classData?.armor_proficiencies ?? [],
    weapon_proficiencies: classData?.weapon_proficiencies ?? [],
    features: [],
    spells: [],
    ability_score_history: [],
  }
}

function currentScores(character) {
  return {
    str: character.stat_str ?? 10,
    dex: character.stat_dex ?? 10,
    con: character.stat_con ?? 10,
    int: character.stat_int ?? 10,
    wis: character.stat_wis ?? 10,
    cha: character.stat_cha ?? 10,
  }
}

// Levels a single class from 0 to targetLevel, one level at a time, letting
// diffLevelUp itself discover what's pending at each level (rather than
// hardcoding each class's choice schedule) and auto-resolving via
// resolveChoice until nothing's left pending — the same converge-until-empty
// loop LevelUpTool.vue's UI does by hand, just automatic.
function buildCombatant({ speciesName, role, targetLevel }) {
  const roleConfig = ROLE_TABLE[role]
  if (!roleConfig) {
    throw new Error(
      `Unknown role "${role}" — expected one of: ${Object.keys(ROLE_TABLE).join(
        ', '
      )}`
    )
  }
  let character = buildShell(speciesName, roleConfig)
  const warnings = []

  for (let level = 1; level <= targetLevel; level++) {
    const inputs = {}
    let result = null
    for (let attempt = 0; attempt < 8; attempt++) {
      result = diffLevelUp(character, {
        className: roleConfig.className,
        toLevel: level,
        hpMethod: 'average',
        ...inputs,
      })
      if (!result.patch) {
        throw new Error(
          `Could not build level ${level} ${
            roleConfig.className
          }: ${result.warnings?.join(' ')}`
        )
      }
      const pending = result.pendingChoices || []
      if (pending.length === 0) break
      // The build already names its subclass; the rest are answered by the shared policy.
      const sub = pending.find((p) => p.type === 'subclassChoice')
      if (sub)
        character = {
          ...character,
          classes: character.classes.map((c) =>
            normalizeName(c.name) === normalizeName(roleConfig.className) &&
            !c.subclass
              ? { ...c, subclass: roleConfig.subclassName }
              : c
          ),
        }
      const before = JSON.stringify(inputs)
      const unresolved = pending.filter(
        (p) =>
          p.type !== 'subclassChoice' &&
          !answerChoice(
            p,
            inputs,
            {
              character,
              className: roleConfig.className,
              toLevel: level,
            },
            { ...roleConfig, abilityOrder: roleConfig.statOrder }
          )
      )
      if (unresolved.length)
        throw new Error(
          `${
            roleConfig.className
          } level ${level}: no answer for pendingChoices ${JSON.stringify(
            unresolved.map((p) => p.type)
          )}.`
        )
      if (!sub && JSON.stringify(inputs) === before && attempt === 7)
        throw new Error(
          `${
            roleConfig.className
          } level ${level}: could not resolve pendingChoices ${JSON.stringify(
            pending
          )} after 8 attempts.`
        )
    }
    if (result.warnings?.length) warnings.push(...result.warnings)
    character = { ...character, ...result.patch }
  }

  return { character, warnings }
}

// Formula-based AC/attack-bonus/save-DC — deliberately NOT equipment-lookup-
// based (a freshly built NPC has no real party_items.json inventory, and
// wiring one up just for a throwaway combatant is its own can of worms; see
// engine/CHECKLIST.md-style reasoning in the plan this shipped from). Uses
// the character's REAL computed proficiency bonus at its REAL level, unlike
// encounter_utils.js's difficulty-only AC formula — this is the direct fix
// for "AC caps regardless of level."
const ARMOR_BASE_BY_ROLE = {
  melee_str: 14, // Barbarian Unarmored Defense flavor: 10 + dex + con, approximated flat
  melee_dex: 13, // light armor (leather) flavor
  ranged: 16, // medium armor (half plate) flavor
  caster_int: 12, // mage armor flavor
  caster_cha: 13, // light armor flavor (Fiend patron, not Hexblade-medium)
}

function toEncounterData(character, role, isBoss) {
  const roleConfig = ROLE_TABLE[role]
  const scores = currentScores(character)
  const prof = proficiencyBonus(character.level)
  const primaryMod = abilityModifier(scores[roleConfig.primaryStat])
  const dexMod = abilityModifier(scores.dex)
  const conMod = abilityModifier(scores.con)

  const ac =
    role === 'melee_str'
      ? 10 + dexMod + conMod
      : ARMOR_BASE_BY_ROLE[role] + Math.min(dexMod, role === 'ranged' ? 2 : 5)

  const attackBonus = prof + primaryMod
  const isCaster = role === 'caster_int' || role === 'caster_cha'

  return {
    roleLabel: `${roleConfig.label} · ${roleConfig.className} (${roleConfig.subclassName})`,
    size: 'Medium',
    ac,
    maxHp: character.hp_max,
    hp: character.hp_max,
    stats: scores,
    attackBonus: isCaster ? null : attackBonus,
    weapon: isCaster
      ? null
      : {
          damageDice:
            role === 'melee_str' ? '2d6' : role === 'melee_dex' ? '1d6' : '1d8',
          damageMod: primaryMod,
          damageType: role === 'ranged' ? 'piercing' : 'slashing',
          magical: false,
          displayName:
            role === 'melee_str'
              ? 'Greataxe'
              : role === 'melee_dex'
              ? 'Shortsword'
              : 'Longbow',
        },
    spellSaveDC: isCaster ? 8 + prof + primaryMod : null,
    spellAttackBonus: isCaster ? prof + primaryMod : null,
    features: character.features ?? [],
    spells: character.spells ?? [],
    isBoss: !!isBoss,
  }
}

function listRoles() {
  return Object.entries(ROLE_TABLE).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    className: cfg.className,
    subclassName: cfg.subclassName,
  }))
}

module.exports = { buildCombatant, toEncounterData, listRoles, ROLE_TABLE }
