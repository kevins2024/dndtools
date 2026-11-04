// The engine's character sheet (engine/rules/5e/sheet.js) for a character as the screen holds it: every
// calculated number with the lines that explain it. The engine needs data files the browser cannot read,
// so the dev server computes it (POST /api/engine/character-sheet). Identical requests are shared and
// remembered, so several components on one screen cost one request.
//
// Resolves to null when there is no server (the static build): callers keep showing what they showed
// before, so nothing breaks, it just is not engine-derived there.

const cache = new Map() // request body -> Promise<sheet | null>
const LIMIT = 60

export function sheetRequest(character, partyItems = []) {
  return JSON.stringify({
    character,
    partyItems: partyItems.filter((i) => i.equipped_by === character.name),
  })
}

export function fetchSheet(body) {
  if (cache.has(body)) return cache.get(body)
  const promise = fetch('/api/engine/character-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
  cache.set(body, promise)
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value)
  promise.then((sheet) => {
    if (!sheet) cache.delete(body) // do not remember a failure
  })
  return promise
}
