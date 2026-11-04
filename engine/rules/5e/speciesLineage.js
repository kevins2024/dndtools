// Which species and lineage a stored character is, as the lineage tables in species-choices.json know
// them. A sheet may say genus "Elf" with subgenus "High Elf" (current), genus "Wood Elf" (older), genus
// "Silver Dragonborn", or only carry a feature named "Tiefling Lineage: Infernal"; all resolve here.
//
// No fs/path (plain data), so browser code may use it through featureGrants.js.

const SPECIES_CHOICES = require('../../data/5e2024/species-choices.json')

const SPECIES = Object.keys(SPECIES_CHOICES).filter((k) => !k.startsWith('_'))
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim()

// The species key ("Elf") for a genus ("Wood Elf", "Silver Dragonborn"), or null.
function speciesOf(character) {
  const genus = norm(character.genus)
  if (!genus) return null
  return (
    SPECIES.find((s) => norm(s) === genus) ??
    SPECIES.find((s) => genus.endsWith(` ${norm(s)}`)) ??
    null
  )
}

// The picked lineage/legacy/ancestry key ("High Elf", "Infernal", "Silver"), or null.
function lineageOf(character) {
  const species = speciesOf(character)
  const lineages = species ? SPECIES_CHOICES[species].lineages ?? {} : {}
  const known = Object.keys(lineages)
  if (!known.length) return null
  const find = (name) => known.find((k) => norm(k) === norm(name))
  const lead = norm(character.genus).replace(
    new RegExp(` ?${norm(species)}$`),
    ''
  )
  const direct = find(character.subgenus) ?? find(character.genus) ?? find(lead)
  if (direct) return direct
  for (const f of character.features ?? []) {
    if (f.type !== 'speciesTrait') continue
    const hit = find(/:\s*(.+)$/.exec(f.name ?? '')?.[1])
    if (hit) return hit
  }
  return null
}

// The lineage's own table row ({ resistance, darkvision, speed, cantrips, spellsAtLevel... }), or null.
function lineageRow(character) {
  const species = speciesOf(character)
  const lineage = lineageOf(character)
  return species && lineage
    ? SPECIES_CHOICES[species].lineages[lineage] ?? null
    : null
}

const slug = (s) =>
  norm(s)
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// The lineage/ancestry/legacy title -> species ("Giant Ancestry" -> "Goliath").
const SPECIES_BY_PICK_TITLE = Object.fromEntries(
  SPECIES.filter((s) => SPECIES_CHOICES[s].lineageChoice).map((s) => [
    norm(
      SPECIES_CHOICES[s].choices.find(
        (c) => c.id === SPECIES_CHOICES[s].lineageChoice
      ).title
    ),
    s,
  ])
)

// A species pick is stored as a feature named "<title>: <pick>" ("Giant Ancestry: Stone's Endurance")
// that carries no id of its own. Its feature-mechanics entry is keyed
// "pub24_species_<species>-<title>--<pick>"; this derives that id from the name, so the feature gets its
// rules whichever path put it on the sheet, an old record included. null for any other feature.
function pickFeatureId(feature) {
  if (feature?.id) return null
  const m = /^(.+?):\s*(.+)$/.exec(feature?.name ?? '')
  const species = m ? SPECIES_BY_PICK_TITLE[norm(m[1])] : null
  return species
    ? `pub24_species_${slug(species)}-${slug(m[1])}--${slug(m[2])}`
    : null
}

module.exports = {
  speciesOf,
  lineageOf,
  lineageRow,
  pickFeatureId,
  SPECIES_CHOICES,
}
