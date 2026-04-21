// Standard 5e weapon damage dice, keyed by lowercase weapon name.
// Used as a fallback when damage_dice is not set on an item in party_items.json.
export const WEAPON_DICE = {
  // Simple melee
  'club':           '1d4',
  'dagger':         '1d4',
  'greatclub':      '1d8',
  'handaxe':        '1d6',
  'javelin':        '1d6',
  'light hammer':   '1d4',
  'mace':           '1d6',
  'quarterstaff':   '1d6',
  'sickle':         '1d4',
  'spear':          '1d6',

  // Martial melee
  'battleaxe':      '1d8',
  'flail':          '1d8',
  'glaive':         '1d10',
  'greataxe':       '1d12',
  'greatsword':     '2d6',
  'halberd':        '1d10',
  'lance':          '1d12',
  'longsword':      '1d8',
  'maul':           '2d6',
  'morningstar':    '1d8',
  'pike':           '1d10',
  'rapier':         '1d8',
  'scimitar':       '1d6',
  'shortsword':     '1d6',
  'trident':        '1d6',
  'war pick':       '1d8',
  'warhammer':      '1d8',
  'whip':           '1d4',

  // Simple ranged
  'crossbow, light': '1d8',
  'dart':            '1d4',
  'shortbow':        '1d6',
  'sling':           '1d4',

  // Martial ranged
  'blowgun':         '1',
  'crossbow, hand':  '1d6',
  'crossbow, heavy': '1d10',
  'longbow':         '1d8',
  'net':             '0',
}

// Versatile dice (two-handed grip) for weapons that support it.
export const WEAPON_DICE_VERSATILE = {
  'battleaxe':    '1d10',
  'longsword':    '1d10',
  'quarterstaff': '1d8',
  'spear':        '1d8',
  'trident':      '1d8',
  'warhammer':    '1d10',
}

// Standard 5e armor base AC, keyed by armor type name (lowercase).
// Add armor_type to each armor item in party_items.json to use this lookup.
// magic_bonus on the item is added on top of base.
// Truly homebrew armor with no equivalent can use base_ac + armor_category directly on the item.
export const ARMOR_BASE_AC = {
  // Light — full DEX mod
  'padded':          { base: 11, category: 'light' },
  'leather':         { base: 11, category: 'light' },
  'studded leather': { base: 12, category: 'light' },

  // Medium — DEX mod capped at +2
  'hide':            { base: 12, category: 'medium' },
  'chain shirt':     { base: 13, category: 'medium' },
  'scale mail':      { base: 14, category: 'medium' },
  'breastplate':     { base: 14, category: 'medium' },
  'half plate':      { base: 15, category: 'medium' },

  // Heavy — no DEX mod
  'ring mail':       { base: 14, category: 'heavy' },
  'chain mail':      { base: 16, category: 'heavy' },
  'splint':          { base: 17, category: 'heavy' },
  'plate':           { base: 18, category: 'heavy' },
}

// DEX modifier cap by armor category.
// Unarmored and light use Infinity (full DEX), medium caps at 2, heavy at 0.
export const ARMOR_DEX_CAP = {
  unarmored: Infinity,
  light:     Infinity,
  medium:    2,
  heavy:     0,
}

// Default walking speed in feet, used when character.speed is not set.
export const DEFAULT_SPEED_FT = 30
