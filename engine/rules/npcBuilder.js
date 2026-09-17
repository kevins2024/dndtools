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
const { applySpeciesBonus } = require('./5e/species')
const { abilityModifier } = require('./5e/abilities')
const { proficiencyBonus } = require('./5e/progression')
const { loadClass } = require('./5e/classFeatures')
const {
  listInvocations,
  meetsInvocationPrerequisite,
} = require('./5e/invocations')

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
    subclassName: 'Berserker',
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
    subclassName: 'Evocation',
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
    subclassName: 'The Fiend',
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

function buildShell(speciesName, roleConfig) {
  const baseline = assignBaseScores(roleConfig)
  const { scores } = applySpeciesBonus(baseline, speciesName)
  return {
    name: `${roleConfig.label} (${roleConfig.className})`,
    race: speciesName,
    subrace: null,
    level: 0,
    classes: [{ name: roleConfig.className, level: 0, subclass: null }],
    hp_max: 0,
    hp_current: 0,
    hit_dice_current: 0,
    stat_str: scores.str,
    stat_dex: scores.dex,
    stat_con: scores.con,
    stat_int: scores.int,
    stat_wis: scores.wis,
    stat_cha: scores.cha,
    spellcasting_ability: null,
    saving_throws: [],
    skill_proficiencies: [],
    armor_proficiencies: [],
    weapon_proficiencies: [],
    features: [],
    spells: [],
    ability_score_history: [],
  }
}

// Resolves the ability-score half of an ASI. asiFeat.js's applyIncrease
// requires the total to be EXACTLY +2 across whatever abilities are named —
// even a declared +0 is rejected — so this always spends both points
// somewhere real, walking roleConfig.statOrder (primary first) and spilling
// into the next ability in priority order once one hits the 20 cap. Only
// six abilities exist and a full level-20 build has far fewer than six ASIs
// worth of +2s to place, so running out of room entirely isn't reachable in
// practice; if it ever were, throwing (rather than silently sending an
// invalid resolution) is the right failure mode.
function asiIncreases(currentScores, roleConfig) {
  const order = roleConfig.statOrder
  let remaining = 2
  const increases = {}
  for (const ability of order) {
    if (remaining <= 0) break
    const room = Math.max(0, 20 - (currentScores[ability] ?? 10))
    if (room <= 0) continue
    const spend = Math.min(room, remaining)
    increases[ability] = spend
    remaining -= spend
  }
  if (remaining > 0) {
    throw new Error(
      `No ability score has room left for an ASI (all of ${order.join(
        ', '
      )} at or near 20).`
    )
  }
  return increases
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

// Resolves one pendingChoice into either a diffLevelUp call parameter
// ({ param, value }) or a direct character mutation ({ characterPatch }) —
// subclassChoice is the one type diffLevelUp reads off the character record
// itself (classes[].subclass) rather than accepting as a call param.
function resolveChoice(choice, roleConfig, character) {
  switch (choice.type) {
    case 'asiOrFeat':
      return {
        param: 'asiOrFeatResolutions',
        merge: (existing = {}) => ({
          ...existing,
          [choice.level]: {
            type: 'asi',
            increases: asiIncreases(currentScores(character), roleConfig),
          },
        }),
      }
    case 'subclassChoice': {
      const idx = character.classes.findIndex(
        (c) => normalizeName(c.name) === normalizeName(roleConfig.className)
      )
      if (idx === -1 || character.classes[idx].subclass) return null
      return {
        characterPatch: {
          classes: character.classes.map((c, i) =>
            i === idx ? { ...c, subclass: roleConfig.subclassName } : c
          ),
        },
      }
    }
    case 'fightingStyleChoice':
      return {
        param: 'fightingStyleChoice',
        merge: () => roleConfig.fightingStyle ?? choice.options?.[0] ?? null,
      }
    case 'expertiseChoice':
      return {
        param: 'expertiseChoice',
        merge: () =>
          roleConfig.expertiseSkills ?? (choice.options ?? []).slice(0, 2),
      }
    case 'favoredEnemyChoice':
      return {
        param: 'favoredEnemyChoice',
        merge: () => roleConfig.favoredEnemy ?? choice.options?.[0] ?? null,
      }
    case 'naturalExplorerChoice':
      return {
        param: 'naturalExplorerChoice',
        merge: () => roleConfig.naturalExplorer ?? choice.options?.[0] ?? null,
      }
    case 'pactBoonChoice':
      return {
        param: 'pactBoonChoice',
        merge: () => roleConfig.pactBoon ?? 'Pact of the Blade',
      }
    case 'invocationChoice': {
      const pool =
        roleConfig.invocationPreferences ?? listInvocations().map((i) => i.name)
      const eligible = pool.filter((name) =>
        meetsInvocationPrerequisite(character, name)
      )
      return {
        param: 'invocationChoices',
        merge: () => eligible,
      }
    }
    case 'bonusSpellChoice':
      return {
        param: 'pactBoonBonusSpells',
        merge: (existing = []) => existing,
      }
    case 'newCantrips':
      return {
        param: 'spellChoices',
        merge: (existing = {}) => ({
          ...existing,
          cantrips: roleConfig.cantripPreferences ?? [],
        }),
      }
    case 'newKnownSpells':
      return {
        param: 'spellChoices',
        merge: (existing = {}) => ({
          ...existing,
          spells: roleConfig.spellPreferences ?? [],
        }),
      }
    case 'spellbookAdditions':
      return {
        param: 'spellbookChoices',
        merge: (existing = []) => roleConfig.spellPreferences ?? [],
      }
    case 'multiclassSkillChoice': {
      // Despite the name, this also fires for a genuine STARTING class (not
      // just a real multiclass pickup) for the handful of classes whose
      // starting skill grant diffLevelUp models this way (Bard/Ranger/
      // Rogue) — confirmed by smoke-testing Rogue, which threw without this
      // case handled. Picks the first legal option not already known.
      const classData = loadClass(roleConfig.className)
      const options = classData?.skill_choices?.options
      const already = new Set(character.skill_proficiencies || [])
      const pick = Array.isArray(options)
        ? options.find((id) => !already.has(id))
        : null
      if (!pick) return null
      return {
        param: 'multiclassSkillChoice',
        merge: () => pick,
      }
    }
    default:
      return null
  }
}

function applyResolution(resolutions, resolved) {
  if (!resolved || !resolved.param) return resolutions
  const next = { ...resolutions }
  next[resolved.param] = resolved.merge(resolutions[resolved.param])
  return next
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
    let resolutions = {}
    let result = null
    for (let attempt = 0; attempt < 8; attempt++) {
      result = diffLevelUp(character, {
        className: roleConfig.className,
        toLevel: level,
        hpMethod: 'average',
        ...resolutions,
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
      let mutated = false
      for (const choice of pending) {
        const resolved = resolveChoice(choice, roleConfig, character)
        if (resolved?.characterPatch) {
          character = { ...character, ...resolved.characterPatch }
          mutated = true
        } else if (resolved) {
          resolutions = applyResolution(resolutions, resolved)
        }
      }
      if (!mutated && attempt === 7) {
        throw new Error(
          `${
            roleConfig.className
          } level ${level}: could not resolve pendingChoices ${JSON.stringify(
            pending
          )} after 8 attempts.`
        )
      }
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
