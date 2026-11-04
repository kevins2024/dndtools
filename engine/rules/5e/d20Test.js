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

// rolls: one d20 result for 'normal', two for advantage/disadvantage. `rerolls` lists the dice that were
// rolled again, [{ from, to }] (Halfling Luck), and only labels the breakdown: `rolls` already holds the
// new dice.
function resolveD20Test(
  rolls,
  { mode = 'normal', modifier = 0, rerolls = [] } = {}
) {
  const natural =
    mode === 'advantage'
      ? Math.max(...rolls)
      : mode === 'disadvantage'
      ? Math.min(...rolls)
      : rolls[0]

  const d20Label =
    mode === 'normal' ? 'd20' : `d20, ${mode} (${rolls.join(' / ')})`
  const rerollNote = rerolls.length
    ? ` — rerolled ${rerolls.map((r) => `${r.from} to ${r.to}`).join(', ')}`
    : ''
  const breakdown = [{ label: d20Label + rerollNote, amount: natural }]
  if (modifier) breakdown.push({ label: 'Modifier', amount: modifier })

  return {
    value: natural + modifier,
    natural,
    rolls: [...rolls],
    rerolls: [...rerolls],
    mode,
    breakdown,
  }
}

function rollD20(rng = Math.random) {
  return 1 + Math.floor(rng() * 20)
}

// opts: { advantage, disadvantage, modifier, rng, rerollOn } — rng is an optional
// () => number in [0, 1) so callers (and tests) can pin the dice. rerollOn is the list of results the
// roller may roll again and must keep the new die (Halfling Luck: [1], "When you roll a 1 on the d20 of a
// D20 Test, you can reroll the die"); it applies to each d20 rolled, once.
function rollD20Test(opts = {}) {
  const mode = resolveMode(opts)
  const rng = opts.rng ?? Math.random
  const rerollOn = opts.rerollOn ?? []
  const rerolls = []
  const die = () => {
    const first = rollD20(rng)
    if (!rerollOn.includes(first)) return first
    const second = rollD20(rng)
    rerolls.push({ from: first, to: second })
    return second
  }
  const rolls = mode === 'normal' ? [die()] : [die(), die()]
  return resolveD20Test(rolls, { mode, modifier: opts.modifier ?? 0, rerolls })
}

module.exports = { resolveMode, resolveD20Test, rollD20, rollD20Test }
