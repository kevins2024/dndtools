const { loadFeat } = require('./grants')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SCORE_CAP = 20 // standard 5e cap; Epic Boons pushing past this are out of scope

// Shared score-bump-and-cap logic, with no opinion on how many points a
// caller is allowed to spend in total — that's a rule specific to WHERE the
// increase came from (a full ASI vs. a feat's own fixed bump), enforced by
// the caller, not here.
function bumpAbilities(scores, increases) {
  const next = { ...scores }
  const notes = []
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
  }
  return { scores: next, notes }
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

// Only feats with a catalogued `ability_score_increase` (engine/data/feats.json)
// apply an ability bump automatically. Everything else about a feat (granted
// spells, proficiencies, etc.) still has to be added to the character by hand —
// the feat catalog only covers what's needed to verify known-spell counts so
// far (see CHECKLIST.md Phase 3), not full mechanical text for every feat.
function applyFeatChoice(scores, featName, abilityChoice = null) {
  const feat = loadFeat(featName)
  if (!feat) {
    return {
      scores,
      notes: [
        `"${featName}" isn't in the feat catalog yet — record it manually, no automatic ability bump applied.`,
      ],
    }
  }
  if (!feat.ability_score_increase) {
    return { scores, notes: [] }
  }

  const { choice_of: choiceOf, amount } = feat.ability_score_increase
  let ability = abilityChoice
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
  return bumpAbilities(scores, { [ability]: amount })
}

// resolution: { type: 'asi', increases: {str:1,dex:1} } | { type: 'feat', featName, abilityChoice? }
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
      resolution.abilityChoice
    )
  }
  throw new Error(
    `Unknown resolution type "${resolution.type}" — expected "asi" or "feat".`
  )
}

module.exports = { applyIncrease, applyFeatChoice, resolveAsiOrFeat, SCORE_CAP }
