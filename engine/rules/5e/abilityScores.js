// Resolves a character's EFFECTIVE ability scores — base scores plus
// equipment/feature stat bonuses and overrides — as a pure function of
// whatever the caller hands in. This file does NOT read party_items.json
// or any other src/data/ file itself (that would break engine/'s whole
// point: portable, framework-free, no dependency on this app's specific
// file layout). The caller (server.js, which already has party_items.json
// on disk, or eventually a Godot-side equivalent) is responsible for
// filtering down to "items equipped by this character" and passing that
// list in — see equippedItems' own doc below.
//
// Mirrors src/utils/dnd_utils.js's resolveStats() ability-score-resolution
// passes (stat_overrides, then item stat_bonuses, then feature
// stat_bonuses) exactly, scoped to just the 6 ability scores — that
// function also resolves AC/initiative/derived-bonus fields, which are a
// display concern this engine-side function has no reason to duplicate.
//
// Built 2026-09-25 after a real bug: diffLevelUp.js's uses_formula
// resolution (Divine Sense's "1 + CHA modifier") used base stat_cha only,
// producing a wrong answer for any character with an equipped item that
// boosts that ability — because engine/ had no path to that information
// at all. The fix isn't giving engine/ file access; it's the caller
// supplying the right input, same as it already supplies `character`,
// `className`, `toLevel`, etc. See engine/CHECKLIST.md's 2026-09-25 entry.

const SCORE_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

// equippedItems: a plain array of item-shaped objects (stat_overrides?,
// stat_bonuses?) already filtered to ones this character has equipped —
// NOT raw party_items.json (the caller filters by equipped_by first,
// exactly like dnd_utils.js's resolveStats does before this point).
function resolveEffectiveScores(character, equippedItems = []) {
  const scores = {}
  for (const key of SCORE_KEYS) {
    scores[key] = character[`stat_${key}`] ?? 10
  }

  // Pass 1 — stat_overrides set a score to a fixed value (e.g. Amulet of
  // Health: con -> 19), regardless of base.
  for (const item of equippedItems) {
    if (!item.stat_overrides) continue
    for (const [key, val] of Object.entries(item.stat_overrides)) {
      if (key in scores) scores[key] = val
    }
  }

  // Pass 2 — item stat_bonuses ADD to the score.
  for (const item of equippedItems) {
    if (!item.stat_bonuses) continue
    for (const [key, val] of Object.entries(item.stat_bonuses)) {
      if (SCORE_KEYS.includes(key)) scores[key] = (scores[key] ?? 10) + val
    }
  }

  // Pass 3 — feature stat_bonuses ADD to the score (e.g. Elven Accuracy).
  for (const feature of character.features ?? []) {
    if (!feature.stat_bonuses) continue
    for (const [key, val] of Object.entries(feature.stat_bonuses)) {
      if (SCORE_KEYS.includes(key)) scores[key] = (scores[key] ?? 10) + val
    }
  }

  return scores
}

module.exports = { resolveEffectiveScores }
