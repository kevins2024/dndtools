// "Hurl Something" — homebrew (unique to Brick, open to anyone with the
// feature and Strength 21+): throw a heavy object as an attack.
//
//   - Weight limit: 5 x Strength score (a third of carrying capacity).
//   - Damage: 1d4 bludgeoning per full 8 lb (minimum 1d4), plus Strength.
//   - Ranged attack, 20/60 ft, with proficiency, Strength to hit.
//   - Counts as a thrown weapon attack: Thrown Weapon Fighting's +2 and
//     Hurler's Rage's Rage damage both apply when the character has them.
//   - A hit is a critical hit when the thrower is more than 20 ft above the
//     target.
//   - An object over 40 lb splashes: creatures within 5 ft of the target make
//     a DEX save (DC 8 + proficiency + STR mod) or take half the dice.
//   - Cost: the whole Attack action (see HURL_ACTION_COST). Extra Attack
//     doesn't add throws, but a bonus-action attack (Frenzy) is still free.
//
// Hurl Yourself (hurlYourself.js) is a different attack (fall damage) and
// borrows only this file's Strength requirement and action cost.
//
// Same contract as unarmedAttacks.js: equippedItems is already filtered to
// "equipped by this character", attack/damage come back as
// `{ value, breakdown: [{ label, amount }] }`. Zero fs/path dependencies —
// browser code require()s this directly (src/utils/hurlSomething.js).

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')
const { effectiveProficiencyBonus } = require('./proficiency')
const { rageDamage } = require('./weaponAttack')

const HURL_FEATURE_ID = 'hb_hurl_something'
const MIN_STRENGTH = 21
const POUNDS_PER_DIE = 8
const MAX_POUNDS_PER_STR = 5
const SPLASH_OVER_POUNDS = 40
const AUTO_CRIT_HEIGHT_FT = 20
const RANGE = { normal: 20, long: 60 }
// 'attack_action' = the throw replaces the whole Attack action;
// 'one_attack' = it replaces a single attack of an Extra Attack routine.
const HURL_ACTION_COST = 'attack_action'

const hasFeature = (character, id) =>
  (character.features ?? []).some((f) => f.id === id)

function maxHurlWeight(strScore) {
  return strScore * MAX_POUNDS_PER_STR
}

// Number of d4s a thrown object of this weight deals (minimum one).
function hurlDiceCount(weightLbs) {
  return Math.max(1, Math.floor(weightLbs / POUNDS_PER_DIE))
}

// The throw math. weight: pounds being thrown (null = the heaviest
// allowed, clamped to 5 x STR). null if the character lacks the feature or
// effective Strength 21+.
function hurlStrike(character, equippedItems = [], { weight = null } = {}) {
  if (!hasFeature(character, HURL_FEATURE_ID)) return null
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  if (scores.str < MIN_STRENGTH) return null

  const strMod = abilityModifier(scores.str)
  const prof = effectiveProficiencyBonus(character, bonuses)
  const maxWeight = maxHurlWeight(scores.str)
  const thrown = Math.min(weight ?? maxWeight, maxWeight)
  const diceCount = hurlDiceCount(thrown)

  const twf = hasFeature(character, 'fighting-style-thrown-weapon-fighting')
    ? 2
    : 0
  const rage = hasFeature(character, 'hb_hurlers_rage')
    ? rageDamage(character)
    : 0

  return {
    maxWeight,
    weight: thrown,
    diceCount,
    dice: `${diceCount}d4`,
    damageType: 'bludgeoning',
    range: RANGE,
    actionCost: HURL_ACTION_COST,
    attack: {
      value: strMod + prof,
      breakdown: [
        { label: 'STR', amount: strMod },
        { label: 'Proficiency', amount: prof },
      ],
    },
    damage: {
      value: strMod + twf + rage,
      breakdown: [
        { label: 'STR', amount: strMod },
        ...(twf ? [{ label: 'Thrown Weapon Fighting', amount: twf }] : []),
        ...(rage ? [{ label: 'Raging', amount: rage }] : []),
      ],
    },
    autoCritFromAboveFt: AUTO_CRIT_HEIGHT_FT,
    splash:
      thrown > SPLASH_OVER_POUNDS
        ? {
            radius: 5,
            save: 'dex',
            dc: 8 + prof + strMod,
            dice: `${diceCount}d4`,
            onFail: 'half',
          }
        : null,
  }
}

// weight: pounds of the object being thrown; defaults to the heaviest the
// character can lift-and-throw, and is clamped to that.
function hurlSomething(character, equippedItems = [], { weight = null } = {}) {
  const strike = hurlStrike(character, equippedItems, { weight })
  return strike && { name: 'Hurl Something', ...strike }
}

module.exports = {
  HURL_FEATURE_ID,
  MIN_STRENGTH,
  HURL_ACTION_COST,
  hurlStrike,
  maxHurlWeight,
  hurlDiceCount,
  hurlSomething,
}
