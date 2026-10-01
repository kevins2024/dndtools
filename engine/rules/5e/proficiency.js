// Effective proficiency bonus: base (class/level table, or a character's own
// override field) + any flat item/feature bonus already folded into
// `bonuses.proficiency_bonus` by characterStats.js's resolveEffectiveStats
// (e.g. an Ioun Stone of Mastery). Extracted from src/utils/dnd_utils.js's
// `_prof` 2026-09-30 — shared by saving throws, skills, spell attack/DC,
// and weapon attack bonus, all of which used to duplicate this exact
// 2-line formula inline before calling it. See engine/CHECKLIST.md's entry
// that day.

const { proficiencyBonus } = require('./progression')
const { bonusLines } = require('./breakdown')

// equippedItems is optional here (unlike every other breakdown function in
// this family) because effectiveProficiencyBonus's existing callers only
// ever had `bonuses` on hand, not the raw item list — passing it is what
// lets the breakdown name which item granted the bonus; omitting it just
// means that one line reads "Item/feature bonus" instead of a specific name.
function effectiveProficiencyBonusBreakdown(
  character,
  bonuses = {},
  equippedItems = []
) {
  const base = character.proficiency_bonus ?? proficiencyBonus(character.level)
  const breakdown = [
    {
      label:
        character.proficiency_bonus != null
          ? 'Manual override'
          : `Level ${character.level ?? 1}`,
      amount: base,
    },
  ]
  const namedLines = [
    ...bonusLines(equippedItems, 'proficiency_bonus'),
    ...bonusLines(character.features, 'proficiency_bonus'),
  ]
  const itemBonus = bonuses.proficiency_bonus ?? 0
  if (namedLines.length) {
    breakdown.push(...namedLines)
  } else if (itemBonus) {
    breakdown.push({ label: 'Item/feature bonus', amount: itemBonus })
  }
  return { value: base + itemBonus, breakdown }
}

function effectiveProficiencyBonus(character, bonuses = {}) {
  return effectiveProficiencyBonusBreakdown(character, bonuses).value
}

module.exports = {
  effectiveProficiencyBonus,
  effectiveProficiencyBonusBreakdown,
}
