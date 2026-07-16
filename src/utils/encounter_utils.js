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

// ── Attack calibration ────────────────────────────────────────────────────────

// Target hit% per difficulty — drives attack bonus calibration.
const TARGET_HIT_PCT = {
  trivial: 0.35,
  easy: 0.45,
  medium: 0.55,
  hard: 0.65,
  deadly: 0.72,
}

// Average party AC by level (5e baseline). Index = level.
// This campaign adds PARTY_AC_ITEM_BONUS on top for generous magic items.
const BASE_PARTY_AC = [
  0, 13, 13, 13, 14, 14, 15, 15, 15, 16, 16, 17, 17, 17, 18, 18, 19, 19, 19, 20,
  20,
]
const PARTY_AC_ITEM_BONUS = 2

// ── Feature library ───────────────────────────────────────────────────────────

const BOSS_UNIVERSAL = [
  {
    name: 'Legendary Resistance (2/day)',
    description:
      'If this boss fails a saving throw, it can choose to succeed instead. Usable twice per encounter.',
  },
  {
    name: 'Multiattack',
    description:
      'This boss makes two attacks per action. When below half HP, it makes three.',
  },
]

const REACTIVE_FEATURES = {
  antiHealing: {
    name: 'Necrotic Siphon (Reaction)',
    description:
      'Once per round: when a creature within 60 ft is healed by magic, reduce that healing by half and gain that many temporary HP.',
  },
  antiControl: {
    name: 'Iron Will',
    description:
      'Advantage on saving throws against being Charmed, Stunned, or Incapacitated.',
  },
}

