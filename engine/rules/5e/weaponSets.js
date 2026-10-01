// A character can have more than 2 weapons flagged equipped_by them at once
// (e.g. a melee pair AND a ranged pair carried ready to switch to), which a
// flat "equipped_by === character.name" check treats as ALL simultaneously
// in-hand — fine for "is this on my person" (armor, rings, wondrous items),
// wrong for "what am I actually holding right now" (which rules like Dual
// Wielder's conditional AC bonus need). Only `type: 'weapon'` items carry a
// `weapon_set` (1 or 2); everything else ignores the concept entirely and
// stays governed by equipped_by alone. A weapon with no weapon_set set is
// treated as active regardless of which set is current — an unmigrated/
// legacy item, or a deliberately set-agnostic one (e.g. a weapon someone
// always keeps sheathed on their belt in both loadouts).
//
// Extracted from src/utils/dnd_utils.js 2026-09-30 as part of moving AC
// computation into engine/ (AC's Dual Wielder bonus needs this) — see
// engine/CHECKLIST.md's entry that day.

function activeWeaponSet(character) {
  return character.active_weapon_set ?? 1
}

// True if `item` should count as "in hand right now" for this character —
// equipped_by them, and (for weapons specifically) either set-agnostic or
// in the currently active set.
function isActiveEquipped(item, character) {
  if (item.equipped_by !== character.name) return false
  if (item.type !== 'weapon' || item.weapon_set == null) return true
  return item.weapon_set === activeWeaponSet(character)
}

// Real RAW: Dual Wielder's +1 AC applies only "while wielding a separate
// melee weapon in each hand" — two one-handed melee weapons, no shield (a
// shield occupies the second hand, which is exactly what the feat's own
// wording excludes). Doesn't check whether the character actually HAS the
// feat — callers gate on that separately — so this stays a pure "is the
// character's current loadout physically dual-wielding melee" check,
// reusable anywhere else this same condition matters (attack bonuses,
// flavor text, etc.).
function isDualWieldingMelee(character, items = []) {
  const active = items.filter((i) => isActiveEquipped(i, character))
  const hasShield = active.some((i) => i.armor_type === 'shield')
  if (hasShield) return false
  const meleeOneHanded = active.filter(
    (i) => i.type === 'weapon' && i.slot === 'melee1h'
  )
  return meleeOneHanded.length >= 2
}

module.exports = { activeWeaponSet, isActiveEquipped, isDualWieldingMelee }
