// Canonical 5e weapon properties, keyed by weapon_category on each item.
// Items only store what differs from these defaults (enhancement_bonus, damage_dice override, etc.)
// weapon_type: 'melee' | 'ranged'
// versatile weapons have damage_dice_2h for the two-handed grip
export const WEAPON_PROPS = {
  // ── Simple melee ──
  club: {
    weapon_type: 'melee',
    damage_dice: '1d4',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
  },
  dagger: {
    weapon_type: 'melee',
    damage_dice: '1d4',
    damage_type: 'piercing',
    finesse: true,
    versatile: false,
    thrown: { normal: 20, long: 60 },
  },
  greatclub: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
  },
  handaxe: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'slashing',
    finesse: false,
    versatile: false,
    thrown: { normal: 20, long: 60 },
  },
  javelin: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
    thrown: { normal: 30, long: 120 },
  },
  'light hammer': {
    weapon_type: 'melee',
    damage_dice: '1d4',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
    thrown: { normal: 20, long: 60 },
  },
  mace: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
  },
  quarterstaff: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d8',
  },
  staff: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d8',
  },
  sickle: {
    weapon_type: 'melee',
    damage_dice: '1d4',
    damage_type: 'slashing',
    finesse: false,
    versatile: false,
  },
  spear: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'piercing',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d8',
    thrown: { normal: 20, long: 60 },
  },

  // ── Martial melee ──
  battleaxe: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'slashing',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d10',
  },
  flail: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
  },
  glaive: {
    weapon_type: 'melee',
    damage_dice: '1d10',
    damage_type: 'slashing',
    finesse: false,
    versatile: false,
  },
  greataxe: {
    weapon_type: 'melee',
    damage_dice: '1d12',
    damage_type: 'slashing',
    finesse: false,
    versatile: false,
  },
  greatsword: {
    weapon_type: 'melee',
    damage_dice: '2d6',
    damage_type: 'slashing',
    finesse: false,
    versatile: false,
  },
  halberd: {
    weapon_type: 'melee',
    damage_dice: '1d10',
    damage_type: 'slashing',
    finesse: false,
    versatile: false,
  },
  lance: {
    weapon_type: 'melee',
    damage_dice: '1d12',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  longsword: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'slashing',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d10',
  },
  maul: {
    weapon_type: 'melee',
    damage_dice: '2d6',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
  },
  morningstar: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  pike: {
    weapon_type: 'melee',
    damage_dice: '1d10',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  rapier: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'piercing',
    finesse: true,
    versatile: false,
  },
  scimitar: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'slashing',
    finesse: true,
    versatile: false,
  },
  shortsword: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'piercing',
    finesse: true,
    versatile: false,
  },
  trident: {
    weapon_type: 'melee',
    damage_dice: '1d6',
    damage_type: 'piercing',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d8',
    thrown: { normal: 20, long: 60 },
  },
  'war pick': {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  warhammer: {
    weapon_type: 'melee',
    damage_dice: '1d8',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: true,
    damage_dice_2h: '1d10',
  },
  whip: {
    weapon_type: 'melee',
    damage_dice: '1d4',
    damage_type: 'slashing',
    finesse: true,
    versatile: false,
  },

  // ── Simple ranged ──
  dart: {
    weapon_type: 'ranged',
    damage_dice: '1d4',
    damage_type: 'piercing',
    finesse: true,
    versatile: false,
    thrown: { normal: 20, long: 60 },
  },
  shortbow: {
    weapon_type: 'ranged',
    damage_dice: '1d6',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  sling: {
    weapon_type: 'ranged',
    damage_dice: '1d4',
    damage_type: 'bludgeoning',
    finesse: false,
    versatile: false,
  },
  'light crossbow': {
    weapon_type: 'ranged',
    damage_dice: '1d8',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },

  // ── Martial ranged ──
  'hand crossbow': {
    weapon_type: 'ranged',
    damage_dice: '1d6',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  'heavy crossbow': {
    weapon_type: 'ranged',
    damage_dice: '1d10',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
  longbow: {
    weapon_type: 'ranged',
    damage_dice: '1d8',
    damage_type: 'piercing',
    finesse: false,
    versatile: false,
  },
}

// Standard 5e armor base AC, keyed by armor type name (lowercase).
// Add armor_type to each armor item in party_items.json to use this lookup.
// enhancement_bonus on the item is added on top of base.
// Truly homebrew armor with no equivalent can use armor_base_ac directly on the item.
export const ARMOR_BASE_AC = {
  // Light — full DEX mod
  padded: { base: 11, category: 'light' },
  leather: { base: 11, category: 'light' },
  'studded leather': { base: 12, category: 'light' },

  // Medium — DEX mod capped at +2
  hide: { base: 12, category: 'medium' },
  'chain shirt': { base: 13, category: 'medium' },
  'scale mail': { base: 14, category: 'medium' },
  breastplate: { base: 14, category: 'medium' },
  'half plate': { base: 15, category: 'medium' },

  // Heavy — no DEX mod
  'ring mail': { base: 14, category: 'heavy' },
  'chain mail': { base: 16, category: 'heavy' },
  splint: { base: 17, category: 'heavy' },
  plate: { base: 18, category: 'heavy' },
}

// DEX modifier cap by armor category.
// Unarmored and light use Infinity (full DEX), medium caps at 2, heavy at 0.
export const ARMOR_DEX_CAP = {
  unarmored: Infinity,
  light: Infinity,
  medium: 2,
  heavy: 0,
}

// Default walking speed in feet, used when character.speed is not set.
export const DEFAULT_SPEED_FT = 30
