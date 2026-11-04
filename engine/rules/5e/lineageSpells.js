// The higher-level spells a 2024 species lineage teaches at character levels 3 and 5 (Elven Lineage,
// Fiendish Legacy). The rule, from the species text:
//   "When you reach character levels 3 and 5, you learn a higher-level spell, as shown on the table.
//    You always have that spell prepared. You can cast it once without a spell slot, and you regain the
//    ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any
//    spell slots you have of the appropriate level."
//
// The table is species-choices.json (lineages[x].spellsAtLevel). Keyed on TOTAL character level, so a
// multiclass character gets the spell at the right overall level whichever class crossed it.
//
// Server and scripts only (reads the spell data).

const { findSpellRecord, isSpellOnClassList } = require('./spellLists')
const { speciesOf, lineageOf, SPECIES_CHOICES } = require('./speciesLineage')
const { effectiveGrants } = require('./featureGrants')

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim()

// A feature's spells_granted is the older way a lineage spell was recorded; a spell row from this same
// lineage is the current one. A spell the class also knows does not count: the lineage's copy is
// always prepared and has its free cast.
function hasGrant(character, name, source) {
  const n = norm(name)
  return (
    (character.spells ?? []).some(
      (s) => norm(s.name) === n && s._source === source
    ) ||
    (character.features ?? []).some((f) =>
      (f.spells_granted ?? []).some((g) => norm(g) === n)
    )
  )
}

// Spell rows owed for crossing from total level `fromLevel` (exclusive) to `toLevel` (inclusive).
// Spells the sheet already has from the lineage are left out, so running it twice grants nothing twice.
function lineageSpellsDue(character, fromLevel, toLevel) {
  const species = speciesOf(character)
  const lineage = lineageOf(character)
  const table = lineage
    ? SPECIES_CHOICES[species].lineages[lineage].spellsAtLevel
    : null
  if (!table) return []
  const source = `${species}: ${lineage}`
  const rows = []
  for (const [lvl, names] of Object.entries(table)) {
    const level = Number(lvl)
    if (level <= fromLevel || level > toLevel) continue
    for (const name of names) {
      if (hasGrant(character, name, source)) continue
      rows.push({
        name,
        level: findSpellRecord(name, '2024')?.level ?? null,
        prepared: true,
        featureGranted: true,
        always: true,
        _source: source,
        uses_max: 1,
        uses_current: 1,
        recharge: 'long_rest',
      })
    }
  }
  return rows
}

// Every lineage spell a character of this level should have and does not: the roster audit.
function missingLineageSpells(character) {
  return lineageSpellsDue(character, 0, character.level ?? 0)
}

// High Elf: "Whenever you finish a Long Rest, you can replace that cantrip with a different cantrip from
// the Wizard spell list." The rule is the lineage feature's `cantrip_swap` ({ replaces, from_list });
// this replaces the lineage's cantrip row with `newName`. The caller offers it after a Long Rest.
// { ok: false, error } or { ok: true, patch: { spells }, from, to }.
function swapLineageCantrip(character, newName) {
  const feature = (character.features ?? []).find(
    (f) => effectiveGrants(f).cantrip_swap
  )
  if (!feature)
    return { ok: false, error: 'No lineage lets the character swap a cantrip.' }
  const rule = effectiveGrants(feature).cantrip_swap
  const source = `${speciesOf(character)}: ${lineageOf(character)}`
  const row = (character.spells ?? []).find(
    (s) => s._source === source && s.level === 0
  )
  if (!row) return { ok: false, error: 'The lineage cantrip is missing.' }
  const record = findSpellRecord(newName, '2024')
  if (!record || record.level !== 0)
    return { ok: false, error: `${newName} is not a cantrip.` }
  if (isSpellOnClassList(rule.from_list, newName, '2024') !== true)
    return {
      ok: false,
      error: `${newName} is not on the ${rule.from_list} spell list.`,
    }
  if ((character.spells ?? []).some((s) => norm(s.name) === norm(newName)))
    return { ok: false, error: `The character already knows ${newName}.` }
  return {
    ok: true,
    from: row.name,
    to: record.name,
    patch: {
      spells: character.spells.map((s) =>
        s === row ? { ...s, name: record.name } : s
      ),
    },
  }
}

module.exports = {
  lineageOf,
  lineageSpellsDue,
  missingLineageSpells,
  swapLineageCantrip,
}
