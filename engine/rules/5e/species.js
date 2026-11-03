const species2014 = require('../../data/5e/species.json')
const { normalizeRuleset, loadRulesetJson } = require('./ruleset')

// Under 2024: every species the 2024 books rewrote, plus the 2014 species with
// no rewrite (Half-Elf, Half-Orc, Eladrin...) tagged `legacy: true` — still
// playable, just not rewritten. 2024 species carry no ability_score_bonus (that
// moved to the background).
function speciesFor(ruleset) {
  if (normalizeRuleset(ruleset) !== '2024') return species2014
  const rewritten = loadRulesetJson('2024', 'species.json') ?? []
  const have = new Set(rewritten.map((s) => s.name.toLowerCase()))
  return [
    ...rewritten,
    ...species2014
      .filter((s) => !have.has(s.name.toLowerCase()))
      .map((s) => ({ ...s, legacy: true })),
  ]
}

function loadSpecies(name, ruleset) {
  return (
    speciesFor(ruleset).find(
      (s) => s.name.toLowerCase() === String(name).toLowerCase()
    ) || null
  )
}

function listSpecies(ruleset) {
  return speciesFor(ruleset).map((s) => ({ name: s.name }))
}

// Every trait a character of this species/subrace actually has — species-
// level traits plus the matching subrace's own, flattened into one array.
// Mirrors NewCharacterTool.vue's client-side `displayTraits` computed, but
// as a reusable engine helper for diffLevelUp.js (which needs this for a
// character already built, not just at creation time). Returns [] for an
// unknown species/subrace rather than throwing — callers treat "no traits"
// and "no species" the same way (nothing to apply).
function traitsFor(speciesName, subraceName, ruleset) {
  const sp = loadSpecies(speciesName, ruleset)
  if (!sp) return []
  const traits = [...(sp.traits || [])]
  if (subraceName) {
    const sub = (sp.subraces || []).find(
      (s) => s.name.toLowerCase() === String(subraceName).toLowerCase()
    )
    if (sub) traits.push(...(sub.traits || []))
  }
  return traits
}

// Species grant no ability scores in the 2024 rules (the background does, see
// backgrounds.applyBackgroundBonus). Kept so callers have one place to ask; legacy
// species such as Half-Elf get nothing either. The 2014 +2/+1 species bonuses are retired
// (tag `ruleset-2014-final`).
function applySpeciesBonus(scores, speciesName) {
  return {
    scores,
    notes: [
      `${speciesName} grants no ability score bonus; the background does.`,
    ],
  }
}

// Roster `genus` strings are not always a species name: "Silver Dragonborn",
// "Wood Elf", "Eladrin Elf", "Hill Dwarf". Returns { species, hint } where
// species is a species name (2014 or 2024) and hint is the leftover qualifier.
const BASE_SPECIES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Dragonborn',
  'Gnome',
  'Goliath',
  'Tiefling',
  'Aasimar',
  'Orc',
]
function resolveSpeciesName(genus, subgenus) {
  if (!genus) return { species: null, hint: subgenus || '' }
  const exact = loadSpecies(genus, '2024')
  if (exact) return { species: exact.name, hint: subgenus || '' }
  const base = BASE_SPECIES.find((b) => new RegExp(`\\b${b}$`, 'i').test(genus))
  if (base) {
    const lead = genus.replace(new RegExp(`\\s*${base}$`, 'i'), '').trim()
    return { species: base, hint: [lead, subgenus].filter(Boolean).join(' ') }
  }
  return { species: genus, hint: subgenus || '' }
}

// A species the 2024 books rewrote is its 2024 self entirely: none of its 2014 traits (nor any of its
// 2014 subraces') carry over, whatever an older sheet still lists. Returns the 2014 feature ids that
// are therefore stale for this genus/subgenus — empty for a species 2024 did not rewrite (Half-Elf,
// Half-Orc ...), which keeps its 2014 traits. The generic 2014 "Darkvision" feature stands in for the
// species' darkvision, so it is stale too once the 2024 species grants its own.
function staleSpeciesFeatureIds(genus, subgenus, features = []) {
  // Only a leak when the sheet already holds the 2024 version too; a lineage 2024 did not rewrite
  // (Eladrin) is kept whole as its 2014 self, as the migration does.
  if (!features.some((f) => /^pub24_species_/.test(f.id || '')))
    return new Set()
  const { species } = resolveSpeciesName(genus, subgenus)
  if (!species) return new Set()
  const rewritten = (loadRulesetJson('2024', 'species.json') ?? []).find(
    (s) => s.name.toLowerCase() === species.toLowerCase()
  )
  const old = species2014.find(
    (s) => s.name.toLowerCase() === species.toLowerCase()
  )
  if (!rewritten || !old) return new Set()
  const ids = [
    ...(old.traits || []),
    ...(old.subraces || []).flatMap((sub) => sub.traits || []),
  ]
    .map((t) => t.id)
    .filter(Boolean)
  if ((rewritten.traits || []).some((t) => /darkvision/i.test(t.id || t.name)))
    ids.push('pub_darkvision')
  return new Set(ids)
}

module.exports = {
  staleSpeciesFeatureIds,
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
  traitsFor,
  resolveSpeciesName,
}
