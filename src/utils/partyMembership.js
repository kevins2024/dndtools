// Thin wrapper around engine/rules/partyMembership.js (same pattern as
// attunement.js): requires the leaf engine file directly, never the
// engine/index.js barrel. No fs/path dependencies.
const membershipEngine = require('../../engine/rules/partyMembership')

export const livePartyOf = membershipEngine.livePartyOf
export const joinCheck = membershipEngine.joinCheck
export const reactivationConflicts = membershipEngine.reactivationConflicts
export const reactivationBlockReason = membershipEngine.reactivationBlockReason
