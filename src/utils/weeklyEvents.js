// Thin wrapper around engine/rules/weeklyEvents.js, same pattern as
// src/utils/rest.js. Imports the leaf rule file directly — NOT the
// engine/index.js barrel (see combatTurn.js's header comment). It depends
// only on 5e/dice.js, a zero-fs/path leaf.
const weeklyEventsEngine = require('../../engine/rules/weeklyEvents')

export const rollBetween = weeklyEventsEngine.rollBetween
export const refugeeTier = weeklyEventsEngine.refugeeTier
export const rollRefugees = weeklyEventsEngine.rollRefugees
export const rollLineItems = weeklyEventsEngine.rollLineItems
export const advanceCrossingProfit = weeklyEventsEngine.advanceCrossingProfit
