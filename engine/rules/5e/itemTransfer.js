// Moving an item into another character's bag.
//
// `transferItemToCharacter(item, toName)` returns the updated item, or null
// when there is nothing to do (the target already has it — carrying or
// wielding; a stray drop on your own portrait must not unequip anything).
//
// What a hand-off has to reset, beyond carried_by: everything that was true
// of the OLD owner's use of the item. Equipped-ness, attunement (attunement
// is per-person — the new carrier hasn't attuned), and the weapon-loadout
// slot / main-off hand choice (those are the old owner's loadout). Storage
// and party-pool ownership are cleared because the item now has a bearer.
//
// An item marked `equipped_by: 'disallowed'` (a scroll, a bag, a tool — it
// can't be equipped at all) keeps that mark: handing it over must not make it
// equippable.
//
// Not touched: charges, notes, enhancement bonus, anything about the item
// itself. No dependencies — browser code require()s this directly.

function transferItemToCharacter(item, toName) {
  if (!item || !toName || toName === 'party') return null
  if (item.carried_by === toName && !item.stored_at) return null

  return {
    ...item,
    carried_by: toName,
    equipped_by: item.equipped_by === 'disallowed' ? 'disallowed' : null,
    stored_at: null,
    party_id: null,
    attuned: false,
    weapon_set: null,
    hand: null,
  }
}

// The loose gear of a party's pool: carried by "the party", tagged with its id.
function partyPoolItems(items, partyId) {
  return items.filter((i) => i.carried_by === 'party' && i.party_id === partyId)
}

// Hands a party's whole pool to one character. Returns the full items array
// with those items transferred (every other item untouched).
function transferPoolToCharacter(items, partyId, toName) {
  return items.map((item) =>
    item.carried_by === 'party' && item.party_id === partyId
      ? transferItemToCharacter(item, toName) ?? item
      : item
  )
}

module.exports = {
  transferItemToCharacter,
  partyPoolItems,
  transferPoolToCharacter,
}
