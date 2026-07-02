import { pick, GENDERS, RACES } from './character_utils.js'
import monstersIndex from '@/data/monsters_index.json'

// ── Pre-group bestiary by type for fast CR-filtered lookup ───────────────────
const BESTIARY_BY_TYPE = {}
for (const m of monstersIndex) {
  const t = m.type ?? 'Unknown'
  if (!BESTIARY_BY_TYPE[t]) BESTIARY_BY_TYPE[t] = []
  BESTIARY_BY_TYPE[t].push(m)
}

// Size ordering used for filtering
const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

// ── Encounter type configuration ─────────────────────────────────────────────
//
// pool:           ordered list of sources. 'humanoid' = procedural generation;
//                 other strings match bestiary type names (Beast, Fiend, etc.).
// humanoidRatio:  when pool has both 'humanoid' and bestiary entries, fraction of
//                 grunt slots that are humanoid. Bosses favour the bestiary pool.
// roleWeights:    weighted role array for humanoid slots (overrides ROLE_POOL).
// sizeMax:        largest creature size allowed when sampling from the bestiary.
// notes:          shown in the wizard header for DM context.

export const ENCOUNTER_TYPE_CONFIG = {
  'Ambush (City)': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_dex',
      'melee_dex',
      'melee_dex',
      'ranged',
      'ranged',
      'caster_cha',
    ],
    sizeMax: 'Medium',
    notes: 'Street ambush — agile melee and ranged, no heavy armour',
  },
  'Ambush (Wilds)': {
    pool: ['Beast', 'Monstrosity'],
    sizeMax: 'Large',
    notes: 'Territorial predators or pack hunters pounce from cover',
  },
  'Skirmish (Military)': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_str',
      'melee_str',
      'melee_str',
      'ranged',
      'ranged',
      'support',
      'caster_int',
    ],
    notes: 'Organised soldiers — infantry, archers, and a battlefield mage',
  },
  'Skirmish (Wilderness)': {
    pool: ['humanoid', 'Beast', 'Monstrosity'],
    humanoidRatio: 0.55,
    roleWeights: ['melee_str', 'melee_str', 'ranged', 'ranged', 'melee_dex'],
    sizeMax: 'Large',
    notes: 'Raiders accompanied by trained or tamed wilderness creatures',
  },
  Siege: {
    pool: ['humanoid'],
    roleWeights: [
      'melee_str',
      'melee_str',
      'melee_str',
      'melee_str',
      'ranged',
      'ranged',
      'support',
      'healer',
    ],
    notes:
      'Fortified assault wave — armoured troops with archer cover and healers',
  },
  Interception: {
    pool: ['humanoid'],
    roleWeights: [
      'melee_dex',
      'melee_dex',
      'ranged',
      'ranged',
      'ranged',
      'caster_int',
    ],
    sizeMax: 'Medium',
    notes: 'Party is cut off mid-route by scouts and skirmishers',
  },
  'Assassination Attempt': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_dex',
      'melee_dex',
      'melee_dex',
      'melee_dex',
      'ranged',
      'caster_cha',
    ],
    sizeMax: 'Medium',
    notes: 'Precision hit — fast, stealthy killers with a specific target',
  },
  'Arena Combat': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_str',
      'melee_str',
      'melee_dex',
      'melee_dex',
      'ranged',
      'ranged',
      'caster_int',
      'caster_cha',
      'healer',
      'support',
    ],
    notes: 'Gladiatorial — all roles valid; tanks included for spectacle',
  },
  'Urban Brawl': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_str',
      'melee_str',
      'melee_dex',
      'melee_dex',
      'ranged',
      'support',
    ],
    sizeMax: 'Medium',
    notes: 'Street brawl — rough fighters, improvised weapons, no formation',
  },
  'Mercenary Contract': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_str',
      'melee_str',
      'ranged',
      'ranged',
      'caster_int',
      'support',
    ],
    notes: 'Hired professionals — mixed but competent combat force',
  },
  'Caravan Raid': {
    pool: ['humanoid'],
    roleWeights: ['melee_str', 'melee_str', 'melee_dex', 'ranged', 'ranged'],
    notes: 'Opportunistic raiders — hit fast, claim valuables, retreat',
  },
  'Prison Break': {
    pool: ['humanoid'],
    roleWeights: ['melee_str', 'melee_str', 'melee_str', 'ranged', 'support'],
    notes: 'Guards or escaped prisoners — desperate and improvised',
  },
  'Heist Gone Wrong': {
    pool: ['humanoid'],
    roleWeights: [
      'melee_dex',
      'melee_dex',
      'melee_dex',
      'ranged',
      'caster_cha',
    ],
    sizeMax: 'Medium',
    notes: 'Thieves cornered mid-job — nimble, tactical, and motivated',
  },
  'The Hunt (Prey)': {
    pool: ['Beast', 'Monstrosity', 'Fiend', 'humanoid', 'Undead'],
    humanoidRatio: 0.25,
    roleWeights: ['melee_dex', 'melee_dex', 'ranged', 'caster_cha'],
    sizeMax: 'Huge',
    notes: 'The party is the hunted — predators of any kind close in',
  },
  'The Hunt (Predator)': {
    pool: ['Beast', 'Monstrosity', 'humanoid', 'Undead', 'Aberration'],
    humanoidRatio: 0.35,
    roleWeights: ['melee_str', 'melee_str', 'ranged', 'melee_dex'],
    sizeMax: 'Huge',
    notes: 'The party pursues quarry — prey could be anything',
  },
  'Wilderness Encounter': {
    pool: ['Beast', 'Monstrosity'],
    sizeMax: 'Huge',
    notes: 'Natural hazard — creatures defending territory or just hungry',
  },
  'Monster Lair': {
    pool: ['Beast', 'Monstrosity', 'Aberration', 'Undead'],
    sizeMax: 'Huge',
    notes: 'Something lives here — dominant creature with minions or spawn',
  },
  'Dungeon Delve': {
    pool: ['Aberration', 'Construct', 'Ooze', 'Undead', 'Monstrosity'],
    sizeMax: 'Huge',
    notes: 'Deep underground — varied denizens of ancient or corrupted places',
  },
  'Cultist Gathering': {
    pool: ['humanoid', 'Fiend', 'Undead'],
    humanoidRatio: 0.65,
    roleWeights: [
      'caster_cha',
      'caster_cha',
      'caster_int',
      'melee_str',
      'support',
    ],
    notes: 'Worshippers with summoned servants — leader is usually a caster',
  },
  'Cultist Summoning': {
    pool: ['humanoid', 'Fiend', 'Undead'],
    humanoidRatio: 0.25,
    roleWeights: ['caster_cha', 'caster_int'],
    notes: 'Ritual in progress — few desperate cultists, many summoned',
  },
  'Ritual Disruption': {
    pool: ['humanoid', 'Fiend'],
    humanoidRatio: 0.55,
    roleWeights: ['caster_cha', 'caster_cha', 'caster_int', 'melee_str'],
    notes: 'Stop the ritual — caster-heavy humanoids with fiendish backup',
  },
  'Undead Rising': {
    pool: ['Undead'],
    sizeMax: 'Large',
    notes: 'The dead walk — horde, awakened dead, or something worse',
  },
  'Demonic Incursion': {
    pool: ['Fiend', 'Aberration'],
    sizeMax: 'Huge',
    notes: 'Planar breach — fiends and corrupted beings pour through',
  },
  'Ancient Guardian': {
    pool: ['Construct', 'Aberration', 'Undead'],
    sizeMax: 'Huge',
    notes: 'Ancient defenders — constructs or spirits protecting old places',
  },
}

