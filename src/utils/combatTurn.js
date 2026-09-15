// Thin wrapper around engine/rules/combatTurn.js. This is the one place in
// src/ that touches engine/ directly for this feature: turn/round/action-
// economy toggling is a hot, rapid-click UI loop (the same category as this
// app's existing HP/death-save/condition tracking, which is already
// synchronous local Vue state with no network round-trip), not a
// rules-catalog lookup — so unlike most engine/ consumption, it skips the
// /api/engine/* server routes entirely. See CLAUDE.md for the standing rule
// this module follows (core D&D logic lives in engine/, framework-free) and
// the narrow exception this file represents (direct require() for
// session-local hot paths).
//
// Imports rules/combatTurn.js directly — NOT the engine/index.js barrel.
// The barrel re-exports every rule module, several of which (classFeatures,
// subclasses, etc.) use Node's `fs`/`path` to read data files off disk at
// require-time; webpack can't bundle those for the browser (confirmed: a
// build attempt through the barrel fails with "Can't resolve 'fs'/'path'").
// rules/combatTurn.js itself has zero dependencies — no fs, no path, no
// other rule file — so importing it directly sidesteps the problem
// entirely without touching the barrel or any other engine/ consumer.
const combatTurnEngine = require('../../engine/rules/combatTurn')

export const combatTurn = {
  createCombatTurnState: combatTurnEngine.createCombatTurnState,
  advanceTurn: combatTurnEngine.advanceTurn,
  setActiveTurnIndex: combatTurnEngine.setActiveTurnIndex,
  setResource: combatTurnEngine.setResource,
  spendResource: combatTurnEngine.spendResource,
  resetResourcesFor: combatTurnEngine.resetResourcesFor,
  syncOrder: combatTurnEngine.syncOrder,
  hasActedThisRound: combatTurnEngine.hasActedThisRound,
}
