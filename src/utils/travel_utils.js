// travel_utils.js
// Thin wrapper around engine/rules/travel.js, the roll engine for the
// Travel Event wizard. Content lives in travel_events.js; the dice logic
// (turning terrain, continent, whether the party knows the way, and the lead
// tracker's Survival mod into one resolved event) lives in the engine —
// moved there 2026-10-01. This file just supplies the content to it.
//
// Imports the leaf rule file directly — NOT the engine/index.js barrel,
// which breaks webpack via fs/path at require-time (see combatTurn.js's
// header comment). travel.js depends only on zero-fs/path leaf modules.

import { TRAVEL_EVENTS } from '@/data/travel_events.js'

const travelEngine = require('../../engine/rules/travel')

export const TIER_LABELS = travelEngine.TIER_LABELS

// Topics eligible for a given terrain + continent.
export function eligibleTopics(terrain, continent) {
  return travelEngine.eligibleTopics(TRAVEL_EVENTS, terrain, continent)
}

export function pickTravelTopic(terrain, continent) {
  return travelEngine.pickTravelTopic(TRAVEL_EVENTS, terrain, continent)
}

// See engine/rules/travel.js for the roll mode and tier rules.
export function resolveTravelEvent(args) {
  return travelEngine.resolveTravelEvent(args)
}
