// Resolves a weapon item's full mechanical properties against the canonical
// PHB table (data/5e/weapons.json), with the item's own fields overriding
// defaults, and an optional homebrew weapon-type table for anything not in
// the PHB (a homebrew weapon this campaign has added — e.g. a "saber" that
// counts as a rapier for proficiency). Extracted from src/utils/dnd_utils.js's
// `_weaponProps` 2026-09-30 — see engine/CHECKLIST.md's entry that day.
//
// This file does NOT read src/data/weapon_types_and_languages.json itself
// (engine/'s whole point: portable, no dependency on this app's specific
// file layout) — the caller passes homebrew weapon types in as a plain
// map, same "caller supplies the input" pattern as equippedItems elsewhere
// in this project's engine/ modules.

const weaponTable = require('../../data/5e/weapons.json')

// homebrewWeaponTypes: { [category]: {weapon_type?, damage_dice?, ...} } —
// same shape as a PHB weapons.json entry, keyed by the homebrew weapon's own
// id/category string (matches weapon.weapon_category on the item).
function weaponProps(weapon, homebrewWeaponTypes = {}) {
  const base =
    weaponTable[weapon.weapon_category] ??
    homebrewWeaponTypes[weapon.weapon_category] ??
    {}
  return {
    weapon_type:
      weapon.weapon_type ??
      base.weapon_type ??
      (weapon.slot?.startsWith('ranged') ? 'ranged' : 'melee'),
    damage_dice: weapon.damage_dice ?? base.damage_dice ?? '1d4',
    damage_dice_2h: weapon.damage_dice_2h ?? base.damage_dice_2h ?? null,
    damage_type: weapon.damage_type ?? base.damage_type ?? null,
    // 'simple' | 'martial' | null (null only for old items predating this
    // field, or a homebrew weapon that never got one set) — used by
    // isProficientWithWeapon below.
    category: weapon.category ?? base.category ?? null,
    // A homebrew weapon can piggyback on a real weapon's proficiency
    // instead of (or in addition to) its own category — e.g. a Saber's
    // real text: "Anyone proficient with a rapier can proficiently wield
    // a saber."
    counts_as_proficiency:
      weapon.counts_as_proficiency ?? base.counts_as_proficiency ?? null,
    finesse: weapon.finesse ?? base.finesse ?? false,
    versatile: weapon.versatile ?? base.versatile ?? false,
    thrown: weapon.thrown ?? base.thrown ?? null,
    returning: weapon.returning ?? false,
    // PHB p. 148: a silvered weapon overcomes the damage resistance (or
    // immunity) some creatures — lycanthropes, certain devils — have to
    // nonmagical weapons. A property of this particular item, not of the
    // weapon type, so it's read off the item. The engine doesn't apply it
    // (resistance lives on the target), it just tracks and shows it.
    silvered: weapon.silvered === true,
  }
}

// Whether `character` is proficient with `weapon` — checks the broad
// simple/martial category, the weapon's own category-name as a specific
// proficiency (e.g. "longbow"), and any counts_as_proficiency alias
// (homebrew weapons piggybacking on a real weapon's proficiency).
// Case-insensitive since weapon_proficiencies has historically mixed
// casing across characters.
const WEAPON_CATEGORY_ALIASES = { staff: 'quarterstaff' }

function isProficientWithWeapon(
  character,
  weapon,
  homebrewWeaponTypes = {},
  equippedItems = []
) {
  const props = weaponProps(weapon, homebrewWeaponTypes)
  // Proficiency can also come from a worn item (Bracers of Archery: longbow and
  // shortbow) — only while its effects are active (see attunement.js).
  const profs = new Set(
    [
      ...(character.weapon_proficiencies ?? []),
      ...equippedItems.flatMap((i) => i.grants_weapon_proficiency ?? []),
    ].map((p) => p.toLowerCase())
  )
  if (props.category && profs.has(props.category)) return true
  // A magic "staff" (Staff of Power, Staff of Evocation) is a quarterstaff.
  const specific = WEAPON_CATEGORY_ALIASES[weapon.weapon_category] ?? weapon.weapon_category
  if (specific && profs.has(specific.toLowerCase())) return true
  if (
    props.counts_as_proficiency &&
    profs.has(props.counts_as_proficiency.toLowerCase())
  )
    return true
  return false
}

module.exports = { weaponProps, isProficientWithWeapon }