const FEATURE_POOLS = {
  humanoid: {
    melee_str: {
      passive: [
        {
          name: 'Brutal Strikes',
          description:
            'When this enemy hits with a melee attack, reroll one damage die and use the higher result.',
        },
        {
          name: 'Battle Hardened',
          description:
            'Advantage on CON saves and immunity to being frightened.',
        },
        {
          name: 'Relentless Endurance (1/encounter)',
          description: 'When reduced to 0 HP: drop to 1 HP instead.',
        },
      ],
      active: [
        {
          name: 'Reckless Assault',
          description:
            'Attacks with advantage this round but grants advantage to all attackers against it until start of its next turn.',
        },
        {
          name: 'Shield Slam (Bonus Action)',
          description:
            'Shove a creature within 5 ft (DC = 8 + STR mod + Prof). On fail: pushed 5 ft and knocked prone.',
        },
        {
          name: 'Second Wind (Bonus Action)',
          description: 'Once per encounter: regain 1d10 + level HP.',
        },
      ],
      boss: [
        {
          name: "Commander's Bellow",
          description:
            'At the start of each turn, all allies within 30 ft gain +2 to their next attack roll.',
        },
        {
          name: 'Unstoppable Charge',
          description:
            'After moving 10+ ft before attacking, target makes DC 15 STR save or is knocked prone.',
        },
      ],
    },
    melee_dex: {
      passive: [
        {
          name: 'Shadow Steps',
          description:
            'Moving through dim light or darkness costs no extra movement; no opportunity attacks while in darkness.',
        },
        {
          name: 'Nimble Escape',
          description: 'Can Disengage or Hide as a bonus action each turn.',
        },
        {
          name: 'Evasion',
          description:
            'When subjected to an effect that allows a DEX save for half damage: no damage on success, half on fail.',
        },
      ],
      active: [
        {
          name: 'Sneak Attack (3d6)',
          description:
            'Once per turn when attacking with advantage or an ally is adjacent to the target: +3d6 piercing damage.',
        },
        {
          name: 'Ambush Strike',
          description:
            'If attacking a surprised creature, all damage from that attack is doubled.',
        },
        {
          name: 'Crippling Jab',
          description:
            'On a hit: DC 13 CON save or lose 10 ft of movement until end of next turn.',
        },
      ],
      boss: [
        {
          name: 'Death Strike',
          description:
            'If this enemy has advantage against a creature that has not acted yet, a hit is automatically a critical hit.',
        },
        {
          name: 'Vanish (1/encounter)',
          description:
            'Become invisible until start of next turn. First attack while invisible has advantage.',
        },
      ],
    },
    ranged: {
      passive: [
        {
          name: "Hawk's Eye",
          description:
            'Ignores half and three-quarters cover. No disadvantage on ranged attacks made within 5 ft of a hostile.',
        },
        {
          name: 'Mobile Combatant',
          description:
            'After a ranged attack, can move up to 10 ft without provoking opportunity attacks.',
        },
        {
          name: 'Steady Aim',
          description:
            'If this enemy does not move on their turn, they gain +2 to ranged attack rolls.',
        },
      ],
      active: [
        {
          name: 'Volley',
          description:
            'Fire at all creatures in a 10-ft radius within normal range. DC 13 DEX save or take weapon damage.',
        },
        {
          name: 'Pinning Shot',
          description:
            'On a hit: DC 13 STR save or speed reduced to 0 until end of next turn.',
        },
        {
          name: 'Called Shot',
          description:
            'Declare a body part before attacking. Head: DC 14 CON or Stunned 1 rd. Legs: DC 13 STR or speed halved. Arm: DC 13 CON or disadvantage on attacks.',
        },
      ],
      boss: [
        {
          name: 'Rain of Arrows',
          description:
            'Makes 3 attacks per action, each against a different target.',
        },
        {
          name: 'Explosive Shot (1/short rest)',
          description:
            '10-ft radius detonation on impact: DC 13 DEX save, 4d6 fire damage (half on save).',
        },
      ],
    },
    caster_int: {
      passive: [
        {
          name: 'Arcane Ward',
          description:
            'Magical ward with 2× level HP absorbs damage before the caster takes any. Does not recharge mid-combat.',
        },
        {
          name: 'Spell Absorption (1/encounter)',
          description:
            'When failing a save against a spell, can choose to succeed instead and absorb that spell slot level.',
        },
        {
          name: 'Careful Metamagic',
          description:
            "Once per encounter, up to 3 creatures automatically succeed on a save against one of this caster's area spells.",
        },
      ],
      active: [
        {
          name: 'Counterspell (Reaction)',
          description:
            'When a creature within 60 ft casts a spell: auto-counter spells up to L3; DC 10 + spell level for higher.',
        },
        {
          name: 'Forceful Barrier (Bonus Action)',
          description: 'Gain +3 AC until start of next turn.',
        },
        {
          name: 'Arcane Riposte (Reaction)',
          description:
            'When hit by a melee attack: deal 2d6 force damage to the attacker.',
        },
      ],
      boss: [
        {
          name: 'Arcane Mastery',
          description:
            'Can maintain one concentration spell and one non-concentration spell simultaneously. Concentration checks have advantage.',
        },
        {
          name: 'Spell Echo (1/encounter)',
          description:
            'When casting a spell of L3 or lower: cast it twice simultaneously against the same or different targets.',
        },
      ],
    },
    caster_cha: {
      passive: [
        {
          name: 'Dark Blessing',
          description:
            'Regains 5 HP at the start of each of its turns if at 1+ HP. Cold and fire damage suppress this for one round.',
        },
        {
          name: 'Entropic Shroud',
          description:
            'Creature that hits this enemy in melee: DC 13 WIS save or Frightened until end of their next turn.',
        },
        {
          name: 'Pact Resilience',
          description:
            'When this creature would die, it instead drops to 1 HP (once per encounter). While below 10 HP, all incoming damage is halved.',
        },
      ],
      active: [
        {
          name: 'Dominating Gaze',
          description:
            "One creature within 30 ft: DC 14 WIS save or Charmed until they take damage or the start of this caster's next turn.",
        },
        {
          name: 'Horrific Curse',
          description:
            "One creature within 30 ft: DC 15 CON save (repeatable as an action). While cursed: disadvantage on all saves against this enemy's spells.",
        },
        {
          name: 'Eldritch Blast (Repelling)',
          description:
            'Range 120 ft, +5 to hit: 1d10 force damage and target pushed 10 ft on hit.',
        },
      ],
      boss: [
        {
          name: 'Soul Drain (Recharge 5-6)',
          description:
            'All creatures within 20 ft: DC 15 CON save. Fail: 4d10 necrotic and HP max reduced by damage dealt until long rest.',
        },
        {
          name: 'Eldritch Dominion',
          description:
            "Up to 3 non-boss allies are under this boss's telepathic control. If the boss dies, controlled allies are Stunned until end of their next turn.",
        },
      ],
    },
    healer: {
      passive: [
        {
          name: 'Aura of Warding',
          description:
            'Allies within 10 ft gain resistance to damage from spells.',
        },
        {
          name: 'Sacred Resilience',
          description: 'Cannot be reduced below 1 HP more than once per round.',
        },
        {
          name: 'Spiritual Advisor',
          description:
            'Allies within 30 ft have advantage on WIS and CHA saving throws.',
        },
      ],
      active: [
        {
          name: 'Healing Word (Bonus Action)',
          description:
            'Heal one ally within 60 ft for 2d4 + 5 HP. Usable twice before a short rest.',
        },
        {
          name: 'Dispel Magic (Action)',
          description:
            'End one spell of L3 or lower on a creature within 60 ft (auto). Higher: DC 10 + spell level.',
        },
        {
          name: 'Sacred Flame',
          description:
            'Range 60 ft: DC 14 DEX save or 2d8 radiant damage. Cover provides no benefit.',
        },
      ],
      boss: [
        {
          name: 'Divine Rebuke (Reaction)',
          description:
            'When an ally within 30 ft takes damage: the attacker takes 3d6 radiant damage (DC 14 DEX save for half).',
        },
        {
          name: 'Resurrect (1/encounter)',
          description:
            'As an action, restore a fallen ally to 1 HP. The ally immediately takes their turn on this initiative count.',
        },
      ],
    },
    support: {
      passive: [
        {
          name: 'Pack Tactics',
          description:
            'Advantage on attack rolls if at least one ally is within 5 ft of the target.',
        },
        {
          name: 'Coordinated Defense',
          description: 'Allies within 10 ft gain +2 AC against ranged attacks.',
        },
        {
          name: 'Inspiring Presence',
          description:
            'Allied humanoids within 30 ft deal +2 damage on their first attack each round.',
        },
      ],
      active: [
        {
          name: 'Battle Orders (Bonus Action)',
          description:
            'Grant one ally within 30 ft an immediate additional attack using their reaction.',
        },
        {
          name: 'Rally! (1/encounter)',
          description:
            'All allies within 30 ft gain 10 temporary HP and advantage on their next saving throw.',
        },
        {
          name: 'Expose Weakness',
          description:
            "After hitting a target: all allies have advantage on their next attack against that same target before this creature's next turn.",
        },
      ],
      boss: [
        {
          name: 'Supreme Command',
          description:
            'Acts first in initiative regardless of roll. Allies gain +2 to attacks while this boss is alive.',
        },
        {
          name: 'Tactical Mastermind (Free Action)',
          description:
            'Once per round: Flank (two allies flank a target), Retreat (two allies Disengage for free), or Focus Fire (all allies must attack same target this round).',
        },
      ],
    },
  },
  bestiary: {
    Beast: {
      passive: [
        {
          name: 'Pack Tactics',
          description:
            'Advantage on attacks if at least one ally is within 5 ft of the target.',
        },
        {
          name: 'Keen Senses',
          description: 'Advantage on Perception checks. Cannot be surprised.',
        },
        {
          name: 'Rending Fury',
          description:
            'Deals an extra die of damage against targets that are Grappled or Prone.',
        },
      ],
      active: [
        {
          name: 'Pounce',
          description:
            'After moving 20+ ft and hitting with a claw: DC 13 STR save or knocked prone, then make a bonus bite attack.',
        },
        {
          name: 'Rend',
          description:
            "On a hit: target's AC is reduced by 1 (max −3) until repaired.",
        },
        {
          name: 'Frenzied Bite (Recharge 5-6)',
          description:
            'One bite for 3d8 + STR mod piercing. Automatic critical if target is below half HP.',
        },
      ],
      boss: [
        {
          name: 'Alpha Howl',
          description:
            "Beast allies within 60 ft gain advantage on attacks until the Alpha's next turn. Other beasts make DC 12 WIS save or Frighten their enemies for 1 round.",
        },
        {
          name: 'Feral Rampage',
          description:
            'When reduced below half HP: gain an extra attack and +2 damage on all hits.',
        },
      ],
    },
    Undead: {
      passive: [
        {
          name: 'Undead Fortitude',
          description:
            'When reduced to 0 HP by non-radiant, non-critical damage: DC CON save (10 + damage dealt). Success = drop to 1 HP.',
        },
        {
          name: 'Necrotic Aura',
          description:
            'Living creatures within 5 ft take 1d6 necrotic at start of their turn. Healing halved while in aura.',
        },
        {
          name: 'Turn Immunity',
          description:
            'Immune to being Turned. Any Turn Undead effect aimed at this creature deals 2d6 psychic to the caster instead.',
        },
      ],
      active: [
        {
          name: 'Life Drain (Recharge 5-6)',
          description:
            'DC 14 CON save. Fail: 3d8 necrotic damage and HP max reduced by amount dealt until long rest.',
        },
        {
          name: 'Grave Chill',
          description:
            "On a hit: DC 13 CON save or speed halved and bonus action lost until start of undead's next turn.",
        },
        {
          name: 'Withering Gaze',
          description:
            "Range 30 ft: DC 14 CON save or Weakened — attacks and saves have −2 penalty until end of target's next turn.",
        },
      ],
      boss: [
        {
          name: 'Dark Resurrection (Reaction, Recharge 6)',
          description:
            'When an Undead ally within 30 ft drops to 0 HP: raise it with 1 HP and 10 temporary HP.',
        },
        {
          name: 'Soul Consumption',
          description:
            'When any creature dies within 30 ft: gain 10 temp HP and an extra attack on the next turn.',
        },
      ],
    },
    Fiend: {
      passive: [
        { name: 'Fire Immunity', description: 'Immune to fire damage.' },
        {
          name: 'Magic Resistance',
          description:
            'Advantage on saving throws against spells and magical effects.',
        },
        {
          name: 'Infernal Toughness',
          description:
            'Resistance to cold and lightning damage. Immune to poison and the poisoned condition.',
        },
      ],
      active: [
        {
          name: 'Hellfire Burst (Recharge 5-6)',
          description:
            '15-ft cone: DC 14 DEX save. 3d10 fire damage (half on save). Undamaged targets may be ignited — 1d6 fire per round, action to extinguish.',
        },
        {
          name: 'Corrupting Touch',
          description:
            'On a melee hit: target has disadvantage on Concentration checks and healing spells are halved until DC 15 CHA save (repeatable end of their turn).',
        },
        {
          name: 'Infernal Chains',
          description:
            'Range 30 ft: DC 14 STR save or Restrained by spectral chains until end of next turn. Restrained targets take 2d8 fire at start of their turns.',
        },
      ],
      boss: [
        {
          name: 'Infernal Command',
          description:
            'All Fiend allies within 60 ft gain resistance to non-magical physical damage while this boss lives.',
        },
        {
          name: 'Summon Lesser Fiends (1/day)',
          description:
            "Use action to summon 1d4 lesser fiends (50% chance per fiend). They arrive at start of boss's next turn.",
        },
      ],
    },
    Dragon: {
      passive: [
        {
          name: 'Frightful Presence',
          description:
            'Creatures within 120 ft aware of the dragon: DC 17 WIS save or Frightened 1 minute. Repeat each turn. Immune for 24h on success.',
        },
        {
          name: 'Dragon Resilience',
          description:
            'Advantage on all saving throws. Resistant to non-magical bludgeoning, piercing, and slashing.',
        },
      ],
      active: [
        {
          name: 'Wing Attack',
          description:
            'Creatures within 15 ft: DC 15 DEX save or 2d6 bludgeoning and knocked prone. Dragon can then fly up to half its fly speed.',
        },
        {
          name: 'Breath Weapon (Recharge 5-6)',
          description:
            '60-ft cone: DC 18 DEX save, 8d6 fire damage (half on save). Or cold breath: DC 18 CON save, 10d8 cold, speed halved 1 round.',
        },
      ],
      boss: [
        {
          name: 'Multiattack',
          description:
            'Three attacks: one bite (2d10+mod) and two claws (2d6+mod). Can replace one claw with Wing Attack.',
        },
        {
          name: 'Lair Action (Initiative 20)',
          description:
            'Roll 1d3: (1) 20-ft eruption 3d6 fire DC 15; (2) stone spires in 20-ft area, difficult terrain; (3) 20-ft sphere noxious gas, DC 13 CON or Poisoned 1 rnd.',
        },
      ],
    },
    Construct: {
      passive: [
        {
          name: 'Immutable Form',
          description:
            'Immune to spells that would alter form. Advantage on saves against Polymorph, Dominate, and similar.',
        },
        {
          name: 'Damage Absorption (Lightning)',
          description:
            'Lightning damage is converted to healing for this creature instead.',
        },
        {
          name: 'Adamantine Body',
          description:
            'Attacks that would deal a critical hit deal normal damage instead.',
        },
      ],
      active: [
        {
          name: 'Force Slam (Recharge 5-6)',
          description:
            '20-ft radius shockwave: DC 15 STR save. 3d8 bludgeoning and knocked prone on fail.',
        },
        {
          name: 'Interlocking Grapple',
          description:
            'On a melee hit: target is Grappled (escape DC 15) and Restrained. Can hold up to 2 creatures.',
        },
        {
          name: 'Plasma Burst (Recharge 5-6)',
          description:
            '30-ft line: DC 14 DEX save. 4d6 lightning + 2d6 fire (half on save). Fail: also Blinded until end of next turn.',
        },
      ],
      boss: [
        {
          name: 'Overclock (Bonus Action)',
          description:
            'Gain an extra melee attack and double movement until end of round. Take 10 damage at end of round.',
        },
        {
          name: 'Emergency Repair (Reaction, 1/encounter)',
          description:
            'When reduced below 25% HP: regain 30 HP and suppress all conditions for 1 round.',
        },
      ],
    },
    Fey: {
      passive: [
        {
          name: 'Misty Escape (Reaction)',
          description:
            'When taking damage: teleport up to 60 ft to an unoccupied space in sight. Once per round.',
        },
        {
          name: 'Glamour Aura',
          description:
            'Creatures starting their turn within 20 ft: DC 14 WIS save or Charmed until start of next turn (cannot attack this fey).',
        },
        {
          name: 'Magic Resistance',
          description:
            'Advantage on saving throws against spells and magical effects.',
        },
      ],
      active: [
        {
          name: 'Bewildering Visions',
          description:
            'One target within 30 ft: DC 14 WIS save or 3d6 psychic damage and treat all creatures as invisible until end of their next turn.',
        },
        {
          name: 'Feywild Step (Bonus Action)',
          description:
            'Teleport up to 30 ft to an unoccupied space in sight. Once per turn.',
        },
        {
          name: 'Pixie Dust',
          description:
            "10-ft radius around this creature: DC 13 WIS save or Incapacitated until hit or until end of fey's next turn.",
        },
      ],
      boss: [
        {
          name: 'Wild Magic Surge (Start of Round)',
          description:
            'Roll 1d6. 1-2: all spells target random creatures. 3: boss regains a spell slot. 4-6: no effect.',
        },
        {
          name: 'Curse of the Fey Court',
          description:
            'Range 60 ft: DC 16 CHA save or Cursed 1 minute. Cursed: highest ability score −4, cannot benefit from advantage. Remove Curse ends it.',
        },
      ],
    },
    default: {
      passive: [
        {
          name: 'Relentless',
          description:
            'When a save would leave this creature Incapacitated: Stunned until end of next turn instead.',
        },
        {
          name: 'Thick Hide',
          description:
            'Resistance to non-magical bludgeoning, piercing, and slashing damage.',
        },
        {
          name: "Predator's Instinct",
          description:
            'Advantage on attack rolls against creatures that have not yet acted in combat.',
        },
      ],
      active: [
        {
          name: 'Brutal Strike',
          description:
            'Once per turn on a hit: DC 14 STR save or knocked prone.',
        },
        {
          name: 'Terrifying Screech (1/encounter)',
          description:
            'All creatures within 30 ft: DC 13 WIS save or Frightened 1 minute (repeat save end of each turn).',
        },
        {
          name: 'Reckless Strike',
          description:
            'All attacks this turn have advantage, but all attacks against this creature also have advantage until start of its next turn.',
        },
      ],
      boss: [
        {
          name: 'Apex Predator',
          description:
            'Cannot be flanked. Creatures attempting to Disengage from melee must succeed on a DC 14 STR save or fail to move.',
        },
        {
          name: 'Second Nature (1/encounter)',
          description:
            'When reduced to 0 HP for the first time: regain half max HP. No longer subject to surprise conditions after this.',
        },
      ],
    },
  },
}

