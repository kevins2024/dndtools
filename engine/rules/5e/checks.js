// Saving throws, skills, passive perception, initiative, and spell attack/
// save DC — extracted from src/utils/dnd_utils.js 2026-09-30 (see
// engine/CHECKLIST.md's entry that day for the broader story: these all
// already called the fixed resolveStats()/resolveEffectiveStats, this pass
// moves their own arithmetic in too, matching the AC precedent).
//
// Saving throws, skills, passive perception, and spell attack/DC each got a
// breakdown sibling in a follow-up pass the same day (AC's tooltip pattern
// extended, per the project owner's stated direction that every derived
// stat should eventually have one) — `xBreakdown(...)` returns
// `{ value, breakdown }` exactly like armorClass.js's `computeAC`, and the
// plain `x(...)` function is now just `xBreakdown(...).value`, so there's
// still only one implementation of each formula. Initiative was left alone
// — nothing in the UI has ever shown an initiative tooltip, so there was no
// real duplication to fix and no established format to match.
//
// equippedItems: items already filtered to "equipped by this character" —
// same contract as characterStats.js/armorClass.js/weaponSets.js.

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')
const { effectiveProficiencyBonus } = require('./proficiency')
const { bonusLines } = require('./breakdown')

// ── Saving throws ──────────────────────────────────────────────────────────

function savingThrowBreakdown(character, statKey, equippedItems = []) {
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  const base = abilityModifier(scores[statKey])
  const prof = effectiveProficiencyBonus(character, bonuses)
  const isProficient = (character.saving_throws ?? []).includes(statKey)

  const breakdown = [{ label: `${statKey.toUpperCase()} mod`, amount: base }]
  if (isProficient) breakdown.push({ label: 'Proficiency', amount: prof })
  breakdown.push(
    ...bonusLines(equippedItems, 'saving_throws'),
    ...bonusLines(character.features, 'saving_throws')
  )

  const value = base + (isProficient ? prof : 0) + (bonuses.saving_throws ?? 0)
  return { value, breakdown }
}

function savingThrow(character, statKey, equippedItems = []) {
  return savingThrowBreakdown(character, statKey, equippedItems).value
}

function allSavingThrows(character, equippedItems = []) {
  return Object.fromEntries(
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => [
      k,
      savingThrow(character, k, equippedItems),
    ])
  )
}

// ── Skills ──────────────────────────────────────────────────────────────────

const SKILL_MAP = {
  Acrobatics: 'dex',
  AnimalHandling: 'wis',
  Arcana: 'int',
  Athletics: 'str',
  Deception: 'cha',
  History: 'int',
  Insight: 'wis',
  Intimidation: 'cha',
  Investigation: 'int',
  Medicine: 'wis',
  Nature: 'int',
  Perception: 'wis',
  Performance: 'cha',
  Persuasion: 'cha',
  Religion: 'int',
  SleightOfHand: 'dex',
  Stealth: 'dex',
  Survival: 'wis',
}

function skillBreakdown(character, skillName, equippedItems = []) {
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  const statKey = SKILL_MAP[skillName]
  if (!statKey) return { value: 0, breakdown: [] }

  const base = abilityModifier(scores[statKey])
  const prof = effectiveProficiencyBonus(character, bonuses)
  // Proficiency can come from the character's own training OR from an
  // equipped item (item.grants_skill_proficiency: [names]) — e.g. an
  // armor/wondrous item that teaches a skill while worn. Item-granted
  // proficiency only counts while equipped, unlike a character's own
  // skill_proficiencies, which is why this checks equippedItems separately
  // rather than just merging onto the character record.
  const itemGrantsProficiency = equippedItems.some((i) =>
    (i.grants_skill_proficiency ?? []).includes(skillName)
  )
  const isProficient =
    itemGrantsProficiency ||
    (character.skill_proficiencies ?? []).includes(skillName)
  const hasExpertise = (character.skill_expertise ?? []).includes(skillName)
  // Jack of All Trades (Bard, 2nd level): half proficiency bonus, rounded
  // down, on any ability check that doesn't already include proficiency
  // bonus — i.e. only when NOT otherwise proficient/expert on this skill.
  const hasJackOfAllTrades =
    !isProficient &&
    (character.features ?? []).some(
      (f) => (f.name || '').trim().toLowerCase() === 'jack of all trades'
    )
  const profBonus = hasExpertise
    ? prof * 2
    : isProficient
    ? prof
    : hasJackOfAllTrades
    ? Math.floor(prof / 2)
    : 0
  const itemBonus = bonuses[`skill_${skillName}`] ?? 0

  const breakdown = [{ label: `${statKey.toUpperCase()} mod`, amount: base }]
  if (hasExpertise) {
    breakdown.push({ label: 'Expertise (Prof x2)', amount: profBonus })
  } else if (isProficient) {
    breakdown.push({ label: 'Proficiency', amount: profBonus })
  } else if (hasJackOfAllTrades) {
    breakdown.push({
      label: 'Jack of All Trades (half Prof)',
      amount: profBonus,
    })
  }
  breakdown.push(
    ...bonusLines(equippedItems, `skill_${skillName}`),
    ...bonusLines(character.features, `skill_${skillName}`)
  )

  return { value: base + profBonus + itemBonus, breakdown }
}

function skill(character, skillName, equippedItems = []) {
  return skillBreakdown(character, skillName, equippedItems).value
}