export const ENCOUNTER_TYPES = Object.keys(ENCOUNTER_TYPE_CONFIG)

// ── Difficulties ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ['trivial', 'easy', 'medium', 'hard', 'deadly']

export const DIFFICULTY_SELECTABLE = [
  'trivial',
  'easy',
  'medium',
  'hard',
  'deadly',
  'random',
  'random (no extremes)',
]

const DIFFICULTY_PARAMS = {
  trivial: {
    hpMinOffset: -10,
    hpMaxOffset: -5,
    countRange: [-3, -1],
    bossChance: 0,
    extraBossChances: [],
  },
  easy: {
    hpMinOffset: -2,
    hpMaxOffset: 5,
    countRange: [-2, 0],
    bossChance: 0,
    extraBossChances: [],
  },
  medium: {
    hpMinOffset: 5,
    hpMaxOffset: 20,
    countRange: [-2, 2],
    bossChance: 0,
    extraBossChances: [],
  },
  hard: {
    hpMinOffset: 15,
    hpMaxOffset: 40,
    countRange: [0, 3],
    bossChance: 0.35,
    extraBossChances: [],
  },
  deadly: {
    hpMinOffset: 25,
    hpMaxOffset: 60,
    countRange: [2, 5],
    bossChance: 1,
    extraBossChances: [0.5, 0.25],
  },
}