// ── Spell library for caster enemies ─────────────────────────────────────────

const SPELL_POOLS = {
  caster_int: {
    easy: [
      {
        name: 'Magic Missile',
        description: 'Three darts, each 1d4+1 force damage. Automatic hit.',
      },
      {
        name: 'Shield (Reaction)',
        description:
          '+5 AC until start of next turn when targeted by an attack. Also blocks Magic Missile.',
      },
      {
        name: 'Thunderwave',
        description:
          '15-ft cube from caster: DC 14 CON save. 2d8 thunder damage and pushed 10 ft on fail. Half, not pushed on save.',
      },
    ],
    medium: [
      {
        name: 'Misty Step (Bonus Action)',
        description: 'Teleport up to 30 ft to a space in sight.',
      },
      {
        name: 'Web',
        description:
          '20-ft cube within 60 ft: difficult terrain. DC 14 DEX or Restrained. Concentration 1 hour.',
      },
      {
        name: 'Mirror Image',
        description:
          '3 duplicates: each has 33%, then 50%, then 75% chance to absorb an attack (destroyed on hit).',
      },
      {
        name: 'Magic Missile',
        description: 'Three darts, each 1d4+1 force. Automatic hit.',
      },
      {
        name: 'Shield (Reaction)',
        description: '+5 AC until start of next turn.',
      },
    ],
    hard: [
      {
        name: 'Fireball',
        description:
          '20-ft radius within 150 ft: DC 14 DEX save. 8d6 fire damage (half on save).',
      },
      {
        name: 'Counterspell (Reaction)',
        description:
          'Interrupt a spell within 60 ft: auto-succeeds for spells up to L3. For higher: DC 10 + spell level.',
      },
      {
        name: 'Hypnotic Pattern',
        description:
          '30-ft cube within 120 ft: DC 14 WIS save or Incapacitated. Concentration. Ends on damage to creature.',
      },
      {
        name: 'Misty Step (Bonus Action)',
        description: 'Teleport up to 30 ft to a space in sight.',
      },
      {
        name: 'Mirror Image',
        description: '3 duplicates absorb attacks before caster takes damage.',
      },
    ],
    deadly: [
      {
        name: 'Disintegrate',
        description:
          'Range 60 ft: DC 16 DEX save. 10d6+40 force damage (half on save). Reduced to 0 HP = disintegrated.',
      },
      {
        name: 'Fireball',
        description: '20-ft radius: DC 14 DEX save. 8d6 fire (half on save).',
      },
      {
        name: 'Counterspell (Reaction)',
        description:
          'Interrupt a spell: auto for L3 and under; DC 10 + spell level for higher.',
      },
      {
        name: 'Hypnotic Pattern',
        description: '30-ft cube: DC 14 WIS or Incapacitated. Concentration.',
      },
      {
        name: 'Time Ravage',
        description:
          'Single target within 90 ft: DC 17 CON save. Fail: 10d8+20 necrotic, Aged, Poisoned, speed halved. Half on save.',
      },
    ],
  },
  caster_cha: {
    easy: [
      {
        name: 'Charm Person',
        description:
          'Range 60 ft: DC 13 WIS save or Charmed — caster is treated as a friendly contact. Ends on damage.',
      },
      {
        name: 'Hex (Bonus Action)',
        description:
          'Curse one target within 90 ft: +1d6 necrotic on each hit, disadvantage on one ability check type.',
      },
      {
        name: 'Command',
        description:
          'Range 60 ft: DC 13 WIS save or obey one-word command (drop, flee, grovel, halt, approach).',
      },
    ],
    medium: [
      {
        name: 'Darkness',
        description:
          'Range 60 ft: 15-ft sphere of magical darkness. Blocks darkvision.',
      },
      {
        name: 'Hunger of Hadar',
        description:
          '20-ft sphere within 150 ft: difficult terrain, no light. 2d6 cold at turn start, 2d6 acid at turn end. Concentration.',
      },
      {
        name: 'Suggestion',
        description:
          'Range 30 ft: DC 14 WIS save or follow a reasonable suggestion up to 8 hours. Ends on damage.',
      },
      {
        name: 'Charm Person',
        description: 'Range 60 ft: DC 13 WIS or Charmed.',
      },
      {
        name: 'Hex (Bonus Action)',
        description: '+1d6 necrotic per hit, disadvantage on one ability type.',
      },
    ],
    hard: [
      {
        name: 'Banishment',
        description:
          'Range 60 ft: DC 15 CHA save or Banished to another plane. Concentration. Returns when concentration drops.',
      },
      {
        name: 'Hold Monster',
        description:
          'Range 90 ft: DC 15 WIS save or Paralyzed. Auto-crits from within 5 ft. Concentration.',
      },
      {
        name: 'Hunger of Hadar',
        description:
          '20-ft sphere: 2d6 cold each turn start, 2d6 acid each turn end. Blind within. Concentration.',
      },
      {
        name: 'Darkness',
        description: '15-ft sphere magical darkness. Blocks darkvision.',
      },
      {
        name: 'Suggestion',
        description: 'DC 14 WIS or follow reasonable suggestion for 8 hours.',
      },
    ],
    deadly: [
      {
        name: 'Dominate Person',
        description:
          "Range 60 ft: DC 16 WIS save or completely under caster's control. Concentration 1 minute.",
      },
      {
        name: 'Mass Suggestion',
        description:
          'Up to 6 targets within 60 ft: DC 16 WIS save or follow a suggestion for 24 hours.',
      },
      {
        name: 'Eyebite',
        description:
          'One target per turn within 60 ft — choose: Asleep (DC 14 WIS, unconscious 1 min), Panicked (DC 14 WIS, frightened + flees), or Sickened (DC 14 CON, poisoned). Concentration 1 min.',
      },
      {
        name: 'Banishment',
        description: 'DC 15 CHA or Banished. Concentration.',
      },
      {
        name: 'Hold Monster',
        description:
          'DC 15 WIS or Paralyzed. Auto-crits from 5 ft. Concentration.',
      },
    ],
  },
  healer: {
    easy: [
      { name: 'Cure Wounds', description: 'Touch: heal 1d8 + WIS mod HP.' },
      {
        name: 'Healing Word (Bonus Action)',
        description:
          'Range 60 ft: heal 1d4 + WIS mod HP. Can be cast same turn as another spell.',
      },
    ],
    medium: [
      {
        name: 'Mass Healing Word (Bonus Action)',
        description:
          'Range 60 ft, up to 6 targets: each heals 1d4 + WIS mod HP.',
      },
      {
        name: 'Lesser Restoration',
        description:
          'Touch: end one condition (blinded, deafened, paralyzed, or poisoned).',
      },
      { name: 'Cure Wounds', description: 'Touch: heal 2d8 + WIS mod HP.' },
      {
        name: 'Healing Word (Bonus Action)',
        description: 'Range 60 ft: heal 1d4 + WIS mod HP.',
      },
    ],
    hard: [
      {
        name: 'Revivify',
        description:
          'Touch: restore a creature that dropped to 0 HP this round to 1 HP.',
      },
      {
        name: 'Mass Healing Word (Bonus Action)',
        description: '6 targets each heal 1d4 + WIS mod HP.',
      },
      {
        name: 'Spirit Guardians',
        description:
          '15-ft aura: enemies take 3d8 radiant/necrotic per turn (DC 15 WIS half), speed halved in zone. Concentration.',
      },
      {
        name: 'Greater Restoration',
        description:
          'Touch: end charmed, exhaustion (−1), frightened, cursed, or HP max / ability score reduction.',
      },
    ],
    deadly: [
      {
        name: 'Heal',
        description:
          'Range 60 ft: target regains 70 HP. No longer blinded, deafened, diseased, or poisoned.',
      },
      {
        name: 'Mass Cure Wounds',
        description: 'Range 60 ft, 6 targets: each heals 3d8 + WIS mod HP.',
      },
      {
        name: 'Revivify',
        description:
          'Touch: restore a creature that dropped to 0 HP this round to 1 HP.',
      },
      {
        name: 'Spirit Guardians',
        description:
          '15-ft aura: 3d8 radiant/necrotic per turn (DC 15 WIS half). Concentration.',
      },
      {
        name: 'Flame Strike',
        description:
          '10-ft cylinder, 40 ft tall within 60 ft: DC 14 DEX save. 4d6 fire + 4d6 radiant (half on save).',
      },
    ],
  },
}

