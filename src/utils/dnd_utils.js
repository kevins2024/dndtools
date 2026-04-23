// dnd_utils.js
// Utility functions for Dawn Blades campaign app
// All functions are pure — pass in a character object, get a number back
// Designed for use as Vue 2 computed properties
//
// USAGE IN VUE COMPONENT:
//   import { dnd } from './dnd_utils.js'
//   computed: {
//     ac()              { return dnd.ac(this.character) },
//     initiative()      { return dnd.initiative(this.character) },
//     passivePerception(){ return dnd.passivePerception(this.character) },
//     weapons()         { return dnd.weaponSummaries(this.character) },
//     // etc.
//   }
//
// DISPLAY HELPERS (for templates):
//   dnd.signed(n)       → "+3" or "-1" (always shows sign)
//   dnd.formatBonus(n)  → alias for signed

import { ARMOR_BASE_AC, WEAPON_PROPS } from './dnd_constants.js'

export const STAT_KEYS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

export const dnd = {
  // ─────────────────────────────────────────────
  // CORE PRIMITIVES
  // ─────────────────────────────────────────────

  roll() {
    return Math.floor(Math.random() * 20) + 1
  },

  // Ability score → modifier
  mod(score) {
    return Math.floor((score - 10) / 2)
  },

  // Format a number as a signed string for display: 3 → "+3", -1 → "-1", 0 → "+0"
  signed(n) {
    return n >= 0 ? `+${n}` : `${n}`
  },

  // Alias
  formatBonus(n) {
    return dnd.signed(n)
  },

  // Proficiency bonus from level (standard 5e table)
  proficiencyBonus(level) {
    return Math.ceil(level / 4) + 1
  },

  // ─────────────────────────────────────────────
  // STAT RESOLUTION
  // Applies item stat_overrides first, then collects
  // stat_bonuses for use in downstream calculations.
  // Always call this before computing AC, saves, etc.
  // ─────────────────────────────────────────────

  // Returns { stats, bonuses, unarmoredBonuses }
  // stats:   raw ability scores after overrides (e.g. Amulet of Health sets CON 19)
  // bonuses: flat additive bonuses from items that apply regardless of armor
  // unarmoredBonuses: bonuses that only apply when unarmored
  resolveStats(character, carriedPartyItems = []) {
    const items = [...(character.items ?? []), ...carriedPartyItems]
    const stats = {
      str: character.stat_str,
      dex: character.stat_dex,
      con: character.stat_con,
      int: character.stat_int,
      wis: character.stat_wis,
      cha: character.stat_cha,
    }
    const bonuses = {}
    const unarmoredBonuses = {}

    // Pass 1 — stat_overrides set a stat to a fixed value
    for (const item of items) {
      if (item.stat_overrides) {
        Object.assign(stats, item.stat_overrides)
      }
    }

    // Pass 2 — collect bonuses (regular and unarmored separately)
    for (const item of items) {
      // Regular bonuses (apply always)
      if (item.stat_bonuses) {
        for (const [key, val] of Object.entries(item.stat_bonuses)) {
          bonuses[key] = (bonuses[key] ?? 0) + val
        }
      }
      // Unarmored-only bonuses
      if (item.unarmored_stat_bonuses) {
        for (const [key, val] of Object.entries(item.unarmored_stat_bonuses)) {
          unarmoredBonuses[key] = (unarmoredBonuses[key] ?? 0) + val
        }
      }
    }

    return { stats, bonuses, unarmoredBonuses }
  },

  // ─────────────────────────────────────────────
  // ARMOR CLASS
  // Handles heavy / medium / light / unarmored
  // Applies item ac bonuses (Bracers of Defense,
  // Ring of Protection, Cloak of Protection, etc.)
  // Also handles unarmored AC from robes/wondrous items
  // Optional: pass bladesongActive = true for Bladesinger
  // ─────────────────────────────────────────────

  ac(character, { bladesongActive = false, carriedPartyItems = [] } = {}) {
    const { stats, bonuses, unarmoredBonuses } = dnd.resolveStats(
      character,
      carriedPartyItems
    )
    const items = [...(character.items ?? []), ...carriedPartyItems]

    // Check if wearing armor (blocks unarmored bonuses)
    const armorItem = items.find(
      (i) =>
        i.equipped_by === character.name &&
        i.type === 'armor' &&
        i.slot === 'body'
    )
    const isWearingArmor = !!armorItem

    const dexMod = dnd.mod(stats.dex)
    const intMod = dnd.mod(stats.int)

    let base, armorType
    if (isWearingArmor) {
      armorType = armorItem.armor_type
      const armorData = ARMOR_BASE_AC[armorType]
      const category = armorData?.category ?? armorType
      const armorBaseAc = armorItem.armor_base_ac ?? armorData?.base ?? 10
      const magicBonus = armorItem.magic_bonus ?? 0

      switch (category) {
        case 'heavy':
          base = armorBaseAc + magicBonus
          break
        case 'medium':
          base = armorBaseAc + magicBonus + Math.min(dexMod, 2)
          break
        case 'light':
        default:
          base = armorBaseAc + magicBonus + dexMod
          break
      }
    } else {
      // Not wearing armor - check for unarmored AC sources
      const unarmoredAcItem = items.find(
        (i) =>
          i.equipped_by === character.name && i.unarmored_armor_base_ac != null
      )

      if (unarmoredAcItem) {
        // Item like Robe of the Archmagi provides base unarmored AC
        base = unarmoredAcItem.unarmored_armor_base_ac + dexMod
        armorType = 'unarmored'
      } else {
        // Standard unarmored AC
        base = 10 + dexMod
        armorType = 'unarmored'
      }
    }

    // Bladesinger: +INT mod to AC while Bladesong active
    const bladesongBonus = bladesongActive ? intMod : 0

    // Shield adds flat +2 (if not blocked by armor restrictions)
    const shieldItem = items.find(
      (i) => i.equipped_by === character.name && i.armor_type === 'shield'
    )
    const shieldBonus = shieldItem ? 2 + (shieldItem.magic_bonus ?? 0) : 0

    // Item bonuses - combine regular and unarmored bonuses appropriately
    const regularAcBonus = bonuses.ac ?? 0
    const unarmoredAcBonus = isWearingArmor ? 0 : unarmoredBonuses.ac ?? 0
    const itemAcBonus = regularAcBonus + unarmoredAcBonus

    return base + shieldBonus + itemAcBonus + bladesongBonus
  },

  // ─────────────────────────────────────────────
  // INITIATIVE
  // DEX modifier. Feral Instinct (Barbarian) gives
  // advantage — handled at the table, not here.
  // ─────────────────────────────────────────────

  initiative(character) {
    const { stats } = dnd.resolveStats(character)
    return dnd.mod(stats.dex)
  },

  // ─────────────────────────────────────────────
  // SAVING THROWS
  // Returns bonus for a given stat key ('str','dex',etc.)
  // Includes proficiency if the character is proficient.
  // Includes item saving_throw bonuses (Ring/Cloak of Protection).
  // ─────────────────────────────────────────────

  savingThrow(character, statKey) {
    const { stats, bonuses } = dnd.resolveStats(character)
    const base = dnd.mod(stats[statKey])
    const prof =
      character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)
    const isProficient = (character.saving_throws ?? []).includes(statKey)
    const itemBonus = bonuses.saving_throws ?? 0
    return base + (isProficient ? prof : 0) + itemBonus
  },

  // Returns all six saving throws as an object
  allSavingThrows(character) {
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha']
    return Object.fromEntries(
      keys.map((k) => [k, dnd.savingThrow(character, k)])
    )
  },

  // ─────────────────────────────────────────────
  // SKILLS
  // Maps each skill to its governing ability score.
  // Accounts for proficiency and expertise (double prof).
  // Accounts for item skill bonuses (e.g. skill_Perception).
  // ─────────────────────────────────────────────

  SKILL_MAP: {
    Acrobatics: 'dex',
    AnimalHandling: 'wis',
    Arcana: 'int',
    Athletics: 'str',
    Deception: 'cha',
    History: 'int',
    Insight: 'wis',
    Intimidation: 'cha',
    Investigation: 'int',
    Medicine: 'wis',
    Nature: 'int',
    Perception: 'wis',
    Performance: 'cha',
    Persuasion: 'cha',
    Religion: 'int',
    SleightOfHand: 'dex',
    Stealth: 'dex',
    Survival: 'wis',
  },

  skill(character, skillName) {
    const { stats, bonuses } = dnd.resolveStats(character)
    const statKey = dnd.SKILL_MAP[skillName]
    if (!statKey) return 0

    const base = dnd.mod(stats[statKey])
    const prof =
      character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)
    const isProficient = (character.skill_proficiencies ?? []).includes(
      skillName
    )
    const hasExpertise = (character.expertise ?? []).includes(skillName)
    const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0

    // Item skill bonuses use key format "skill_SkillName" (e.g. skill_Perception)
    const itemBonus = bonuses[`skill_${skillName}`] ?? 0

    return base + profBonus + itemBonus
  },

  // Returns all skills as an object
  allSkills(character) {
    return Object.fromEntries(
      Object.keys(dnd.SKILL_MAP).map((s) => [s, dnd.skill(character, s)])
    )
  },

  // ─────────────────────────────────────────────
  // PASSIVE PERCEPTION
  // 10 + Perception skill bonus (includes expertise
  // and item bonuses automatically via skill())
  // ─────────────────────────────────────────────

  passivePerception(character) {
    return 10 + dnd.skill(character, 'Perception')
  },

  // ─────────────────────────────────────────────
  // ABILITY MODIFIERS (convenience)
  // Returns all six mods after stat resolution
  // ─────────────────────────────────────────────

  allMods(character) {
    const { stats } = dnd.resolveStats(character)
    return Object.fromEntries(
      Object.entries(stats).map(([k, v]) => [k, dnd.mod(v)])
    )
  },

  // ─────────────────────────────────────────────
  // SPELLCASTING
  // Requires character.spellcasting_ability to be set
  // (e.g. 'int', 'wis', 'cha'). Returns null if not
  // a spellcaster.
  // ─────────────────────────────────────────────

  spellAttackBonus(character) {
    if (!character.spellcasting_ability) return null
    const { stats, bonuses } = dnd.resolveStats(character)
    const mod = dnd.mod(stats[character.spellcasting_ability])
    const prof =
      character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)
    const itemBonus = bonuses.spell_attack ?? 0
    return mod + prof + itemBonus
  },

  spellSaveDC(character) {
    const bonus = dnd.spellAttackBonus(character)
    if (bonus === null) return null
    const { bonuses } = dnd.resolveStats(character)
    const itemBonus = bonuses.spell_save_dc ?? 0
    return 8 + bonus + itemBonus
  },

  // ─────────────────────────────────────────────
  // WEAPON ATTACK & DAMAGE BONUSES
  // weapon: an item object with type: 'weapon',
  //   weapon_type: 'melee' | 'ranged',
  //   finesse: bool,
  //   magic_bonus: number
  //
  // Finesse weapons use the better of STR or DEX.
  // Ranged weapons use DEX.
  // Melee non-finesse uses STR.
  // Includes ranged_damage item bonus for Bracers of Archery.
  // ─────────────────────────────────────────────

  // Resolves all weapon properties, with item-level fields overriding the WEAPON_PROPS lookup.
  // Items only need weapon_category + any non-standard overrides (e.g. homebrew damage dice).
  _weaponProps(weapon) {
    const base = WEAPON_PROPS[weapon.weapon_category] ?? {}
    return {
      weapon_type: weapon.weapon_type ?? base.weapon_type ?? (weapon.slot?.startsWith('ranged') ? 'ranged' : 'melee'),
      damage_dice: weapon.damage_dice ?? base.damage_dice ?? '1d4',
      damage_dice_2h: weapon.damage_dice_2h ?? base.damage_dice_2h ?? null,
      finesse: weapon.finesse ?? base.finesse ?? false,
      versatile: weapon.versatile ?? base.versatile ?? false,
    }
  },

  _weaponStatMod(character, weapon) {
    const { stats } = dnd.resolveStats(character)
    const props = dnd._weaponProps(weapon)
    if (props.finesse) {
      return Math.max(dnd.mod(stats.str), dnd.mod(stats.dex))
    }
    return props.weapon_type === 'ranged' ? dnd.mod(stats.dex) : dnd.mod(stats.str)
  },

  // Returns the damage die for a weapon, choosing 1h or 2h based on what the character has equipped.
  // Shields count as melee1h — off-hand is free only when a single melee1h item is equipped.
  gripDie(character, weapon, partyItems = []) {
    const props = dnd._weaponProps(weapon)
    if (!props.versatile) return props.damage_dice
    if (weapon.slot === 'melee2h') return props.damage_dice_2h ?? props.damage_dice
    const melee1hCount = partyItems.filter(
      (i) => i.equipped_by === character.name && i.slot === 'melee1h'
    ).length
    return melee1hCount <= 1
      ? (props.damage_dice_2h ?? props.damage_dice)
      : props.damage_dice
  },

  attackBonus(character, weapon) {
    const { bonuses } = dnd.resolveStats(character)
    const props = dnd._weaponProps(weapon)
    const statMod = dnd._weaponStatMod(character, weapon)
    const prof = character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)
    const magic = weapon.magic_bonus ?? 0
    const attackTypeBonus = props.weapon_type === 'ranged'
      ? bonuses.ranged_attack ?? 0
      : bonuses.melee_attack ?? 0
    return statMod + prof + magic + attackTypeBonus
  },

  damageBonus(character, weapon) {
    const { bonuses } = dnd.resolveStats(character)
    const props = dnd._weaponProps(weapon)
    const statMod = dnd._weaponStatMod(character, weapon)
    const magic = weapon.magic_bonus ?? 0
    const rangedBonus = props.weapon_type === 'ranged' ? bonuses.ranged_damage ?? 0 : 0
    return statMod + magic + rangedBonus
  },

  weaponSummary(character, weapon, partyItems = []) {
    const props = dnd._weaponProps(weapon)
    const die = dnd.gripDie(character, weapon, partyItems)
    return {
      name: weapon.name,
      attack: dnd.signed(dnd.attackBonus(character, weapon)),
      damage: `${die}${dnd.signed(dnd.damageBonus(character, weapon))}`,
      type: props.weapon_type,
      notes: weapon.notes ?? '',
    }
  },

  // Returns summaries for all weapons in character's inventory
  weaponSummaries(character) {
    return (character.items ?? [])
      .filter((i) => i.type === 'weapon')
      .map((w) => dnd.weaponSummary(character, w))
  },

  // ─────────────────────────────────────────────
  // FULL CHARACTER SUMMARY
  // Returns a single computed object with everything
  // your templates are likely to need. Useful as a
  // single Vue computed that memoizes all the math.
  //
  // Usage:
  //   computed: {
  //     computed() { return dnd.summary(this.character) }
  //   }
  //   then in template: computed.ac, computed.weapons, etc.
  // ─────────────────────────────────────────────

  summary(character, options = {}) {
    const { bladesongActive = false } = options
    const { stats, bonuses } = dnd.resolveStats(character)
    const prof =
      character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)

    return {
      // Resolved stats (after overrides like Amulet of Health)
      stats,
      bonuses,

      // Core numbers
      ac: dnd.ac(character, { bladesongActive }),
      initiative: dnd.initiative(character),
      proficiencyBonus: prof,
      passivePerception: dnd.passivePerception(character),

      // Spellcasting (null if not a caster)
      spellAttackBonus: dnd.spellAttackBonus(character),
      spellSaveDC: dnd.spellSaveDC(character),

      // Ability modifiers
      mods: dnd.allMods(character),

      // All saving throws
      saves: dnd.allSavingThrows(character),

      // All skills
      skills: dnd.allSkills(character),

      // Weapons
      weapons: dnd.weaponSummaries(character),
    }
  },

  // ─────────────────────────────────────────────
  // UTILITY LOOKUPS
  // Helpers for working with the data files
  // ─────────────────────────────────────────────

  // Returns a display-ready array of stat objects for templates
  statArray(character) {
    return STAT_KEYS.map(({ key, label }) => ({
      key,
      label,
      score: character[`stat_${key}`],
      mod: dnd.mod(character[`stat_${key}`]),
      modStr: dnd.signed(dnd.mod(character[`stat_${key}`])),
    }))
  },

  // Find a character by name (first match) from characters array
  findCharacter(characters, name) {
    return (
      characters.find(
        (c) =>
          c.name.toLowerCase() === name.toLowerCase() ||
          c.full_name?.toLowerCase() === name.toLowerCase()
      ) ?? null
    )
  },

  // Find an NPC by name
  findNPC(npcs, name) {
    return npcs.find((n) => n.name.toLowerCase() === name.toLowerCase()) ?? null
  },

  itemsFor(character, partyItems, { equippedOnly = false } = {}) {
    return partyItems.filter(
      (i) =>
        i.equipped_by === character.name ||
        (!equippedOnly && i.attuned && i.carried_by === character.name)
    )
  },

  lookupSpell(spellName) {
    return homebrew.spells.find((s) => s.name === spellName) ?? null
  },

  // Get all witness items across a character's inventory
  witnessItems(character) {
    return (character.items ?? []).filter((i) => i.type === 'witness')
  },

  // Get all weapons
  weapons(character) {
    return (character.items ?? []).filter((i) => i.type === 'weapon')
  },

  // Get all NPCs at a given location name
  npcsAtLocation(npcs, locationName) {
    return npcs.filter((n) =>
      n.location?.toLowerCase().includes(locationName.toLowerCase())
    )
  },

  // Get all locations of a given type from a locations array
  // (locations is the flat array of city-level objects from locations.js)
  locationsByType(locations, type) {
    const results = []
    for (const city of locations) {
      for (const loc of city.locations ?? []) {
        if (loc.type === type) results.push({ city: city.name, ...loc })
      }
    }
    return results
  },

  // Get all sealed chambers across all locations
  sealedChambers(locations) {
    return dnd.locationsByType(locations, 'sealed_chamber')
  },
}
