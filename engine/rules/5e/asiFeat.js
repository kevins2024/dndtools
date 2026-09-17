const { loadFeat } = require('./grants')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SCORE_CAP = 20 // standard 5e cap; Epic Boons pushing past this are out of scope

// Shared score-bump-and-cap logic, with no opinion on how many points a
// caller is allowed to spend in total — that's a rule specific to WHERE the
// increase came from (a full ASI vs. a feat's own fixed bump), enforced by
// the caller, not here.
//
// Also returns `deltas` — the ACTUAL applied change per ability (after minus
// before, so a cap reduces the recorded delta below the requested amount).
// This is what diffLevelUp.js turns into an ability_score_history entry —
// deltas are the ground truth for "how much did this specific bump really
// contribute," not the requested amount, so history always sums correctly
// to the final stat even when a bump gets partially or fully capped.
function bumpAbilities(scores, increases) {
  const next = { ...scores }
  const notes = []
  const deltas = []
  for (const [ability, amount] of Object.entries(increases)) {
    if (!ABILITIES.includes(ability)) {
      throw new Error(`Unknown ability "${ability}".`)
    }
    const before = next[ability] ?? 10
    const after = Math.min(SCORE_CAP, before + amount)
    if (after < before + amount) {
      notes.push(
        `${ability.toUpperCase()} capped at ${SCORE_CAP} (would have been ${
          before + amount
        }).`
      )
    }
    next[ability] = after
    deltas.push({ ability, amount: after - before })
  }
  return { scores: next, notes, deltas }
}

// The standard Ability Score Improvement: always +2 total, either +2 to one
// ability or +1/+1 to two.
function applyIncrease(scores, increases) {
  const total = Object.values(increases).reduce((sum, n) => sum + n, 0)
  if (total !== 2) {
    throw new Error(
      `Ability Score Improvement must total +2 across abilities, got +${total}.`
    )
  }
  for (const [ability, amount] of Object.entries(increases)) {
    if (amount !== 1 && amount !== 2) {
      throw new Error(
        `Ability increases must be +1 or +2 each, got +${amount} to ${ability}.`
      )
    }
  }
  return bumpAbilities(scores, increases)
}

// Only feats with a catalogued entry (engine/data/feats.json) apply anything
// automatically. What gets auto-applied has grown from "just the ability
// score bump" to: the ability score bump, a `feature` object the caller
// (diffLevelUp) merges into character.features[] (carrying stat_bonuses,
// the resolved extra `choices`, and grants_saving_throw_proficiency), and
// (in diffLevelUp, not here — this function stays character-shape-agnostic)
// any grants_spells fixed/choice spells. Everything else about a feat
// (proficiencies with no structured home yet, situational combat text) is
// still recorded manually — see feats.json's own `_schema` note.
function applyFeatChoice(
  scores,
  featName,
  abilityChoice = null,
  choices = null
) {
  const feat = loadFeat(featName)
  if (!feat) {
    return {
      scores,
      notes: [
        `"${featName}" isn't in the feat catalog yet — record it manually, no automatic ability bump applied.`,
      ],
      feature: null,
      deltas: [],
    }
  }

  let ability = abilityChoice
  let nextScores = scores
  let notes = []
  let deltas = [] // empty when the feat has no ability_score_increase at all (e.g. Alert, Skilled)

  if (feat.ability_score_increase) {
    const { choice_of: choiceOf, amount } = feat.ability_score_increase
    if (choiceOf && choiceOf.length > 1) {
      if (!ability || !choiceOf.includes(ability)) {
        throw new Error(
          `"${featName}" requires choosing one ability from [${choiceOf.join(
            ', '
          )}] — got "${ability || 'none'}".`
        )
      }
    } else {
      ability = ability || (choiceOf && choiceOf[0])
    }
    // Not routed through applyIncrease — a feat's own bump (usually +1, not
    // always) doesn't follow the "+2 total" ASI rule, just the shared cap logic.
    const bumped = bumpAbilities(scores, { [ability]: amount })
    nextScores = bumped.scores
    notes = bumped.notes
    deltas = bumped.deltas
  }

  const feature = {
    name: featName,
    type: 'feat',
    ability_choice: ability ?? null,
    choices: choices ?? null,
    stat_bonuses: feat.stat_bonuses ?? null,
    grants_saving_throw_proficiency: feat.grants_saving_throw_proficiency
      ? ability
      : null,
    grants_spells: feat.grants_spells ?? null,
  }

  return { scores: nextScores, notes, feature, deltas }
}

// resolution: { type: 'asi', increases: {str:1,dex:1} }
//           | { type: 'feat', featName, abilityChoice?, choices? }
function resolveAsiOrFeat(scores, resolution) {
  if (!resolution || !resolution.type) {
    throw new Error(
      'ASI/feat resolution required: { type: "asi", increases } or { type: "feat", featName }.'
    )
  }
  if (resolution.type === 'asi') {
    return applyIncrease(scores, resolution.increases)
  }
  if (resolution.type === 'feat') {
    return applyFeatChoice(
      scores,
      resolution.featName,
      resolution.abilityChoice,
      resolution.choices
    )
  }
  throw new Error(
    `Unknown resolution type "${resolution.type}" — expected "asi" or "feat".`
  )
}

module.exports = { applyIncrease, applyFeatChoice, resolveAsiOrFeat, SCORE_CAP }
