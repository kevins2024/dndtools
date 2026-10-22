// Campaign house rules that have a mechanical right answer (see
// src/data/house_rules.json for the table-facing text). Not 5e RAW, so this
// lives beside the other campaign-level rules rather than in rules/5e/.
// Extracted 2026-10-01 from src/utils/dnd_utils.js.
//
// No fs/path dependencies — browser code require()s this directly; see
// src/utils/houseRules.js.

const { FALL_CAP_DAMAGE } = require('./5e/fall')

// The gold value Weave Dust is worked out from. An item's own recorded
// value_gp always wins. Otherwise it is a standard value for the item's
// rarity: the item's rarity if it has one, or, for an enchanted weapon or
// armor with none recorded, the rarity the DMG gives that +N (weapons and
// shields +1 uncommon / +2 rare / +3 very rare; other armor +1 rare / +2
// very rare / +3 legendary). The gold figures are a campaign choice (the DMG
// gives price ranges, not single values) and are the one place to edit if
// they feel wrong. Artifacts and anything with no rarity to go on return
// null: nothing to calculate from, so the caller falls back to manual entry.
const RARITY_VALUE_GP = {
  common: 100,
  uncommon: 500,
  rare: 5000,
  'very rare': 50000,
  legendary: 100000,
}

function rarityOf(item) {
  const rarity = String(item?.rarity ?? '').toLowerCase()
  if (RARITY_VALUE_GP[rarity]) return rarity
  const bonus = item?.enhancement_bonus
  if (!bonus || bonus < 1 || bonus > 3) return null
  const armor = item.armor_type && item.armor_type !== 'shield'
  const ladder = armor
    ? ['rare', 'very rare', 'legendary']
    : ['uncommon', 'rare', 'very rare']
  return ladder[bonus - 1]
}

function itemValueGp(item) {
  if (!item) return null
  if (item.value_gp) return item.value_gp
  const rarity = rarityOf(item)
  return rarity ? RARITY_VALUE_GP[rarity] : null
}

// "Weave Dust from Broken-Down Magic Items": a magic item can be destroyed
// for Weave Dust instead of sold for gold. base = value_gp / 15, reduced by
// up to 30% in proportion to missing charges, and for an item that
// recharges with a purchased material, also by the cost of the material
// needed to refill what's missing. Then a d20 swings it: natural 20 doubles,
// natural 1 halves, otherwise ±(roll-offset)%: 11-19 give +1..+9%, 2-10
// give -9..-1%. Pure given an item and a specific roll, so the UI can both
// preview a range and commit one real roll. Returns null when the item has
// no recorded value_gp — nothing to calculate from, not a silent 0.
function weaveDustForRoll(item, roll) {
  const valueGp = itemValueGp(item)
  if (!valueGp) return null
  let base = valueGp / 15
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
}

// {low, high} using the non-crit roll extremes (2 and 19) — an at-a-glance
// preview before actually destroying the item, which rolls for real
// (including the crit 1/20 cases) via weaveDustForRoll.
function weaveDustEstimateRange(item) {
  if (!itemValueGp(item)) return null
  return {
    low: weaveDustForRoll(item, 2),
    high: weaveDustForRoll(item, 19),
  }
}

// "Crowd": up to 5 weak creatures tracked as one pooled-HP unit. Strength
// (how many are still meaningfully fighting) is the current HP's position
// among `size` even thresholds of max HP, rounded up — a Crowd of 5 with 50
// max HP is Strength 5 down to 40 HP, 4 down to 30, ... 1 until destroyed at
// 0. Derived purely from HP + size, no stored state. null when this isn't a
// Crowd (size <= 1) or its max HP isn't known.
function crowdStrength({ size, maxHp, damage = 0 }) {
  if (!size || size <= 1) return null
  if (!maxHp) return null
  const current = Math.max(0, maxHp - damage)
  return Math.ceil((current / maxHp) * size)
}

// A Crowd's area-of-effect saves always succeed, but the halved (saved)
// damage is multiplied by its current Strength before applying — a fireball
// for 20 against Strength 3 is 10 * 3 = 30.
function crowdAreaDamage(baseDamage, strength) {
  return Math.floor(baseDamage / 2) * strength
}

// "Landing On Someone": when a creature takes fall damage and lands on
// another creature or an object, that target takes the same damage. `fallDamage`
// is the damage the faller actually took (after Slow Fall, Feather Fall and
// the like), because it's the impact that hurts — not the rolled dice.
// `target` is `{ size, immunities, resistances, vulnerabilities }`
// (damage-type names, any case). Fall damage is bludgeoning, so immunity to
// bludgeoning means no damage, and resistance/vulnerability to it
// halves/doubles it. A resistance written as "from nonmagical attacks"
// doesn't apply — a fall isn't an attack — so only a plain bludgeoning entry
// counts.
//
// `lethal: true` is a fall over 60 ft (fall.js): the dice no longer decide.
// Anything Large or smaller (an unspecified size counts as Medium) that
// isn't immune to bludgeoning just dies — `{ damage: null, dies: true }`;
// anything bigger takes the table's maximum (FALL_CAP_DAMAGE) instead, with
// its resistance or vulnerability applied.
const SMALL_ENOUGH_TO_DIE = ['tiny', 'small', 'medium', 'large']

function landingImpact(fallDamage, target = {}, { lethal = false } = {}) {
  const has = (list) =>
    (list ?? []).some((t) => String(t).trim().toLowerCase() === 'bludgeoning')
  if (lethal) {
    if (has(target.immunities)) return { damage: 0, modifier: 'immune' }
    const size = String(target.size ?? 'medium').toLowerCase()
    if (SMALL_ENOUGH_TO_DIE.includes(size))
      return { damage: null, modifier: 'none', dies: true }
    fallDamage = FALL_CAP_DAMAGE
  }
  if (!(fallDamage > 0)) return { damage: 0, modifier: 'none' }
  if (has(target.immunities)) return { damage: 0, modifier: 'immune' }
  if (has(target.resistances))
    return { damage: Math.floor(fallDamage / 2), modifier: 'resistant' }
  if (has(target.vulnerabilities))
    return { damage: fallDamage * 2, modifier: 'vulnerable' }
  return { damage: fallDamage, modifier: 'none' }
}

module.exports = {
  landingImpact,
  RARITY_VALUE_GP,
  itemValueGp,
  weaveDustForRoll,
  weaveDustEstimateRange,
  crowdStrength,
  crowdAreaDamage,
}
