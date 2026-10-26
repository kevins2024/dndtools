// Paired items — gear whose effect only works while its partner is nearby
// (the Farreach rings, the Stone of the Broken Vein / Rootbound Ward).
//
// The pairing is library data, not per-copy data: item-mechanics.json gives
// the item a `pair` block —
//
//   "pair": {
//     "with": "<catalog id of the partner item>",
//     "range_ft": 30,
//     "effects": ["The Stones Agree"]   // granted spells/features that need it
//   }
//
// — so only the named effects are marked as needing the pair; the item's other
// spells and features (a stone's solo spells, Ring's Answer) are not. Who
// currently holds the partner is looked up from the party items each time it
// is asked, so it can never go stale the way a stored item id can.
//
// The engine can't know whether the two bearers are actually within range (no
// positions here) — that stays the player's call. This only reports what the
// pair needs and where the other half is.
//
// No dependencies — browser code require()s this directly.

// Where an item currently is: who has it, and whether it's on their person
// (equipped) or just in their pack / the party's / stored somewhere.
function holderOf(item) {
  if (item.equipped_by && item.equipped_by !== 'disallowed') {
    return { who: item.equipped_by, place: null, status: 'equipped' }
  }
  if (item.carried_by) {
    return { who: item.carried_by, place: null, status: 'carried' }
  }
  if (item.stored_at) {
    return { who: null, place: item.stored_at, status: 'stored' }
  }
  return { who: null, place: null, status: 'unassigned' }
}

// Does this item's `effectName` (a granted spell or feature) need the pair?
function effectNeedsPair(item, effectName) {
  return !!item?.pair?.effects?.includes(effectName)
}

// Everything about an item's pairing, or null if it has none:
//   { rangeFt, effects: [name], partners: [{ id, name, who, place, status, attuned }] }
// `partners` is every other party item made from the partner's catalog entry —
// usually one, empty if the partner isn't in the party's inventory.
function pairInfo(item, partyItems = []) {
  const pair = item?.pair
  if (!pair?.with) return null
  const partners = partyItems
    .filter((i) => i.catalog_id === pair.with && i.id !== item.id)
    .map((i) => ({
      id: i.id,
      name: i.name,
      ...holderOf(i),
      attuned: !!i.attuned,
    }))
  return {
    rangeFt: pair.range_ft ?? null,
    effects: pair.effects ?? [],
    partners,
  }
}

// pairInfo, but only when `effectName` is one of the effects that needs the
// pair — what a spell or feature badge asks. null for every other effect.
function pairRequirement(item, effectName, partyItems = []) {
  return effectNeedsPair(item, effectName) ? pairInfo(item, partyItems) : null
}

module.exports = { holderOf, effectNeedsPair, pairInfo, pairRequirement }
