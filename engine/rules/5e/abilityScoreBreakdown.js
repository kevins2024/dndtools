// Per-ability breakdown of how a character's effective score was built, for
// the ability-score grid's tooltips. Extracted 2026-10-01 from
// src/utils/dnd_utils.js's statArray, which resolved scores AND walked
// items/features/history to attribute each contribution, then built the
// tooltip string — the attribution is the rule-adjacent half and belongs
// here; the string joining stays in the UI.
//
// Returns one entry per ability:
//   { key, score, mod, modified, base, override, contributions }
//   score          — effective score (after overrides + all bonuses)
//   base           — the implied base: the stored stat_<key> minus every
//                    recorded ability_score_history amount (stat_* means
//                    "the final number" for historical entries; history is
//                    purely a record of how it was built)
//   override       — { name, value } if an item sets the score outright
//                    (e.g. Amulet of Health), else null
//   contributions  — [{ label, amount }]: ASI/feat/racial history first
//                    (label "Source, level N"), then named item and feature
//                    bonuses
//   modified       — anything above applies (override, bonus, or history)
//
// equippedItems: already filtered to "equipped by this character" — same
// contract as every other 5e/ stat-resolution function in this family.
//
// Zero fs/path dependencies — browser code require()s this directly.

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')

const SCORE_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function abilityScoreBreakdown(character, equippedItems = []) {
  const { scores } = resolveEffectiveStats(character, equippedItems)

  return SCORE_KEYS.map((key) => {
    const score = scores[key] ?? 10

    let override = null
    const itemContributions = []
    for (const item of equippedItems) {
      if (item.stat_overrides && key in item.stat_overrides) {
        override = { name: item.name, value: item.stat_overrides[key] }
      }
      const bonus = item.stat_bonuses?.[key]
      if (bonus) itemContributions.push({ label: item.name, amount: bonus })
    }
    for (const feature of character.features ?? []) {
      const bonus = feature.stat_bonuses?.[key]
      if (bonus) itemContributions.push({ label: feature.name, amount: bonus })
    }

    const history = (character.ability_score_history ?? []).filter(
      (h) => h.ability === key
    )
    const historySum = history.reduce((sum, h) => sum + h.amount, 0)

    return {
      key,
      score,
      mod: abilityModifier(score),
      modified:
        itemContributions.length > 0 || override != null || history.length > 0,
      base: (character[`stat_${key}`] ?? 10) - historySum,
      override,
      contributions: [
        ...history.map((h) => ({
          label: `${h.source}, level ${h.level_gained}`,
          amount: h.amount,
        })),
        ...itemContributions,
      ],
    }
  })
}

module.exports = { abilityScoreBreakdown }
