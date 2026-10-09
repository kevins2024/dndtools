// Party membership rules. A character can be in only ONE party that's in play
// (not marked `inactive`); an inactive party keeps its roster as history and
// may overlap with anything.
//
// These pure functions answer "can they join?" and "can this party come back?"
// along with the reason, so the UI can disable an action AND say why, and the
// store can refuse the same action if something bypasses the UI.
//
// A party is `{ id, name, members: [name], inactive?: true, ... }`.
// No dependencies — browser code require()s this directly.

// The other party in play that this character belongs to, or null.
function livePartyOf(parties, characterName, exceptPartyId = null) {
  return (
    parties.find(
      (p) =>
        !p.inactive &&
        p.id !== exceptPartyId &&
        (p.members ?? []).includes(characterName)
    ) ?? null
  )
}

// Whether `characterName` may be added to party `partyId`.
// { ok: true } or { ok: false, party, reason } naming the party they're in.
function joinCheck(parties, partyId, characterName) {
  const target = parties.find((p) => p.id === partyId)
  if (!target || target.inactive) return { ok: true } // history roster
  const other = livePartyOf(parties, characterName, partyId)
  if (!other) return { ok: true }
  return {
    ok: false,
    party: other,
    reason: `${characterName} is in ${other.name}, which is in play. Remove them there first.`,
  }
}

// Members of an inactive party who are now in a party that's in play, so the
// party can't come back until they're moved out of it. [{ character, party }]
function reactivationConflicts(parties, partyId) {
  const target = parties.find((p) => p.id === partyId)
  if (!target) return []
  return (target.members ?? [])
    .map((character) => ({
      character,
      party: livePartyOf(parties, character, partyId),
    }))
    .filter((c) => c.party)
}

// A short sentence for the disabled Reactivate button, or '' when it's fine.
function reactivationBlockReason(parties, partyId) {
  const conflicts = reactivationConflicts(parties, partyId)
  if (!conflicts.length) return ''
  const names = conflicts.map((c) => `${c.character} (${c.party.name})`)
  return `Can't reactivate while ${names.join(', ')} ${
    conflicts.length === 1 ? 'is' : 'are'
  } in a party that's in play. Remove them from it, or mark that party inactive, first.`
}

module.exports = {
  livePartyOf,
  joinCheck,
  reactivationConflicts,
  reactivationBlockReason,
}
