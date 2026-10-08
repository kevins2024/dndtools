// Shared drag-and-drop type for moving an item between characters: items in
// CharacterInventory are the drag source, portraits in CharacterContext the
// drop target. A custom MIME type (not text/plain) so ordinary text/link drags
// never light up a portrait, and so dragover — where browsers only expose the
// types, not the data — can still tell this is an item.
export const ITEM_DRAG_TYPE = 'application/x-dndtools-item'

// Call from a row's @dragstart. Carries the item id; the drop handler looks
// the item up in the store at drop time, so there's no stale copy in flight.
export function startItemDrag(event, item) {
  event.dataTransfer.setData(ITEM_DRAG_TYPE, item.id)
  event.dataTransfer.effectAllowed = 'move'
}
