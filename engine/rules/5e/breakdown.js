// Shared helper for engine breakdown functions — generalizes the
// named-item/named-feature loop armorClass.js originated (see its own
// "Per-item flat AC bonuses" comment) so every other breakdown function
// (checks.js, weaponAttack.js, proficiency.js) doesn't reinvent it. Items
// and features both carry `.name` + `.stat_bonuses`, so one function finds
// every named source of a given stat_bonuses key across either list.
//
// These lines are for tooltip clarity ONLY — the actual numeric value a
// breakdown function returns should still come from resolveEffectiveStats'
// lump-sum `bonuses` object, not from summing these lines a second time.
// Doing both was exactly the AC double-counting bug fixed 2026-09-30 (see
// engine/CHECKLIST.md's entry that day) — named lines and the lump total
// are mathematically the same number by construction, so adding both into
// a value counts it twice.
function bonusLines(sources, key) {
  const lines = []
  for (const src of sources ?? []) {
    const amount = src.stat_bonuses?.[key] ?? 0
    if (amount) lines.push({ label: src.name, amount })
  }
  return lines
}

module.exports = { bonusLines }
