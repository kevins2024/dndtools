// Ability scores calculated from what a record keeps: the base scores as first
// generated (`ability_base`) plus every recorded change (`ability_score_history`:
// species, background, Ability Score Improvements, feats, awards). Pure — no data
// files — so browser code can use it (see derive.js for the parts that need them).

const KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const hasRecordedBase = (c) =>
  Boolean(c?.ability_base && typeof c.ability_base === 'object')

// null when the record has not recorded its base scores.
function deriveAbilityScores(character) {
  if (!hasRecordedBase(character)) return null
  const scores = {}
  for (const k of KEYS) scores[k] = character.ability_base[k] ?? 10
  for (const h of character.ability_score_history || [])
    if (h.ability in scores) scores[h.ability] += h.amount || 0
  return scores
}

module.exports = { deriveAbilityScores, hasRecordedBase }
