// Attunement (campaign ruling, 2026-10-08): an item that needs attunement but
// isn't attuned keeps its plain enchantment — a Sword +2 is still +2, Full
// Plate +2 still +2 AC — but grants none of its special effects: no stat
// bonuses or overrides, no granted proficiencies, spells, advantages or
// weapon effects.
//
// `applyAttunement(items)` is the one place that says which fields are
// "special effects". The sheet builds its equipped-item list through it
// (dnd_utils `_equippedOnly`), so every stat, AC, check and attack that reads
// those items sees the right thing without each rule re-checking attunement.
//
// Items that don't need attunement, and attuned ones, pass through untouched.
// No dependencies — browser code require()s this directly.

// Everything an unattuned item must NOT contribute. (Not listed on purpose:
// enhancement_bonus — the plain +N — and the base weapon/armor facts such as
// armor_type, armor_base_ac, weapon_category, damage_dice, slot.)
const EFFECT_FIELDS = [
  'stat_bonuses',
  'stat_overrides',
  'unarmored_stat_bonuses',
  'unarmored_armor_base_ac',
  'grants_initiative_advantage',
  'grants_skill_advantage',
  'grants_skill_proficiency',
  'grants_weapon_proficiency',
  'spells_granted',
  'features_granted',
  'extra_damage',
  'weapon_effects',
  'returning',
]

function isAttunementActive(item) {
  return !item.needs_attunement || !!item.attuned
}

function applyAttunement(items) {
  return items.map((item) => {
    if (isAttunementActive(item)) return item
    const stripped = { ...item }
    for (const field of EFFECT_FIELDS) delete stripped[field]
    return stripped
  })
}

module.exports = { EFFECT_FIELDS, isAttunementActive, applyAttunement }
