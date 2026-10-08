// Draft characters: an unsaved level-up or a brand-new character is applied to
// the live store so the app can preview it, but it must only reach disk
// through its explicit Save button — never through the ambient autosave that
// persists everything else (bug 2.1: any unrelated edit marked `characters`
// dirty, and the autosave then sent the whole in-memory table, drafts
// included, so the Save/Revert flow was bypassed silently).
//
// These two pure functions are what the store's save action uses. A draft is
// identified by character name (the store keeps the list in
// `state.draftCharacters`).
//
// No dependencies — browser code require()s this directly.

// The rows an AMBIENT save should write: every draft character is held at its
// last-saved baseline (`originals`), or left out entirely if it was never
// saved. Everyone else is written as they are in memory.
function rowsForAmbientSave(characters, originals, drafts) {
  if (!drafts?.length) return characters
  const out = []
  for (const c of characters) {
    if (!drafts.includes(c.name)) {
      out.push(c)
      continue
    }
    const baseline = (originals ?? []).find((o) => o.name === c.name)
    if (baseline) out.push(baseline)
  }
  return out
}

// After a save, the merged table from disk replaces the one in memory —
// which would silently throw the drafts away (they were held back). Put each
// live draft row back, in place if it exists on disk or appended if new.
function restoreDrafts(mergedRows, liveRows, drafts) {
  if (!drafts?.length) return mergedRows
  let rows = mergedRows
  for (const name of drafts) {
    const live = liveRows.find((c) => c.name === name)
    if (!live) continue
    const idx = rows.findIndex((c) => c.name === name)
    rows =
      idx === -1 ? [...rows, live] : rows.map((c, i) => (i === idx ? live : c))
  }
  return rows
}

module.exports = { rowsForAmbientSave, restoreDrafts }
