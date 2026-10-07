// Computes a character's AC and a structured breakdown of every
// contribution to it — extracted from src/utils/dnd_utils.js's _acCompute
// 2026-09-30 (see engine/CHECKLIST.md's entry that day for the full story
// of why this moved: it's real "aggregate bonuses from items/features"
// logic, no different in kind from ability score resolution, not a display
// concern the way it was originally judged to be).
//
// Returns { value, breakdown: [{ label, amount }, ...] } — a plain list of
// contributions, NOT a pre-joined display string. That's deliberate: the
// whole point of moving this here is so ANY future UI (this app's Vue
// sheet today, a Godot sheet later) can render its own tooltip from the
// same breakdown without re-deriving the AC math itself. Building the
// joined string for today's UI is dnd_utils.js's job now, not this
// function's.
//
// equippedItems: items already filtered to "equipped by this character" —
// same contract as characterStats.js's resolveEffectiveStats (the caller
// filters party_items.json down once and reuses that same list for both).

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')
const { armorBaseData } = require('./armor')
const { isDualWieldingMelee } = require('./weaponSets')

// Which unarmored-AC formula applies. An explicit `unarmored_ac_formula`
// on the character always wins ('default' included — a deliberate "no special
// formula"). When it's absent, a Barbarian or Monk with the Unarmored Defense
// feature gets their class's formula: a character built through the New
// Character tool never had the field set, so a freshly made Barbarian's AC
// silently ignored CON (10 + DEX instead of 10 + DEX + CON) until someone
// hand-added it, as had been done for Rhuna. (A Barbarian/Monk multiclass
// can't stack both — Barbarian is checked first.)
// A feature can define its own unarmored AC with `unarmored_defense:
// { abilities: ['dex', 'int'] }` (AC = 10 + those modifiers) — how a
// one-off homebrew feature (Elowenne's Elegant Ward) works without a new
// formula name each time. Ranks below an explicit character formula and
// above the Barbarian/Monk class inference.
function unarmoredDefenseFeature(character) {
  return (
    (character.features ?? []).find((f) => f.unarmored_defense?.abilities) ??
    null
  )
}

function unarmoredFormula(character) {
  if (character.unarmored_ac_formula) return character.unarmored_ac_formula
  if (unarmoredDefenseFeature(character)) return 'feature'
  const hasUnarmoredDefense = (character.features ?? []).some(
    (f) => f.name === 'Unarmored Defense'
  )
  if (!hasUnarmoredDefense) return 'default'
  const classNames = (character.classes ?? []).map((c) => c.name)
  if (classNames.includes('Barbarian')) return 'barbarian'
  if (classNames.includes('Monk')) return 'monk'
  return 'default'
}

