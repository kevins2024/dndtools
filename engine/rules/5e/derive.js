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
const { deriveAbilityScores, hasRecordedBase } = require('./abilityDerive')
const { featureHpBonus, featureHpLines } = require('./hpBonuses')
const { resolveEffectiveStats } = require('./characterStats')
const { exhaustionEffects } = require('./exhaustion')
const { proficiencyBonus } = require('./progression')
const { traitsFor } = require('./species')
const { rulesetOf } = require('./rulesetId')

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

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`)

// Maximum HP as the rules compute it, with the lines for a tooltip. RAW (2014 and
// 2024): your maximum is the sum of your hit-die results plus your CURRENT
// Constitution modifier for every level you have, "as though you had the new modifier
// from 1st level". So an item that changes Constitution while it is worn changes
// the maximum at once and retroactively, and taking it off takes that away again —
// it is not tied to when the item was put on.
//
//   value          the maximum with items as worn now, before any temporary effect
//   effectiveValue value with `hp_max_modifier` (Aid, drains) and exhaustion applied
//   baseValue      the maximum with no item effects (what the stored hp_max copy holds)
function maxHpBreakdown(character, equippedItems = []) {
  const recordedScores = deriveAbilityScores(character)
  const { scores: effective } = resolveEffectiveStats(character, equippedItems)
  const baseScores =
    recordedScores ??
    Object.fromEntries(
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => [
        k,
        character[`stat_${k}`] ?? 10,
      ])
    )
  const levels = totalLevel(character)
  const recorded = (character.level_history || [])
    .filter((e) => e.kind === 'level' && typeof e.hp?.die === 'number')
    .reduce((n, e) => n + e.hp.die, 0)
  const unrecorded = character.hp_unrecorded_dice || 0
  const baseMod = abilityModifier(baseScores.con)
  const effMod = abilityModifier(effective.con)
  const speciesPerLevel = traitsFor(
    character.genus,
    character.subgenus,
    rulesetOf(character)
  ).reduce((n, t) => n + (t.grants_hp_per_level || 0), 0)
  const featureLines = featureHpLines(
    character.features || [],
    character.classes || []
  )

  const lines = []
  if (recorded)
    lines.push({ label: 'Hit dice rolled or averaged', amount: recorded })
  if (unrecorded)
    lines.push({ label: 'Hit dice (results not recorded)', amount: unrecorded })
  lines.push({
    label: `CON modifier ${signed(baseMod)} x ${levels} levels`,
    amount: baseMod * levels,
  })
  if (speciesPerLevel)
    lines.push({
      label: `Species (+${speciesPerLevel} x ${levels} levels)`,
      amount: speciesPerLevel * levels,
    })
  lines.push(...featureLines)
  const baseValue = lines.reduce((n, l) => n + l.amount, 0)

  const itemDelta = (effMod - baseMod) * levels
  if (itemDelta) {
    const names = equippedItems
      .filter((i) => i.stat_overrides?.con || i.stat_bonuses?.con)
      .map((i) => i.name)
      .join(', ')
    lines.push({
      label: `${names || 'Items'}: CON ${baseScores.con} -> ${
        effective.con
      } (modifier ${signed(effMod - baseMod)} x ${levels} levels)`,
      amount: itemDelta,
    })
  }
  const value = baseValue + itemDelta

  const extra = []
  const ex = exhaustionEffects(character.exhaustion_level, rulesetOf(character))
  let effectiveValue = value
  if (character.hp_max_modifier) {
    effectiveValue += character.hp_max_modifier
    extra.push({
      label: 'Temporary change to maximum',
      amount: character.hp_max_modifier,
    })
  }
  if (ex.hpMaxHalved) {
    const half = Math.floor(effectiveValue / 2)
    extra.push({
      label: 'Exhaustion (maximum halved)',
      amount: half - effectiveValue,
    })
    effectiveValue = half
  }
  return {
    value,
    baseValue,
    effectiveValue,
    breakdown: lines,
    effectiveBreakdown: [...lines, ...extra],
  }
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
  maxHpBreakdown,
  deriveCharacter,
  hydrateCharacter,
  hasRecordedBase,
}
