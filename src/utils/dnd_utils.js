// dnd_utils.js
// Utility functions for Dawn Blades campaign app
// All functions are pure — pass in a character object + partyItems, get a number back
// Designed for use as Vue 2 computed properties
//
// USAGE IN VUE COMPONENT:
//   import { dnd } from './dnd_utils.js'
//   computed: {
//     partyItems() { return this.$store.state.party_items },
//     ac()               { return dnd.ac(this.character, { carriedPartyItems: this.partyItems }) },
//     savingThrow(key)   { return dnd.savingThrow(this.character, key, this.partyItems) },
//   }
//
// DISPLAY HELPERS (for templates):
//   dnd.signed(n)   → "+3" or "-1"

import { ARMOR_BASE_AC, WEAPON_PROPS } from './dnd_constants.js'
import homebrew from '../data/homebrew.json'

const HOMEBREW_WEAPON_PROPS = Object.fromEntries(
  (homebrew.weapon_types ?? []).map((w) => [w.id, w])
)

export const STAT_KEYS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

export const CLASS_ICONS = {
  fighter:   'ra-crossed-swords',
  barbarian: 'ra-axe-swing',
  rogue:     'ra-daggers',
  artificer: 'ra-gear-hammer',
  wizard:    'ra-crystal-wand',
  cleric:    'ra-ankh',
  warlock:   'ra-eye-monster',
  bard:      'ra-quill-ink',
  monk:      'ra-lightning',
  paladin:   'ra-bolt-shield',
  druid:     'ra-leaf',
  ranger:    'ra-broadhead-arrow',
  sorcerer:  'ra-fluffy-swirl',
}

export function classIcon(character) {
  const primary = (character.class ?? '').split(/[\s\/]+/)[0].toLowerCase()
  return CLASS_ICONS[primary] ?? null
}

// Ability score keys that live inside stat_bonuses but modify the score itself, not a derived bonus.
const SCORE_BONUS_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])