function computeAC(
  character,
  equippedItems = [],
  { bladesongActive = false } = {}
) {
  const { scores, bonuses, unarmoredBonuses } = resolveEffectiveStats(
    character,
    equippedItems
  )

  const armorItem = equippedItems.find(
    (i) => i.type === 'armor' && i.slot === 'body'
  )
  const isWearingArmor = !!armorItem
  const dexMod = abilityModifier(scores.dex)
  const conMod = abilityModifier(scores.con)
  const wisMod = abilityModifier(scores.wis)
  const intMod = abilityModifier(scores.int)
  const breakdown = []
  let base
  let statUnarmoredBonus = 0

  if (isWearingArmor) {
    const armorData = armorBaseData(armorItem.armor_type)
    const category = armorData?.category ?? armorItem.armor_type
    const armorBaseAc = armorItem.armor_base_ac ?? armorData?.base ?? 10
    const magicBonus = armorItem.enhancement_bonus ?? 0
    const magicStr = magicBonus ? `, +${magicBonus} enhancement` : ''

    switch (category) {
      case 'heavy':
        base = armorBaseAc + magicBonus
        breakdown.push({
          label: `${armorItem.name} (base ${armorBaseAc}${magicStr})`,
          amount: base,
        })
        break
      case 'medium': {
        const dexCapped = Math.min(dexMod, 2)
        base = armorBaseAc + magicBonus + dexCapped
        breakdown.push({
          label: `${armorItem.name} (base ${armorBaseAc}${magicStr})`,
          amount: armorBaseAc + magicBonus,
        })
        breakdown.push({ label: 'DEX (cap 2)', amount: dexCapped })
        break
      }
      default: {
        base = armorBaseAc + magicBonus + dexMod
        breakdown.push({
          label: `${armorItem.name} (base ${armorBaseAc}${magicStr})`,
          amount: armorBaseAc + magicBonus,
        })
        breakdown.push({ label: 'DEX', amount: dexMod })
        break
      }
    }
  } else {
    const unarmoredAcItem = equippedItems.find(
      (i) => i.unarmored_armor_base_ac != null
    )
    if (unarmoredAcItem) {
      base = unarmoredAcItem.unarmored_armor_base_ac + dexMod
      breakdown.push({
        label: `${unarmoredAcItem.name} (base ${unarmoredAcItem.unarmored_armor_base_ac})`,
        amount: unarmoredAcItem.unarmored_armor_base_ac,
      })
      breakdown.push({ label: 'DEX', amount: dexMod })
    } else if (unarmoredFormula(character) === 'feature') {
      const feature = unarmoredDefenseFeature(character)
      const mods = feature.unarmored_defense.abilities.map((a) =>
        abilityModifier(scores[a])
      )
      base = 10 + mods.reduce((sum, m) => sum + m, 0)
      const names = feature.unarmored_defense.abilities
        .map((a) => a.toUpperCase())
        .join(' + ')
      breakdown.push({
        label: `${feature.name} (10 + ${names})`,
        amount: base,
      })
    } else if (unarmoredFormula(character) === 'monk') {
      base = 10 + dexMod + wisMod
      breakdown.push({ label: 'Monk Defense (10 + DEX + WIS)', amount: base })
    } else if (unarmoredFormula(character) === 'barbarian') {
      base = 10 + dexMod + conMod
      breakdown.push({
        label: 'Barbarian Defense (10 + DEX + CON)',
        amount: base,
      })
    } else {
      base = 10 + dexMod
      breakdown.push({ label: 'Unarmored (10 + DEX)', amount: base })
    }

    // Stat-mod unarmored bonuses (e.g. Monk's Belt adds CON mod)
    if (unarmoredBonuses.ac_unarmored_con) {
      const src = equippedItems.find(
        (i) => i.unarmored_stat_bonuses?.ac_unarmored_con
      )
      breakdown.push({ label: `${src?.name ?? 'Item'}: CON`, amount: conMod })
      statUnarmoredBonus += conMod
    }
  }

  const shieldItem = equippedItems.find((i) => i.armor_type === 'shield')
  const shieldEnhancement = shieldItem ? shieldItem.enhancement_bonus ?? 0 : 0
  const shieldBonus = shieldItem ? 2 + shieldEnhancement : 0
  if (shieldItem) {
    breakdown.push({ label: shieldItem.name, amount: shieldBonus })
  }

  // Per-item flat AC bonuses (ring of protection, cloak of protection, bracers of defense, etc.)
  for (const item of equippedItems) {
    const bonus = item.stat_bonuses?.ac ?? 0
    const unarmoredBonus = !isWearingArmor
      ? item.unarmored_stat_bonuses?.ac ?? 0
      : 0
    const total = bonus + unarmoredBonus
    if (total) breakdown.push({ label: item.name, amount: total })
  }

  // Per-feature flat AC bonuses (e.g. Fighting Style: Defense) — shown in
  // the breakdown for clarity, but NOT accumulated into a separate total
  // added to `value` below. Real bug found + fixed 2026-09-30 (see
  // engine/CHECKLIST.md): the pre-migration code DID keep a separate
  // `featureAcBonus` running total and added it into `value` on top of
  // `bonuses.ac` — but `resolveEffectiveStats`' own pass 3 already folds
  // every feature's stat_bonuses.ac into that same `bonuses.ac`, so the
  // old code silently double-counted any feature-granted AC bonus. A
  // 2026-09-09 comment on the original code justified the separate total
  // by saying resolveStats' bonuses.ac only counted ITEM bonuses, not
  // feature ones — true when that comment was written, but resolveStats
  // gained its feature pass sometime after, and nobody re-checked this
  // function's own assumption against it. Confirmed via a full roster
  // sweep: affected exactly one character (Chuknora, Fighting Style:
  // Defense, +1 AC overstated).
  for (const feature of character.features ?? []) {
    const bonus = feature.stat_bonuses?.ac ?? 0
    if (bonus) breakdown.push({ label: feature.name, amount: bonus })
  }

  // Dual Wielder's +1 AC — conditional on the character's CURRENT loadout
  // (weapon-set aware), not a flat feat bonus, so it can't live in
  // stat_bonuses.ac the same way as the loop just above.
  let dualWielderAcBonus = 0
  const hasDualWielder = (character.features ?? []).some(
    (f) => (f.name || '').trim().toLowerCase() === 'dual wielder'
  )
  if (hasDualWielder && isDualWieldingMelee(character, equippedItems)) {
    dualWielderAcBonus = 1
    breakdown.push({ label: 'Dual Wielder', amount: dualWielderAcBonus })
  }

  const bladesongBonus = bladesongActive ? intMod : 0
  if (bladesongActive) {
    breakdown.push({ label: 'Bladesong INT', amount: bladesongBonus })
  }

  const itemAcBonus =
    (bonuses.ac ?? 0) + (isWearingArmor ? 0 : unarmoredBonuses.ac ?? 0)
  const value =
    base +
    shieldBonus +
    itemAcBonus +
    statUnarmoredBonus +
    bladesongBonus +
    dualWielderAcBonus

  return { value, breakdown }
}

module.exports = { computeAC }
