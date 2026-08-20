// merge-utils.js
// Generic 3-way merge for JSON-shaped data, used by the save endpoint in
// server.js so that an autosave from one browser tab never blindly clobbers
// rows/fields that tab never touched.
//
// The three inputs at every level of the structure:
//   base   - what the client loaded/last synced (the common ancestor)
//   ours   - the client's current in-memory value (what it wants to save)
//   theirs - what's actually on disk right now (may have changed since
//            base, e.g. from a direct file edit or another tab's save)
//
// Rule of thumb: a side that didn't change a piece of data from `base`
// defers to the other side. If both sides changed the SAME piece of data
// to different values, that's a genuine conflict — logged, and resolved by
// preferring the on-disk value (`theirs`), since in practice a conflict
// here means a stale browser tab disagrees with a more deliberate direct
// edit made after that tab loaded.

function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  return JSON.stringify(a) === JSON.stringify(b)
}

// Picks the field ('id' or 'name') that identifies elements of an array of
// objects, so array merges can match up elements instead of comparing the
// whole array as one blob. Returns null if elements aren't objects with
// either field (e.g. arrays of primitives) — those get merged as a unit.
function getKeyField(arr) {
  const sample = arr.find((x) => x && typeof x === 'object')
  if (!sample) return null
  if (sample.id != null) return 'id'
  if (sample.name != null) return 'name'
  return null
}

function keyOf(item, field) {
  return String(item[field])
}

function mergeArrays(base, ours, theirs, path, conflicts) {
  base = Array.isArray(base) ? base : []
  ours = Array.isArray(ours) ? ours : []
  theirs = Array.isArray(theirs) ? theirs : []

  const field = getKeyField(base) || getKeyField(ours) || getKeyField(theirs)

  // No stable per-element key (e.g. array of strings/numbers) — treat the
  // whole array as one value.
  if (!field) {
    if (deepEqual(ours, base)) return theirs
    if (deepEqual(theirs, base)) return ours
    if (deepEqual(ours, theirs)) return ours
    conflicts.push(path)
    return theirs
  }

  const baseMap = new Map(base.map((x) => [keyOf(x, field), x]))
  const oursMap = new Map(ours.map((x) => [keyOf(x, field), x]))
  const theirsMap = new Map(theirs.map((x) => [keyOf(x, field), x]))

  // Disk order is the spine (keeps externally-added rows in a sane place);
  // anything the client added that disk doesn't know about yet is appended.
  const orderedKeys = [
    ...theirs.map((x) => keyOf(x, field)),
    ...ours.map((x) => keyOf(x, field)).filter((k) => !theirsMap.has(k)),
  ]

  const seen = new Set()
  const result = []

  for (const k of orderedKeys) {
    if (seen.has(k)) continue
    seen.add(k)

    const inBase = baseMap.has(k)
    const inOurs = oursMap.has(k)
    const inTheirs = theirsMap.has(k)
    const b = baseMap.get(k)
    const o = oursMap.get(k)
    const t = theirsMap.get(k)

    if (!inBase) {
      // Brand new row on one or both sides — nothing to reconcile against.
      if (inOurs && inTheirs) {
        result.push(
          deepEqual(o, t)
            ? o
            : mergeValue(undefined, o, t, `${path}[${k}]`, conflicts)
        )
      } else {
        result.push(inTheirs ? t : o)
      }
      continue
    }

    if (!inOurs && !inTheirs) continue // deleted on both sides

    if (!inOurs && inTheirs) {
      // Client deleted this row. Honor it — unless disk independently
      // changed the row after the client's base, in which case don't
      // silently throw away that edit.
      if (!deepEqual(t, b)) result.push(t)
      continue
    }

    if (inOurs && !inTheirs) {
      // Disk no longer has this row (deleted externally). Honor it —
      // unless the client independently edited the row, in which case
      // keep the client's edit rather than lose it.
      if (!deepEqual(o, b)) result.push(o)
      continue
    }

    // Present in base, ours, and theirs — recursive per-field merge.
    result.push(mergeValue(b, o, t, `${path}[${k}]`, conflicts))
  }

  return result
}

function mergeValue(base, ours, theirs, path, conflicts) {
  if (deepEqual(ours, theirs)) return theirs
  if (deepEqual(ours, base)) return theirs
  if (deepEqual(theirs, base)) return ours

  if (Array.isArray(ours) || Array.isArray(theirs) || Array.isArray(base)) {
    return mergeArrays(base, ours, theirs, path, conflicts)
  }

  if (
    ours &&
    theirs &&
    typeof ours === 'object' &&
    typeof theirs === 'object'
  ) {
    const b = base && typeof base === 'object' ? base : {}
    const keys = new Set([
      ...Object.keys(b),
      ...Object.keys(ours),
      ...Object.keys(theirs),
    ])
    const result = {}
    for (const key of keys) {
      result[key] = mergeValue(
        b[key],
        ours[key],
        theirs[key],
        `${path}.${key}`,
        conflicts
      )
    }
    return result
  }

  // Both sides changed this leaf to a different value and neither matches
  // the other — genuine conflict.
  conflicts.push(path)
  return theirs
}

function threeWayMerge(base, ours, theirs) {
  const conflicts = []
  const merged = mergeValue(base, ours, theirs, '$', conflicts)
  return { merged, conflicts }
}

module.exports = { threeWayMerge, deepEqual }
