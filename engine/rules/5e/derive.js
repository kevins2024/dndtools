// Values that are CALCULATED from what a character record keeps, never stored as
// the source of truth: ability scores, maximum Hit Points, proficiency bonus.
//
// What the record keeps (the facts):
//   ability_base            { str, dex, con, int, wis, cha } — the scores as first generated
//                           (point buy / array / rolls), before any bonus
//   ability_score_history   every change since, each with its source and level:
//                           species, background, Ability Score Improvements, feats,
//                           story rewards or items that changed the score for good
//   level_history[].hp.die  the die result for each level taken (maximum at level 1,
//                           the roll or the average after)
//   hp_unrecorded_dice      die results that were never written down (older sheets):
//                           the sum of those levels' dice, so nothing else has to guess
//   features, classes       for the per-level HP bonuses (Tough, Draconic Resilience)
//   genus / subgenus        for the species HP bonus (Dwarven Toughness)
//
// A record that has `ability_base` opts in: `deriveCharacter` returns the numbers the
// sheet should show, `hydrateCharacter` lays them over the stored copies. The stored
// stat_* / hp_max stay in the file as a convenience for scripts and the UI, and the
// audit fails if they ever disagree with the derivation.
//
// Server and scripts only (species lookup reads data files).

const { abilityModifier } = require('./abilities')
const { featureHpBonus } = require('./hpBonuses')
const { proficiencyBonus } = require('./progression')
const { traitsFor } = require('./species')
const { rulesetOf } = require('./rulesetId')

const KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const hasRecordedBase = (c) =>
  Boolean(c?.ability_base && typeof c.ability_base === 'object')

function deriveAbilityScores(character) {
  if (!hasRecordedBase(character)) return null
  const scores = {}
  for (const k of KEYS) scores[k] = character.ability_base[k] ?? 10
  for (const h of character.ability_score_history || [])
    if (h.ability in scores) scores[h.ability] += h.amount || 0
  return scores
}

function totalLevel(character) {
  return (character.classes || []).reduce((n, c) => n + (c.level || 0), 0)
}

// { total, parts } — parts is the { label, amount } list for a tooltip.
function deriveMaxHp(character, scores) {
  const levels = totalLevel(character)
  const recorded = (character.level_history || [])
    .filter((e) => e.kind === 'level' && typeof e.hp?.die === 'number')
    .reduce((n, e) => n + e.hp.die, 0)
  const unrecorded = character.hp_unrecorded_dice || 0
  const con = abilityModifier(scores.con) * levels
  const speciesPerLevel = traitsFor(
    character.genus,
    character.subgenus,
    rulesetOf(character)
  ).reduce((n, t) => n + (t.grants_hp_per_level || 0), 0)
  const features = featureHpBonus(
    character.features || [],
    character.classes || []
  )
  const parts = [
    { label: 'Hit dice (recorded)', amount: recorded },
    { label: 'Hit dice (not recorded)', amount: unrecorded },
    { label: 'CON modifier', amount: con },
    { label: 'Species bonus', amount: speciesPerLevel * levels },
    { label: 'Feats and features', amount: features },
  ].filter((p) => p.amount !== 0)
  return { total: parts.reduce((n, p) => n + p.amount, 0), parts }
}

// null when the record has not recorded its base scores.
function deriveCharacter(character) {
  const scores = deriveAbilityScores(character)
  if (!scores) return null
  const hp = deriveMaxHp(character, scores)
  return {
    scores,
    stat_str: scores.str,
    stat_dex: scores.dex,
    stat_con: scores.con,
    stat_int: scores.int,
    stat_wis: scores.wis,
    stat_cha: scores.cha,
    hp_max: hp.total,
    hp_breakdown: hp.parts,
    proficiency_bonus: proficiencyBonus(totalLevel(character)),
  }
}

// The character with the derived numbers laid over the stored ones. hp_current is
// kept, but never above the derived maximum.
function hydrateCharacter(character) {
  const d = deriveCharacter(character)
  if (!d) return character
  const { scores, hp_breakdown, ...stored } = d
  return {
    ...character,
    ...stored,
    hp_current: Math.min(character.hp_current ?? stored.hp_max, stored.hp_max),
  }
}

module.exports = {
  deriveAbilityScores,
  deriveMaxHp,
  deriveCharacter,
  hydrateCharacter,
  hasRecordedBase,
}
