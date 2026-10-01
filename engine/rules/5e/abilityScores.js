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
// Just the 6-ability-score slice of characterStats.js's resolveEffectiveStats
// — see that file for the full resolution (scores AND the ac/attack/damage/
// saving-throw bonus buckets together). This function used to duplicate that
// same 3-pass logic itself, scoped down to scores only, with a comment
// justifying the AC/attack/damage side as "a display concern" not worth
// putting in engine/. That reasoning was wrong (see characterStats.js's own
// header for the correction — found 2026-09-30) — now this is just a thin
// convenience wrapper so existing callers asking for "just the scores"
// don't need the full {scores, bonuses, unarmoredBonuses} shape.
//
// Built 2026-09-25 after a real bug: diffLevelUp.js's uses_formula
// resolution (Divine Sense's "1 + CHA modifier") used base stat_cha only,
// producing a wrong answer for any character with an equipped item that
// boosts that ability — because engine/ had no path to that information
// at all. The fix isn't giving engine/ file access; it's the caller
// supplying the right input, same as it already supplies `character`,
// `className`, `toLevel`, etc. See engine/CHECKLIST.md's 2026-09-25 entry.

const { resolveEffectiveStats } = require('./characterStats')

// equippedItems: a plain array of item-shaped objects (stat_overrides?,
// stat_bonuses?) already filtered to ones this character has equipped —
// NOT raw party_items.json (the caller filters by equipped_by first,
// exactly like characterStats.js's resolveEffectiveStats does before this
// point).
function resolveEffectiveScores(character, equippedItems = []) {
  return resolveEffectiveStats(character, equippedItems).scores
}

module.exports = { resolveEffectiveScores }
