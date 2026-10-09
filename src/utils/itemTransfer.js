// Thin wrapper around engine/rules/5e/itemTransfer.js (same pattern as
// attunement.js): requires the leaf engine file directly, never the
// engine/index.js barrel. No fs/path dependencies.
const itemTransferEngine = require('../../engine/rules/5e/itemTransfer')

export const transferItemToCharacter =
  itemTransferEngine.transferItemToCharacter
export const partyPoolItems = itemTransferEngine.partyPoolItems
export const transferPoolToCharacter = itemTransferEngine.transferPoolToCharacter
