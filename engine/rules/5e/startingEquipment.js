// Starting equipment, 2024: turns the item names in a class's and a background's `starting_equipment`
// options (engine/data/5e2024/classes/*.json, backgrounds.json) into party_items.json records, using the
// same weapon_category / armor_type conventions the app's other items use (a mundane weapon only needs
// weapon_category, its stats resolve from the shared weapon table).
//
// The 2024 rule: a class offers equipment packages A / B (the Fighter also C), a background offers A / B;
// every package is a list of items plus gold, and the last one is gold only. A new character takes one
// class package and one background package, and the gold from both.
//
// Packs are stored as one "misc" item with the pack's contents in its description, not exploded into
// their parts (this app tracks named gear, not every candle). Pack contents are the 2024 Basic Rules'
// (they changed from 2014).
//
// Pure data (no fs), safe anywhere.

const PACKS = {
  "Burglar's Pack":
    'Backpack, Ball Bearings, Bell, 10 Candles, Crowbar, Hooded Lantern, 7 flasks of Oil, 5 days of Rations, Rope, Tinderbox, Waterskin.',
  "Diplomat's Pack":
    'Chest, Fine Clothes, Ink, 5 Ink Pens, Lamp, 2 Map or Scroll Cases, 4 flasks of Oil, 5 sheets of Paper, 5 sheets of Parchment, Perfume, Tinderbox.',
  "Dungeoneer's Pack":
    'Backpack, Caltrops, Crowbar, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, Waterskin.',
  "Entertainer's Pack":
    'Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 flasks of Oil, 9 days of Rations, Tinderbox, Waterskin.',
  "Explorer's Pack":
    'Backpack, Bedroll, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, Waterskin.',
  "Priest's Pack":
    'Backpack, Blanket, Holy Water, Lamp, 7 days of Rations, Robe, Tinderbox.',
  "Scholar's Pack":
    'Backpack, Book, Ink, Ink Pen, Lamp, 10 flasks of Oil, 10 sheets of Parchment, Tinderbox.',
}

const SIMPLE = [
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
]
const MARTIAL = [
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
]
const RANGED = new Set([
  'dart',
  'shortbow',
  'sling',
  'light crossbow',
  'hand crossbow',
  'heavy crossbow',
  'longbow',
])
const TWO_HANDED = new Set([
  'greatclub',
  'glaive',
  'greataxe',
  'greatsword',
  'halberd',
  'lance',
  'maul',
  'pike',
])
const ARMOR = {
  'Padded Armor': 'padded',
  'Leather Armor': 'leather',
  'Studded Leather Armor': 'studded leather',
  'Hide Armor': 'hide',
  'Chain Shirt': 'chain shirt',
  'Scale Mail': 'scale mail',
  Breastplate: 'breastplate',
  'Half Plate Armor': 'half plate',
  'Ring Mail': 'ring mail',
  'Chain Mail': 'chain mail',
  'Splint Armor': 'splint',
  'Plate Armor': 'plate',
}
const PLURALS = {
  Pouches: 'Pouch',
  Costumes: 'Costume',
}

const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const WEAPONS = new Set([...SIMPLE, ...MARTIAL])
const TOOLISH =
  /(tools|supplies|utensils|kit|set|instrument)$|^(bagpipes|drum|dulcimer|flute|horn|lute|lyre|pan flute|shawm|viol)$/i

// Weapon names come plural for a stack ("Daggers", "Handaxes", "Javelins").
function weaponCategory(name) {
  const n = name.toLowerCase()
  if (WEAPONS.has(n)) return n
  return (
    [n.replace(/s$/, ''), n.replace(/es$/, '')].find((x) => WEAPONS.has(x)) ??
    null
  )
}

// One entry ({ name, qty }) as the fields of a party item (no id, no owner).
function itemFields(entry) {
  const qty = entry.qty ?? 1
  const name = entry.name
  const weapon = weaponCategory(name)
  let item
  if (weapon)
    item = {
      name: title(weapon),
      type: 'weapon',
      weapon_category: weapon,
      slot: TWO_HANDED.has(weapon)
        ? 'melee2h'
        : RANGED.has(weapon)
        ? 'ranged'
        : 'melee1h',
    }
  else if (ARMOR[name])
    item = { name, type: 'armor', armor_type: ARMOR[name], slot: 'body' }
  else if (name === 'Shield')
    item = { name, type: 'armor', armor_type: 'shield', slot: 'shield' }
  else if (name === 'Arrows' || name === 'Bolts')
    item = {
      name,
      type: 'consumable',
      slot: 'none',
      description:
        name === 'Arrows'
          ? 'Ammunition for a shortbow or longbow.'
          : 'Ammunition for a crossbow.',
    }
  else if (PACKS[name])
    item = { name, type: 'misc', slot: 'none', description: PACKS[name] }
  else if (/^(Holy Symbol|Arcane Focus|Druidic Focus)/.test(name))
    item = { name, type: 'focus', slot: 'held' }
  else if (TOOLISH.test(name) || name === "Thieves' Tools")
    item = { name, type: 'tool', slot: 'none' }
  else item = { name: PLURALS[name] ?? name, type: 'misc', slot: 'none' }
  if (qty > 1) item.quantity = qty
  return item
}

// Weapons, armor and foci can be equipped; everything else is carried only.
const isEquippable = (type) =>
  type === 'weapon' || type === 'armor' || type === 'focus'

// Places in a package where the player supplies the item's name: the key of the pick, and a label.
// "(same as above)" means the tool the background gave.
function placeholder(name) {
  if (/chosen for the tool proficiency above/i.test(name))
    return { key: 'classTool' }
  if (/^Musical Instrument of your choice$/i.test(name))
    return { key: 'instrument', pool: 'Musical Instrument' }
  if (/^Gaming Set \(any\)$/i.test(name))
    return { key: 'gamingSet', pool: 'Gaming Set' }
  if (/\(same as above\)$/i.test(name)) return { key: 'backgroundTool' }
  return null
}

// "Chain Mail, Greatsword, 8 Javelins + 4 GP" — the one-line summary a picker shows.
function describePackage(pkg) {
  const parts = (pkg.items ?? []).map((i) =>
    i.qty > 1 ? `${i.qty} ${i.name}` : i.name
  )
  return [...parts, `${pkg.gold} GP`].join(', ')
}

// The party items and gold for a chosen package. `named` fills the placeholders: { classTool,
// instrument, gamingSet, backgroundTool }. An item whose placeholder is not filled yet is left out.
function packageToItems(pkg, characterName, named = {}) {
  const items = []
  for (const entry of pkg.items ?? []) {
    const ph = placeholder(entry.name)
    const resolved = ph ? named[ph.key] : entry.name
    if (!resolved) continue
    const f = itemFields({ ...entry, name: resolved })
    items.push({
      ...f,
      carried_by: characterName,
      equipped_by: isEquippable(f.type) ? null : 'disallowed',
      needs_attunement: false,
      attuned: false,
      notes: '',
    })
  }
  return { items, gold: pkg.gold ?? 0 }
}

module.exports = { packageToItems, describePackage, placeholder, PACKS }