export const dnd = {
  // ─────────────────────────────────────────────
  // CORE PRIMITIVES
  // ─────────────────────────────────────────────

  roll() {
    return Math.floor(Math.random() * 20) + 1
  },

  mod(score) {
    return Math.floor(((score ?? 10) - 10) / 2)
  },

  signed(n) {
    return n >= 0 ? `+${n}` : `${n}`
  },

  formatBonus(n) {
    return dnd.signed(n)
  },

  proficiencyBonus(level) {
    return Math.ceil(level / 4) + 1
  },

  // ─────────────────────────────────────────────
  // STAT RESOLUTION
  // Pass carriedPartyItems whenever item effects must be visible.
  //
  // Returns { stats, bonuses, unarmoredBonuses }
  //   stats          — ability scores after overrides + score bonuses
  //   bonuses        — additive derived bonuses (ac, saves, spell_attack, etc.)
  //   unarmoredBonuses — bonuses that only apply when not wearing armor
  // ─────────────────────────────────────────────

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

    // Only items equipped by this character apply their bonuses
    const equippedItems = items.filter((i) => i.equipped_by === character.name)

    // Pass 1 — stat_overrides set a stat to a fixed value (e.g. Amulet of Health: con → 19)
    for (const item of equippedItems) {
      if (item.stat_overrides) {
        for (const [key, val] of Object.entries(item.stat_overrides)) {
          if (key in stats) stats[key] = val
        }
      }
    }

    // Pass 2 — collect bonuses; ability-score keys (str/dex/…) add to the score itself
    for (const item of equippedItems) {
      if (item.stat_bonuses) {
        for (const [key, val] of Object.entries(item.stat_bonuses)) {
          if (SCORE_BONUS_KEYS.has(key)) {
            // e.g. Belt of Dwarvenkind { con: 2 } → add to CON score
            if (key in stats) stats[key] = (stats[key] ?? 10) + val
          } else {
            bonuses[key] = (bonuses[key] ?? 0) + val
          }
        }
      }
      if (item.unarmored_stat_bonuses) {
        for (const [key, val] of Object.entries(item.unarmored_stat_bonuses)) {
          unarmoredBonuses[key] = (unarmoredBonuses[key] ?? 0) + val
        }
      }
    }

    return { stats, bonuses, unarmoredBonuses }
  },

  // Effective proficiency bonus: base (class/level or character field) + item bonus (Ioun Stone).
  _prof(character, bonuses) {
    const base = character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)
    return base + (bonuses.proficiency_bonus ?? 0)
  },

  // ─────────────────────────────────────────────
  // ARMOR CLASS
  // ─────────────────────────────────────────────

  // Internal — runs the full AC calculation and records each step for the breakdown tooltip.
  _acCompute(character, { bladesongActive = false, carriedPartyItems = [] } = {}) {
    const { stats, bonuses, unarmoredBonuses } = dnd.resolveStats(character, carriedPartyItems)
    const items = [...(character.items ?? []), ...carriedPartyItems]
    const mine = (i) => i.equipped_by === character.name

    const armorItem = items.find((i) => mine(i) && i.type === 'armor' && i.slot === 'body')
    const isWearingArmor = !!armorItem
    const dexMod = dnd.mod(stats.dex)
    const intMod = dnd.mod(stats.int)
    const steps = []
    let base

    if (isWearingArmor) {
      const armorData = ARMOR_BASE_AC[armorItem.armor_type]
      const category = armorData?.category ?? armorItem.armor_type
      const armorBaseAc = armorItem.armor_base_ac ?? armorData?.base ?? 10
      const magicBonus = armorItem.enhancement_bonus ?? 0
      const magicStr = magicBonus ? `, +${magicBonus} enhancement` : ''

      switch (category) {
        case 'heavy':
          base = armorBaseAc + magicBonus
          steps.push(`${armorItem.name} (base ${armorBaseAc}${magicStr})`)
          break
        case 'medium': {
          const dexCapped = Math.min(dexMod, 2)
          base = armorBaseAc + magicBonus + dexCapped
          steps.push(`${armorItem.name} (base ${armorBaseAc}${magicStr})`)
          steps.push(`DEX ${dnd.signed(dexCapped)} (cap 2)`)
          break
        }
        default: {
          base = armorBaseAc + magicBonus + dexMod
          steps.push(`${armorItem.name} (base ${armorBaseAc}${magicStr})`)
          steps.push(`DEX ${dnd.signed(dexMod)}`)
          break
        }
      }
    } else {
      const unarmoredAcItem = items.find((i) => mine(i) && i.unarmored_armor_base_ac != null)
      if (unarmoredAcItem) {
        base = unarmoredAcItem.unarmored_armor_base_ac + dexMod
        steps.push(`${unarmoredAcItem.name} (base ${unarmoredAcItem.unarmored_armor_base_ac})`)
        steps.push(`DEX ${dnd.signed(dexMod)}`)
      } else {
        base = 10 + dexMod
        steps.push(`Unarmored 10 + DEX ${dnd.signed(dexMod)}`)
      }
    }

    const shieldItem = items.find((i) => mine(i) && i.armor_type === 'shield')
    const shieldEnhancement = shieldItem ? (shieldItem.enhancement_bonus ?? 0) : 0
    const shieldBonus = shieldItem ? 2 + shieldEnhancement : 0
    if (shieldItem) {
      const shieldStr = shieldEnhancement ? `, +${shieldEnhancement} enhancement` : ''
      steps.push(`${shieldItem.name} (${dnd.signed(shieldBonus)}${shieldStr})`)
    }

    // Per-item AC bonuses (ring of protection, cloak of protection, bracers of defense, etc.)
    for (const item of items.filter(mine)) {
      const bonus = item.stat_bonuses?.ac ?? 0
      const unarmoredBonus = !isWearingArmor ? (item.unarmored_stat_bonuses?.ac ?? 0) : 0
      const total = bonus + unarmoredBonus
      if (total) steps.push(`${item.name} (${dnd.signed(total)})`)
    }

    if (bladesongActive) steps.push(`Bladesong INT ${dnd.signed(intMod)}`)

    const itemAcBonus = (bonuses.ac ?? 0) + (isWearingArmor ? 0 : unarmoredBonuses.ac ?? 0)
    const bladesongBonus = bladesongActive ? intMod : 0
    const value = base + shieldBonus + itemAcBonus + bladesongBonus
    steps.push(`= ${value}`)
    return { value, steps }
  },

  ac(character, options = {}) {
    return dnd._acCompute(character, options).value
  },

  // Returns a newline-separated string describing the AC calculation for the breakdown tooltip.
  acBreakdown(character, options = {}) {
    return dnd._acCompute(character, options).steps.join('\n')
  },

  // ─────────────────────────────────────────────
  // INITIATIVE
  // ─────────────────────────────────────────────

  initiative(character, partyItems = []) {
    const { stats } = dnd.resolveStats(character, partyItems)
    return dnd.mod(stats.dex)
  },

  // ─────────────────────────────────────────────
  // SAVING THROWS
  // ─────────────────────────────────────────────

  savingThrow(character, statKey, partyItems = []) {
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    const base = dnd.mod(stats[statKey])
    const prof = dnd._prof(character, bonuses)
    const isProficient = (character.saving_throws ?? []).includes(statKey)
    return base + (isProficient ? prof : 0) + (bonuses.saving_throws ?? 0)
  },

  allSavingThrows(character, partyItems = []) {
    return Object.fromEntries(
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => [
        k,
        dnd.savingThrow(character, k, partyItems),
      ])
    )
  },

  // ─────────────────────────────────────────────
  // SKILLS
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

  skill(character, skillName, partyItems = []) {
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    const statKey = dnd.SKILL_MAP[skillName]
    if (!statKey) return 0

    const base = dnd.mod(stats[statKey])
    const prof = dnd._prof(character, bonuses)
    const isProficient = (character.skill_proficiencies ?? []).includes(skillName)
    const hasExpertise = (character.skill_expertise ?? []).includes(skillName)
    const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0
    const itemBonus = bonuses[`skill_${skillName}`] ?? 0

    return base + profBonus + itemBonus
  },

  allSkills(character, partyItems = []) {
    return Object.fromEntries(
      Object.keys(dnd.SKILL_MAP).map((s) => [s, dnd.skill(character, s, partyItems)])
    )
  },

  // ─────────────────────────────────────────────
  // PASSIVE PERCEPTION
  // ─────────────────────────────────────────────

  passivePerception(character, partyItems = []) {
    return 10 + dnd.skill(character, 'Perception', partyItems)
  },

  // ─────────────────────────────────────────────
  // ABILITY MODIFIERS (convenience)
  // ─────────────────────────────────────────────

  allMods(character, partyItems = []) {
    const { stats } = dnd.resolveStats(character, partyItems)
    return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, dnd.mod(v)]))
  },

  // ─────────────────────────────────────────────
  // SPELLCASTING
  // ─────────────────────────────────────────────

  spellAttackBonus(character, partyItems = []) {
    if (!character.spellcasting_ability) return null
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    const mod = dnd.mod(stats[character.spellcasting_ability])
    const prof = dnd._prof(character, bonuses)
    return mod + prof + (bonuses.spell_attack ?? 0)
  },

  spellSaveDC(character, partyItems = []) {
    if (!character.spellcasting_ability) return null
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    const mod = dnd.mod(stats[character.spellcasting_ability])
    const prof = dnd._prof(character, bonuses)
    return 8 + mod + prof + (bonuses.spell_save_dc ?? 0)
  },

  // ─────────────────────────────────────────────
  // WEAPON ATTACK & DAMAGE
  // ─────────────────────────────────────────────

  _weaponProps(weapon) {
    const base = WEAPON_PROPS[weapon.weapon_category] ?? HOMEBREW_WEAPON_PROPS[weapon.weapon_category] ?? {}
    return {
      weapon_type: weapon.weapon_type ?? base.weapon_type ?? (weapon.slot?.startsWith('ranged') ? 'ranged' : 'melee'),
      damage_dice: weapon.damage_dice ?? base.damage_dice ?? '1d4',
      damage_dice_2h: weapon.damage_dice_2h ?? base.damage_dice_2h ?? null,
      finesse: weapon.finesse ?? base.finesse ?? false,
      versatile: weapon.versatile ?? base.versatile ?? false,
    }
  },

  _weaponStatMod(character, weapon, partyItems = []) {
    const { stats } = dnd.resolveStats(character, partyItems)
    const props = dnd._weaponProps(weapon)
    if (props.finesse) return Math.max(dnd.mod(stats.str), dnd.mod(stats.dex))
    return props.weapon_type === 'ranged' ? dnd.mod(stats.dex) : dnd.mod(stats.str)
  },

  gripDie(character, weapon, partyItems = []) {
    const props = dnd._weaponProps(weapon)
    if (!props.versatile) return props.damage_dice
    if (weapon.slot === 'melee2h') return props.damage_dice_2h ?? props.damage_dice
    const melee1hCount = partyItems.filter(
      (i) => i.equipped_by === character.name && i.slot === 'melee1h'
    ).length
    return melee1hCount <= 1 ? (props.damage_dice_2h ?? props.damage_dice) : props.damage_dice
  },

  attackBonus(character, weapon, partyItems = []) {
    const { bonuses } = dnd.resolveStats(character, partyItems)
    const props = dnd._weaponProps(weapon)
    const statMod = dnd._weaponStatMod(character, weapon, partyItems)
    const prof = dnd._prof(character, bonuses)
    const magic = weapon.enhancement_bonus ?? 0
    const typeBonus = props.weapon_type === 'ranged'
      ? (bonuses.ranged_attack ?? 0)
      : (bonuses.melee_attack ?? 0)
    return statMod + prof + magic + typeBonus
  },

  damageBonus(character, weapon, partyItems = []) {
    const { bonuses } = dnd.resolveStats(character, partyItems)
    const props = dnd._weaponProps(weapon)
    const statMod = dnd._weaponStatMod(character, weapon, partyItems)
    const magic = weapon.enhancement_bonus ?? 0
    const rangedBonus = props.weapon_type === 'ranged' ? (bonuses.ranged_damage ?? 0) : 0
    return statMod + magic + rangedBonus
  },

  weaponSummary(character, weapon, partyItems = []) {
    const props = dnd._weaponProps(weapon)
    const die = dnd.gripDie(character, weapon, partyItems)
    return {
      name: weapon.name,
      attack: dnd.signed(dnd.attackBonus(character, weapon, partyItems)),
      damage: `${die}${dnd.signed(dnd.damageBonus(character, weapon, partyItems))}`,
      type: props.weapon_type,
      notes: weapon.notes ?? '',
    }
  },

  weaponSummaries(character, partyItems = []) {
    return partyItems
      .filter((i) => i.equipped_by === character.name && i.type === 'weapon')
      .map((w) => dnd.weaponSummary(character, w, partyItems))
  },

  // ─────────────────────────────────────────────
  // FULL CHARACTER SUMMARY
  // ─────────────────────────────────────────────

  summary(character, { bladesongActive = false, partyItems = [] } = {}) {
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    const prof = dnd._prof(character, bonuses)

    return {
      stats,
      bonuses,
      ac: dnd.ac(character, { bladesongActive, carriedPartyItems: partyItems }),
      initiative: dnd.initiative(character, partyItems),
      proficiencyBonus: prof,
      passivePerception: dnd.passivePerception(character, partyItems),
      spellAttackBonus: dnd.spellAttackBonus(character, partyItems),
      spellSaveDC: dnd.spellSaveDC(character, partyItems),
      mods: dnd.allMods(character, partyItems),
      saves: dnd.allSavingThrows(character, partyItems),
      skills: dnd.allSkills(character, partyItems),
      weapons: dnd.weaponSummaries(character, partyItems),
    }
  },

  // ─────────────────────────────────────────────
  // DISPLAY HELPERS
  // ─────────────────────────────────────────────

  // Stat block for templates — scores and mods after all item effects.
  statArray(character, partyItems = []) {
    const { stats } = dnd.resolveStats(character, partyItems)
    return STAT_KEYS.map(({ key, label }) => {
      const score = stats[key] ?? 10
      return { key, label, score, mod: dnd.mod(score), modStr: dnd.signed(dnd.mod(score)) }
    })
  },

  findCharacter(characters, name) {
    return characters.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() ||
        c.full_name?.toLowerCase() === name.toLowerCase()
    ) ?? null
  },

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

  npcsAtLocation(npcs, locationName) {
    return npcs.filter((n) =>
      n.location?.toLowerCase().includes(locationName.toLowerCase())
    )
  },

  locationsByType(locations, type) {
    const results = []
    for (const city of locations) {
      for (const loc of city.locations ?? []) {
        if (loc.type === type) results.push({ city: city.name, ...loc })
      }
    }
    return results
  },

  sealedChambers(locations) {
    return dnd.locationsByType(locations, 'sealed_chamber')
  },
}
