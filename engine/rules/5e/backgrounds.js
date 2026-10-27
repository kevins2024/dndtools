const backgrounds = require('../../data/5e/backgrounds.json')
const { normalizeRuleset, loadRulesetJson } = require('./ruleset')

// A deliberately curated subset (40, see engine/CHECKLIST.md) of the ~360
// unique backgrounds across all published sourcebooks — each real, verified
// against a reference skill-proficiency table (not guessed from memory; an
// earlier pass mis-attributed a couple of these to the wrong sourcebook from
// memory alone, caught and corrected before this file was written), each with
// a clean fixed two-skill grant. Backgrounds whose RAW skill list involves a
// player choice (e.g. Cloistered Scholar, Faction Agent) are deliberately
// left out rather than guessed at with an arbitrary default pick.
//
// Plus one deliberate homebrew exception: "Born Adventurer" — no real
// background lets you freely pick any two of the 18 skills (every published
// one has a fixed or narrowly-choice-limited list), so it's flagged
// `homebrew: true` with an empty `skill_proficiencies` and a `free_choice`
// marker instead. No RAW rule restricts which skills a background can grant
// — a real-data tally across ~150 published background instances shows every
// skill appears at least a handful of times (Medicine rarest, Athletics/
// Persuasion/Insight most common) — so no skill is excluded from the choice.
//
// Under '2024' the list is the 2024 backgrounds (ability scores, an origin
// feat, two skills, a tool) plus the 2014/homebrew backgrounds the 2024 rules
// did not rewrite, tagged `legacy: true`; a 2024 background replaces a 2014 one
// of the same name (Sage, Noble, Criminal...).
function backgroundsFor(ruleset) {
  if (normalizeRuleset(ruleset) !== '2024') return backgrounds
  const rewritten = loadRulesetJson('2024', 'backgrounds.json') ?? []
  const have = new Set(rewritten.map((b) => b.name.toLowerCase()))
  return [
    ...rewritten,
    ...backgrounds
      .filter((b) => !have.has(b.name.toLowerCase()))
      .map((b) => ({ ...b, legacy: true })),
  ]
}

function listBackgrounds(ruleset) {
  return backgroundsFor(ruleset)
}

function loadBackground(name, ruleset) {
  return (
    backgroundsFor(ruleset).find(
      (b) => b.name.toLowerCase() === String(name).toLowerCase()
    ) || null
  )
}

// 2024: a background lists three abilities; increase one by 2 and another by 1
// ({ plus2, plus1 }), or all three by 1 ({ all: true }). Nothing goes above 20.
// Returns { scores, notes, deltas } like asiFeat.js so diffLevelUp can record
// the same ability_score_history entries.
function applyBackgroundBonus(scores, backgroundName, choice = {}) {
  const bg = loadBackground(backgroundName, '2024')
  if (!bg?.ability_scores?.length) {
    throw new Error(
      `"${backgroundName}" has no 2024 ability scores to increase.`
    )
  }
  const allowed = bg.ability_scores
  const increases = {}
  if (choice.all) {
    for (const a of allowed) increases[a] = 1
  } else {
    const { plus2, plus1 } = choice
    for (const a of [plus2, plus1]) {
      if (!allowed.includes(a)) {
        throw new Error(
          `${backgroundName} can only raise ${allowed.join(', ')} — got "${a}".`
        )
      }
    }
    if (plus2 === plus1) {
      throw new Error('Pick two different abilities for the +2 and the +1.')
    }
    increases[plus2] = 2
    increases[plus1] = 1
  }
  const next = { ...scores }
  const notes = []
  const deltas = []
  for (const [ability, amount] of Object.entries(increases)) {
    const before = next[ability] ?? 10
    const after = Math.max(before, Math.min(20, before + amount))
    if (after < before + amount) {
      notes.push(`${ability.toUpperCase()} capped at 20.`)
    }
    next[ability] = after
    deltas.push({ ability, amount: after - before })
  }
  return { scores: next, notes, deltas }
}

module.exports = { listBackgrounds, loadBackground, applyBackgroundBonus }
