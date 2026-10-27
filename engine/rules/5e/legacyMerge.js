// "2024 where it exists, 2014 where it doesn't": the 2024 view of a named catalog
// (invocations, maneuvers...) is the 2024 file, plus every 2014 entry that has no
// 2024 counterpart, marked `legacy: true`. A same-named entry is always the 2024 one.

const key = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

function mergeLegacy(current, legacy) {
  const out = { ...current }
  const have = new Set(
    Object.keys(current)
      .filter((k) => !k.startsWith('_'))
      .map(key)
  )
  for (const [name, data] of Object.entries(legacy || {})) {
    if (name.startsWith('_') || have.has(key(name))) continue
    out[name] = { ...data, legacy: true, ruleset: '2014' }
  }
  return out
}

module.exports = { mergeLegacy }