function resolveDifficulty(difficulty) {
  if (difficulty === 'random') return pick(DIFFICULTIES)
  if (difficulty === 'random (no extremes)')
    return pick(['easy', 'medium', 'hard'])
  return difficulty
}

// ── Role stat profiles (humanoid) ─────────────────────────────────────────────

export const ROLE_PROFILES = {
  melee_str: {
    label: 'Melee (STR)',
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [14, 18],
      dex: [10, 14],
      con: [14, 18],
      int: [6, 10],
      wis: [8, 12],
      cha: [6, 10],
    },
  },
  melee_dex: {
    label: 'Melee (DEX)',
    primary: 'dex',
    hitDie: 10,
    ranges: {
      str: [8, 12],
      dex: [14, 18],
      con: [12, 16],
      int: [8, 12],
      wis: [10, 12],
      cha: [8, 12],
    },
  },
  ranged: {
    label: 'Ranged',
    primary: 'dex',
    hitDie: 8,
    ranges: {
      str: [8, 12],
      dex: [14, 18],
      con: [10, 14],
      int: [8, 12],
      wis: [10, 14],
      cha: [8, 12],
    },
  },
  caster_int: {
    label: 'Caster (INT)',
    primary: 'int',
    hitDie: 6,
    ranges: {
      str: [6, 10],
      dex: [10, 14],
      con: [10, 14],
      int: [14, 18],
      wis: [10, 14],
      cha: [8, 12],
    },
  },
  caster_cha: {
    label: 'Caster (CHA)',
    primary: 'cha',
    hitDie: 6,
    ranges: {
      str: [6, 10],
      dex: [10, 14],
      con: [10, 14],
      int: [8, 12],
      wis: [8, 12],
      cha: [14, 18],
    },
  },
  healer: {
    label: 'Healer',
    primary: 'wis',
    hitDie: 8,
    ranges: {
      str: [8, 12],
      dex: [10, 14],
      con: [12, 14],
      int: [8, 12],
      wis: [14, 18],
      cha: [10, 14],
    },
  },
  support: {
    label: 'Support',
    primary: 'cha',
    hitDie: 8,
    ranges: {
      str: [8, 12],
      dex: [10, 14],
      con: [10, 14],
      int: [10, 14],
      wis: [10, 14],
      cha: [12, 16],
    },
  },
}

export const ROLE_KEYS = Object.keys(ROLE_PROFILES)

const ROLE_POOL = [
  'melee_str',
  'melee_str',
  'melee_dex',
  'melee_dex',
  'ranged',
  'ranged',
  'caster_int',
  'caster_cha',
  'healer',
  'support',
]

// ── Bestiary creature profiles (non-humanoid) ─────────────────────────────────

