// "Hurl Yourself" — homebrew, unique to Brick. He leaps off something high
// and comes down on one creature and up to one creature adjacent to it. The
// damage is the campaign's fall damage (fall.js: the Gygax dice table, d8
// unless he braces, nothing rolled over 60 ft — he dies): rolled once, Brick
// takes it as normal, and each target takes it x2 — he's
// massive and angles himself onto them. Per the "Landing On Someone" house
// rule (houseRules.landingImpact), a target immune to bludgeoning takes
// nothing, resistance halves, and vulnerability doubles. From over 60 ft it's
// the lethal case: Brick dies, and so does what he lands on (Large or
// smaller; bigger takes the table's maximum).
//
// What it borrows from Hurl Something (hurlSomething.js) instead of
// repeating: the Strength 21+ requirement and the action cost (the whole
// Attack action). It is not a throw, so none of Hurl Something's dice,
// weight limit, splash or thrown-weapon bonuses apply.
//
// The target must be within jump distance (jump.js). No attack roll and no
// saving throw — the landing is the effect; the height is what limits it.
//
// No fs/path dependencies — browser code require()s this directly
// (src/utils/hurlSomething.js).

const { MIN_STRENGTH, HURL_ACTION_COST } = require('./hurlSomething')
const { longJumpFeet } = require('./jump')
const { fallDamage, isLethalFall } = require('./fall')
const { landingImpact } = require('../houseRules')
const { resolveEffectiveStats } = require('./characterStats')

const HURL_YOURSELF_FEATURE_ID = 'hb_hurl_yourself'
// How much harder he lands than a plain fall — his size and angling.
const HURL_YOURSELF_MULTIPLIER = 2
const MAX_TARGETS = 2

// heightFt: how far he falls (null = just the rules, no damage preview).
// braced: whether he made the brace check (d6 instead of d8).
// null if the character lacks the feature or effective Strength 21+.
function hurlYourself(
  character,
  equippedItems = [],
  { heightFt = null, braced = false } = {}
) {
  if (
    !(character.features ?? []).some((f) => f.id === HURL_YOURSELF_FEATURE_ID)
  )
    return null
  const { scores } = resolveEffectiveStats(character, equippedItems)
  if (scores.str < MIN_STRENGTH) return null

  return {
    name: 'Hurl Yourself',
    actionCost: HURL_ACTION_COST,
    range: { jump: longJumpFeet(scores.str) },
    multiplier: HURL_YOURSELF_MULTIPLIER,
    maxTargets: MAX_TARGETS,
    heightFt,
    lethal: heightFt == null ? false : isLethalFall(heightFt),
    fall: heightFt == null ? null : fallDamage(heightFt, { braced }),
  }
}

// What one target takes, given the fall damage Brick actually rolled and
// took (null for a lethal fall — pass `{ lethal: true }`).
function hurlYourselfDamage(fallDamageTaken, target = {}, opts = {}) {
  return landingImpact(
    Math.floor((fallDamageTaken ?? 0) * HURL_YOURSELF_MULTIPLIER),
    target,
    opts
  )
}

module.exports = {
  HURL_YOURSELF_FEATURE_ID,
  HURL_YOURSELF_MULTIPLIER,
  hurlYourself,
  hurlYourselfDamage,
}
