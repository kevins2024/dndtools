const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('createCombatTurnState starts at round 1, turnIndex 0, everyone with fresh resources', () => {
  const state = engine.createCombatTurnState(['a', 'b', 'c'])
  assert.equal(state.round, 1)
  assert.equal(state.turnIndex, 0)
  assert.deepEqual(state.order, ['a', 'b', 'c'])
  for (const key of ['a', 'b', 'c']) {
    assert.deepEqual(state.resources[key], {
      action: true,
      bonusAction: true,
      reaction: true,
    })
  }
})

test('advanceTurn moves to the next combatant without changing the round mid-round', () => {
  const state = engine.createCombatTurnState(['a', 'b', 'c'])
  const next = engine.advanceTurn(state)
  assert.equal(next.turnIndex, 1)
  assert.equal(next.round, 1)
})

test('advanceTurn wraps to 0 and increments the round at the end of the order', () => {
  let state = engine.createCombatTurnState(['a', 'b', 'c'])
  state = engine.advanceTurn(state) // b, round 1
  state = engine.advanceTurn(state) // c, round 1
  state = engine.advanceTurn(state) // a, round 2 (wrapped)
  assert.equal(state.turnIndex, 0)
  assert.equal(state.round, 2)
})

test("advanceTurn resets only the newly active combatant's resources — everyone else untouched", () => {
  let state = engine.createCombatTurnState(['a', 'b'])
  state = engine.setResource(state, 'a', 'action', false)
  state = engine.setResource(state, 'b', 'reaction', false)
  state = engine.advanceTurn(state) // b becomes active
  assert.deepEqual(state.resources.b, {
    action: true,
    bonusAction: true,
    reaction: true,
  })
  // a was not the newly active combatant — their spent action stays spent
  assert.equal(state.resources.a.action, false)
})

test('advanceTurn on a solo combatant re-triggers them and increments the round every call', () => {
  let state = engine.createCombatTurnState(['solo'])
  state = engine.advanceTurn(state)
  assert.equal(state.turnIndex, 0)
  assert.equal(state.round, 2)
  state = engine.advanceTurn(state)
  assert.equal(state.round, 3)
})

test('advanceTurn on an empty order is a safe no-op', () => {
  const state = engine.createCombatTurnState([])
  const next = engine.advanceTurn(state)
  assert.deepEqual(next, state)
})

test('setActiveTurnIndex changes only turnIndex — round and all resources untouched', () => {
  let state = engine.createCombatTurnState(['a', 'b', 'c'])
  state = engine.setResource(state, 'a', 'bonusAction', false)
  const jumped = engine.setActiveTurnIndex(state, 2)
  assert.equal(jumped.turnIndex, 2)
  assert.equal(jumped.round, state.round)
  assert.deepEqual(jumped.resources, state.resources)
})

test('setResource sets exactly the named resource for the named combatant, nothing else', () => {
  const state = engine.createCombatTurnState(['a', 'b'])
  const next = engine.setResource(state, 'a', 'bonusAction', false)
  assert.equal(next.resources.a.bonusAction, false)
  assert.equal(next.resources.a.action, true)
  assert.equal(next.resources.a.reaction, true)
  assert.deepEqual(next.resources.b, {
    action: true,
    bonusAction: true,
    reaction: true,
  })
})

test('setResource is a safe no-op for an untracked key', () => {
  const state = engine.createCombatTurnState(['a'])
  const next = engine.setResource(state, 'nobody', 'action', false)
  assert.deepEqual(next, state)
})

test('spendResource is equivalent to setResource(..., false), never sets true', () => {
  const state = engine.createCombatTurnState(['a'])
  const spent = engine.spendResource(state, 'a', 'reaction')
  assert.equal(spent.resources.a.reaction, false)
  const spentAgain = engine.spendResource(spent, 'a', 'reaction')
  assert.equal(spentAgain.resources.a.reaction, false)
})

test('resetResourcesFor restores all 3 resources for one combatant, nothing else touched', () => {
  let state = engine.createCombatTurnState(['a', 'b'])
  state = engine.setResource(state, 'a', 'action', false)
  state = engine.setResource(state, 'a', 'reaction', false)
  state = engine.setResource(state, 'b', 'bonusAction', false)
  const reset = engine.resetResourcesFor(state, 'a')
  assert.deepEqual(reset.resources.a, {
    action: true,
    bonusAction: true,
    reaction: true,
  })
  assert.equal(reset.resources.b.bonusAction, false)
})

