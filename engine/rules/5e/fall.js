// Falling — the campaign's HOUSE RULE, not PHB (the PHB's 1d6 per 10 ft,
// max 20d6, leaves a high-level character barely scratched by a 100 ft fall).
// Lives under 5e/ because it replaces a 5e rule; see src/data/house_rules.json
// ("Falling") for the table-facing text.
//
//   - A fall's "tier" is one per full 10 ft. The number of dice is the
//     triangular number of the tier (Gygax's table): 1, 3, 6, 10, 15, 21.
//   - The dice are d8 by default. The faller may brace — an Acrobatics check
//     or a Constitution saving throw, their choice — against DC 14 + tier;
//     on a success the dice are d6 instead.
//   - A fall of more than 60 ft isn't rolled: the faller dies (see
//     houseRules.landingImpact for what they land on).
//
// Pure; the only dependency is checks.js (zero fs/path), so browser code can
// require() it directly.

const { skill, savingThrow } = require('./checks')

const FEET_PER_TIER = 10
const LETHAL_OVER_FT = 60
const BASE_DC = 14
const MAX_TIER = LETHAL_OVER_FT / FEET_PER_TIER // 6
const FAIL_DIE = 8
const BRACED_DIE = 6

const triangular = (n) => (n * (n + 1)) / 2

// One per full 10 ft (0 below 10 ft: no fall damage).
function fallTier(heightFt) {
  return Math.max(0, Math.floor(heightFt / FEET_PER_TIER))
}

function isLethalFall(heightFt) {
  return heightFt > LETHAL_OVER_FT
}

// Number of dice: 1, 3, 6, 10, 15, 21 for tiers 1-6. null when the fall is
// lethal (the dice no longer decide) or too short to hurt.
function fallDiceCount(heightFt) {
  if (isLethalFall(heightFt)) return null
  const tier = fallTier(heightFt)
  return tier === 0 ? null : triangular(tier)
}

// DC to brace against the fall; null when there's no fall damage to resist.
function fallDC(heightFt) {
  if (isLethalFall(heightFt)) return null
  const tier = fallTier(heightFt)
  return tier === 0 ? null : BASE_DC + tier
}

// The maximum damage the table can deal: 21d8. Used when a fall over 60 ft
// lands on something too big to simply die (see houseRules.landingImpact).
const FALL_CAP_DAMAGE = triangular(MAX_TIER) * FAIL_DIE

// Damage of a fall. braced: the faller made the check, so d6 instead of d8.
// Returns { lethal, tier, count, die, dice, min, avg, max, dc }; for a lethal
// fall, { lethal: true } and nothing to roll; for no damage, count is 0.
function fallDamage(heightFt, { braced = false } = {}) {
  if (isLethalFall(heightFt)) return { lethal: true }
  const tier = fallTier(heightFt)
  const count = tier === 0 ? 0 : triangular(tier)
  const sides = braced ? BRACED_DIE : FAIL_DIE
  return {
    lethal: false,
    tier,
    count,
    die: sides,
    dice: count ? `${count}d${sides}` : null,
    min: count,
    avg: (count * (sides + 1)) / 2,
    max: count * sides,
    dc: fallDC(heightFt),
  }
}

// Roll a fall. `rng` is any () => [0, 1) so tests can drive it. For a lethal
// fall nothing is rolled: { lethal: true }. Otherwise the faller's damage:
// { lethal: false, tier, braced, die, count, rolls: [...], total, dice, dc }.
function rollFall(heightFt, { braced = false, rng = Math.random } = {}) {
  const info = fallDamage(heightFt, { braced })
  if (info.lethal) return { lethal: true }
  const rolls = Array.from(
    { length: info.count },
    () => Math.floor(rng() * info.die) + 1
  )
  return {
    lethal: false,
    tier: info.tier,
    braced,
    die: info.die,
    count: info.count,
    dice: info.dice,
    dc: info.dc,
    rolls,
    total: rolls.reduce((sum, r) => sum + r, 0),
  }
}

// The two ways to brace, with this character's real bonuses, and which is
// better (ties go to the saving throw). null if there's nothing to brace.
function fallCheckOptions(character, equippedItems = [], heightFt) {
  const dc = fallDC(heightFt)
  if (dc == null) return null
  const acrobatics = skill(character, 'Acrobatics', equippedItems)
  const constitution = savingThrow(character, 'con', equippedItems)
  return {
    dc,
    acrobatics,
    constitution,
    best: acrobatics > constitution ? 'acrobatics' : 'constitution',
  }
}

module.exports = {
  FEET_PER_TIER,
  LETHAL_OVER_FT,
  FALL_CAP_DAMAGE,
  fallTier,
  isLethalFall,
  fallDiceCount,
  fallDC,
  fallDamage,
  rollFall,
  fallCheckOptions,
}