// ── Party analysis & attack calibration ──────────────────────────────────────

function pickN(arr, n) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(n, copy.length))
}

export function analyzeParty(partyCharacters) {
  if (!partyCharacters?.length) {
    return {
      avgLevel: 5,
      estimatedAC: 17,
      hasHealer: false,
      hasArcane: false,
      hasMartial: true,
      hasControl: false,
      hasAOE: false,
    }
  }
  const avgLevel =
    partyCharacters.reduce((a, c) => a + (c.level ?? 1), 0) /
    partyCharacters.length
  const lvlIdx = Math.min(20, Math.round(avgLevel))
  const estimatedAC = (BASE_PARTY_AC[lvlIdx] ?? 15) + PARTY_AC_ITEM_BONUS

  const classes = partyCharacters.flatMap((c) =>
    (c.classes ?? []).map((cl) => (cl.name ?? '').toLowerCase())
  )
  const hasHealer = classes.some((c) =>
    ['cleric', 'druid', 'paladin', 'bard'].includes(c)
  )
  const hasArcane = classes.some((c) =>
    ['wizard', 'sorcerer', 'warlock', 'artificer', 'bard'].includes(c)
  )
  const hasMartial = classes.some((c) =>
    ['fighter', 'barbarian', 'paladin', 'ranger', 'monk', 'rogue'].includes(c)
  )
  const hasControl = hasArcane || classes.includes('bard')
  const hasAOE = classes.some((c) =>
    ['sorcerer', 'wizard', 'druid', 'bard'].includes(c)
  )

  return {
    avgLevel,
    estimatedAC,
    hasHealer,
    hasArcane,
    hasMartial,
    hasControl,
    hasAOE,
  }
}

