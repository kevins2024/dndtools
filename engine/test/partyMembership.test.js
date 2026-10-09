const test = require('node:test')
const assert = require('node:assert')
const {
  livePartyOf,
  joinCheck,
  reactivationConflicts,
  reactivationBlockReason,
} = require('../rules/partyMembership')

const parties = [
  { id: 'A', name: 'Alpha', members: ['Lenn', 'Pirra'] },
  { id: 'B', name: 'Beta', members: ['Siv'] },
  { id: 'C', name: 'Gamma', members: ['Lenn', 'Siv', 'Petra'], inactive: true },
]

test('a character in a live party is found; inactive parties do not count', () => {
  assert.strictEqual(livePartyOf(parties, 'Lenn').id, 'A')
  assert.strictEqual(livePartyOf(parties, 'Petra'), null) // only in inactive Gamma
  assert.strictEqual(livePartyOf(parties, 'Lenn', 'A'), null) // excluding their own party
})

test('joining a live party is blocked when the character is in another live party, with a reason', () => {
  const check = joinCheck(parties, 'B', 'Lenn')
  assert.strictEqual(check.ok, false)
  assert.strictEqual(check.party.name, 'Alpha')
  assert.match(check.reason, /Lenn is in Alpha/)
  assert.deepStrictEqual(joinCheck(parties, 'B', 'Petra'), { ok: true })
  assert.deepStrictEqual(joinCheck(parties, 'A', 'Pirra'), { ok: true }) // already theirs
})

test('an inactive party keeps a free-form roster: joining it is never blocked', () => {
  assert.deepStrictEqual(joinCheck(parties, 'C', 'Lenn'), { ok: true })
})

test('reactivating is blocked while a member is in a live party, and says who and where', () => {
  const conflicts = reactivationConflicts(parties, 'C')
  assert.deepStrictEqual(
    conflicts.map((c) => [c.character, c.party.name]),
    [['Lenn', 'Alpha'], ['Siv', 'Beta']]
  )
  const reason = reactivationBlockReason(parties, 'C')
  assert.match(reason, /Lenn \(Alpha\), Siv \(Beta\) are in a party that's in play/)
})

test('a party with no conflicts can come back', () => {
  const free = parties.map((p) => (p.id === 'A' ? { ...p, inactive: true } : p))
  const afterB = free.map((p) => (p.id === 'B' ? { ...p, inactive: true } : p))
  assert.deepStrictEqual(reactivationConflicts(afterB, 'C'), [])
  assert.strictEqual(reactivationBlockReason(afterB, 'C'), '')
})
