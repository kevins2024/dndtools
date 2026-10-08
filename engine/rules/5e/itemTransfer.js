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
// Not touched: charges, notes, enhancement bonus, anything about the item
// itself. No dependencies — browser code require()s this directly.

function transferItemToCharacter(item, toName) {
  if (!item || !toName || toName === 'party') return null
  if (item.carried_by === toName && !item.stored_at) return null

  return {
    ...item,
    carried_by: toName,
    equipped_by: null,
    stored_at: null,
    party_id: null,
    attuned: false,
    weapon_set: null,
    hand: null,
  }
}

module.exports = { transferItemToCharacter }
