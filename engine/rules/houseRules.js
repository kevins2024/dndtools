// Campaign house rules that have a mechanical right answer (see
// src/data/house_rules.json for the table-facing text). Not 5e RAW, so this
// lives beside the other campaign-level rules rather than in rules/5e/.
// Extracted 2026-10-01 from src/utils/dnd_utils.js.
//
// Zero dependencies — browser code require()s this directly; see
// src/utils/houseRules.js.

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
}

// {low, high} using the non-crit roll extremes (2 and 19) — an at-a-glance
// preview before actually destroying the item, which rolls for real
// (including the crit 1/20 cases) via weaveDustForRoll.
function weaveDustEstimateRange(item) {
  if (!item?.value_gp) return null
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

module.exports = {
  weaveDustForRoll,
  weaveDustEstimateRange,
  crowdStrength,
  crowdAreaDamage,
}
