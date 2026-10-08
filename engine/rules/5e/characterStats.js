// Resolves a character's EFFECTIVE stats — base ability scores plus
// equipment/feature stat_bonuses and stat_overrides, aggregated into THREE
// buckets: `scores` (the 6 ability scores themselves), `bonuses` (flat
// bonuses to derived stats — ac, initiative, melee_attack, saving_throws,
// proficiency_bonus, etc.), and `unarmoredBonuses` (bonuses that only apply
// while NOT wearing armor, e.g. a Monk's Belt adding CON to AC). Pure
// function of whatever the caller hands in — does NOT read party_items.json
// or any other src/data/ file itself (engine/'s whole point: portable,
// framework-free, no dependency on this app's specific file layout). The
// caller is responsible for filtering down to "items equipped by this
// character" and passing that list in.
//
// This is the FULL version of what abilityScores.js's resolveEffectiveScores
// does — that function used to be the only piece of this logic in engine/,
// scoped down to just the 6 ability scores with a comment justifying the
// AC/attack/damage/saving-throw side as "a display concern" not worth
// duplicating into engine/. That reasoning was wrong: those bonuses are the
// exact same kind of rule (item/feature grants a flat bonus, aggregate it)
// as the ability-score passes, not a UI concern — see engine/CHECKLIST.md's
// 2026-09-30 entry for the full story of catching this. resolveEffectiveScores
// now just calls this function and returns its `.scores`, so the two stay
// in sync by construction rather than by two people remembering to update
// both.
//
// Mirrors src/utils/dnd_utils.js's resolveStats() exactly (same 3 passes,
// same key routing) — that function is now a thin call into this one.

const SCORE_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SCORE_KEY_SET = new Set(SCORE_KEYS)

function resolveEffectiveStats(character, equippedItems = []) {
  const scores = {}
  for (const key of SCORE_KEYS) {
    scores[key] = character[`stat_${key}`] ?? 10
  }
  const bonuses = {}
  const unarmoredBonuses = {}

  // Pass 1 — stat_overrides set a score to a fixed value (e.g. Amulet of
  // Health: con -> 19). RAW (Amulet of Health, Gauntlets of Ogre Power, ...):
  // "no effect if your score is already that high or higher" — so an override
  // can raise a score but never lower it. Only ability scores can be
  // overridden this way (there's no "override AC to a fixed value" concept).
  for (const item of equippedItems) {
    if (!item.stat_overrides) continue
    for (const [key, val] of Object.entries(item.stat_overrides)) {
      if (key in scores) scores[key] = Math.max(scores[key], val)
    }
  }

  // Pass 2 — item stat_bonuses ADD to a score if the key is one of the 6
  // abilities, otherwise it's a derived-stat bonus (ac, initiative, ...).
  // unarmored_stat_bonuses is the same idea, but only counts while the
  // character isn't wearing body armor (checked by the caller, e.g. AC).
  for (const item of equippedItems) {
    if (item.stat_bonuses) {
      for (const [key, val] of Object.entries(item.stat_bonuses)) {
        if (SCORE_KEY_SET.has(key)) {
          scores[key] = (scores[key] ?? 10) + val
        } else {
          bonuses[key] = (bonuses[key] ?? 0) + val
        }
      }
    }
    if (item.unarmored_stat_bonuses) {
      for (const [key, val] of Object.entries(item.unarmored_stat_bonuses)) {
        unarmoredBonuses[key] = (unarmoredBonuses[key] ?? 0) + val
      }
    }
  }

  // Pass 3 — feature stat_bonuses (e.g. Elven Accuracy +1 DEX), same
  // ability-vs-derived-stat routing as pass 2.
  for (const feature of character.features ?? []) {
    if (!feature.stat_bonuses) continue
    for (const [key, val] of Object.entries(feature.stat_bonuses)) {
      if (SCORE_KEY_SET.has(key)) {
        scores[key] = (scores[key] ?? 10) + val
      } else {
        bonuses[key] = (bonuses[key] ?? 0) + val
      }
    }
  }

  return { scores, bonuses, unarmoredBonuses }
}

module.exports = { resolveEffectiveStats }
