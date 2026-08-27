const leveling = require('../data/leveling.json')

function proficiencyBonus(level) {
  return leveling.proficiency_bonus_by_level[String(level)]
}

function asiLevelsForClass(className) {
  return leveling.asi_level_overrides[className] || leveling.default_asi_levels
}

function isAsiLevel(className, level) {
  return asiLevelsForClass(className).includes(level)
}

function hitDieForClass(className) {
  return leveling.hit_die_by_class[className]
}

// HP gained for a single level in `className`. Per RAW, "average" is always
// floor(die/2)+1 — that formula IS the average of a die roll, not a separate
// house rule. Defaults to 'roll' per project owner: players are offered the
// choice each level, but rolling is the expected default rather than the
// safer average. Pass `rolledValue` when the player has an actual roll to
// record (e.g. physical dice); otherwise a roll is generated here.
//
// `level` is optional but important: at 1st level HP is ALWAYS the hit die's
// max value, per RAW — never rolled or averaged, regardless of `method`.
function hpGainForLevel(
  className,
  method = 'roll',
  rolledValue = null,
  level = null
) {
  const hitDie = hitDieForClass(className)
  if (!hitDie) return null

  if (level === 1) return hitDie

  if (method === 'average') return Math.floor(hitDie / 2) + 1

  if (method !== 'roll') {
    throw new Error(
      `Unknown HP method "${method}" — expected "roll" or "average".`
    )
  }
  if (rolledValue !== null) {
    if (
      !Number.isInteger(rolledValue) ||
      rolledValue < 1 ||
      rolledValue > hitDie
    ) {
      throw new Error(
        `Rolled value ${rolledValue} is not a valid result for a d${hitDie}.`
      )
    }
    return rolledValue
  }
  return 1 + Math.floor(Math.random() * hitDie)
}

module.exports = {
  proficiencyBonus,
  asiLevelsForClass,
  isAsiLevel,
  hitDieForClass,
  hpGainForLevel,
}
