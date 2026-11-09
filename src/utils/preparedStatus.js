// Has each character picked all the prepared spells their class tables give them? The engine counts
// (engine/rules/5e/preparedStatus.js, POST /api/engine/prepared-status); this only asks. Identical
// requests are shared and remembered. Resolves to {} when there is no server (the static build), so no
// mark is drawn there.

const cache = new Map() // request body -> Promise<{ [name]: status | null }>
const LIMIT = 20

// Only what the count reads, so a change to anything else does not ask again.
export function preparedStatusRequest(characters, spellbooks = []) {
  return JSON.stringify({
    characters: characters.map((c) => ({
      name: c.name,
      ruleset: c.ruleset,
      classes: c.classes,
      spells: c.spells,
      prepared_spells: c.prepared_spells,
      spellbook_id: c.spellbook_id,
      features: (c.features ?? [])
        .filter((f) => f.spells_granted?.length)
        .map((f) => ({ name: f.name, spells_granted: f.spells_granted })),
    })),
    spellbooks,
  })
}

export function fetchPreparedStatus(body) {
  if (cache.has(body)) return cache.get(body)
  const promise = fetch('/api/engine/prepared-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}))
  cache.set(body, promise)
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value)
  return promise
}
