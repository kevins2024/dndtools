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
import weaponTypesAndLanguages from '../data/weapon_types_and_languages.json'

const HOMEBREW_WEAPON_PROPS = Object.fromEntries(
  (weaponTypesAndLanguages.weapon_types ?? []).map((w) => [w.id, w])
)

export const STAT_KEYS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

// Ability score keys that live inside stat_bonuses but modify the score itself, not a derived bonus.
const SCORE_BONUS_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])

// Short, plain-language reminders of what each ability actually governs —
// for a tooltip on the ability-score pickers (New Character / Level Up),
// aimed at players still learning the rules, not a rules-lawyer reference.
export const ABILITY_DESCRIPTIONS = {
  str: 'Melee attack & damage rolls (non-finesse weapons), Athletics, carrying/lifting capacity.',
  dex: 'Armor Class, initiative, ranged & finesse weapon attacks, Acrobatics/Stealth/Sleight of Hand.',
  con: 'Hit points gained at every level, and Constitution saves (including concentration checks).',
  int: 'Investigation/Arcana/History/Nature/Religion checks; Wizard spell attacks & save DC.',
  wis: 'Perception/Insight/Medicine/Survival/Animal Handling checks; Cleric/Druid/Ranger spell attacks & save DC.',
  cha: 'Persuasion/Deception/Intimidation/Performance checks; Bard/Sorcerer/Warlock/Paladin spell attacks & save DC.',
}

// PHB's own "Quick Build" suggested ability priority per class (real RAW
// guidance, not a guess) — melee classes list both str/dex since the book
// itself treats finesse/ranged builds as equally valid, not a single right
// answer. A class's actual spellcasting ability (tracked per-class in
// engine/data, not duplicated here) should always be added on top of this by
// the caller — see `dnd.priorityAbilitiesForClass`.
const CLASS_QUICK_BUILD_ABILITIES = {
  Artificer: ['int', 'dex', 'con'],
  Barbarian: ['str', 'con'],
  Bard: ['cha', 'dex'],
  Cleric: ['wis', 'str'],
  Druid: ['wis', 'con'],
  Fighter: ['str', 'dex', 'con'],
  Monk: ['dex', 'wis'],
  Paladin: ['str', 'cha'],
  Ranger: ['dex', 'wis'],
  Rogue: ['dex'],
  Sorcerer: ['cha', 'con'],
  Warlock: ['cha', 'con'],
  Wizard: ['int', 'con'],
}

// classData: a loaded class record (needs .name and, for casters, a
// .spellcasting.ability field) — pass whatever the caller already has from
// engine/data/classes rather than re-fetching. Returns an ordered, deduped
// array of ability keys (e.g. ['cha', 'dex']), or [] if the class isn't
// recognized.
function priorityAbilitiesForClass(classData) {
  if (!classData?.name) return []
  const abilities = []
  const seen = new Set()
  const add = (a) => {
    if (a && !seen.has(a)) {
      seen.add(a)
      abilities.push(a)
    }
  }
  add(classData.spellcasting?.ability)
  for (const a of CLASS_QUICK_BUILD_ABILITIES[classData.name] ?? []) add(a)
  return abilities
}

