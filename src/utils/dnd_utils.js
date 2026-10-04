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

import weaponTypesAndLanguages from '../data/weapon_types_and_languages.json'
import { abilityModifier } from './abilities.js'
import { proficiencyBonus } from './progression.js'
import { resolveEffectiveStats } from './characterStats.js'
import {
  activeWeaponSet as engineActiveWeaponSet,
  isActiveEquipped as engineIsActiveEquipped,
  isDualWieldingMelee as engineIsDualWieldingMelee,
} from './weaponSets.js'
import { computeAC } from './armorClass.js'
import {
  effectiveProficiencyBonus,
  effectiveProficiencyBonusBreakdown,
} from './proficiency.js'
import {
  savingThrow as engineSavingThrow,
  savingThrowBreakdown as engineSavingThrowBreakdown,
  allSavingThrows as engineAllSavingThrows,
  SKILL_MAP as ENGINE_SKILL_MAP,
  skill as engineSkill,
  skillBreakdown as engineSkillBreakdown,
  allSkills as engineAllSkills,
  passivePerception as enginePassivePerception,
  passivePerceptionBreakdown as enginePassivePerceptionBreakdown,
  initiative as engineInitiative,
  hasInitiativeAdvantage as engineHasInitiativeAdvantage,
  spellAttackBonus as engineSpellAttackBonus,
  spellAttackBonusBreakdown as engineSpellAttackBonusBreakdown,
  spellSaveDC as engineSpellSaveDC,
  spellSaveDCBreakdown as engineSpellSaveDCBreakdown,
} from './checks.js'
import {
  weaponStatMod as engineWeaponStatMod,
  gripDie as engineGripDie,
  thrownDie as engineThrownDie,
  attackBonus as engineAttackBonus,
  attackBonusBreakdown as engineAttackBonusBreakdown,
  damageBonus as engineDamageBonus,
  damageBonusBreakdown as engineDamageBonusBreakdown,
  rageDamageBonus as engineRageDamageBonus,
  weaponProps as engineWeaponProps,
  isProficientWithWeapon as engineIsProficientWithWeapon,
} from './weaponAttack.js'

import {
  sneakAttackDice as engineSneakAttackDice,
  unarmedStrike as engineUnarmedStrike,
  psychicBlades as enginePsychicBlades,
} from './unarmedAttacks.js'

import {
  weaveDustForRoll as engineWeaveDustForRoll,
  weaveDustEstimateRange as engineWeaveDustEstimateRange,
} from './houseRules.js'

