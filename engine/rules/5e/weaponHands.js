// Main hand vs. off hand for a character's one-handed weapons. A character
// can have two one-handed weapons in the same loadout (dual wielding) and
// nothing on the record said which was which — which matters for the rules
// that name the off hand (two-weapon fighting's bonus-action attack, "attack
// with your offhand weapon" reactions like Press Momentum) and for simply
// remembering how to hold them at the table. Added 2026-10-03.
//
// Model: a weapon item carries `hand: 'main' | 'off' | null`. Only
// one-handed weapons (slot melee1h / ranged1h) have a hand; two-handed ones
// occupy both, and anything unassigned is `null`. A hand belongs to a
// LOADOUT (weapon_set 1 or 2; a set-less weapon counts in both, matching
// weaponSets.js), so a main-hand weapon in Set 2 doesn't conflict with a
// main-hand weapon in Set 1.
//
// Pure — every function takes the items it should consider (already
// filtered to what this character has equipped, same contract as the rest of
// this family) and returns plain data. Item mutations are returned as
// patches `[{ id, hand }]`; the caller commits them.
//
// Zero dependencies beyond weaponSets.js — browser code require()s this
// directly; see src/utils/weaponHands.js.

const { isActiveEquipped } = require('./weaponSets')

const ONE_HANDED_SLOTS = ['melee1h', 'ranged1h']

function isOneHandedWeapon(item) {
  return item.type === 'weapon' && ONE_HANDED_SLOTS.includes(item.slot)
}

function isTwoHandedWeapon(item) {
  return item.type === 'weapon' && !isOneHandedWeapon(item)
}

// The loadouts (set numbers) an item belongs to: its own set, or both if
// it's set-agnostic.
function setsOf(item) {
  return item.weapon_set == null ? [1, 2] : [item.weapon_set]
}

// One-handed weapons sharing at least one loadout with `item`, excluding it.
function loadoutMates(item, items) {
  const mine = setsOf(item)
  return items.filter(
    (other) =>
      other.id !== item.id &&
      isOneHandedWeapon(other) &&
      setsOf(other).some((s) => mine.includes(s))
  )
}

// Which hand to give `item`, with the knock-on changes needed to keep the
// loadout consistent: only one main and one off per loadout, and when
// exactly one other one-handed weapon shares the loadout, it gets the
// opposite hand automatically (picking Denna's dagger as main makes her
// other dagger the off hand — nobody dual-wields with two main hands).
// hand: 'main' | 'off' | null. Returns patches [{ id, hand }] including the
// item itself; empty for a weapon that has no hand (two-handed, non-weapon).
function setHand(item, items, hand) {
  if (!isOneHandedWeapon(item)) return []
  const patches = new Map([[item.id, hand]])
  if (hand == null) return [...patches].map(([id, h]) => ({ id, hand: h }))

  const mates = loadoutMates(item, items)
  for (const mate of mates) {
    if (mate.hand === hand) patches.set(mate.id, null)
  }
  if (mates.length === 1) {
    patches.set(mates[0].id, hand === 'main' ? 'off' : 'main')
  }
  return [...patches].map(([id, h]) => ({ id, hand: h }))
}

// Next value when the player clicks the hand control: unassigned -> main ->
// off -> unassigned.
function nextHand(current) {
  if (current === 'main') return 'off'
  if (current === 'off') return null
  return 'main'
}

// The patches for one click of the hand control on `item`: advance it
// through unassigned -> main -> off -> unassigned, with the loadout kept
// consistent (see setHand).
function cycleHand(item, items) {
  return setHand(item, items, nextHand(item.hand ?? null))
}

// What's in each hand right now (the character's active loadout, or
// `setNum` to ask about the other one). Returns
//   { main, off, twoHanded, shield, unassigned, ambiguous }
// where main/off/twoHanded/shield are items (or null), unassigned is the
// one-handed weapons with no hand, and `ambiguous` is true when two or more
// one-handed weapons are in hand but hands aren't fully assigned — the case
// the UI should nudge about. A shield occupies the off hand.
function loadoutHands(character, items, setNum = null) {
  const probe =
    setNum == null ? character : { ...character, active_weapon_set: setNum }
  const active = items.filter((i) => isActiveEquipped(i, probe))
  const oneHanded = active.filter(isOneHandedWeapon)
  const shield = active.find((i) => i.armor_type === 'shield') ?? null
  const twoHanded = active.find(isTwoHandedWeapon) ?? null
  const main = oneHanded.find((i) => i.hand === 'main') ?? null
  const offWeapon = oneHanded.find((i) => i.hand === 'off') ?? null
  const unassigned = oneHanded.filter(
    (i) => i.hand !== 'main' && i.hand !== 'off'
  )
  const ambiguous =
    !twoHanded &&
    oneHanded.length >= 2 &&
    (unassigned.length > 0 || !main || !offWeapon)
  return {
    main,
    off: offWeapon ?? shield,
    twoHanded,
    shield,
    unassigned,
    ambiguous,
  }
}

module.exports = {
  isOneHandedWeapon,
  setHand,
  nextHand,
  cycleHand,
  loadoutHands,
}