function allSkills(character, equippedItems = []) {
  return Object.fromEntries(
    Object.keys(SKILL_MAP).map((s) => [s, skill(character, s, equippedItems)])
  )
}

// Advantage on a skill's ability checks from an item or feature carrying
// `grants_skill_advantage: ['Perception', ...]` (Sentinel Shield). Like
// initiative advantage, an item only counts while attuned when it needs
// attunement. Advantage can't be a flat number, so this is a separate yes/no
// the roller acts on; the one place it does become a number is passive
// Perception below (PHB: advantage on a passive check is +5).
function skillAdvantage(character, skillName, equippedItems = []) {
  const grants = (x) => (x.grants_skill_advantage ?? []).includes(skillName)
  return (
    equippedItems.some(
      (i) => grants(i) && (!i.needs_attunement || i.attuned)
    ) || (character.features ?? []).some(grants)
  )
}

function passivePerceptionBreakdown(character, equippedItems = []) {
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const perception = skillBreakdown(character, 'Perception', equippedItems)
  const advantage = skillAdvantage(character, 'Perception', equippedItems)
    ? 5
    : 0
  const breakdown = [
    { label: 'Base', amount: 10 },
    { label: 'Perception skill', amount: perception.value },
    ...(advantage ? [{ label: 'Advantage on Perception', amount: 5 }] : []),
    ...bonusLines(equippedItems, 'passive_perception'),
    ...bonusLines(character.features, 'passive_perception'),
  ]
  const value =
    10 + perception.value + advantage + (bonuses.passive_perception ?? 0)
  return { value, breakdown }
}

function passivePerception(character, equippedItems = []) {
  return passivePerceptionBreakdown(character, equippedItems).value
}

// ── Initiative ───────────────────────────────────────────────────────────────

// A feature with `adds_ability_to_initiative: 'int'` (Chronurgy Magic's
// Temporal Awareness: "add your Intelligence modifiers to your initiative
// rolls") adds that ability's modifier on top of DEX. Counted once per
// ability however many features name it, and read off the EFFECTIVE score so
// items/features that change the ability are honored.
function initiative(character, equippedItems = []) {
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  const extraAbilities = new Set(
    (character.features ?? [])
      .map((f) => f.adds_ability_to_initiative)
      .filter(Boolean)
  )
  let extra = 0
  for (const ability of extraAbilities) {
    extra += abilityModifier(scores[ability] ?? 10)
  }
  return abilityModifier(scores.dex) + extra + (bonuses.initiative ?? 0)
}

// Advantage isn't a flat number like the rest of resolveEffectiveStats'
// bonuses, so it can't live in stat_bonuses.initiative — it changes how the
// roll itself is made (roll twice, take the higher), which only the actual
// roller (the UI's combat-turn code) can act on. Checked separately so the
// caller decides how to roll. Item grants only count while attuned when the
// item needs attunement (e.g. a Weapon of Warning does nothing unattuned,
// per RAW) — unlike resolveEffectiveStats' flat bonuses, which don't
// currently gate on attunement at all, this is intentionally stricter for
// the one case that's been explicitly checked against RAW.
function hasInitiativeAdvantage(character, equippedItems = []) {
  const itemGrants = equippedItems.some(
    (i) => i.grants_initiative_advantage && (!i.needs_attunement || i.attuned)
  )
  const featureGrants = (character.features ?? []).some(
    (f) => f.grants_initiative_advantage
  )
  return itemGrants || featureGrants
}

// ── Spellcasting ──────────────────────────────────────────────────────────

function spellAttackBonusBreakdown(character, equippedItems = []) {
  if (!character.spellcasting_ability) return null
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  const ability = character.spellcasting_ability
  const mod = abilityModifier(scores[ability])
  const prof = effectiveProficiencyBonus(character, bonuses)
  const breakdown = [
    { label: `${ability.toUpperCase()} mod`, amount: mod },
    { label: 'Proficiency', amount: prof },
    ...bonusLines(equippedItems, 'spell_attack'),
    ...bonusLines(character.features, 'spell_attack'),
  ]
  return { value: mod + prof + (bonuses.spell_attack ?? 0), breakdown }
}

function spellAttackBonus(character, equippedItems = []) {
  return spellAttackBonusBreakdown(character, equippedItems)?.value ?? null
}

function spellSaveDCBreakdown(character, equippedItems = []) {
  if (!character.spellcasting_ability) return null
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  const ability = character.spellcasting_ability
  const mod = abilityModifier(scores[ability])
  const prof = effectiveProficiencyBonus(character, bonuses)
  const breakdown = [
    { label: 'Base', amount: 8 },
    { label: `${ability.toUpperCase()} mod`, amount: mod },
    { label: 'Proficiency', amount: prof },
    ...bonusLines(equippedItems, 'spell_save_dc'),
    ...bonusLines(character.features, 'spell_save_dc'),
  ]
  return { value: 8 + mod + prof + (bonuses.spell_save_dc ?? 0), breakdown }
}

function spellSaveDC(character, equippedItems = []) {
  return spellSaveDCBreakdown(character, equippedItems)?.value ?? null
}

module.exports = {
  savingThrow,
  savingThrowBreakdown,
  allSavingThrows,
  SKILL_MAP,
  skill,
  skillBreakdown,
  allSkills,
  passivePerception,
  passivePerceptionBreakdown,
  initiative,
  hasInitiativeAdvantage,
  skillAdvantage,
  spellAttackBonus,
  spellAttackBonusBreakdown,
  spellSaveDC,
  spellSaveDCBreakdown,
}
