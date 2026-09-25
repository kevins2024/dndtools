// Pure turn/round/action-economy state for the combat tracker — no Vue, no
// character/monster knowledge, just abstract string keys in an order. Kept
// framework-free deliberately: this is core D&D turn-structure logic, and
// per CLAUDE.md's standing rule, anything that's a real game mechanic
// (independent of how it's displayed) belongs here so it ports cleanly to
// the planned Godot version rather than living inside a Vue component.
//
// Every function takes a state object and returns a NEW one — no mutation —
// matching the immutable-update style used elsewhere in this engine (see
// diffLevelUp.js).

// extraKeys: ids of any per-turn-capped feature this SPECIFIC combatant has
// (Action Surge's 17th-level cap, Sneak Attack, etc. — see
// engine/data/5e/feature-mechanics.json's per_turn_cap field). Not every
// combatant has any; defaults to none so every existing call site (and
// every combatant without one) behaves exactly as before. The caller derives
// this list from that combatant's own character.features[] (any entry with
// per_turn_cap: true, keyed by its id) — this file stays character-shape-
// agnostic on purpose, same as the rest of engine/, so it just takes
// whatever key strings the caller hands it.
function freshResources(extraKeys = []) {
  const resources = { action: true, bonusAction: true, reaction: true }
  for (const key of extraKeys) resources[key] = true
  return resources
}

// extraKeysByCombatant: { combatantKey: [featureId, ...] } — see
// freshResources' own comment. Optional; omit for the pre-existing 3-
// resource-only behavior.
function createCombatTurnState(orderKeys, extraKeysByCombatant = {}) {
  const resources = {}
  for (const key of orderKeys) {
    resources[key] = freshResources(extraKeysByCombatant[key] ?? [])
  }
  return { round: 1, turnIndex: 0, order: [...orderKeys], resources }
}

// Advances to the next combatant. Increments the round only when wrapping
// back to the start of the order. Real RAW: a combatant's action, bonus
// action, AND reaction all refresh at the start of THEIR OWN turn — a
// reaction persists across everyone else's turns in between — so only the
// newly active combatant's resources reset here, nobody else's. Any per-
// turn-capped feature (Action Surge 17th, Sneak Attack) refreshes on
// exactly the same trigger, for the same RAW reason — it's a "this turn"
// fact, same category as the other three.
function advanceTurn(state, extraKeysByCombatant = {}) {
  if (state.order.length === 0) return state
  const turnIndex = (state.turnIndex + 1) % state.order.length
  const round = turnIndex === 0 ? state.round + 1 : state.round
  const activeKey = state.order[turnIndex]
  return {
    ...state,
    turnIndex,
    round,
    resources: {
      ...state.resources,
      [activeKey]: freshResources(extraKeysByCombatant[activeKey] ?? []),
    },
  }
}

// Manual DM override (e.g. clicking a different combatant's card). Changes
// only which combatant is active — never touches resources. Per this app's
// DM-flexibility-over-automation design, looking at (or narratively jumping
// to) a different combatant must not silently refresh or spend anyone's
// action economy; only advanceTurn and explicit resource calls do that.
function setActiveTurnIndex(state, index) {
  return { ...state, turnIndex: index }
}

function setResource(state, key, resource, value) {
  if (!state.resources[key]) return state
  return {
    ...state,
    resources: {
      ...state.resources,
      [key]: { ...state.resources[key], [resource]: value },
    },
  }
}

function spendResource(state, key, resource) {
  return setResource(state, key, resource, false)
}

function resetResourcesFor(state, key, extraKeys = []) {
  if (!state.resources[key]) return state
  return {
    ...state,
    resources: { ...state.resources, [key]: freshResources(extraKeys) },
  }
}

// Handles the initiative order changing mid-fight — a combatant added,
// removed, or the whole list re-sorted (e.g. a late roll override changes
// tiebreak position). Round is never touched here; only advanceTurn changes
// it. The active combatant is tracked by IDENTITY (their key), not by
// numeric position, so a pure reorder never silently hands the turn to
// whoever now happens to sit at the old index. extraKeysByCombatant only
// matters for a combatant NEWLY appearing in newOrderKeys (an enemy added
// mid-fight) — an already-tracked combatant keeps their existing resources
// object untouched, extra keys and all.
function syncOrder(state, newOrderKeys, extraKeysByCombatant = {}) {
  const activeKey = state.order[state.turnIndex] ?? null

  const resources = {}
  for (const key of newOrderKeys) {
    resources[key] = state.resources[key]
      ? { ...state.resources[key] }
      : freshResources(extraKeysByCombatant[key] ?? [])
  }

  let turnIndex
  if (newOrderKeys.length === 0) {
    turnIndex = 0
  } else if (activeKey !== null && newOrderKeys.includes(activeKey)) {
    turnIndex = newOrderKeys.indexOf(activeKey)
  } else {
    // The active combatant themself was removed. Clamping the old numeric
    // index is deliberate, not a fallback: removing an entry shifts
    // everyone after it down one slot, so the same index now naturally
    // lands on "whoever was next" — exactly the right behavior here, even
    // though identity-tracking (above) is correct for the reorder case.
    turnIndex = Math.min(state.turnIndex, newOrderKeys.length - 1)
  }

  return { round: state.round, turnIndex, order: [...newOrderKeys], resources }
}

// True once a combatant's turn has passed this round — i.e. their slot in
// `order` is behind the current `turnIndex`. The active combatant themself
// (index === turnIndex) has not "acted" yet by this definition; they're
// acting now. Purely derived from state already tracked, but exposed as its
// own function since "who has gone this round" is a fact a Godot-side UI
// would need too, not just this app's battle map.
function hasActedThisRound(state, key) {
  const idx = state.order.indexOf(key)
  if (idx === -1) return false
  return idx < state.turnIndex
}

module.exports = {
  createCombatTurnState,
  advanceTurn,
  setActiveTurnIndex,
  setResource,
  spendResource,
  resetResourcesFor,
  syncOrder,
  hasActedThisRound,
}