export const dnd = {
  priorityAbilitiesForClass,

  // ─────────────────────────────────────────────
  // CLASS HELPERS
  // ─────────────────────────────────────────────

  // "Fighter / Warlock" or "Monk"
  classLabel(character) {
    return (character?.classes ?? []).map((c) => c.name).join(' / ')
  },

  // "Champion / Great Old One" or "Way of the Open Hand"
  subclassLabel(character) {
    return (character?.classes ?? [])
      .map((c) => c.subclass)
      .filter(Boolean)
      .join(' / ')
  },

  // Full subtitle: "Fighter 4 / Warlock 5 · Level 9" or "Monk (Way of the Open Hand) · Level 9"
  // Pass { includeSubclass: false } to omit the parenthetical subclass, e.g.
  // when the caller renders the subclass on its own line instead.
  classBreakdownLabel(character, { includeSubclass = true } = {}) {
    const classes = character?.classes ?? []
    if (classes.length === 1) {
      const c = classes[0]
      const subclassPart =
        includeSubclass && c.subclass ? ` (${c.subclass})` : ''
      return `${c.name}${subclassPart} · Level ${character.level}`
    }
    return (
      classes.map((c) => `${c.name} ${c.level}`).join(' / ') +
      ` · Level ${character.level}`
    )
  },

  // ─────────────────────────────────────────────
  // CORE PRIMITIVES
  // ─────────────────────────────────────────────

  roll() {
    return Math.floor(Math.random() * 20) + 1
  },

  // Weave Dust from Broken-Down Magic Items (house_rules.json) — pure given
  // an item + a specific d20 roll, so the UI can both preview a range (rolls
  // 2 and 19, the non-crit extremes) and commit one real roll on actual
  // destruction. Returns null when the item has no recorded value_gp — there's
  // nothing to calculate from, not a silent 0.
  weaveDustForRoll(item, roll) {
    if (!item?.value_gp) return null
    let base = item.value_gp / 15
    if (item.charges_max) {
      const current = item.charges_current ?? item.charges_max
      const missingFraction = 1 - current / item.charges_max
      base *= 1 - 0.3 * missingFraction
      if (
        item.charges_recharge_type === 'material' &&
        item.charges_recharge_material_cost_gp
      ) {
        const missingCharges = item.charges_max - current
        base -= (missingCharges * item.charges_recharge_material_cost_gp) / 15
      }
    }
    let adjusted
    if (roll === 20) adjusted = base * 2
    else if (roll === 1) adjusted = base / 2
    else {
      const pct = roll >= 11 ? roll - 10 : roll - 11
      adjusted = base * (1 + pct / 100)
    }
    return Math.max(0, Math.floor(adjusted))
  },

  // {low, high} using the non-crit roll extremes (2 and 19) — an at-a-glance
  // preview before actually destroying the item, which rolls for real
  // (including the crit 1/20 cases) via weaveDustForRoll.
  weaveDustEstimateRange(item) {
    if (!item?.value_gp) return null
    return {
      low: dnd.weaveDustForRoll(item, 2),
      high: dnd.weaveDustForRoll(item, 19),
    }
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

  // Shared pill-display formatting — used by WeaponTable, FeaturePillsPanel,
  // and SpellPillsByLevel so there's one implementation instead of three
  // copies.
  rechargeLabel(recharge) {
    if (recharge === 'short_rest') return 'SR'
    if (recharge === 'long_rest') return 'LR'
    return recharge.replace(/_/g, ' ')
  },

  // Short display label for an action_type value — shared by
  // BattleItemsPanel's item-cost badge and item/spell detail popups so
  // there's one mapping instead of one per component.
  actionTypeBadgeLabel(actionType) {
    const map = {
      action: 'Action',
      bonus_action: 'Bonus',
      reaction: 'Reaction',
      // Triggers as part of an action already being taken (an attack, a
      // spell cast) rather than costing one of its own — distinct from a
      // true always-on passive bonus, which needs no trigger at all.
      free: 'Free',
    }
    return map[actionType] ?? 'Passive'
  },

  // Normalizes one entry of an item's `spells_granted` array to a common
  // shape, regardless of which authoring style it uses:
  //   - a bare string (legacy/simple grant — exactly one spell, no
  //     differentiated cost, item-level action_type applies)
  //   - an object (see engine/CHECKLIST.md's item-granted-spells writeup):
  //       name                          — spell name
  //       action_type                   — 'action'|'bonus_action'|'reaction'|'free',
  //                                       the REAL cost of casting THIS spell via
  //                                       this item (may differ from the spell's
  //                                       own casting_time, and from other spells
  //                                       on the same item)
  //       charge_cost                   — number, or {min,max} when the player
  //                                       chooses how many of the item's own
  //                                       charges_current/charges_max pool to
  //                                       spend at cast time (e.g. a wand's
  //                                       variable-level upcast)
  //       uses_max / uses_current       — an independent per-spell use count,
  //                                       NOT drawn from the item's shared
  //                                       charge pool (same shape as
  //                                       weapon_effects' uses_max/uses_current)
  //       recharge                      — when this spell's own uses_current
  //                                       resets (see rechargeLabel) — only
  //                                       meaningful alongside uses_max
  //       material_component_required   — true if the wielder must still
  //                                       provide/consume the spell's own real
  //                                       material component (per
  //                                       published_spells.json) even when cast
  //                                       via the item; omitted/false means the
  //                                       item itself substitutes, per the DMG's
  //                                       general "no separate components
  //                                       needed" rule for magic item casting
  //       choice_group                  — links 2+ entries that share ONE use
  //                                       or charge; casting any one of them
  //                                       spends the shared resource (e.g. a
  //                                       Necklace of Prayer Beads' Curing bead
  //                                       offering a choice of Cure Wounds or
  //                                       Lesser Restoration from the same use)
  normalizeItemSpellGrant(entry, item) {
    if (typeof entry === 'string') {
      return {
        name: entry,
        actionType: item?.action_type ?? null,
        chargeCost: null,
        usesMax: null,
        usesCurrent: null,
        recharge: null,
        materialComponentRequired: false,
        choiceGroup: null,
      }
    }
    return {
      name: entry.name,
      actionType: entry.action_type ?? item?.action_type ?? null,
      chargeCost: entry.charge_cost ?? null,
      usesMax: entry.uses_max ?? null,
      usesCurrent: entry.uses_current ?? null,
      recharge: entry.recharge ?? null,
      materialComponentRequired: entry.material_component_required === true,
      choiceGroup: entry.choice_group ?? null,
    }
  },

  schoolAbbr(school) {
    const map = {
      abjuration: 'Abj',
      conjuration: 'Con',
      divination: 'Div',
      enchantment: 'Enc',
      evocation: 'Evo',
      illusion: 'Ill',
      necromancy: 'Nec',
      transmutation: 'Tra',
    }
    return map[school.toLowerCase()] ?? school.slice(0, 3)
  },

  // CSS var name for a school/class's accent color — see the
  // --color-school-*/--color-class-* tokens in theme.css. Falls back to the
  // neutral text-low token so an unrecognized value still renders sanely
  // instead of an invalid CSS color.
  schoolColorVar(school) {
    const known = [
      'abjuration',
      'conjuration',
      'divination',
      'enchantment',
      'evocation',
      'illusion',
      'necromancy',
      'transmutation',
    ]
    const key = (school ?? '').toLowerCase()
    return known.includes(key)
      ? `var(--color-school-${key})`
      : 'var(--color-text-low)'
  },

  classColorVar(className) {
    const known = [
      'artificer',
      'barbarian',
      'bard',
      'cleric',
      'druid',
      'fighter',
      'monk',
      'paladin',
      'ranger',
      'rogue',
      'sorcerer',
      'warlock',
      'wizard',
    ]
    const key = (className ?? '').toLowerCase()
    return known.includes(key)
      ? `var(--color-class-${key})`
      : 'var(--color-text-low)'
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

    // Pass 3 — feature stat_bonuses (e.g. Elven Accuracy +1 DEX)
    for (const feature of character.features ?? []) {
      if (feature.stat_bonuses) {
        for (const [key, val] of Object.entries(feature.stat_bonuses)) {
          if (SCORE_BONUS_KEYS.has(key)) {
            if (key in stats) stats[key] = (stats[key] ?? 10) + val
          } else {
            bonuses[key] = (bonuses[key] ?? 0) + val
          }
        }
      }
    }

    return { stats, bonuses, unarmoredBonuses }
  },

  // Effective proficiency bonus: base (class/level or character field) + item bonus (Ioun Stone).
  _prof(character, bonuses) {
    const base =
      character.proficiency_bonus ?? dnd.proficiencyBonus(character.level)
    return base + (bonuses.proficiency_bonus ?? 0)
  },

  // ─────────────────────────────────────────────
  // WEAPON SETS
  // ─────────────────────────────────────────────
  // A character can have more than 2 weapons flagged equipped_by them at
  // once (e.g. a melee pair AND a ranged pair carried ready to switch to),
  // which the old flat "equipped_by === character.name" check treated as
  // ALL simultaneously in-hand — fine for "is this on my person" (armor,
  // rings, wondrous items), wrong for "what am I actually holding right
  // now" (which rules like Dual Wielder's conditional AC bonus need). Added
  // 2026-09-09. Only `type: 'weapon'` items carry a `weapon_set` (1 or 2);
  // everything else ignores the concept entirely and stays governed by
  // equipped_by alone. A weapon with no weapon_set set is treated as active
  // regardless of which set is current — an unmigrated/legacy item, or a
  // deliberately set-agnostic one (e.g. a weapon someone always keeps
  // sheathed on their belt in both loadouts).
  activeWeaponSet(character) {
    return character.active_weapon_set ?? 1
  },

  // True if `item` should count as "in hand right now" for this character —
  // equipped_by them, and (for weapons specifically) either set-agnostic or
  // in the currently active set.
  isActiveEquipped(item, character) {
    if (item.equipped_by !== character.name) return false
    if (item.type !== 'weapon' || item.weapon_set == null) return true
    return item.weapon_set === dnd.activeWeaponSet(character)
  },

  // Real RAW: Dual Wielder's +1 AC applies only "while wielding a separate
  // melee weapon in each hand" — two one-handed melee weapons, no shield
  // (a shield occupies the second hand, which is exactly what the feat's
  // own wording excludes). Doesn't check the feat itself — callers already
  // gate on that (see _acCompute below) so this stays a pure "is the
  // character's current loadout physically dual-wielding melee" check,
  // reusable anywhere else this same condition matters later (attack
  // bonuses, flavor text, etc.).
  isDualWieldingMelee(character, carriedPartyItems = []) {
    const items = [...(character.items ?? []), ...carriedPartyItems]
    const active = items.filter((i) => dnd.isActiveEquipped(i, character))
    const hasShield = active.some((i) => i.armor_type === 'shield')
    if (hasShield) return false
    const meleeOneHanded = active.filter(
      (i) => i.type === 'weapon' && i.slot === 'melee1h'
    )
    return meleeOneHanded.length >= 2
  },

  // ─────────────────────────────────────────────
  // ARMOR CLASS
  // ─────────────────────────────────────────────

  // Internal — runs the full AC calculation and records each step for the breakdown tooltip.
  _acCompute(
    character,
    { bladesongActive = false, carriedPartyItems = [] } = {}
  ) {
    const { stats, bonuses, unarmoredBonuses } = dnd.resolveStats(
      character,
      carriedPartyItems
    )
    const items = [...(character.items ?? []), ...carriedPartyItems]
    const mine = (i) => i.equipped_by === character.name

    const armorItem = items.find(
      (i) => mine(i) && i.type === 'armor' && i.slot === 'body'
    )
    const isWearingArmor = !!armorItem
    const dexMod = dnd.mod(stats.dex)
    const conMod = dnd.mod(stats.con)
    const wisMod = dnd.mod(stats.wis)
    const intMod = dnd.mod(stats.int)
    const steps = []
    let base
    let statUnarmoredBonus = 0

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
      const unarmoredAcItem = items.find(
        (i) => mine(i) && i.unarmored_armor_base_ac != null
      )
      if (unarmoredAcItem) {
        base = unarmoredAcItem.unarmored_armor_base_ac + dexMod
        steps.push(
          `${unarmoredAcItem.name} (base ${unarmoredAcItem.unarmored_armor_base_ac})`
        )
        steps.push(`DEX ${dnd.signed(dexMod)}`)
      } else if (character.unarmored_ac_formula === 'monk') {
        base = 10 + dexMod + wisMod
        steps.push(
          `Monk Defense: 10 + DEX ${dnd.signed(dexMod)} + WIS ${dnd.signed(
            wisMod
          )}`
        )
      } else if (character.unarmored_ac_formula === 'barbarian') {
        base = 10 + dexMod + conMod
        steps.push(
          `Barbarian Defense: 10 + DEX ${dnd.signed(dexMod)} + CON ${dnd.signed(
            conMod
          )}`
        )
      } else {
        base = 10 + dexMod
        steps.push(`Unarmored: 10 + DEX ${dnd.signed(dexMod)}`)
      }

      // Stat-mod unarmored bonuses (e.g. Monk's Belt adds CON mod)
      if (unarmoredBonuses.ac_unarmored_con) {
        const src = items
          .filter(mine)
          .find((i) => i.unarmored_stat_bonuses?.ac_unarmored_con)
        steps.push(`${src?.name ?? 'Item'}: CON ${dnd.signed(conMod)}`)
        statUnarmoredBonus += conMod
      }
    }

    const shieldItem = items.find((i) => mine(i) && i.armor_type === 'shield')
    const shieldEnhancement = shieldItem ? shieldItem.enhancement_bonus ?? 0 : 0
    const shieldBonus = shieldItem ? 2 + shieldEnhancement : 0
    if (shieldItem) {
      const shieldLabel = shieldEnhancement
        ? `+2 base, +${shieldEnhancement} enhancement = ${dnd.signed(
            shieldBonus
          )}`
        : `${dnd.signed(shieldBonus)}`
      steps.push(`${shieldItem.name} (${shieldLabel})`)
    }

    // Per-item flat AC bonuses (ring of protection, cloak of protection, bracers of defense, etc.)
    for (const item of items.filter(mine)) {
      const bonus = item.stat_bonuses?.ac ?? 0
      const unarmoredBonus = !isWearingArmor
        ? item.unarmored_stat_bonuses?.ac ?? 0
        : 0
      const total = bonus + unarmoredBonus
      if (total) steps.push(`${item.name} (${dnd.signed(total)})`)
    }

    // Per-feature flat AC bonuses (e.g. Fighting Style: Defense) — real bug
    // found 2026-09-09: this loop computed `bonus` and pushed a breakdown
    // step describing it, but never actually added it into `value` below
    // (unlike item stat_bonuses.ac, which resolveStats aggregates into
    // `bonuses.ac` and IS counted). Chuknora's Fighting Style: Defense
    // (stat_bonuses.ac: 1) was silently not applying — the tooltip claimed
    // it while her real computed AC was 1 lower than shown.
    let featureAcBonus = 0
    for (const feature of character.features ?? []) {
      const bonus = feature.stat_bonuses?.ac ?? 0
      if (bonus) {
        steps.push(`${feature.name} (${dnd.signed(bonus)})`)
        featureAcBonus += bonus
      }
    }

    // Dual Wielder's +1 AC — conditional on the character's CURRENT loadout
    // (weapon-set aware, see isDualWieldingMelee above), not a flat feat
    // bonus like the loop just above, so it can't live in stat_bonuses.ac
    // the same way. Added 2026-09-09 alongside weapon sets.
    let dualWielderAcBonus = 0
    const hasDualWielder = (character.features ?? []).some(
      (f) => (f.name || '').trim().toLowerCase() === 'dual wielder'
    )
    if (
      hasDualWielder &&
      dnd.isDualWieldingMelee(character, carriedPartyItems)
    ) {
      dualWielderAcBonus = 1
      steps.push(`Dual Wielder (${dnd.signed(dualWielderAcBonus)})`)
    }

    if (bladesongActive) steps.push(`Bladesong INT ${dnd.signed(intMod)}`)

    const itemAcBonus =
      (bonuses.ac ?? 0) + (isWearingArmor ? 0 : unarmoredBonuses.ac ?? 0)
    const bladesongBonus = bladesongActive ? intMod : 0
    const value =
      base +
      shieldBonus +
      itemAcBonus +
      statUnarmoredBonus +
      bladesongBonus +
      featureAcBonus +
      dualWielderAcBonus
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
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    return dnd.mod(stats.dex) + (bonuses.initiative ?? 0)
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
    // Proficiency can come from the character's own training OR from an
    // equipped item (item.grants_skill_proficiency: [names]) — e.g. an
    // armor/wondrous item that teaches a skill while worn. Item-granted
    // proficiency only counts while equipped, unlike a character's own
    // skill_proficiencies, which is why this checks partyItems separately
    // rather than just merging onto the character record.
    const itemGrantsProficiency = partyItems.some(
      (i) =>
        i.equipped_by === character.name &&
        (i.grants_skill_proficiency ?? []).includes(skillName)
    )
    const isProficient =
      itemGrantsProficiency ||
      (character.skill_proficiencies ?? []).includes(skillName)
    const hasExpertise = (character.skill_expertise ?? []).includes(skillName)
    const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0
    const itemBonus = bonuses[`skill_${skillName}`] ?? 0

    return base + profBonus + itemBonus
  },

  allSkills(character, partyItems = []) {
    return Object.fromEntries(
      Object.keys(dnd.SKILL_MAP).map((s) => [
        s,
        dnd.skill(character, s, partyItems),
      ])
    )
  },

  // ─────────────────────────────────────────────
  // PASSIVE PERCEPTION
  // ─────────────────────────────────────────────

  passivePerception(character, partyItems = []) {
    const { bonuses } = dnd.resolveStats(character, partyItems)
    return (
      10 +
      dnd.skill(character, 'Perception', partyItems) +
      (bonuses.passive_perception ?? 0)
    )
  },

  // ─────────────────────────────────────────────
  // ABILITY MODIFIERS (convenience)
  // ─────────────────────────────────────────────

  allMods(character, partyItems = []) {
    const { stats } = dnd.resolveStats(character, partyItems)
    return Object.fromEntries(
      Object.entries(stats).map(([k, v]) => [k, dnd.mod(v)])
    )
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
    const base =
      WEAPON_PROPS[weapon.weapon_category] ??
      HOMEBREW_WEAPON_PROPS[weapon.weapon_category] ??
      {}
    return {
      weapon_type:
        weapon.weapon_type ??
        base.weapon_type ??
        (weapon.slot?.startsWith('ranged') ? 'ranged' : 'melee'),
      damage_dice: weapon.damage_dice ?? base.damage_dice ?? '1d4',
      damage_dice_2h: weapon.damage_dice_2h ?? base.damage_dice_2h ?? null,
      damage_type: weapon.damage_type ?? base.damage_type ?? null,
      // 'simple' | 'martial' | null (null only for old items predating this
      // field, or a homebrew weapon that never got one set) — used by
      // isProficientWithWeapon below.
      category: weapon.category ?? base.category ?? null,
      // A homebrew weapon can piggyback on a real weapon's proficiency
      // instead of (or in addition to) its own category — e.g. the Saber's
      // real text: "Anyone proficient with a rapier can proficiently wield
      // a saber."
      counts_as_proficiency:
        weapon.counts_as_proficiency ?? base.counts_as_proficiency ?? null,
      finesse: weapon.finesse ?? base.finesse ?? false,
      versatile: weapon.versatile ?? base.versatile ?? false,
      thrown: weapon.thrown ?? base.thrown ?? null,
      returning: weapon.returning ?? false,
    }
  },

  // Whether `character` is proficient with `weapon` — checks the broad
  // simple/martial category, the weapon's own category-name as a specific
  // proficiency (e.g. "longbow"), and any counts_as_proficiency alias
  // (homebrew weapons piggybacking on a real weapon's proficiency).
  // Case-insensitive since weapon_proficiencies has historically mixed
  // casing across characters.
  isProficientWithWeapon(character, weapon) {
    const props = dnd._weaponProps(weapon)
    const profs = new Set(
      (character.weapon_proficiencies ?? []).map((p) => p.toLowerCase())
    )
    if (props.category && profs.has(props.category)) return true
    if (
      weapon.weapon_category &&
      profs.has(weapon.weapon_category.toLowerCase())
    )
      return true
    if (
      props.counts_as_proficiency &&
      profs.has(props.counts_as_proficiency.toLowerCase())
    )
      return true
    return false
  },

  _weaponStatMod(character, weapon, partyItems = []) {
    const { stats } = dnd.resolveStats(character, partyItems)
    const props = dnd._weaponProps(weapon)
    if (props.finesse) return Math.max(dnd.mod(stats.str), dnd.mod(stats.dex))
    return props.weapon_type === 'ranged'
      ? dnd.mod(stats.dex)
      : dnd.mod(stats.str)
  },

  gripDie(character, weapon, partyItems = []) {
    const props = dnd._weaponProps(weapon)
    if (!props.versatile) return props.damage_dice
    if (weapon.slot === 'melee2h')
      return props.damage_dice_2h ?? props.damage_dice
    const melee1hCount = partyItems.filter(
      (i) => i.equipped_by === character.name && i.slot === 'melee1h'
    ).length
    return melee1hCount <= 1
      ? props.damage_dice_2h ?? props.damage_dice
      : props.damage_dice
  },

  attackBonus(character, weapon, partyItems = []) {
    const { bonuses } = dnd.resolveStats(character, partyItems)
    const props = dnd._weaponProps(weapon)
    const statMod = dnd._weaponStatMod(character, weapon, partyItems)
    const prof = dnd._prof(character, bonuses)
    const magic = weapon.enhancement_bonus ?? 0
    const typeBonus =
      props.weapon_type === 'ranged'
        ? bonuses.ranged_attack ?? 0
        : bonuses.melee_attack ?? 0
    return statMod + prof + magic + typeBonus
  },

  damageBonus(character, weapon, partyItems = []) {
    const { bonuses } = dnd.resolveStats(character, partyItems)
    const props = dnd._weaponProps(weapon)
    const statMod = dnd._weaponStatMod(character, weapon, partyItems)
    const magic = weapon.enhancement_bonus ?? 0
    const rangedBonus =
      props.weapon_type === 'ranged' ? bonuses.ranged_damage ?? 0 : 0
    const meleeBonus =
      props.weapon_type !== 'ranged' ? bonuses.melee_damage ?? 0 : 0
    return statMod + magic + rangedBonus + meleeBonus
  },

  weaponSummary(character, weapon, partyItems = []) {
    const props = dnd._weaponProps(weapon)
    const die = dnd.gripDie(character, weapon, partyItems)
    return {
      name: weapon.name,
      attack: dnd.signed(dnd.attackBonus(character, weapon, partyItems)),
      damage: `${die}${dnd.signed(
        dnd.damageBonus(character, weapon, partyItems)
      )}`,
      type: props.weapon_type,
      notes: weapon.notes ?? '',
    }
  },

  weaponSummaries(character, partyItems = []) {
    return partyItems
      .filter((i) => i.equipped_by === character.name && i.type === 'weapon')
      .map((w) => dnd.weaponSummary(character, w, partyItems))
  },

  // Groups stat_bonuses from equipped items by bonus key, with item name + value per entry.
  // Used for building tooltip strings that name which item contributes each bonus.
  _itemBonusBreakdown(character, partyItems) {
    const result = {}
    for (const item of partyItems.filter(
      (i) => i.equipped_by === character.name
    )) {
      for (const [key, val] of Object.entries(item.stat_bonuses ?? {})) {
        if (!result[key]) result[key] = []
        result[key].push({ name: item.name, value: val })
      }
    }
    return result
  },

  // Rich weapon rows for the combat panel UI — includes atkTooltip, dmgTooltip, and extras.
  buildWeaponRows(character, partyItems = []) {
    const { stats, bonuses } = dnd.resolveStats(character, partyItems)
    const strMod = dnd.mod(stats.str)
    const dexMod = dnd.mod(stats.dex)
    const prof = dnd._prof(character, bonuses)
    const ibd = dnd._itemBonusBreakdown(character, partyItems)
    const equippedItems = partyItems.filter(
      (i) => i.equipped_by === character.name
    )

    const summaries = equippedItems
      .filter((i) => i.type === 'weapon')
      .map((w) => {
        const props = dnd._weaponProps(w)
        const magic = w.enhancement_bonus ?? 0
        let statMod, statDesc
        if (props.finesse) {
          statMod = Math.max(strMod, dexMod)
          statDesc = `Finesse — best of STR ${dnd.signed(
            strMod
          )}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)}`
        } else if (props.weapon_type === 'ranged') {
          statMod = dexMod
          statDesc = `DEX ${dnd.signed(dexMod)}`
        } else {
          statMod = strMod
          statDesc = `STR ${dnd.signed(strMod)}`
        }

        const atkBonusKey =
          props.weapon_type === 'ranged' ? 'ranged_attack' : 'melee_attack'
        const atkTotal = dnd.attackBonus(character, w, partyItems)
        const atkParts = [statDesc, `Prof ${dnd.signed(prof)}`]
        if (magic) atkParts.push(`Enchanted ${dnd.signed(magic)}`)
        for (const { name, value } of ibd[atkBonusKey] ?? [])
          atkParts.push(`${name} ${dnd.signed(value)}`)
        atkParts.push(`= ${dnd.signed(atkTotal)}`)

        const dmgBonus = dnd.damageBonus(character, w, partyItems)
        const die = dnd.gripDie(character, w, partyItems)
        const dmgParts = [die, statDesc.split('—')[0].trim()]
        if (magic) dmgParts.push(`Enchanted ${dnd.signed(magic)}`)
        if (props.weapon_type === 'ranged') {
          for (const { name, value } of ibd.ranged_damage ?? [])
            dmgParts.push(`${name} ${dnd.signed(value)}`)
        }

        const extras = w.extra_damage
          ? [
              {
                source: `${w.extra_damage.type} ${
                  w.extra_damage.trigger ?? 'on hit'
                }`,
                die: w.extra_damage.die,
                type: w.extra_damage.type,
                trigger: w.extra_damage.trigger ?? 'on hit',
              },
            ]
          : []

        // A thrown attack always uses the weapon's base one-handed die, even
        // if it's currently gripped two-handed for melee — real RAW, the
        // versatile bonus die only applies to a melee attack made with two
        // hands (see the weapon detail popup, which already shows this
        // split). `gripDie()` above answers "what die for however it's
        // CURRENTLY held," which is right for the main melee number but
        // wrong for a thrown attack whenever that current grip is 2H. Only
        // surfaced when it actually differs from the main line — a
        // thrown-and-currently-1H weapon has nothing extra worth showing.
        const thrownDie = props.thrown ? props.damage_dice : null
        const mainDamage = `${die}${dnd.signed(dmgBonus)}`
        const thrownDamage =
          thrownDie && thrownDie !== die
            ? `${thrownDie}${dnd.signed(dmgBonus)}`
            : null

        return {
          id: w.id,
          name: w.name,
          attack: dnd.signed(atkTotal),
          damage: mainDamage,
          thrownDamage,
          type: props.weapon_type,
          atkTooltip: atkParts.join(' + ').replace(' + =', ' ='),
          dmgTooltip: dmgParts.join(' + '),
          extras,
          thrown: props.thrown,
          returning: props.returning,
        }
      })

    if (character.martial_arts_die) {
      const level = character.level ?? 1
      const die =
        character.martial_arts_die === 'auto'
          ? level >= 17
            ? '1d10'
            : level >= 11
            ? '1d8'
            : level >= 5
            ? '1d6'
            : '1d4'
          : character.martial_arts_die
      const statMod = Math.max(strMod, dexMod)
      const unarmedAtk = bonuses.unarmed_attack ?? 0
      const unarmedDmg = bonuses.unarmed_damage ?? 0
      const atkTotal = statMod + prof + unarmedAtk
      const dmgTotal = statMod + unarmedDmg
      const atkParts = [
        `Martial Arts ${dnd.signed(statMod)}`,
        `Prof ${dnd.signed(prof)}`,
      ]
      if (unarmedAtk) atkParts.push(`Items ${dnd.signed(unarmedAtk)}`)
      atkParts.push(`= ${dnd.signed(atkTotal)}`)
      const dmgParts = [die, `STR/DEX ${dnd.signed(statMod)}`]
      if (unarmedDmg) dmgParts.push(`Items ${dnd.signed(unarmedDmg)}`)

      const extras = equippedItems
        .filter((i) => i.extra_damage?.applies_to === 'unarmed')
        .map((i) => ({
          source: i.name,
          die: i.extra_damage.die,
          type: i.extra_damage.type,
          trigger: i.extra_damage.trigger ?? 'on hit',
        }))

      summaries.unshift({
        name: 'Unarmed Strike',
        attack: dnd.signed(atkTotal),
        damage: `${die}${dnd.signed(dmgTotal)}`,
        type: 'melee',
        atkTooltip: atkParts.join(' + ').replace('+ =', '='),
        dmgTooltip: dmgParts.join(' + '),
        extras,
      })
    }

    return summaries
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
    const baseScores = {
      str: character.stat_str ?? 10,
      dex: character.stat_dex ?? 10,
      con: character.stat_con ?? 10,
      int: character.stat_int ?? 10,
      wis: character.stat_wis ?? 10,
      cha: character.stat_cha ?? 10,
    }
    const equipped = [...(character.items ?? []), ...partyItems].filter(
      (i) => i.equipped_by === character.name
    )
    const effects = {}
    for (const item of equipped) {
      for (const [key, val] of Object.entries(item.stat_overrides ?? {})) {
        ;(effects[key] = effects[key] ?? []).push({
          name: item.name,
          type: 'override',
          value: val,
        })
      }
      for (const [key, val] of Object.entries(item.stat_bonuses ?? {})) {
        if (!SCORE_BONUS_KEYS.has(key)) continue
        ;(effects[key] = effects[key] ?? []).push({
          name: item.name,
          type: 'bonus',
          value: val,
        })
      }
    }
    for (const feature of character.features ?? []) {
      for (const [key, val] of Object.entries(feature.stat_bonuses ?? {})) {
        if (!SCORE_BONUS_KEYS.has(key)) continue
        ;(effects[key] = effects[key] ?? []).push({
          name: feature.name,
          type: 'bonus',
          value: val,
        })
      }
    }
    return STAT_KEYS.map(({ key, label }) => {
      const score = stats[key] ?? 10
      const fx = effects[key]
      // ability_score_history — real attributable ASI/feat/racial-bonus
      // entries (see engine/rules/diffLevelUp.js + NewCharacterTool.vue's
      // abilityScoreHistorySeed). stat_str etc. still mean "the final
      // number" (unchanged, additive-only) — history is purely a display
      // breakdown of how that number was built, so the implied base is
      // whatever's left after subtracting every recorded history amount.
      // Empty/absent on every character built before this existed, in which
      // case this degrades to exactly the old no-history tooltip.
      const history = (character.ability_score_history ?? []).filter(
        (h) => h.ability === key
      )
      const historySum = history.reduce((sum, h) => sum + h.amount, 0)
      const modified = !!fx?.length || !!history.length
      let tooltip
      if (!modified) {
        tooltip = `${label}: ${baseScores[key]} (no modifiers) = ${dnd.signed(
          dnd.mod(score)
        )}`
      } else if (fx?.some((e) => e.type === 'override')) {
        const ov = fx.find((e) => e.type === 'override')
        tooltip = `${label}: set to ${ov.value} by ${ov.name} = ${dnd.signed(
          dnd.mod(score)
        )}`
      } else {
        const impliedBase = baseScores[key] - historySum
        const parts = [`${label}: ${impliedBase} base`]
        for (const h of history) {
          parts.push(`+${h.amount} (${h.source}, level ${h.level_gained})`)
        }
        for (const e of fx ?? []) parts.push(`+${e.value} (${e.name})`)
        parts.push(`= ${score} (${dnd.signed(dnd.mod(score))})`)
        tooltip = parts.join(' · ')
      }
      return {
        key,
        label,
        score,
        mod: dnd.mod(score),
        modStr: dnd.signed(dnd.mod(score)),
        modified,
        tooltip,
      }
    })
  },

  findCharacter(characters, name) {
    return (
      characters.find(
        (c) =>
          c.name.toLowerCase() === name.toLowerCase() ||
          c.full_name?.toLowerCase() === name.toLowerCase()
      ) ?? null
    )
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