const BESTIARY_PROFILES = {
  Beast: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [14, 20],
      dex: [10, 16],
      con: [14, 18],
      int: [2, 6],
      wis: [10, 14],
      cha: [4, 8],
    },
  },
  Monstrosity: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [14, 20],
      dex: [10, 16],
      con: [14, 18],
      int: [4, 10],
      wis: [10, 14],
      cha: [4, 10],
    },
  },
  Fiend: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [14, 18],
      dex: [12, 16],
      con: [14, 18],
      int: [8, 14],
      wis: [10, 14],
      cha: [12, 16],
    },
  },
  Undead: {
    primary: 'str',
    hitDie: 8,
    ranges: {
      str: [12, 18],
      dex: [8, 12],
      con: [12, 16],
      int: [2, 12],
      wis: [8, 14],
      cha: [4, 10],
    },
  },
  Aberration: {
    primary: 'int',
    hitDie: 8,
    ranges: {
      str: [10, 16],
      dex: [10, 14],
      con: [12, 16],
      int: [14, 18],
      wis: [12, 16],
      cha: [6, 12],
    },
  },
  Construct: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [16, 20],
      dex: [6, 10],
      con: [14, 20],
      int: [2, 8],
      wis: [8, 12],
      cha: [2, 6],
    },
  },
  Ooze: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [12, 18],
      dex: [2, 6],
      con: [14, 18],
      int: [1, 2],
      wis: [6, 8],
      cha: [2, 4],
    },
  },
  Dragon: {
    primary: 'str',
    hitDie: 12,
    ranges: {
      str: [18, 22],
      dex: [10, 14],
      con: [16, 20],
      int: [12, 18],
      wis: [12, 14],
      cha: [14, 18],
    },
  },
  Giant: {
    primary: 'str',
    hitDie: 12,
    ranges: {
      str: [18, 24],
      dex: [6, 12],
      con: [16, 20],
      int: [6, 10],
      wis: [8, 12],
      cha: [8, 12],
    },
  },
  Fey: {
    primary: 'dex',
    hitDie: 8,
    ranges: {
      str: [8, 14],
      dex: [14, 18],
      con: [10, 14],
      int: [10, 16],
      wis: [12, 16],
      cha: [14, 18],
    },
  },
  Elemental: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [14, 20],
      dex: [10, 14],
      con: [14, 18],
      int: [4, 8],
      wis: [10, 12],
      cha: [6, 10],
    },
  },
  Celestial: {
    primary: 'wis',
    hitDie: 10,
    ranges: {
      str: [14, 18],
      dex: [12, 16],
      con: [12, 16],
      int: [12, 16],
      wis: [16, 20],
      cha: [14, 18],
    },
  },
  Plant: {
    primary: 'str',
    hitDie: 10,
    ranges: {
      str: [14, 20],
      dex: [4, 8],
      con: [14, 18],
      int: [1, 4],
      wis: [8, 12],
      cha: [2, 6],
    },
  },
  default: {
    primary: 'str',
    hitDie: 8,
    ranges: {
      str: [12, 16],
      dex: [10, 14],
      con: [12, 16],
      int: [6, 12],
      wis: [8, 12],
      cha: [6, 10],
    },
  },
}

const NATURAL_ATTACKS = {
  Beast: ['Claws', 'Bite', 'Gore', 'Talons', 'Stomp', 'Pounce'],
  Monstrosity: ['Claw', 'Bite', 'Sting', 'Slam', 'Tentacle', 'Crush'],
  Fiend: ['Claw', 'Bite', 'Tail Strike', 'Corrupting Touch'],
  Undead: ['Claw', 'Bite', 'Life Drain', 'Necrotic Touch', 'Slam'],
  Aberration: ['Tentacle', 'Psychic Lash', 'Bite', 'Slam', 'Eye Ray'],
  Construct: ['Slam', 'Crush', 'Metal Strike', 'Pincer'],
  Ooze: ['Pseudopod', 'Engulf', 'Acid Splash'],
  Dragon: ['Bite', 'Claw', 'Tail', 'Wing Strike'],
  Giant: ['Greatclub', 'Slam', 'Rock', 'Stomp'],
  Fey: ['Claws', 'Rapier', 'Thorn Whip', 'Enchanting Strike'],
  Elemental: ['Slam', 'Touch', 'Strike', 'Elemental Blast'],
  Celestial: ['Radiant Strike', 'Divine Smite', 'Mace'],
  Plant: ['Slam', 'Vine Strike', 'Thorn', 'Constrict'],
  default: ['Strike', 'Slam', 'Bite'],
}

// ── Weapon tables (humanoid) ──────────────────────────────────────────────────

