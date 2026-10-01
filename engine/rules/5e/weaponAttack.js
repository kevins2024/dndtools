// Weapon attack bonus, damage bonus, versatile grip die, and Rage's damage
// bonus — extracted from src/utils/dnd_utils.js 2026-09-30 (see
// engine/CHECKLIST.md's entry that day). attackBonus/damageBonus got a
// breakdown sibling in a follow-up pass the same day (AC's tooltip pattern
// extended — see checks.js's own header comment for the fuller story):
// `attackBonusBreakdown`/`damageBonusBreakdown` return
// `{ value, breakdown }`, and the plain functions are now just `.value`.
//
// equippedItems: items already filtered to "equipped by this character" —
// same contract as every other 5e/ engine module in this family.

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')
const { effectiveProficiencyBonus } = require('./proficiency')
const { weaponProps } = require('./weapons')
const { bonusLines } = require('./breakdown')

// Shared by both breakdown functions below — the stat-mod line's label
// depends on the same finesse/ranged/melee routing weaponStatMod itself
// uses, so it's derived here once instead of re-deriving the same
// conditional twice.
function statModLabel(props) {
  if (props.finesse) return 'Finesse (best of STR/DEX)'
  return props.weapon_type === 'ranged' ? 'DEX' : 'STR'
}

function weaponStatMod(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const { scores } = resolveEffectiveStats(character, equippedItems)
  const props = weaponProps(weapon, homebrewWeaponTypes)
  if (props.finesse) {
    return Math.max(abilityModifier(scores.str), abilityModifier(scores.dex))
  }
  return props.weapon_type === 'ranged'
    ? abilityModifier(scores.dex)
    : abilityModifier(scores.str)
}

// A versatile weapon's damage die depends on whether it's actually being
// wielded two-handed right now: explicitly in the melee2h slot, or in
// melee1h with no second one-handed melee weapon also equipped (i.e. both
// hands are free for it).
function gripDie(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const props = weaponProps(weapon, homebrewWeaponTypes)
  if (!props.versatile) return props.damage_dice
  if (weapon.slot === 'melee2h')
    return props.damage_dice_2h ?? props.damage_dice
  const melee1hCount = equippedItems.filter((i) => i.slot === 'melee1h').length
  return melee1hCount <= 1
    ? props.damage_dice_2h ?? props.damage_dice
    : props.damage_dice
}

function attackBonusBreakdown(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const props = weaponProps(weapon, homebrewWeaponTypes)
  const statMod = weaponStatMod(
    character,
    weapon,
    equippedItems,
    homebrewWeaponTypes
  )
  const prof = effectiveProficiencyBonus(character, bonuses)
  const magic = weapon.enhancement_bonus ?? 0
  const atkBonusKey =
    props.weapon_type === 'ranged' ? 'ranged_attack' : 'melee_attack'
  const typeBonus = bonuses[atkBonusKey] ?? 0

  const breakdown = [
    { label: statModLabel(props), amount: statMod },
    { label: 'Proficiency', amount: prof },
  ]
  if (magic)
    breakdown.push({ label: `${weapon.name} enchantment`, amount: magic })
  breakdown.push(
    ...bonusLines(equippedItems, atkBonusKey),
    ...bonusLines(character.features, atkBonusKey)
  )

  return { value: statMod + prof + magic + typeBonus, breakdown }
}

function attackBonus(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  return attackBonusBreakdown(
    character,
    weapon,
    equippedItems,
    homebrewWeaponTypes
  ).value
}

// PHB Rage: melee weapon attacks using Strength deal +2 damage at Barbarian
// levels 1-8, +3 at 9-15, +4 at 16-20. Applies whenever the 'Raging'
// condition is active and the weapon isn't ranged — a finesse weapon is
// treated as eligible too, the same simplification weaponStatMod already
// makes by always using the better of STR/DEX rather than modeling a
// genuine per-attack ability choice.
function rageDamageBonus(character, weapon, homebrewWeaponTypes = {}) {
  if (!(character.conditions ?? []).includes('Raging')) return 0
  const props = weaponProps(weapon, homebrewWeaponTypes)
  if (props.weapon_type === 'ranged') return 0
  const barbLevel = (character.classes ?? []).find(
    (c) => c.name?.toLowerCase() === 'barbarian'
  )?.level
  if (!barbLevel) return 0
  if (barbLevel >= 16) return 4
  if (barbLevel >= 9) return 3
  return 2
}

function damageBonusBreakdown(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const props = weaponProps(weapon, homebrewWeaponTypes)
  const statMod = weaponStatMod(
    character,
    weapon,
    equippedItems,
    homebrewWeaponTypes
  )
  const magic = weapon.enhancement_bonus ?? 0
  const dmgBonusKey =
    props.weapon_type === 'ranged' ? 'ranged_damage' : 'melee_damage'
  const typeBonus = bonuses[dmgBonusKey] ?? 0
  const rage = rageDamageBonus(character, weapon, homebrewWeaponTypes)

  const breakdown = [{ label: statModLabel(props), amount: statMod }]
  if (magic)
    breakdown.push({ label: `${weapon.name} enchantment`, amount: magic })
  if (rage) breakdown.push({ label: 'Raging', amount: rage })
  breakdown.push(
    ...bonusLines(equippedItems, dmgBonusKey),
    ...bonusLines(character.features, dmgBonusKey)
  )

  return { value: statMod + magic + typeBonus + rage, breakdown }
}

function damageBonus(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  return damageBonusBreakdown(
    character,
    weapon,
    equippedItems,
    homebrewWeaponTypes
  ).value
}

module.exports = {
  weaponStatMod,
  gripDie,
  attackBonus,
  attackBonusBreakdown,
  damageBonus,
  damageBonusBreakdown,
  rageDamageBonus,
}
