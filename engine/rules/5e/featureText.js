// A feature record either carries its own rules text (`description`) or points
// at the record that does (`text_from: "<id>"`). The pointer exists for a
// feature the app splits into several tiles (Infernal Legacy -> one tile per
// spell, Combat Wild Shape -> speed + healing) so the printed text lives in
// exactly one place and every consumer still receives finished text.
//
// Pure and framework-free (no fs/path) so browser code can require this leaf
// file directly, per CLAUDE.md.

const MAX_HOPS = 5

// `findById(id)` returns a record or undefined. Returns the record's own text,
// else the text of the record it points at (following a chain, loop-guarded),
// else ''. Never throws on a dangling or circular reference.
function resolveFeatureText(record, findById) {
  const seen = new Set()
  let current = record
  for (let hop = 0; current && hop <= MAX_HOPS; hop++) {
    if (current.description) return current.description
    if (!current.text_from || seen.has(current.text_from)) return ''
    seen.add(current.text_from)
    current = findById(current.text_from)
  }
  return ''
}

module.exports = { resolveFeatureText }