const ROLE_WEAPONS = {
  melee_str: [
    { baseName: 'Greatsword', damageDice: '2d6', damageType: 'slashing' },
    { baseName: 'Maul', damageDice: '2d6', damageType: 'bludgeoning' },
    { baseName: 'Battleaxe', damageDice: '1d8', damageType: 'slashing' },
    { baseName: 'Longsword', damageDice: '1d8', damageType: 'slashing' },
  ],
  melee_dex: [
    { baseName: 'Rapier', damageDice: '1d8', damageType: 'piercing' },
    { baseName: 'Shortsword', damageDice: '1d6', damageType: 'piercing' },
    { baseName: 'Scimitar', damageDice: '1d6', damageType: 'slashing' },
  ],
  ranged: [
    { baseName: 'Longbow', damageDice: '1d8', damageType: 'piercing' },
    { baseName: 'Shortbow', damageDice: '1d6', damageType: 'piercing' },
    { baseName: 'Hand Crossbow', damageDice: '1d6', damageType: 'piercing' },
  ],
  caster_int: [
    { baseName: 'Quarterstaff', damageDice: '1d6', damageType: 'bludgeoning' },
    { baseName: 'Dagger', damageDice: '1d4', damageType: 'piercing' },
  ],
  caster_cha: [
    { baseName: 'Dagger', damageDice: '1d4', damageType: 'piercing' },
    { baseName: 'Light Crossbow', damageDice: '1d8', damageType: 'piercing' },
  ],
  healer: [
    { baseName: 'Mace', damageDice: '1d6', damageType: 'bludgeoning' },
    { baseName: 'Quarterstaff', damageDice: '1d6', damageType: 'bludgeoning' },
  ],
  support: [
    { baseName: 'Quarterstaff', damageDice: '1d6', damageType: 'bludgeoning' },
    { baseName: 'Dagger', damageDice: '1d4', damageType: 'piercing' },
  ],
}

const ENHANCEMENT_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3,
]

// ── Stat helpers ──────────────────────────────────────────────────────────────

function rollInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function mod(score) {
  return Math.floor((score - 10) / 2)
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1
}

function generateStats(profile) {
  const stats = {}
  for (const [stat, [min, max]] of Object.entries(profile.ranges)) {
    stats[stat] = rollInRange(min, max)
  }
  return stats
}

function calcHP(level, hitDie, conMod) {
  const first = hitDie + conMod
  const perLevel = Math.ceil(hitDie / 2) + 1 + conMod
  return Math.max(level, first + (level - 1) * perLevel)
}

function rollHP(hpMin, hpMax) {
  const range = Math.max(0, hpMax - hpMin)
  const step = range / 20
  return Math.max(1, Math.round(hpMin + step * rollD20()))
}

export function estimatePartyHP(level) {
  const minHP = calcHP(level, 8, 0)
  const maxHP = calcHP(level, 8, 2)
  return { minHP, maxHP }
}

function generateAC(profile, stats, level) {
  const dexMod = mod(stats.dex)
  const profBonus = Math.ceil(level / 4) + 1
  switch (profile.primary) {
    case 'str':
      return 13 + Math.min(2, Math.floor(level / 4))
    case 'dex':
      return 12 + Math.min(dexMod, 3)
    case 'int':
    case 'cha':
    case 'wis':
      return 10 + dexMod + Math.floor(profBonus / 2)
    default:
      return 10 + dexMod
  }
}

function generateWeapon(roleKey, primaryMod) {
  const pool = ROLE_WEAPONS[roleKey] ?? ROLE_WEAPONS.melee_str
  const base = pick(pool)
  const enhancement =
    ENHANCEMENT_TABLE[Math.floor(Math.random() * ENHANCEMENT_TABLE.length)]
  return {
    baseName: base.baseName,
    damageDice: base.damageDice,
    damageType: base.damageType,
    enhancement,
    displayName:
      enhancement > 0 ? `${base.baseName} +${enhancement}` : base.baseName,
    damageMod: primaryMod + enhancement,
  }
}

// ── Bestiary sampling ─────────────────────────────────────────────────────────

function crToNumber(cr) {
  if (cr == null) return null
  if (cr === 0) return 0
  if (cr < 1) return cr // already fractional
  return Number(cr)
}

