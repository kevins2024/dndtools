/**
 * startingGearCatalog.js — resolves the item names used in each class's
 * `starting_equipment` (engine/data/classes/*.json) into real party_items.json
 * entry shapes, using the SAME weapon_category/armor_type conventions the
 * app's existing magic items already use (see dnd_constants.js's
 * WEAPON_PROPS/ARMOR_BASE_AC) — a mundane starting weapon only needs
 * weapon_category set, base stats resolve from that shared table.
 *
 * Packs (Explorer's Pack, etc.) are stored as a single "misc" item with the
 * real PHB contents in its description, rather than exploded into ~8
 * sub-items each — this app has no precedent for tracking that level of
 * granular mundane gear (every existing party_items.json entry is a named
 * magic item), and exploding packs would 8x the item count for no real
 * payoff at this table.
 */

const PACK_CONTENTS = {
  "Burglar's Pack":
    'Backpack, 1,000 ball bearings, 10ft string, bell, 5 candles, crowbar, hammer, 10 pitons, hooded lantern, 2 flasks of oil, 5 days rations, tinderbox, waterskin, 50ft hempen rope.',
  "Diplomat's Pack":
    'Chest, 2 cases for maps/scrolls, fine clothes, bottle of ink, ink pen, lamp, 2 flasks of oil, 5 sheets of paper, vial of perfume, sealing wax, soap.',
  "Dungeoneer's Pack":
    'Backpack, crowbar, hammer, 10 pitons, 10 torches, tinderbox, 10 days rations, waterskin, 50ft hempen rope.',
  "Entertainer's Pack":
    'Backpack, bedroll, 2 costumes, 5 candles, 5 days rations, waterskin, disguise kit.',
  "Explorer's Pack":
    'Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 days rations, waterskin, 50ft hempen rope.',
  "Priest's Pack":
    'Backpack, blanket, 10 candles, tinderbox, alms box, 2 blocks of incense, censer, vestments, 2 days rations, waterskin.',
  "Scholar's Pack":
    'Backpack, book of lore, bottle of ink, ink pen, 10 sheets of parchment, little bag of sand, small knife.',
}

// weapon_category -> 2-handed melee weapons get slot melee2h; versatile ones
// default to melee1h (one-handed grip) since that's the common starting use.
const RANGED_WEAPONS = new Set([
  'dart',
  'shortbow',
  'sling',
  'light crossbow',
  'hand crossbow',
  'heavy crossbow',
  'longbow',
])
const TWO_HANDED_ONLY = new Set([
  'greatclub',
  'glaive',
  'greataxe',
  'greatsword',
  'halberd',
  'lance',
  'maul',
  'pike',
])

// Real 5e simple/martial split — mirrors dnd_constants.js's WEAPON_PROPS
// section comments, used to resolve "Any Simple Weapon"-style PHB choices
// into a concrete sub-picker.
export const WEAPON_FILTER_GROUPS = {
  simple: [
    'club',
    'dagger',
    'greatclub',
    'handaxe',
    'javelin',
    'light hammer',
    'mace',
    'quarterstaff',
    'sickle',
    'spear',
    'dart',
    'shortbow',
    'sling',
    'light crossbow',
  ],
  'simple-melee': [
    'club',
    'dagger',
    'greatclub',
    'handaxe',
    'javelin',
    'light hammer',
    'mace',
    'quarterstaff',
    'sickle',
    'spear',
  ],
  martial: [
    'battleaxe',
    'flail',
    'glaive',
    'greataxe',
    'greatsword',
    'halberd',
    'lance',
    'longsword',
    'maul',
    'morningstar',
    'pike',
    'rapier',
    'scimitar',
    'shortsword',
    'trident',
    'war pick',
    'warhammer',
    'whip',
    'hand crossbow',
    'heavy crossbow',
    'longbow',
  ],
  'martial-melee': [
    'battleaxe',
    'flail',
    'glaive',
    'greataxe',
    'greatsword',
    'halberd',
    'lance',
    'longsword',
    'maul',
    'morningstar',
    'pike',
    'rapier',
    'scimitar',
    'shortsword',
    'trident',
    'war pick',
    'warhammer',
    'whip',
  ],
}

function titleCase(key) {
  return key.replace(/\b\w/g, (c) => c.toUpperCase())
}

// name -> function(qty) => partial party_items.json fields (no id/owner —
// the caller fills those in). Ammo/thrown-in-bulk items use `quantity`.
const WEAPON_NAMES = [
  ...WEAPON_FILTER_GROUPS.simple,
  ...WEAPON_FILTER_GROUPS.martial,
]

function weaponEntry(category) {
  return () => ({
    name: titleCase(category),
    type: 'weapon',
    weapon_category: category,
    slot: TWO_HANDED_ONLY.has(category)
      ? 'melee2h'
      : RANGED_WEAPONS.has(category)
      ? 'ranged'
      : 'melee1h',
  })
}