test("syncOrder preserves round/resources and re-finds the active combatant's new slot on a pure reorder", () => {
  let state = engine.createCombatTurnState(['a', 'b', 'c'])
  state = engine.setActiveTurnIndex(state, 1) // b is active
  state = engine.setResource(state, 'b', 'action', false)
  state.round = 3 // simulate mid-fight

  // b moves from index 1 to index 0 (e.g. a roll override changed sort order)
  const synced = engine.syncOrder(state, ['b', 'a', 'c'])
  assert.equal(synced.turnIndex, 0) // followed b's identity, not the old index
  assert.equal(synced.round, 3)
  assert.equal(synced.resources.b.action, false)
})

test('syncOrder grants a new mid-fight key fresh resources without touching existing keys', () => {
  let state = engine.createCombatTurnState(['a', 'b'])
  state = engine.setResource(state, 'a', 'action', false)
  const synced = engine.syncOrder(state, ['a', 'b', 'reinforcement'])
  assert.deepEqual(synced.resources.reinforcement, {
    action: true,
    bonusAction: true,
    reaction: true,
  })
  assert.equal(synced.resources.a.action, false)
})

test('syncOrder drops the resource entry for a removed key', () => {
  const state = engine.createCombatTurnState(['a', 'b', 'c'])
  const synced = engine.syncOrder(state, ['a', 'c'])
  assert.equal('b' in synced.resources, false)
  assert.deepEqual(Object.keys(synced.resources).sort(), ['a', 'c'])
})

test('syncOrder clamps turnIndex sensibly when the active combatant themself is removed', () => {
  let state = engine.createCombatTurnState(['a', 'b', 'c'])
  state = engine.setActiveTurnIndex(state, 1) // b is active
  // b (the active combatant) is removed; c shifts into slot 1
  const synced = engine.syncOrder(state, ['a', 'c'])
  assert.equal(synced.turnIndex, 1)
  assert.deepEqual(synced.order, ['a', 'c'])
})

test('syncOrder resets turnIndex to 0 (round untouched) when every combatant is removed', () => {
  let state = engine.createCombatTurnState(['a', 'b'])
  state.round = 5
  const synced = engine.syncOrder(state, [])
  assert.equal(synced.turnIndex, 0)
  assert.equal(synced.round, 5)
  assert.deepEqual(synced.resources, {})
})

test('syncOrder is idempotent when called twice with the same order', () => {
  const state = engine.createCombatTurnState(['a', 'b', 'c'])
  const once = engine.syncOrder(state, ['a', 'b', 'c'])
  const twice = engine.syncOrder(once, ['a', 'b', 'c'])
  assert.deepEqual(once, twice)
})

test('hasActedThisRound is false for everyone at the start of a round', () => {
  const state = engine.createCombatTurnState(['a', 'b', 'c'])
  assert.equal(engine.hasActedThisRound(state, 'a'), false)
  assert.equal(engine.hasActedThisRound(state, 'b'), false)
  assert.equal(engine.hasActedThisRound(state, 'c'), false)
})

test('hasActedThisRound is true only for combatants behind the active turn', () => {
  let state = engine.createCombatTurnState(['a', 'b', 'c'])
  state = engine.advanceTurn(state) // now on b
  assert.equal(engine.hasActedThisRound(state, 'a'), true)
  assert.equal(engine.hasActedThisRound(state, 'b'), false)
  assert.equal(engine.hasActedThisRound(state, 'c'), false)
})

test('hasActedThisRound resets to false for everyone once the round wraps', () => {
  let state = engine.createCombatTurnState(['a', 'b', 'c'])
  state = engine.advanceTurn(state) // b
  state = engine.advanceTurn(state) // c
  state = engine.advanceTurn(state) // wraps to a, round 2
  assert.equal(engine.hasActedThisRound(state, 'a'), false)
  assert.equal(engine.hasActedThisRound(state, 'b'), false)
  assert.equal(engine.hasActedThisRound(state, 'c'), false)
})

test('hasActedThisRound is false for an untracked key', () => {
  const state = engine.createCombatTurnState(['a', 'b'])
  assert.equal(engine.hasActedThisRound(state, 'z'), false)
})
