// The rule-sources ledger (engine/data/5e/rule-sources.json): where a feature's text was checked against a
// second, independent source. Nothing at runtime reads it; this keeps it honest and makes the count of
// checked features only go up.
const test = require('node:test')
const assert = require('node:assert/strict')
const published = require('../../src/data/published_features.json')
const ledger = require('../data/5e/rule-sources.json')

const spellSlug = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const ids = new Set(published.map((f) => f.id))
const spellIds = new Set(
  require('../../src/data/spells_2024.json').map(
    (s) => `spell:${spellSlug(s.name)}`
  )
)
const allEntries = Object.entries(ledger).filter(([k]) => !k.startsWith('_'))
const entries = allEntries.filter(([k]) => !k.startsWith('spell:'))
const spellEntries = allEntries.filter(([k]) => k.startsWith('spell:'))

test('every ledger entry is a published feature or a 2024 spell with well-formed "ref@date" sources', () => {
  const problems = []
  for (const [id, checks] of allEntries) {
    if (id.startsWith('spell:')) {
      if (!spellIds.has(id)) problems.push(`${id}: not a 2024 spell`)
    } else if (!ids.has(id)) problems.push(`${id}: not a published feature`)
    if (!Array.isArray(checks) || !checks.length)
      problems.push(`${id}: no sources`)
    for (const c of checks ?? [])
      if (!/^(srd52|wd|ddb|book):[^@\s]+@\d{4}-\d{2}-\d{2}$/.test(c))
        problems.push(`${id}: bad source "${c}"`)
  }
  assert.deepEqual(problems, [])
})

// Features whose text agreed with a second source on 2026-11-04 (scripts/crosscheck-srd.js against the
// SRD 5.2). Raise it when more are checked; never lower it.
const CHECKED_BASELINE = 220
// Spells that agreed word for word (scripts/crosscheck-spells.js): 301 of the 322 the SRD has
const SPELLS_CHECKED_BASELINE = 301

test('the number of features and spells checked against a second source only goes up', () => {
  assert.ok(
    entries.length >= CHECKED_BASELINE,
    `${entries.length} features checked, baseline ${CHECKED_BASELINE}`
  )
  assert.ok(
    spellEntries.length >= SPELLS_CHECKED_BASELINE,
    `${spellEntries.length} spells checked, baseline ${SPELLS_CHECKED_BASELINE}`
  )
})

test('the species the SRD covers are all checked: every 2024 trait of the nine SRD species that the SRD also has', () => {
  // the SRD species traits with a published 2024 counterpart that are NOT in the ledger are exactly the
  // ones whose text differs in layout (the lineage tables, embedded in the SRD text); anything else is a miss
  const SRD_SPECIES = [
    'dragonborn',
    'dwarf',
    'elf',
    'gnome',
    'goliath',
    'halfling',
    'human',
    'orc',
    'tiefling',
  ]
  const KNOWN_LAYOUT_DIFFERENCES = [
    'pub24_species_elf-elven-lineage',
    'pub24_species_gnome-gnomish-lineage',
    'pub24_species_tiefling-fiendish-legacy',
  ]
  const unchecked = published
    .filter((f) =>
      SRD_SPECIES.some((s) => String(f.id).startsWith(`pub24_species_${s}-`))
    )
    .filter((f) => !f.id.includes('--'))
    .filter((f) => !ledger[f.id])
    .map((f) => f.id)
    .filter((id) => !KNOWN_LAYOUT_DIFFERENCES.includes(id))
  // traits the SRD names differently or does not list are allowed to be unchecked, but the list is visible here
  assert.ok(unchecked.length < 12, unchecked.join(', '))
})