const CATALOG = {}
for (const category of WEAPON_NAMES) {
  CATALOG[titleCase(category)] = weaponEntry(category)
}

// Armor (mundane) — armor_type feeds ARMOR_BASE_AC.
const ARMOR = {
  'Padded Armor': 'padded',
  'Leather Armor': 'leather',
  'Studded Leather Armor': 'studded leather',
  'Hide Armor': 'hide',
  'Chain Shirt': 'chain shirt',
  'Scale Mail': 'scale mail',
  Breastplate: 'breastplate',
  'Half Plate': 'half plate',
  'Ring Mail': 'ring mail',
  'Chain Mail': 'chain mail',
  Splint: 'splint',
  'Plate Armor': 'plate',
}
for (const [name, armor_type] of Object.entries(ARMOR)) {
  CATALOG[name] = () => ({
    name,
    type: 'armor',
    armor_type,
    slot: 'body',
  })
}
CATALOG['Shield'] = () => ({
  name: 'Shield',
  type: 'armor',
  armor_type: 'shield',
  slot: 'shield',
})
CATALOG['Wooden Shield'] = () => ({
  name: 'Wooden Shield',
  type: 'armor',
  armor_type: 'shield',
  slot: 'shield',
  notes:
    "Druid's shield — must be wood, no metal armor/shields per Druidic oath.",
})

// Ammunition — a consumable stack, not an equippable item.
CATALOG['Arrows'] = (qty = 20) => ({
  name: 'Arrows',
  type: 'consumable',
  slot: 'none',
  quantity: qty,
  description: 'Ammunition for a shortbow or longbow.',
})
CATALOG['Bolts'] = (qty = 20) => ({
  name: 'Bolts',
  type: 'consumable',
  slot: 'none',
  quantity: qty,
  description: 'Ammunition for a crossbow.',
})

// Packs
for (const [name, contents] of Object.entries(PACK_CONTENTS)) {
  CATALOG[name] = () => ({
    name,
    type: 'misc',
    slot: 'none',
    description: contents,
  })
}

// Tools / foci / misc gear referenced across the 13 classes' tables.
const MISC = {
  "Thieves' Tools": { type: 'tool', slot: 'none' },
  'Holy Symbol': { type: 'focus', slot: 'held' },
  'Druidic Focus': { type: 'focus', slot: 'held' },
  'Arcane Focus': { type: 'focus', slot: 'held' },
  'Component Pouch': { type: 'tool', slot: 'none' },
  Spellbook: { type: 'tool', slot: 'none' },
  'Musical Instrument': { type: 'tool', slot: 'none' },
}
for (const [name, fields] of Object.entries(MISC)) {
  CATALOG[name] = () => ({ name, ...fields })
}

/**
 * Resolve one gear entry ({name, qty}) — either a concrete catalog item or a
 * symbolic "Any Simple/Martial Weapon" placeholder — into real party_items
 * fields. `resolvedWeapon` is the weapon_category the player picked, only
 * used/required when `entry.filter` is set (a symbolic choice).
 */
export function resolveGearEntry(entry, resolvedWeapon) {
  if (entry.filter) {
    if (!resolvedWeapon) return null
    const build = CATALOG[titleCase(resolvedWeapon)]
    return build
      ? { ...build(), quantity: entry.qty > 1 ? entry.qty : undefined }
      : null
  }
  const build = CATALOG[entry.name]
  if (!build) return null
  const item = build(entry.qty)
  if (entry.qty > 1 && item.quantity == null) item.quantity = entry.qty
  return item
}

export function weaponOptionsForFilter(filter) {
  return (WEAPON_FILTER_GROUPS[filter] ?? []).map((category) => ({
    value: category,
    label: titleCase(category),
  }))
}

// Matches CharacterInventory.vue's own convention: weapon/armor/focus items
// can be equipped (equipped_by starts null, carried), everything else is
// carried-only (equipped_by: 'disallowed' — see Hendvar's Enchanting Tools
// and other existing tool-type entries in party_items.json).
export function isEquippableType(type) {
  return type === 'weapon' || type === 'armor' || type === 'focus'
}

// "5d4x10", "2d4x10", "5d4" (Monk's one exception, no x10) -> rolled gp.
export function rollGoldAlternative(expr) {
  const m = /^(\d+)d(\d+)(?:x(\d+))?$/.exec(expr ?? '')
  if (!m) return 0
  const [, count, sides, mult] = m
  let total = 0
  for (let i = 0; i < Number(count); i++) {
    total += Math.floor(Math.random() * Number(sides)) + 1
  }
  return total * (mult ? Number(mult) : 1)
}