export function pickBestiaryMonster(
  bestiaryType,
  partyLevel,
  isBoss,
  sizeMax = null
) {
  const pool = BESTIARY_BY_TYPE[bestiaryType] ?? []
  if (!pool.length) return null

  // CR range: grunts CR ½ partyLevel–partyLevel+1; bosses CR level–level+3
  const minCR = isBoss
    ? Math.max(1, partyLevel - 1)
    : Math.max(0.125, partyLevel * 0.4)
  const maxCR = isBoss ? partyLevel + 4 : partyLevel + 1

  let filtered = pool.filter((m) => {
    const cr = crToNumber(m.cr)
    if (cr === null) return false
    return cr >= minCR && cr <= maxCR
  })

  // Size filter (used for city encounters etc.)
  if (sizeMax) {
    const maxIdx = SIZE_ORDER.indexOf(sizeMax)
    if (maxIdx !== -1) {
      filtered = filtered.filter((m) => SIZE_ORDER.indexOf(m.size) <= maxIdx)
    }
  }

  // Fallback: widen CR window if nothing matched
  if (!filtered.length) {
    filtered = pool.filter((m) => {
      const cr = crToNumber(m.cr)
      return cr !== null && cr <= maxCR + 2
    })
    if (sizeMax) {
      const maxIdx = SIZE_ORDER.indexOf(sizeMax)
      filtered = filtered.filter((m) => SIZE_ORDER.indexOf(m.size) <= maxIdx)
    }
  }

  return filtered.length ? pick(filtered) : pool.length ? pick(pool) : null
}

// ── Enemy generation ──────────────────────────────────────────────────────────

let _eid = 1

