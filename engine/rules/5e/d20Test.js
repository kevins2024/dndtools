// A d20 test (PHB ch. 7: ability checks, saving throws, attack rolls): roll
// a d20, or two d20s keeping the higher/lower with advantage/disadvantage,
// then add a modifier. If a roll has both advantage and disadvantage they
// cancel and it's a single d20 (PHB p. 173), regardless of how many sources
// grant each.
//
// Same split as abilityScoreRoll.js: a pure, deterministic piece
// (resolveD20Test — given the dice that came up, what's the result and its
// breakdown) and a thin impure wrapper (rollD20Test) that generates the
// dice. Returns the shared { value, breakdown: [{ label, amount }] } shape
// (see breakdown.js / CLAUDE.md) so a UI renders its own tooltip from the
// list instead of building a math string itself.
//
// Zero dependencies (no fs/path, no other rule file) — browser code
// require()s this directly for DiceRoller's rapid-click rolls; see
// src/utils/d20Test.js.

function resolveMode({ advantage = false, disadvantage = false } = {}) {
  if (advantage && !disadvantage) return 'advantage'
  if (disadvantage && !advantage) return 'disadvantage'
  return 'normal'
}

// rolls: one d20 result for 'normal', two for advantage/disadvantage.
function resolveD20Test(rolls, { mode = 'normal', modifier = 0 } = {}) {
  const natural =
    mode === 'advantage'
      ? Math.max(...rolls)
      : mode === 'disadvantage'
      ? Math.min(...rolls)
      : rolls[0]

  const d20Label =
    mode === 'normal' ? 'd20' : `d20, ${mode} (${rolls.join(' / ')})`
  const breakdown = [{ label: d20Label, amount: natural }]
  if (modifier) breakdown.push({ label: 'Modifier', amount: modifier })

  return {
    value: natural + modifier,
    natural,
    rolls: [...rolls],
    mode,
    breakdown,
  }
}

function rollD20() {
  return 1 + Math.floor(Math.random() * 20)
}

// opts: { advantage, disadvantage, modifier }
function rollD20Test(opts = {}) {
  const mode = resolveMode(opts)
  const rolls = mode === 'normal' ? [rollD20()] : [rollD20(), rollD20()]
  return resolveD20Test(rolls, { mode, modifier: opts.modifier ?? 0 })
}

module.exports = { resolveMode, resolveD20Test, rollD20, rollD20Test }
