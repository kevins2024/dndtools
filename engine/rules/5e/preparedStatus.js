// Has a character picked all the spells their class tables give them? One answer, { have, want }, for the
// "unfinished" mark on a portrait and for the audit's prepared-count check, so neither counts on its own.
//
// want: the 2024 class tables' "Prepared Spells" column, summed over every spellcasting class
//       (spellcasting.js preparedSpellCount).
// have: the leveled spells on the sheet that are marked prepared, not counting spells that are granted
//       (a feature, feat, species lineage, the class's always-prepared list, the subclass's list; see
//       spellOrigins.js). A Wizard linked to a shared spellbook has its spells in the book, and which of
//       them are prepared in the character's own `prepared_spells`.
//
// Server and scripts only (it reads class data).

const { resolveSpellcasting, preparedSpellCount } = require('./spellcasting')
const { rulesetOf } = require('./rulesetId')
const { grantedSpellKeys, isGrantedSpell } = require('./spellOrigins')

const isCantrip = (s) => s.level === 0 || s.type === 'cantrip'

// The spells a sheet holds, in one shape: from the shared spellbook when it is linked to one (the book
// knows nothing about which spells came from a species or feat; the sheet's own list does), otherwise
// from the sheet's own list. `book` is the spellbook record or undefined.
function sheetSpells(character, book) {
  if (!book) return character.spells || []
  const preparedNames = new Set(character.prepared_spells || [])
  const grantedHere = new Map(
    (character.spells || [])
      .filter((s) => s.featureGranted)
      .map((s) => [s.name, s])
  )
  return (book.spells || []).map((sp) => ({
    ...sp,
    prepared: preparedNames.has(sp.name),
    ...(sp.level === 0 ? { type: 'cantrip' } : {}),
    ...(grantedHere.has(sp.name)
      ? { featureGranted: true, _source: grantedHere.get(sp.name)._source }
      : {}),
  }))
}

// How many prepared spells the class tables give, summed over the character's spellcasting classes.
function preparedWanted(character, ruleset = rulesetOf(character)) {
  return (character.classes || []).reduce((n, c) => {
    if (!resolveSpellcasting(c.name, c.subclass, ruleset)) return n
    return (
      n + (preparedSpellCount(c.name, c.level, 0, c.subclass, ruleset) ?? 0)
    )
  }, 0)
}

// How many leveled class picks are prepared. `spells` comes from sheetSpells.
function preparedHave(character, spells, ruleset = rulesetOf(character)) {
  const granted = grantedSpellKeys(character, ruleset)
  return spells.filter(
    (s) => !isCantrip(s) && !isGrantedSpell(s, granted) && s.prepared !== false
  ).length
}

// null when the character casts no spells (nothing to finish), or when it is linked to a spellbook that
// was not supplied (counting without it would read 0). Otherwise
// { have, want, missing, state: 'complete' | 'short' | 'over' }.
function preparedSpellStatus(character, { spellbooks = [] } = {}) {
  const ruleset = rulesetOf(character)
  const casters = (character.classes || []).filter((c) =>
    resolveSpellcasting(c.name, c.subclass, ruleset)
  )
  if (!casters.length) return null
  const book = character.spellbook_id
    ? spellbooks.find((b) => b.id === character.spellbook_id)
    : undefined
  if (character.spellbook_id && !book) return null
  const want = preparedWanted(character, ruleset)
  const have = preparedHave(character, sheetSpells(character, book), ruleset)
  return {
    have,
    want,
    missing: Math.max(0, want - have),
    state: have < want ? 'short' : have > want ? 'over' : 'complete',
  }
}

module.exports = {
  sheetSpells,
  preparedWanted,
  preparedHave,
  preparedSpellStatus,
}
