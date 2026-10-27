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
const { weaponProps, isProficientWithWeapon } = require('./weapons')
const { bonusLines } = require('./breakdown')
const barbarian2014 = require('../../data/5e/classes/barbarian.json')
const barbarian2024 = require('../../data/5e2024/classes/barbarian.json')
const { rulesetOf } = require('./rulesetId')

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
  const props = weaponProps(weapon, homebrewWeaponTypes, rulesetOf(character))
  if (props.finesse) {
    return Math.max(abilityModifier(scores.str), abilityModifier(scores.dex))
  }
  return props.weapon_type === 'ranged'
    ? abilityModifier(scores.dex)
    : abilityModifier(scores.str)
}

// A weapon's enchantment bonus, the same number for its attack roll and its
// damage roll. Normally the flat +N on the item (`enhancement_bonus`); a
// scaling weapon (`enhancement_scaling`, from item-mechanics.json) adds a
// bonus that follows the wielder's proficiency bonus instead:
//   { type: 'proficiency', multiplier, offset } -> floor(proficiency * multiplier) + offset
// e.g. { multiplier: 0.5, offset: 1 } is +2 at levels 1-8, +3 at 9-16, +4 at 17-20.
// applyAttunement strips enhancement_scaling from an unattuned item, so it
// only contributes while attuned. Returns { amount, scaling } where scaling is
// the part that came from the formula (for the tooltip label).
function weaponEnchantment(character, weapon, bonuses = {}) {
  const flat = weapon.enhancement_bonus ?? 0
  const scaling = weapon.enhancement_scaling
  if (!scaling) return { amount: flat, scaling: 0 }
  const prof = effectiveProficiencyBonus(character, bonuses)
  const scaled = Math.max(
    0,
    Math.floor(prof * (scaling.multiplier ?? 1)) + (scaling.offset ?? 0)
  )
  return { amount: flat + scaled, scaling: scaled }
}

function enchantmentLine(weapon, enchantment) {
  return {
    label: enchantment.scaling
      ? `${weapon.name} enchantment (scales with proficiency)`
      : `${weapon.name} enchantment`,
    amount: enchantment.amount,
  }
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
  const props = weaponProps(weapon, homebrewWeaponTypes, rulesetOf(character))
  if (!props.versatile) return props.damage_dice
  if (weapon.slot === 'melee2h')
    return props.damage_dice_2h ?? props.damage_dice
  // Deliberately held one-handed (see gripMode in weaponHands.js): never
  // inferred two-handed, even with a free hand.
  if (weapon.grip === 'one') return props.damage_dice
  // Both hands are free for it only with no second one-handed weapon AND no
  // shield (a shield occupies the off hand — longsword + shield is a d8).
  const melee1hCount = equippedItems.filter((i) => i.slot === 'melee1h').length
  const hasShield = equippedItems.some((i) => i.armor_type === 'shield')
  return melee1hCount <= 1 && !hasShield
    ? props.damage_dice_2h ?? props.damage_dice
    : props.damage_dice
}

// A thrown attack always uses the weapon's base one-handed die, even if it's
// currently gripped two-handed for melee — real RAW, the versatile bonus die
// only applies to a melee attack made with two hands. Returns that thrown
// die only when it actually differs from the die for the current grip (a
// thrown-and-currently-1H weapon has nothing extra worth showing), else null.
function thrownDie(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const props = weaponProps(weapon, homebrewWeaponTypes, rulesetOf(character))
  if (!props.thrown) return null
  const current = gripDie(character, weapon, equippedItems, homebrewWeaponTypes)
  return props.damage_dice !== current ? props.damage_dice : null
}

function attackBonusBreakdown(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const props = weaponProps(weapon, homebrewWeaponTypes, rulesetOf(character))
  const statMod = weaponStatMod(
    character,
    weapon,
    equippedItems,
    homebrewWeaponTypes
  )
  // Proficiency only counts if the character is proficient with this weapon.
  // Permissive where the data can't say: a character with no recorded weapon
  // proficiencies, or a weapon with no simple/martial category (old or
  // homebrew items), is treated as proficient rather than silently penalised.
  const canJudge =
    props.category && (character.weapon_proficiencies ?? []).length > 0
  const proficient =
    !canJudge ||
    isProficientWithWeapon(
      character,
      weapon,
      homebrewWeaponTypes,
      equippedItems
    )
  const prof = proficient ? effectiveProficiencyBonus(character, bonuses) : 0
  const enchantment = weaponEnchantment(character, weapon, bonuses)
  const magic = enchantment.amount
  const atkBonusKey =
    props.weapon_type === 'ranged' ? 'ranged_attack' : 'melee_attack'
  const typeBonus = bonuses[atkBonusKey] ?? 0

  const breakdown = [
    { label: statModLabel(props), amount: statMod },
    { label: proficient ? 'Proficiency' : 'Not proficient', amount: prof },
  ]
  if (magic) breakdown.push(enchantmentLine(weapon, enchantment))
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
// The raw Rage damage number for a character: 0 unless Raging and a
// Barbarian. Split out so non-weapon attacks (unarmed strikes) can apply it.
function rageDamage(character) {
  if (!(character.conditions ?? []).includes('Raging')) return 0
  const barbLevel = (character.classes ?? []).find(
    (c) => c.name?.toLowerCase() === 'barbarian'
  )?.level
  if (!barbLevel) return 0
  // The Barbarian class file's own table ({ "1": 2, "9": 3, "16": 4 }): the
  // value at the highest key at or below the level. One source for Rage's
  // damage, the same way its uses already come from `rages_by_level`.
  let damage = 0
  let bestKey = -Infinity
  const barbarian = rulesetOf(character) === '2024' ? barbarian2024 : barbarian2014
  for (const [key, value] of Object.entries(barbarian.rage_damage_by_level)) {
    const k = Number(key)
    if (k <= barbLevel && k > bestKey) {
      bestKey = k
      damage = value
    }
  }
  return damage
}

function rageDamageBonus(character, weapon, homebrewWeaponTypes = {}) {
  if (!(character.conditions ?? []).includes('Raging')) return 0
  const props = weaponProps(weapon, homebrewWeaponTypes, rulesetOf(character))
  if (props.weapon_type === 'ranged') return 0
  return rageDamage(character)
}

function damageBonusBreakdown(
  character,
  weapon,
  equippedItems = [],
  homebrewWeaponTypes = {}
) {
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const props = weaponProps(weapon, homebrewWeaponTypes, rulesetOf(character))
  const statMod = weaponStatMod(
    character,
    weapon,
    equippedItems,
    homebrewWeaponTypes
  )
  const enchantment = weaponEnchantment(character, weapon, bonuses)
  const magic = enchantment.amount
  const dmgBonusKey =
    props.weapon_type === 'ranged' ? 'ranged_damage' : 'melee_damage'
  const typeBonus = bonuses[dmgBonusKey] ?? 0
  const rage = rageDamageBonus(character, weapon, homebrewWeaponTypes)

  const breakdown = [{ label: statModLabel(props), amount: statMod }]
  if (magic) breakdown.push(enchantmentLine(weapon, enchantment))
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
  weaponEnchantment,
  weaponStatMod,
  gripDie,
  thrownDie,
  attackBonus,
  attackBonusBreakdown,
  damageBonus,
  damageBonusBreakdown,
  rageDamageBonus,
  rageDamage,
}
