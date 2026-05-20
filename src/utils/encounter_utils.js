import { pick, GENDERS, RACES } from './character_utils.js'

// ── Encounter types ───────────────────────────────────────────────────────────

export const ENCOUNTER_TYPES = [
  'Ambush',
  'Skirmish',
  'Siege',
  'Interception',
  'Ritual Disruption',
  'The Hunt',
  'Assassination Attempt',
  'Arena Combat',
  'Dungeon Delve',
  'Wilderness Encounter',
  'Urban Brawl',
  'Cultist Gathering',
  'Caravan Raid',
  'Monster Lair',
  'Mercenary Contract',
  'Undead Rising',
  'Demonic Incursion',
  'Prison Break',
  'Heist Gone Wrong',
  'Ancient Guardian',
]

// ── Difficulties ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ['trivial', 'easy', 'medium', 'hard', 'deadly']

export const DIFFICULTY_SELECTABLE = [
  'trivial', 'easy', 'medium', 'hard', 'deadly',
  'random', 'random (no extremes)',
]

// Per-difficulty modifiers applied on top of the party HP values.
// countRange: [minOffset, maxOffset] relative to partySize (clamped to ≥ 1).
// bossChance: probability of exactly one boss (0–1).
// extraBossChances: subsequent boss rolls [p2, p3].
const DIFFICULTY_PARAMS = {
  trivial: { hpMinOffset: -10, hpMaxOffset:  -5, countRange: [-3, -1], bossChance: 0,    extraBossChances: [] },
  easy:    { hpMinOffset:  -2, hpMaxOffset:   5, countRange: [-2,  0], bossChance: 0,    extraBossChances: [] },
  medium:  { hpMinOffset:   5, hpMaxOffset:  20, countRange: [-2,  2], bossChance: 0,    extraBossChances: [] },
  hard:    { hpMinOffset:  15, hpMaxOffset:  40, countRange: [ 0,  3], bossChance: 0.35, extraBossChances: [] },
  deadly:  { hpMinOffset:  25, hpMaxOffset:  60, countRange: [ 2,  5], bossChance: 1,    extraBossChances: [0.5, 0.25] },
}

function resolveDifficulty(difficulty) {
  if (difficulty === 'random') return pick(DIFFICULTIES)
  if (difficulty === 'random (no extremes)') return pick(['easy', 'medium', 'hard'])
  return difficulty
}

// ── Role stat profiles ────────────────────────────────────────────────────────

// Each stat range is [min, max] inclusive (ability score, not modifier).
export const ROLE_PROFILES = {
  melee_str: {
    label: 'Melee (STR)', primary: 'str', hitDie: 10,
    ranges: { str: [14,18], dex: [10,14], con: [14,18], int: [6,10],  wis: [8,12],  cha: [6,10]  },
  },
  melee_dex: {
    label: 'Melee (DEX)', primary: 'dex', hitDie: 10,
    ranges: { str: [8,12],  dex: [14,18], con: [12,16], int: [8,12],  wis: [10,12], cha: [8,12]  },
  },
  ranged: {
    label: 'Ranged',      primary: 'dex', hitDie: 8,
    ranges: { str: [8,12],  dex: [14,18], con: [10,14], int: [8,12],  wis: [10,14], cha: [8,12]  },
  },
  caster_int: {
    label: 'Caster (INT)', primary: 'int', hitDie: 6,
    ranges: { str: [6,10],  dex: [10,14], con: [10,14], int: [14,18], wis: [10,14], cha: [8,12]  },
  },
  caster_cha: {
    label: 'Caster (CHA)', primary: 'cha', hitDie: 6,
    ranges: { str: [6,10],  dex: [10,14], con: [10,14], int: [8,12],  wis: [8,12],  cha: [14,18] },
  },
  healer: {
    label: 'Healer',      primary: 'wis', hitDie: 8,
    ranges: { str: [8,12],  dex: [10,14], con: [12,14], int: [8,12],  wis: [14,18], cha: [10,14] },
  },
  support: {
    label: 'Support',     primary: 'cha', hitDie: 8,
    ranges: { str: [8,12],  dex: [10,14], con: [10,14], int: [10,14], wis: [10,14], cha: [12,16] },
  },
}

export const ROLE_KEYS = Object.keys(ROLE_PROFILES)

