const species2014 = require('../../data/5e/species.json')
const { normalizeRuleset, loadRulesetJson } = require('./ruleset')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

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

// scores: {str,dex,con,int,wis,cha}. `choice`: { abilities: [...] } — required only
// when the species has a flexible bonus (e.g. Half-Elf's +1 to two of your choice).
function applySpeciesBonus(scores, speciesName, choice = {}, ruleset) {
  // 2024: species grant no ability scores — applyBackgroundBonus does it.
  if (normalizeRuleset(ruleset) === '2024') {
    return {
      scores,
      notes: [
        `Under the 2024 rules ${speciesName} grants no ability score bonus; the background does.`,
      ],
    }
  }
  const sp = loadSpecies(speciesName)
  if (!sp) {
    return {
      scores,
      notes: [
        `"${speciesName}" isn't in the species catalog — no bonus applied.`,
      ],
    }
  }

  const next = { ...scores }
  for (const [ability, amount] of Object.entries(
    sp.ability_score_bonus || {}
  )) {
    next[ability] = (next[ability] ?? 10) + amount
  }

  if (sp.choice) {
    const picks = choice.abilities || []
    if (picks.length !== sp.choice.count) {
      throw new Error(
        `${speciesName} requires choosing ${sp.choice.count} abilities for its flexible bonus, got ${picks.length}.`
      )
    }
    for (const ability of picks) {
      if (!ABILITIES.includes(ability))
        throw new Error(`Unknown ability "${ability}".`)
      if (sp.choice.exclude?.includes(ability)) {
        throw new Error(
          `${ability.toUpperCase()} can't be chosen for ${speciesName}'s flexible bonus — already fixed.`
        )
      }
      next[ability] = (next[ability] ?? 10) + sp.choice.amount
    }
  }

  return { scores: next, notes: [] }
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