function generateHumanoidEnemy(
  level,
  hpMin,
  hpMax,
  isBoss,
  roleOverride,
  raceOverride,
  genderOverride,
  typeRoleWeights
) {
  const rolePool = typeRoleWeights ?? ROLE_POOL
  const roleKey =
    roleOverride ??
    (isBoss ? pick(['melee_str', 'melee_dex', 'ranged']) : pick(rolePool))
  const profile = ROLE_PROFILES[roleKey]
  const stats = generateStats(profile)

  const bossHpMult = isBoss ? 1.75 : 1
  const hp = Math.round(rollHP(hpMin, hpMax) * bossHpMult)
  const ac = generateAC(profile, stats, level + (isBoss ? 2 : 0))
  const primaryMod = mod(stats[profile.primary])
  const profBonus = Math.ceil(level / 4) + 1
  const baseAtk = primaryMod + profBonus + (isBoss ? 2 : 0)
  const weapon = generateWeapon(roleKey, primaryMod)
  const totalAtk = baseAtk + weapon.enhancement
  const gender = genderOverride ?? pick(GENDERS)
  const race = raceOverride ?? pick(RACES)

  return {
    id: `enc_enemy_${_eid++}`,
    name: `${isBoss ? 'Boss — ' : ''}${race} ${profile.label}`,
    gender,
    race,
    role: roleKey,
    roleLabel: profile.label,
    isBoss,
    source: 'humanoid',
    hp,
    maxHp: hp,
    ac,
    stats,
    weapon,
    attackBonus: totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`,
  }
}

// Export the filtered pool so the wizard can show a picker
export function getBestiaryPool(
  bestiaryType,
  partyLevel,
  isBoss,
  sizeMax = null
) {
  const pool = BESTIARY_BY_TYPE[bestiaryType] ?? []
  const minCR = isBoss
    ? Math.max(1, partyLevel - 1)
    : Math.max(0.125, partyLevel * 0.4)
  const maxCR = isBoss ? partyLevel + 4 : partyLevel + 1

  let filtered = pool.filter((m) => {
    const cr = crToNumber(m.cr)
    return cr !== null && cr >= minCR && cr <= maxCR
  })
  if (sizeMax) {
    const maxIdx = SIZE_ORDER.indexOf(sizeMax)
    if (maxIdx !== -1)
      filtered = filtered.filter((m) => SIZE_ORDER.indexOf(m.size) <= maxIdx)
  }
  // Widen if nothing found
  if (!filtered.length)
    filtered = pool.filter(
      (m) => crToNumber(m.cr) != null && crToNumber(m.cr) <= maxCR + 3
    )
  return filtered.sort(
    (a, b) =>
      (crToNumber(a.cr) ?? 0) - (crToNumber(b.cr) ?? 0) ||
      a.name.localeCompare(b.name)
  )
}

function generateBestiaryEnemy(
  level,
  hpMin,
  hpMax,
  isBoss,
  bestiaryType,
  sizeMax,
  specificMonster = null
) {
  const monster =
    specificMonster ?? pickBestiaryMonster(bestiaryType, level, isBoss, sizeMax)
  const profile = BESTIARY_PROFILES[bestiaryType] ?? BESTIARY_PROFILES.default
  const stats = generateStats(profile)

  const bossHpMult = isBoss ? 1.75 : 1
  const hp = Math.round(rollHP(hpMin, hpMax) * bossHpMult)
  const ac = generateAC(profile, stats, level + (isBoss ? 2 : 0))
  const primaryMod = mod(stats[profile.primary])
  const profBonus = Math.ceil(level / 4) + 1
  const baseAtk = primaryMod + profBonus + (isBoss ? 2 : 0)
  const attackName = pick(
    NATURAL_ATTACKS[bestiaryType] ?? NATURAL_ATTACKS.default
  )

  const monsterName = monster?.name ?? bestiaryType
  const displayName = isBoss ? `${monsterName} (Boss)` : monsterName

  return {
    id: `enc_enemy_${_eid++}`,
    name: displayName,
    gender: null,
    race: null,
    role: null,
    roleLabel: bestiaryType,
    isBoss,
    source: bestiaryType,
    monsterType: bestiaryType,
    monsterSize: monster?.size ?? 'Medium',
    monsterCR: monster?.cr ?? null,
    hp,
    maxHp: hp,
    ac,
    stats,
    weapon: {
      baseName: attackName,
      damageDice: isBoss ? '2d8' : '1d8',
      damageType: 'piercing',
      enhancement: 0,
      displayName: attackName,
      damageMod: primaryMod,
    },
    attackBonus: baseAtk >= 0 ? `+${baseAtk}` : `${baseAtk}`,
  }
}

// ── Source assignment ─────────────────────────────────────────────────────────

// Assigns each slot a `source` ('humanoid' or a bestiary type) based on the
// encounter type config and random sampling within the humanoidRatio.
function tagSlotSources(slots, typeConfig) {
  const { pool, humanoidRatio = 0.5 } = typeConfig

  if (pool.length === 1) {
    return slots.map((s) => ({ ...s, source: pool[0] }))
  }

  const bestiaryPool = pool.filter((p) => p !== 'humanoid')
  const hasHumanoid = pool.includes('humanoid')

  // Count grunts so we can assign the right ratio
  const grunts = slots.filter((s) => !s.isBoss)
  const humanoidGruntCount = hasHumanoid
    ? Math.round(grunts.length * humanoidRatio)
    : 0

  // Shuffle-assign grunt sources
  const gruntSources = [
    ...Array(humanoidGruntCount).fill('humanoid'),
    ...Array(grunts.length - humanoidGruntCount)
      .fill(null)
      .map(() => pick(bestiaryPool.length ? bestiaryPool : pool)),
  ].sort(() => Math.random() - 0.5)

  let gi = 0
  return slots.map((s) => {
    if (s.isBoss) {
      // Boss: prefer bestiary for dramatic impact in mixed encounters
      const bossSource = bestiaryPool.length ? pick(bestiaryPool) : pool[0]
      return { ...s, source: bossSource }
    }
    return { ...s, source: gruntSources[gi++] }
  })
}

// ── Encounter planning ────────────────────────────────────────────────────────

export function planEncounter({ difficulty, partySize, type }) {
  const resolvedDifficulty = resolveDifficulty(difficulty)
  const params = DIFFICULTY_PARAMS[resolvedDifficulty]

  const [minOff, maxOff] = params.countRange
  const countMin = Math.max(1, partySize + minOff)
  const countMax = Math.max(countMin, partySize + maxOff)
  const count = rollInRange(countMin, countMax)

  const rawSlots = []
  if (Math.random() < params.bossChance) {
    rawSlots.push({
      isBoss: true,
      role: null,
      race: null,
      gender: null,
      source: null,
    })
    for (const p of params.extraBossChances) {
      if (Math.random() < p)
        rawSlots.push({
          isBoss: true,
          role: null,
          race: null,
          gender: null,
          source: null,
        })
      else break
    }
  }
  for (let i = 0; i < count; i++) {
    rawSlots.push({
      isBoss: false,
      role: null,
      race: null,
      gender: null,
      source: null,
    })
  }

  // Tag sources based on encounter type config
  const resolvedType = type === 'random' ? pick(ENCOUNTER_TYPES) : type
  const typeConfig = ENCOUNTER_TYPE_CONFIG[resolvedType]
  const slots = typeConfig ? tagSlotSources(rawSlots, typeConfig) : rawSlots

  return { resolvedDifficulty, resolvedType, slots }
}

// ── Encounter generation ──────────────────────────────────────────────────────

export function generateEncounter({
  resolvedDifficulty,
  resolvedType,
  type, // kept for backwards compat; resolvedType takes precedence
  partySize,
  partyLevel,
  minPartyHP,
  maxPartyHP,
  slots,
}) {
  const finalType =
    resolvedType ?? (type === 'random' ? pick(ENCOUNTER_TYPES) : type)
  const typeConfig = ENCOUNTER_TYPE_CONFIG[finalType] ?? {}
  const params = DIFFICULTY_PARAMS[resolvedDifficulty]
  const sizeMax = typeConfig.sizeMax ?? null
  const roleWeights = typeConfig.roleWeights ?? null

  const hpMin = Math.max(1, minPartyHP + params.hpMinOffset)
  const hpMax = Math.max(hpMin + 5, maxPartyHP + params.hpMaxOffset)

  const enemies = slots.map((slot) => {
    const src = slot.source ?? 'humanoid'
    if (src === 'humanoid') {
      return generateHumanoidEnemy(
        partyLevel,
        hpMin,
        hpMax,
        slot.isBoss,
        slot.role,
        slot.race,
        slot.gender,
        roleWeights
      )
    }
    return generateBestiaryEnemy(
      partyLevel,
      hpMin,
      hpMax,
      slot.isBoss,
      src,
      sizeMax
    )
  })

  return {
    id: `encounter_${Date.now()}`,
    generatedAt: Date.now(),
    difficulty: resolvedDifficulty,
    type: finalType,
    typeConfig: typeConfig.notes ?? '',
    partySize,
    partyLevel,
    enemies,
  }
}

// ── Single-enemy regeneration (for override UI) ───────────────────────────────

export function regenerateEnemy({
  source,
  partyLevel,
  hpMin,
  hpMax,
  isBoss,
  typeConfig,
  specificMonster = null,
  role = null,
  race = null,
  gender = null,
}) {
  const sizeMax = typeConfig?.sizeMax ?? null
  const roleWeights = typeConfig?.roleWeights ?? null
  if (source === 'humanoid') {
    return generateHumanoidEnemy(
      partyLevel,
      hpMin,
      hpMax,
      isBoss,
      role,
      race,
      gender,
      roleWeights
    )
  }
  return generateBestiaryEnemy(
    partyLevel,
    hpMin,
    hpMax,
    isBoss,
    source,
    sizeMax,
    specificMonster
  )
}

// ── Sailor / ship crew NPC generation ────────────────────────────────────────

let _sailorNum = 0

export function generateSailorNpc(overrideName) {
  const dex = rollInRange(10, 14)
  const con = rollInRange(10, 13)
  const str = rollInRange(10, 13)
  const hp = Math.max(4, rollInRange(1, 6) + rollInRange(1, 6) + mod(con))
  return {
    id: `sailor_${_eid++}`,
    name: overrideName ?? `Sailor ${++_sailorNum}`,
    initMod: mod(dex),
    hp,
    maxHp: hp,
    ac: 12,
    stats: { str, dex, con, int: 10, wis: 11, cha: 10 },
    generated: true,
  }
}