// Roles available for random assignment (melee weighted double).
const ROLE_POOL = [
  'melee_str', 'melee_str',
  'melee_dex', 'melee_dex',
  'ranged', 'ranged',
  'caster_int', 'caster_cha',
  'healer',
  'support',
]

// ── Weapon tables ────────────────────────────────────────────────────────────

const ROLE_WEAPONS = {
  melee_str: [
    { baseName: 'Greatsword', damageDice: '2d6', damageType: 'slashing' },
    { baseName: 'Maul',       damageDice: '2d6', damageType: 'bludgeoning' },
    { baseName: 'Battleaxe',  damageDice: '1d8', damageType: 'slashing' },
    { baseName: 'Longsword',  damageDice: '1d8', damageType: 'slashing' },
  ],
  melee_dex: [
    { baseName: 'Rapier',     damageDice: '1d8', damageType: 'piercing' },
    { baseName: 'Shortsword', damageDice: '1d6', damageType: 'piercing' },
    { baseName: 'Scimitar',   damageDice: '1d6', damageType: 'slashing' },
  ],
  ranged: [
    { baseName: 'Longbow',       damageDice: '1d8', damageType: 'piercing' },
    { baseName: 'Shortbow',      damageDice: '1d6', damageType: 'piercing' },
    { baseName: 'Hand Crossbow', damageDice: '1d6', damageType: 'piercing' },
  ],
  caster_int: [
    { baseName: 'Quarterstaff', damageDice: '1d6', damageType: 'bludgeoning' },
    { baseName: 'Dagger',       damageDice: '1d4', damageType: 'piercing' },
  ],
  caster_cha: [
    { baseName: 'Dagger',         damageDice: '1d4', damageType: 'piercing' },
    { baseName: 'Light Crossbow', damageDice: '1d8', damageType: 'piercing' },
  ],
  healer: [
    { baseName: 'Mace',         damageDice: '1d6', damageType: 'bludgeoning' },
    { baseName: 'Quarterstaff', damageDice: '1d6', damageType: 'bludgeoning' },
  ],
  support: [
    { baseName: 'Quarterstaff', damageDice: '1d6', damageType: 'bludgeoning' },
    { baseName: 'Dagger',       damageDice: '1d4', damageType: 'piercing' },
  ],
}

// Weighted table: +0 = 55%, +1 = 25%, +2 = 15%, +3 = 5%
const ENHANCEMENT_TABLE = [0,0,0,0,0,0,0,0,0,0,0, 1,1,1,1,1, 2,2,2, 3]

function generateWeapon(roleKey, primaryMod) {
  const pool        = ROLE_WEAPONS[roleKey] ?? ROLE_WEAPONS.melee_str
  const base        = pick(pool)
  const enhancement = ENHANCEMENT_TABLE[Math.floor(Math.random() * ENHANCEMENT_TABLE.length)]
  return {
    baseName:    base.baseName,
    damageDice:  base.damageDice,
    damageType:  base.damageType,
    enhancement,
    displayName: enhancement > 0 ? `${base.baseName} +${enhancement}` : base.baseName,
    damageMod:   primaryMod + enhancement,
  }
}

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

// ── HP calculation ────────────────────────────────────────────────────────────

// Standard 5e formula: level 1 = max hit die + CON mod, subsequent = ceil(die/2)+1 + CON mod
function calcHP(level, hitDie, conMod) {
  const first    = hitDie + conMod
  const perLevel = Math.ceil(hitDie / 2) + 1 + conMod
  return Math.max(level, first + (level - 1) * perLevel)
}

// Roll a d20 and interpolate within [hpMin, hpMax].
function rollHP(hpMin, hpMax) {
  const range = Math.max(0, hpMax - hpMin)
  const step  = range / 20
  return Math.max(1, Math.round(hpMin + step * rollD20()))
}

// ── Party HP estimation (manual mode) ────────────────────────────────────────

// When no real party data is available, estimate min/max HP from level alone
// using a d8 hit die (class average) and CON mod range of +0 → +2.
export function estimatePartyHP(level) {
  const minHP = calcHP(level, 8, 0)
  const maxHP = calcHP(level, 8, 2)
  return { minHP, maxHP }
}

