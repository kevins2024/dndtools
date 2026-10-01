// Pure procedural encounter-balancing math, extracted from
// src/utils/encounter_utils.js 2026-09-30 (see engine/CHECKLIST.md's entry
// that day for the full story) — genuinely custom/homebrew tool logic, not
// D&D RAW, so this lives directly under engine/rules/ rather than
// engine/rules/5e/, matching how npcBuilder.js/combatTurn.js/pointBuy.js
// already do.
//
// Deliberately does NOT include the rest of encounter_utils.js's surface:
// bestiary lookups (pickBestiaryMonster/getBestiaryPool) read
// src/data/monsters_index.json, outside engine/'s own data/ folder on
// purpose (the Godot-portability boundary this project holds elsewhere —
// see abilityScores.js's header comment for the same reasoning applied to
// party_items.json); generateEncounter/regenerateEnemy make real network
// calls to /api/engine/build-npc and are genuinely UI-side orchestration,
// not pure computation. Only the fully self-contained "given party data,
// compute a number" functions moved here — traced dependency-by-dependency
// before moving anything, not a wholesale file relocation.
//
// src/utils/encounter_utils.js re-exports these (see its own header
// comment on this) so every existing consumer (EncounterGenerator.vue,
// CombatContext.vue) needed zero import-path changes.

const { abilityModifier } = require('./5e/abilities')
const { proficiencyBonus } = require('./5e/progression')

// Target hit% per difficulty — drives attack bonus calibration. Exported
// because calibrateAttackBonus (still in encounter_utils.js — it builds a
// generated NPC's stat block, not pure party analysis) shares this same
// table rather than duplicating it.
const TARGET_HIT_PCT = {
  trivial: 0.35,
  easy: 0.45,
  medium: 0.55,
  hard: 0.65,
  deadly: 0.72,
}

// Average party AC by level (5e baseline). Index = level.
// This campaign adds PARTY_AC_ITEM_BONUS on top for generous magic items.
const BASE_PARTY_AC = [
  0, 13, 13, 13, 14, 14, 15, 15, 15, 16, 16, 17, 17, 17, 18, 18, 19, 19, 19, 20,
  20,
]
const PARTY_AC_ITEM_BONUS = 2

// How easily the party should hit enemies at each difficulty tier
const PARTY_HIT_PCT = {
  trivial: 0.8,
  easy: 0.7,
  medium: 0.6,
  hard: 0.5,
  deadly: 0.4,
}
// How often party spells should land (enemy fails save) at each tier
const SPELL_LAND_PCT = {
  trivial: 0.75,
  easy: 0.65,
  medium: 0.55,
  hard: 0.45,
  deadly: 0.35,
}

// Summarizes a party's rough combat capability — average level, estimated
// AC/attack bonus/spell DC, and which broad roles (healer/arcane/martial/
// control/AOE) are present — used to calibrate generated encounters to the
// party's actual power level rather than just their character level.
function analyzeParty(partyCharacters) {
  if (!partyCharacters?.length) {
    return {
      avgLevel: 5,
      estimatedAC: 17,
      avgAtkBonus: 7,
      avgSpellDC: 14,
      hasHealer: false,
      hasArcane: false,
      hasMartial: true,
      hasControl: false,
      hasAOE: false,
    }
  }
  const avgLevel =
    partyCharacters.reduce((a, c) => a + (c.level ?? 1), 0) /
    partyCharacters.length
  const lvlIdx = Math.min(20, Math.round(avgLevel))
  const estimatedAC = (BASE_PARTY_AC[lvlIdx] ?? 15) + PARTY_AC_ITEM_BONUS

  const classes = partyCharacters.flatMap((c) =>
    (c.classes ?? []).map((cl) => (cl.name ?? '').toLowerCase())
  )
  const hasHealer = classes.some((c) =>
    ['cleric', 'druid', 'paladin', 'bard'].includes(c)
  )
  const hasArcane = classes.some((c) =>
    ['wizard', 'sorcerer', 'warlock', 'artificer', 'bard'].includes(c)
  )
  const hasMartial = classes.some((c) =>
    ['fighter', 'barbarian', 'paladin', 'ranger', 'monk', 'rogue'].includes(c)
  )
  const hasControl = hasArcane || classes.includes('bard')
  const hasAOE = classes.some((c) =>
    ['sorcerer', 'wizard', 'druid', 'bard'].includes(c)
  )

  // Per-character best attack bonus (higher of physical or spell attack)
  const atkBonuses = partyCharacters.map((c) => {
    const prof = c.proficiency_bonus ?? proficiencyBonus(c.level ?? 1)
    const strMod = c.stat_str ? abilityModifier(c.stat_str) : 0
    const dexMod = c.stat_dex ? abilityModifier(c.stat_dex) : 0
    const physAtk = Math.max(strMod, dexMod) + prof
    return c.spell_attack_bonus != null
      ? Math.max(physAtk, c.spell_attack_bonus)
      : physAtk
  })

  // Per-character best spell save DC (explicit or estimated from best casting stat)
  const dcValues = partyCharacters.map((c) => {
    if (c.spell_save_dc != null) return c.spell_save_dc
    const prof = c.proficiency_bonus ?? proficiencyBonus(c.level ?? 1)
    const intMod = c.stat_int ? abilityModifier(c.stat_int) : 0
    const wisMod = c.stat_wis ? abilityModifier(c.stat_wis) : 0
    const chaMod = c.stat_cha ? abilityModifier(c.stat_cha) : 0
    return 8 + prof + Math.max(intMod, wisMod, chaMod)
  })

  const avgAtkBonus = Math.round(
    atkBonuses.reduce((a, b) => a + b, 0) / atkBonuses.length
  )
  const avgSpellDC = Math.round(
    dcValues.reduce((a, b) => a + b, 0) / dcValues.length
  )

  return {
    avgLevel,
    estimatedAC,
    avgAtkBonus,
    avgSpellDC,
    hasHealer,
    hasArcane,
    hasMartial,
    hasControl,
    hasAOE,
  }
}

// What enemy stats should look like at a given difficulty, given the party profile
function enemyBenchmarks(profile, difficulty) {
  const partyHitPct = PARTY_HIT_PCT[difficulty] ?? 0.6
  const spellLandPct = SPELL_LAND_PCT[difficulty] ?? 0.55
  return {
    // Enemy atk bonus to hit party AC at this difficulty's target hit rate
    enemyAtk: Math.round(
      profile.estimatedAC - (21 - (TARGET_HIT_PCT[difficulty] ?? 0.55) * 20)
    ),
    // Enemy AC such that party hits at the target rate
    enemyAC: Math.round(profile.avgAtkBonus + (21 - partyHitPct * 20)),
    // Enemy save mod such that party spells land at the target rate
    enemySave: Math.round(profile.avgSpellDC - spellLandPct * 20 - 1),
  }
}

// Min/max HP a level-`level` character could plausibly have (d8 hit die,
// CON 10-14) — used to sanity-check party HP estimates, not a real
// character's actual HP.
function calcHP(level, hitDie, conMod) {
  const first = hitDie + conMod
  const perLevel = Math.ceil(hitDie / 2) + 1 + conMod
  return Math.max(level, first + (level - 1) * perLevel)
}

function estimatePartyHP(level) {
  const minHP = calcHP(level, 8, 0)
  const maxHP = calcHP(level, 8, 2)
  return { minHP, maxHP }
}

module.exports = {
  TARGET_HIT_PCT,
  analyzeParty,
  enemyBenchmarks,
  estimatePartyHP,
}
