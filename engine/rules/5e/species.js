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

module.exports = {
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
  traitsFor,
  resolveSpeciesName,
}
