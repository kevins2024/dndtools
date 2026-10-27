// What Exhaustion does, by ruleset. Pure and dependency-light (browser-safe).
//
//   2014: a table of six escalating effects (disadvantage on checks, speed
//         halved, disadvantage on attacks/saves, HP max halved, speed 0, death).
//   2024 (SRD 5.2 "Exhaustion [Condition]"): every level reduces the result of
//         each D20 Test by 2 and your Speed by 5 feet; level 6 is death.
//
// exhaustionEffects returns plain data; a UI decides how to show it, and a
// roller adds `d20Penalty` to the modifier of an attack, save or check.

const { normalizeRuleset } = require('./rulesetId')

const MAX_EXHAUSTION = 6

function exhaustionEffects(level, ruleset) {
  const lvl = Math.max(0, Math.min(MAX_EXHAUSTION, Math.floor(level ?? 0)))
  const dead = lvl >= MAX_EXHAUSTION
  if (normalizeRuleset(ruleset) === '2024') {
    return {
      level: lvl,
      dead,
      d20Penalty: lvl ? -2 * lvl : 0,
      speedPenaltyFeet: 5 * lvl,
      summary: lvl ? `-${2 * lvl} to D20 Tests, Speed -${5 * lvl} ft.` : 'None',
    }
  }
  return {
    level: lvl,
    dead,
    checkDisadvantage: lvl >= 1,
    speedHalved: lvl >= 2 && lvl < 5,
    speedZero: lvl >= 5,
    attackAndSaveDisadvantage: lvl >= 3,
    hpMaxHalved: lvl >= 4,
    summary: lvl ? `Level ${lvl}` : 'None',
  }
}

// Effective Speed for a base speed (2024: base minus 5 ft per level).
function speedAfterExhaustion(baseSpeed, level, ruleset) {
  const e = exhaustionEffects(level, ruleset)
  if (e.dead) return 0
  if (normalizeRuleset(ruleset) === '2024')
    return Math.max(0, baseSpeed - e.speedPenaltyFeet)
  return e.speedZero ? 0 : e.speedHalved ? Math.floor(baseSpeed / 2) : baseSpeed
}

module.exports = { exhaustionEffects, speedAfterExhaustion, MAX_EXHAUSTION }