// ── AC generation ─────────────────────────────────────────────────────────────

function generateAC(profile, stats, level) {
  const dexMod = mod(stats.dex)
  const profBonus = Math.ceil(level / 4) + 1  // rough proficiency by level

  switch (profile.primary) {
    case 'str': return 13 + Math.min(2, Math.floor(level / 4))  // heavy-ish armour
    case 'dex': return 12 + Math.min(dexMod, 3)                 // medium or light armour
    case 'int':
    case 'cha':
    case 'wis': return 10 + dexMod + Math.floor(profBonus / 2)  // mage armour / cloth
    default:    return 10 + dexMod
  }
}

// ── Enemy generation ──────────────────────────────────────────────────────────

let _eid = 1

function generateEnemy(level, hpMin, hpMax, isBoss = false, roleOverride = null, raceOverride = null, genderOverride = null) {
  const roleKey  = roleOverride ?? (isBoss ? pick(['melee_str', 'melee_dex', 'ranged']) : pick(ROLE_POOL))
  const profile  = ROLE_PROFILES[roleKey]
  const stats    = generateStats(profile)

  const bossHpMult = isBoss ? 1.75 : 1
  const hp = Math.round(rollHP(hpMin, hpMax) * bossHpMult)

  const ac         = generateAC(profile, stats, level + (isBoss ? 2 : 0))
  const primaryMod = mod(stats[profile.primary])
  const profBonus  = Math.ceil(level / 4) + 1
  const baseAtk    = primaryMod + profBonus + (isBoss ? 2 : 0)

  const weapon      = generateWeapon(roleKey, primaryMod)
  const totalAtk    = baseAtk + weapon.enhancement

  const gender = genderOverride ?? pick(GENDERS)
  const race   = raceOverride   ?? pick(RACES)

  return {
    id:          `enc_enemy_${_eid++}`,
    name:        `${isBoss ? 'Boss — ' : ''}${race} ${profile.label}`,
    gender,
    race,
    role:        roleKey,
    roleLabel:   profile.label,
    isBoss,
    hp,
    maxHp:       hp,
    ac,
    stats,
    weapon,
    attackBonus: totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`,
  }
}

// ── Encounter planning ────────────────────────────────────────────────────────

// Determines enemy count and boss/grunt structure without generating stats.
// Returns { resolvedDifficulty, slots } where each slot is { isBoss, role, race, gender }
// with null meaning "randomize at generation time".
export function planEncounter({ difficulty, partySize }) {
  const resolvedDifficulty = resolveDifficulty(difficulty)
  const params             = DIFFICULTY_PARAMS[resolvedDifficulty]

  const [minOff, maxOff] = params.countRange
  const countMin = Math.max(1, partySize + minOff)
  const countMax = Math.max(countMin, partySize + maxOff)
  const count    = rollInRange(countMin, countMax)

  const slots = []
  if (Math.random() < params.bossChance) {
    slots.push({ isBoss: true, role: null, race: null, gender: null })
    for (const p of params.extraBossChances) {
      if (Math.random() < p) slots.push({ isBoss: true, role: null, race: null, gender: null })
      else break
    }
  }
  for (let i = 0; i < count; i++) {
    slots.push({ isBoss: false, role: null, race: null, gender: null })
  }

  return { resolvedDifficulty, slots }
}

// ── Encounter generation ──────────────────────────────────────────────────────

export function generateEncounter({
  resolvedDifficulty,
  type,
  partySize,
  partyLevel,
  minPartyHP,
  maxPartyHP,
  slots,
}) {
  const resolvedType = type === 'random' ? pick(ENCOUNTER_TYPES) : type
  const params       = DIFFICULTY_PARAMS[resolvedDifficulty]

  const hpMin = Math.max(1, minPartyHP + params.hpMinOffset)
  const hpMax = Math.max(hpMin + 5, maxPartyHP + params.hpMaxOffset)

  const enemies = slots.map((slot) =>
    generateEnemy(partyLevel, hpMin, hpMax, slot.isBoss, slot.role, slot.race, slot.gender)
  )

  return {
    id:          `encounter_${Date.now()}`,
    generatedAt: Date.now(),
    difficulty:  resolvedDifficulty,
    type:        resolvedType,
    partySize,
    partyLevel,
    enemies,
  }
}