function calibrateAttackBonus(partyAvgAC, difficulty, isBoss) {
  const hitPct = TARGET_HIT_PCT[difficulty] ?? 0.55
  const effectivePct = isBoss ? Math.min(0.85, hitPct + 0.08) : hitPct
  return Math.round(partyAvgAC - (21 - effectivePct * 20))
}

function assignFeatures(source, roleKey, difficulty, isBoss, partyProfile) {
  const isHumanoid = source === 'humanoid'
  const pool = isHumanoid
    ? FEATURE_POOLS.humanoid[roleKey] ?? FEATURE_POOLS.humanoid.melee_str
    : FEATURE_POOLS.bestiary[source] ?? FEATURE_POOLS.bestiary.default

  const passiveCount =
    { trivial: 0, easy: 1, medium: 1, hard: 2, deadly: 2 }[difficulty] ?? 1
  const activeCount =
    { trivial: 0, easy: 0, medium: 1, hard: 1, deadly: 2 }[difficulty] ?? 0

  const features = [
    ...pickN(pool.passive ?? [], passiveCount),
    ...pickN(pool.active ?? [], activeCount),
  ]

  if (isBoss) {
    const bossCount = difficulty === 'deadly' ? 2 : 1
    features.push(...pickN(pool.boss ?? [], bossCount))
    features.push(...BOSS_UNIVERSAL)
  }

  if (partyProfile && (difficulty === 'hard' || difficulty === 'deadly')) {
    if (partyProfile.hasHealer && (isBoss || roleKey === 'healer'))
      features.push(REACTIVE_FEATURES.antiHealing)
    if (partyProfile.hasControl && isBoss && difficulty === 'deadly')
      features.push(REACTIVE_FEATURES.antiControl)
  }

  // Deduplicate by name
  const seen = new Set()
  const unique = features.filter((f) => {
    if (seen.has(f.name)) return false
    seen.add(f.name)
    return true
  })

  const spells =
    isHumanoid && SPELL_POOLS[roleKey]
      ? SPELL_POOLS[roleKey][difficulty] ?? SPELL_POOLS[roleKey].easy ?? []
      : []

  return { features: unique, spells }
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
  typeRoleWeights,
  difficulty = 'medium',
  partyProfile = null
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
  const weapon = generateWeapon(roleKey, primaryMod)
  const totalAtk = partyProfile
    ? calibrateAttackBonus(partyProfile.estimatedAC, difficulty, isBoss)
    : primaryMod + profBonus + (isBoss ? 2 : 0) + weapon.enhancement
  const gender = genderOverride ?? pick(GENDERS)
  const race = raceOverride ?? pick(RACES)

  const { features, spells } = assignFeatures(
    'humanoid',
    roleKey,
    difficulty,
    isBoss,
    partyProfile
  )

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
    features,
    spells,
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
  specificMonster = null,
  difficulty = 'medium',
  partyProfile = null
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
  const calibratedAtk = partyProfile
    ? calibrateAttackBonus(partyProfile.estimatedAC, difficulty, isBoss)
    : baseAtk

  const { features, spells } = assignFeatures(
    bestiaryType,
    null,
    difficulty,
    isBoss,
    partyProfile
  )

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
    attackBonus: calibratedAtk >= 0 ? `+${calibratedAtk}` : `${calibratedAtk}`,
    features,
    spells,
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
  partyProfile = null,
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
        roleWeights,
        resolvedDifficulty,
        partyProfile
      )
    }
    return generateBestiaryEnemy(
      partyLevel,
      hpMin,
      hpMax,
      slot.isBoss,
      src,
      sizeMax,
      null,
      resolvedDifficulty,
      partyProfile
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
  difficulty = 'medium',
  partyProfile = null,
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
      roleWeights,
      difficulty,
      partyProfile
    )
  }
  return generateBestiaryEnemy(
    partyLevel,
    hpMin,
    hpMax,
    isBoss,
    source,
    sizeMax,
    specificMonster,
    difficulty,
    partyProfile
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