import { abilityScoreBreakdown as engineAbilityScoreBreakdown } from './abilityScoreBreakdown.js'
import { priorityAbilitiesForClass } from './quickBuild.js'
import { isOneHandedWeapon, loadoutHands } from './weaponHands.js'
import { normalizeItemSpellGrant as engineNormalizeItemSpellGrant } from './characterSpells.js'

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

  // Weave Dust from Broken-Down Magic Items (house_rules.json) — rule lives
  // in engine/rules/houseRules.js.
  weaveDustForRoll(item, roll) {
    return engineWeaveDustForRoll(item, roll)
  },

  weaveDustEstimateRange(item) {
    return engineWeaveDustEstimateRange(item)
  },

  mod(score) {
    return abilityModifier(score ?? 10)
  },

  signed(n) {
    return n >= 0 ? `+${n}` : `${n}`
  },

  formatBonus(n) {
    return dnd.signed(n)
  },

  // Turns any engine `{ value, breakdown: [{label, amount}] }` result (AC's
  // computeAC, and every savingThrow/skill/passivePerception/spellAttack/
  // spellSaveDC/attackBonus/damageBonus/prof-bonus breakdown sibling added
  // 2026-09-30 alongside it) into this UI's joined-string tooltip shape.
  // One formatter for every stat that has a breakdown, so adding a new one
  // later never means writing a new string-joining function to go with it —
  // just a new engine breakdown and a thin delegate that calls this.
  _formatBreakdown({ value, breakdown }) {
    const lines = breakdown.map((s) => `${s.label} (${dnd.signed(s.amount)})`)
    lines.push(`= ${value}`)
    return lines.join('\n')
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

  // Normalizes one entry of an item's `spells_granted` array (bare string or
  // richer grant object) to a common shape — see
  // engine/rules/5e/characterSpells.js for the field-by-field contract.
  normalizeItemSpellGrant(entry, item) {
    return engineNormalizeItemSpellGrant(entry, item)
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
    return proficiencyBonus(level)
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

  // Shared by every engine-delegating function below: combine
  // character.items + carriedPartyItems and filter down to just this
  // character's own equipped gear — the "caller pre-filters" contract every
  // engine/rules/5e/ stat-resolution function in this family expects
  // (characterStats.js, armorClass.js, checks.js, weaponAttack.js).
  _equippedOnly(character, carriedPartyItems = []) {
    const items = [...(character.items ?? []), ...carriedPartyItems]
    return items.filter((i) => i.equipped_by === character.name)
  },

  // The actual 3-pass aggregation (stat_overrides -> item stat_bonuses ->
  // feature stat_bonuses) now lives in engine/rules/5e/characterStats.js's
  // resolveEffectiveStats — moved there 2026-09-30 (see
  // engine/CHECKLIST.md's entry that day for the full story: this used to
  // be split in half, with only the ability-score slice in engine/ and this
  // AC/attack/damage/saving-throw half left here under a "display concern"
  // label that turned out to be wrong — it's the same kind of rule as the
  // ability-score passes, just a different bonus bucket). This is now a
  // thin adapter: filter to this character's own equipped items, call the
  // engine, and rename `scores` -> `stats` to match this function's
  // existing external contract (every caller across the app destructures
  // `{ stats, bonuses }` from this specific key name).
  resolveStats(character, carriedPartyItems = []) {
    const equippedItems = dnd._equippedOnly(character, carriedPartyItems)
    const { scores, bonuses, unarmoredBonuses } = resolveEffectiveStats(
      character,
      equippedItems
    )
    return { stats: scores, bonuses, unarmoredBonuses }
  },

  // Effective proficiency bonus: base (class/level or character field) + item bonus (Ioun Stone).
  // Moved to engine/rules/5e/proficiency.js 2026-09-30 (same story as
  // resolveStats/_acCompute above) — kept as a delegate since several
  // components call dnd._prof(character, bonuses) directly by this name.
  _prof(character, bonuses) {
    return effectiveProficiencyBonus(character, bonuses)
  },

  // Breakdown sibling, added 2026-09-30 alongside the rest of the
  // savingThrow/skill/passivePerception/spellAttack/spellSaveDC/attackBonus/
  // damageBonus breakdowns below — fixes VitalsChipRow's profBonusTooltip,
  // which used to hand-describe the level table and silently never showed
  // an Ioun Stone of Mastery-style item bonus at all.
  profBonusBreakdown(character, bonuses, partyItems = []) {
    return dnd._formatBreakdown(
      effectiveProficiencyBonusBreakdown(
        character,
        bonuses,
        dnd._equippedOnly(character, partyItems)
      )
    )
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
  // Moved to engine/rules/5e/weaponSets.js 2026-09-30 (same reasoning as
  // resolveStats above) — these three stay as thin delegates since
  // WeaponTable.vue/DifficultyCalculator.vue call dnd.activeWeaponSet/
  // dnd.isActiveEquipped directly by these names.
  activeWeaponSet(character) {
    return engineActiveWeaponSet(character)
  },

  isActiveEquipped(item, character) {
    return engineIsActiveEquipped(item, character)
  },

  isDualWieldingMelee(character, carriedPartyItems = []) {
    const items = [...(character.items ?? []), ...carriedPartyItems]
    return engineIsDualWieldingMelee(character, items)
  },

  // ─────────────────────────────────────────────
  // ARMOR CLASS
  // ─────────────────────────────────────────────

  // The actual AC math + breakdown now live in engine/rules/5e/armorClass.js
  // (moved 2026-09-30, same story as resolveStats above — see
  // engine/CHECKLIST.md's entry that day, including a real double-counting
  // bug this move caught and fixed: a feature-granted flat AC bonus like
  // Fighting Style: Defense was being added twice, once via resolveStats'
  // bonuses.ac and once via this file's own separate featureAcBonus total).
  // The engine returns { value, breakdown: [{label, amount}] } — plain
  // structured data, not a display string, so any future UI can build its
  // own tooltip from the same breakdown without re-deriving the AC math.
  // This function stays the one place that turns that structured data into
  // the joined-string shape THIS UI's tooltip currently expects.
  _acCompute(
    character,
    { bladesongActive = false, carriedPartyItems = [] } = {}
  ) {
    const equippedItems = dnd._equippedOnly(character, carriedPartyItems)
    return computeAC(character, equippedItems, { bladesongActive })
  },

  ac(character, options = {}) {
    return dnd._acCompute(character, options).value
  },

  // Returns a newline-separated string describing the AC calculation for the breakdown tooltip.
  acBreakdown(character, options = {}) {
    return dnd._formatBreakdown(dnd._acCompute(character, options))
  },

  // ─────────────────────────────────────────────
  // INITIATIVE
  // ─────────────────────────────────────────────

  // Moved to engine/rules/5e/checks.js 2026-09-30 (same story as
  // resolveStats/_acCompute above — see engine/CHECKLIST.md's entry that
  // day). Every function here filters partyItems down to this character's
  // own equipped items once, then delegates — same adapter shape as
  // _acCompute.
  initiative(character, partyItems = []) {
    return engineInitiative(character, dnd._equippedOnly(character, partyItems))
  },

  // Advantage isn't a flat number like the rest of resolveStats' bonuses, so
  // it can't live in stat_bonuses.initiative — it changes how the roll
  // itself is made (roll twice, take the higher), which only the actual
  // roller (CombatContext's rollInitiative) can act on. This is checked
  // separately so that caller can decide how to roll.
  hasInitiativeAdvantage(character, partyItems = []) {
    return engineHasInitiativeAdvantage(
      character,
      dnd._equippedOnly(character, partyItems)
    )
  },

  // ─────────────────────────────────────────────
  // SAVING THROWS
  // ─────────────────────────────────────────────

  savingThrow(character, statKey, partyItems = []) {
    return engineSavingThrow(
      character,
      statKey,
      dnd._equippedOnly(character, partyItems)
    )
  },

  // Breakdown sibling — same AC-derived tooltip pattern (see _formatBreakdown
  // above), added 2026-09-30 to replace SavingThrowsPanel.vue's own
  // hand-rolled copy of this exact formula.
  savingThrowBreakdown(character, statKey, partyItems = []) {
    return dnd._formatBreakdown(
      engineSavingThrowBreakdown(
        character,
        statKey,
        dnd._equippedOnly(character, partyItems)
      )
    )
  },

  allSavingThrows(character, partyItems = []) {
    return engineAllSavingThrows(
      character,
      dnd._equippedOnly(character, partyItems)
    )
  },

  // ─────────────────────────────────────────────
  // SKILLS
  // ─────────────────────────────────────────────

  SKILL_MAP: ENGINE_SKILL_MAP,

  skill(character, skillName, partyItems = []) {
    return engineSkill(
      character,
      skillName,
      dnd._equippedOnly(character, partyItems)
    )
  },

  // Breakdown sibling, added 2026-09-30 to replace SkillList.vue's own
  // hand-rolled copy of this formula — that copy never handled Jack of All
  // Trades, a real gap the engine version already covered (see checks.js).
  skillBreakdown(character, skillName, partyItems = []) {
    return dnd._formatBreakdown(
      engineSkillBreakdown(
        character,
        skillName,
        dnd._equippedOnly(character, partyItems)
      )
    )
  },

  allSkills(character, partyItems = []) {
    return engineAllSkills(character, dnd._equippedOnly(character, partyItems))
  },

  // ─────────────────────────────────────────────
  // PASSIVE PERCEPTION
  // ─────────────────────────────────────────────

  passivePerception(character, partyItems = []) {
    return enginePassivePerception(
      character,
      dnd._equippedOnly(character, partyItems)
    )
  },

  // Breakdown sibling, added 2026-09-30 to replace VitalsChipRow.vue's own
  // hand-rolled passivePerceptionTooltip computed property.
  passivePerceptionBreakdown(character, partyItems = []) {
    return dnd._formatBreakdown(
      enginePassivePerceptionBreakdown(
        character,
        dnd._equippedOnly(character, partyItems)
      )
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
    return engineSpellAttackBonus(
      character,
      dnd._equippedOnly(character, partyItems)
    )
  },

  // Breakdown siblings, added 2026-09-30 to replace VitalsChipRow.vue's own
  // hand-rolled spellAttackTooltip/spellDCTooltip computed properties.
  // Return '' (not null) for a non-caster, matching how the old hand-rolled
  // tooltips behaved when their template guard (v-if="spellAttack !== null")
  // meant they were never actually rendered for one anyway.
  spellAttackBonusBreakdown(character, partyItems = []) {
    const result = engineSpellAttackBonusBreakdown(
      character,
      dnd._equippedOnly(character, partyItems)
    )
    return result ? dnd._formatBreakdown(result) : ''
  },

  spellSaveDC(character, partyItems = []) {
    return engineSpellSaveDC(
      character,
      dnd._equippedOnly(character, partyItems)
    )
  },

  spellSaveDCBreakdown(character, partyItems = []) {
    const result = engineSpellSaveDCBreakdown(
      character,
      dnd._equippedOnly(character, partyItems)
    )
    return result ? dnd._formatBreakdown(result) : ''
  },

  // ─────────────────────────────────────────────
  // WEAPON ATTACK & DAMAGE
  // ─────────────────────────────────────────────

  _weaponProps(weapon) {
    return engineWeaponProps(weapon, HOMEBREW_WEAPON_PROPS)
  },

  // Whether `character` is proficient with `weapon` — checks the broad
  // simple/martial category, the weapon's own category-name as a specific
  // proficiency (e.g. "longbow"), and any counts_as_proficiency alias
  // (homebrew weapons piggybacking on a real weapon's proficiency).
  // Case-insensitive since weapon_proficiencies has historically mixed
  // casing across characters.
  isProficientWithWeapon(character, weapon) {
    return engineIsProficientWithWeapon(
      character,
      weapon,
      HOMEBREW_WEAPON_PROPS
    )
  },

  _weaponStatMod(character, weapon, partyItems = []) {
    return engineWeaponStatMod(
      character,
      weapon,
      dnd._equippedOnly(character, partyItems),
      HOMEBREW_WEAPON_PROPS
    )
  },

  gripDie(character, weapon, partyItems = []) {
    return engineGripDie(
      character,
      weapon,
      dnd._equippedOnly(character, partyItems),
      HOMEBREW_WEAPON_PROPS
    )
  },

  attackBonus(character, weapon, partyItems = []) {
    return engineAttackBonus(
      character,
      weapon,
      dnd._equippedOnly(character, partyItems),
      HOMEBREW_WEAPON_PROPS
    )
  },

  // Breakdown sibling, added 2026-09-30 — buildWeaponRows below builds its
  // own atkTooltip/dmgTooltip for the combat panel and can call these
  // instead of re-deriving the same stat-mod/prof/magic arithmetic by hand.
  attackBonusBreakdown(character, weapon, partyItems = []) {
    return dnd._formatBreakdown(
      engineAttackBonusBreakdown(
        character,
        weapon,
        dnd._equippedOnly(character, partyItems),
        HOMEBREW_WEAPON_PROPS
      )
    )
  },

  // Thrown-attack die when it differs from the current grip's die, else null.
  thrownDie(character, weapon, partyItems = []) {
    return engineThrownDie(
      character,
      weapon,
      dnd._equippedOnly(character, partyItems),
      HOMEBREW_WEAPON_PROPS
    )
  },

  damageBonus(character, weapon, partyItems = []) {
    return engineDamageBonus(
      character,
      weapon,
      dnd._equippedOnly(character, partyItems),
      HOMEBREW_WEAPON_PROPS
    )
  },

  damageBonusBreakdown(character, weapon, partyItems = []) {
    return dnd._formatBreakdown(
      engineDamageBonusBreakdown(
        character,
        weapon,
        dnd._equippedOnly(character, partyItems),
        HOMEBREW_WEAPON_PROPS
      )
    )
  },

  // PHB Rage: melee weapon attacks using Strength deal +2 damage at
  // Barbarian levels 1-8, +3 at 9-15, +4 at 16-20 — real gap found
  // 2026-09-18: raging characters showed no damage bonus anywhere on their
  // combat sheet, and there was no way to even mark a character as raging
  // (see conditions.js's new 'Raging' condition, added the same pass).
  rageDamageBonus(character, weapon) {
    return engineRageDamageBonus(character, weapon, HOMEBREW_WEAPON_PROPS)
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

  // Current Sneak Attack dice ("3d6") — rule lives in
  // engine/rules/5e/unarmedAttacks.js. null for a non-Rogue.
  sneakAttackDice(character) {
    return engineSneakAttackDice(character)
  },

  // Rich weapon rows for the combat panel UI — includes atkTooltip, dmgTooltip, and extras.
  buildWeaponRows(character, partyItems = []) {
    const equippedItems = partyItems.filter(
      (i) => i.equipped_by === character.name
    )

    // Only the CURRENTLY-active loadout's weapons — a weapon assigned to
    // the other set (or bare-handed props not carried right now) shouldn't
    // clutter the attack list. dnd.isActiveEquipped already existed for
    // this exact check (AC's Dual Wielder calc uses it) but buildWeaponRows
    // never used it, so switching sets never actually changed what showed
    // up here. Real bug found 2026-09-15.
    // Main/off hand for the one-handed weapons in this loadout (rule lives
    // in engine/rules/5e/weaponHands.js). handAmbiguous: two or more
    // one-handers in hand with hands not fully assigned — the row nudges.
    const hands = loadoutHands(character, equippedItems)

    const summaries = equippedItems
      .filter((i) => i.type === 'weapon' && dnd.isActiveEquipped(i, character))
      .map((w) => {
        const props = dnd._weaponProps(w)

        const atkTotal = dnd.attackBonus(character, w, partyItems)
        const atkTooltip = dnd.attackBonusBreakdown(character, w, partyItems)

        const dmgBonus = dnd.damageBonus(character, w, partyItems)
        const die = dnd.gripDie(character, w, partyItems)
        const dmgTooltip = `${die}\n${dnd.damageBonusBreakdown(
          character,
          w,
          partyItems
        )}`

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

        // Thrown uses the base one-handed die even when gripped 2H — rule
        // lives in engine weaponAttack.js's thrownDie; null when it'd just
        // repeat the main line.
        const mainDamage = `${die}${dnd.signed(dmgBonus)}`
        const thrownDieValue = dnd.thrownDie(character, w, partyItems)
        const thrownDamage = thrownDieValue
          ? `${thrownDieValue}${dnd.signed(dmgBonus)}`
          : null

        const oneHanded = isOneHandedWeapon(w)
        return {
          id: w.id,
          name: w.name,
          hand: oneHanded ? w.hand ?? null : null,
          handAmbiguous: oneHanded && hands.ambiguous && !w.hand,
          attack: dnd.signed(atkTotal),
          damage: mainDamage,
          thrownDamage,
          type: props.weapon_type,
          atkTooltip,
          dmgTooltip,
          extras,
          thrown: props.thrown,
          returning: props.returning,
          silvered: props.silvered,
          // Versatile grip (1H/2H) has no visible indicator anywhere in the
          // combat view — only CharacterInventory's own grip-toggle button
          // showed it. Real gap found 2026-09-15. `w.slot` (not just
          // `versatile`) is what's needed to know which grip is CURRENT.
          versatile: props.versatile,
          grip:
            props.versatile && (w.slot === 'melee1h' || w.slot === 'melee2h')
              ? w.slot
              : null,
        }
      })

    // Main hand first, then off hand, then everything else (stable sort, so
    // unassigned weapons keep their existing order).
    const handRank = (row) =>
      row.hand === 'main' ? 0 : row.hand === 'off' ? 1 : 2
    summaries.sort((a, b) => handRank(a) - handRank(b))

    // Unarmed Strike (Martial Arts) and Soulknife Psychic Blades aren't
    // equipped items, so the pass above never sees them — their rules live
    // in engine/rules/5e/unarmedAttacks.js; this just shapes them into rows.
    const equippedForEngine = dnd._equippedOnly(character, partyItems)

    const unarmed = engineUnarmedStrike(character, equippedForEngine)
    if (unarmed) {
      summaries.unshift({
        name: unarmed.name,
        attack: dnd.signed(unarmed.attack.value),
        damage: `${unarmed.die}${dnd.signed(unarmed.damage.value)}`,
        type: 'melee',
        atkTooltip: dnd._formatBreakdown(unarmed.attack),
        dmgTooltip: `${unarmed.die}\n${dnd._formatBreakdown(unarmed.damage)}`,
        extras: unarmed.extras,
      })
    }

    for (const blade of enginePsychicBlades(character, equippedForEngine) ??
      []) {
      summaries.push({
        id: blade.id,
        name: blade.name,
        attack: dnd.signed(blade.attack.value),
        damage: `${blade.die}${dnd.signed(blade.damage.value)}`,
        type: 'melee',
        atkTooltip: dnd._formatBreakdown(blade.attack),
        dmgTooltip: `${blade.die}\n${dnd._formatBreakdown(blade.damage)}`,
        extras: [],
        ...(blade.thrown ? { thrown: blade.thrown } : {}),
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

  // Stat block for templates — scores and mods after all item effects. The
  // attribution (which item/feature/ASI contributed what) comes from
  // engine/rules/5e/abilityScoreBreakdown.js; this only turns it into this
  // grid's tooltip string.
  statArray(character, partyItems = []) {
    const breakdown = engineAbilityScoreBreakdown(
      character,
      dnd._equippedOnly(character, partyItems)
    )
    return STAT_KEYS.map(({ key, label }) => {
      const b = breakdown.find((x) => x.key === key)
      const modStr = dnd.signed(b.mod)
      let tooltip
      if (!b.modified) {
        tooltip = `${label}: ${b.base} (no modifiers) = ${modStr}`
      } else if (b.override) {
        tooltip = `${label}: set to ${b.override.value} by ${b.override.name} = ${modStr}`
      } else {
        const parts = [`${label}: ${b.base} base`]
        for (const c of b.contributions) parts.push(`+${c.amount} (${c.label})`)
        parts.push(`= ${b.score} (${modStr})`)
        tooltip = parts.join(' · ')
      }
      return {
        key,
        label,
        score: b.score,
        mod: b.mod,
        modStr,
        modified: b.modified,
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
