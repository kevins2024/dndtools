// Thin wrapper around engine/rules/dmExport.js, same pattern as
// src/utils/weaponHands.js. Imports the leaf rule file directly — NOT the
// engine/index.js barrel (see combatTurn.js's header comment).
const dmExportEngine = require('../../engine/rules/dmExport')

export const partyItemBundle = dmExportEngine.partyItemBundle
export const characterItems = dmExportEngine.characterItems
export const characterForExport = dmExportEngine.characterForExport
export const partyPoolItems = dmExportEngine.partyPoolItems
export const relationshipsFor = dmExportEngine.relationshipsFor
export const buildExport = dmExportEngine.buildExport
