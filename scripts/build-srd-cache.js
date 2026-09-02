// Rebuilds src/data/api_data_cache/ from the public dnd5eapi.co SRD (2014
// ruleset) API. This directory is a committed local copy, not a runtime
// cache — the app statically imports these files at build time, so they
// must exist on disk. Re-run this script only to pick up upstream SRD
// corrections; day to day the app reads the committed files, no network
// needed.
//
// Homebrew species (Catrin, Drevani, Hei'ugar) are preserved separately —
// see HOMEBREW_SPECIES below — because they don't come from this API at
// all. Dhovari was lore-only (not a playable species) and is intentionally
// left out.

const fs = require('fs')
const path = require('path')

const API_BASE = 'https://www.dnd5eapi.co/api/2014'
const OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'api_data_cache')

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

// Small concurrency limiter so we don't hammer the public API with hundreds
// of simultaneous requests.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

function writeJSON(filename, data) {
  const file = path.join(OUT_DIR, filename)
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  console.log(
    `wrote ${filename} (${Array.isArray(data) ? data.length : 1} entries)`
  )
}

async function buildFeatures() {
  const list = await getJSON(`${API_BASE}/features`)
  const full = await mapLimit(list.results, 10, (r) =>
    getJSON(`https://www.dnd5eapi.co${r.url}`)
  )
  writeJSON('features.json', full)
}

async function buildSpells() {
  const list = await getJSON(`${API_BASE}/spells`)
  const full = await mapLimit(list.results, 10, (r) =>
    getJSON(`https://www.dnd5eapi.co${r.url}`)
  )
  // spellLists.js does `record.classes.includes(className)` with a
  // capitalized class name (e.g. "Wizard"), and SpellBrowser.vue /
  // WeavePhaseGrid.vue compare `s.school` / `s.classes` directly against
  // plain strings with no `.name` unwrapping — normalize the API's
  // {index,name,url} reference objects down to plain name strings so both
  // match published_spells.json's already-flat schema.
  const normalized = full.map((s) => ({
    ...s,
    school: s.school?.name ?? s.school,
    classes: (s.classes ?? []).map((c) => c.name),
    subclasses: (s.subclasses ?? []).map((c) => c.name),
  }))
  writeJSON('srd_spells_full.json', normalized)

  const classSpellFiles = {
    bard: 'bard_spells.json',
    cleric: 'cleric_spells.json',
    druid: 'druid_spells.json',
    paladin: 'paladin_spells.json',
    ranger: 'ranger_spells.json',
    sorcerer: 'sorcerer_spells.json',
    warlock: 'warlock_spells.json',
    wizard: 'wizard_spells.json',
  }
  for (const [cls, filename] of Object.entries(classSpellFiles)) {
    const classList = await getJSON(`${API_BASE}/classes/${cls}/spells`)
    // spellUtils.js expects { index, name, level } per entry — drop `url`.
    const trimmed = classList.results.map(({ index, name, level }) => ({
      index,
      name,
      level,
    }))
    writeJSON(filename, trimmed)
  }
}

// The 3 recovered homebrew species (Catrin, Drevani, Hei'ugar), restored
// verbatim from the last commit before homebrew.json was migrated into this
// (gitignored, since-lost) cache file — see git commit ce5a64f. Dhovari was
// lore-only there (no speed/traits/ability_score_bonus at all) and is not a
// playable species, so it's deliberately omitted here — confirmed with the
// project owner rather than inventing mechanics for it.
const HOMEBREW_SPECIES = [
  {
    name: 'Catrin',
    plural: 'Catrins',
    adjective: 'Catrinese',
    type: 'homebrew_race',
    origin: 'Yetgrese',
    size: 'Medium',
    speed: 30,
    appearance:
      'Taller and broader than humans. Squared facial features. Mottled and ridged skin along lower jaw and chin instead of facial hair. Skin tones similar to human range but extending further into pink and yellow. Culturally tend toward very long hair.',
    languages: ['Yetgresian Common', 'Catrinese'],
    ability_score_bonus: "Player's choice",
    traits: [
      {
        name: 'Broad Build',
        type: 'passive',
        description:
          'Counts as one size larger for the purposes of carrying capacity and grappling.',
      },
      {
        name: 'Settled Presence',
        type: 'passive',
        description:
          'Advantage on saving throws against being frightened or charmed.',
      },
      {
        name: 'Brace',
        type: 'active',
        recharge: 'long_rest',
        description:
          'As a reaction when hit by a melee attack, halve the damage and push the attacker 5ft away if they are Medium or smaller.',
      },
      {
        name: 'Long Memory',
        type: 'passive',
        description: 'Proficiency in the History skill.',
      },
    ],
    notes: "Majority population of Yetgrese's exterior coast.",
    homebrew: true,
  },
  {
    name: 'Drevani',
    plural: 'Drevani',
    adjective: 'Drevani',
    type: 'homebrew_race',
    origin: 'Yetgrese',
    size: 'Small',
    speed: 25,
    appearance:
      'Humanoid pomeranian appearance. Average height 2.5 feet. Expressive faces, full fur covering. Tilawam subculture tends toward punk aesthetic — leather, piercings, dramatically dyed fur, shaved patches for tattoos.',
    languages: ['Yetgresian Common', 'Drevani'],
    ability_score_bonus: "Player's choice",
    traits: [
      {
        name: 'Sharp Nose',
        type: 'passive',
        description: 'Advantage on Perception checks that rely on smell.',
      },
      {
        name: 'Low Profile',
        type: 'passive',
        description:
          'Can move through the space of Medium or larger creatures without squeezing.',
      },
      {
        name: 'Ferocious Bite',
        type: 'active',
        recharge: 'long_rest',
        description:
          'Make an unarmed strike as a bonus action dealing piercing damage plus STR modifier. Damage die scales every 3 levels: levels 1-2: 1d6, levels 3-5: 2d6, levels 6-8: 3d6, levels 9-11: 4d6, levels 12-14: 5d6, levels 15-17: 6d6, levels 18-20: 7d6.',
      },
    ],
    notes: 'Found in lower altitude regions of Yetgrese.',
    homebrew: true,
  },
  {
    name: "Hei'ugar",
    plural: "Hei'ugar",
    adjective: "Hei'ugar",
    type: 'homebrew_race',
    origin: 'Yetgrese',
    size: 'Medium',
    speed: 30,
    appearance:
      'Grey-undertoned skin, warmer than standard Duergar after generations of surface living. More varied hair than their Duergar kin. Enlarged pupils adapted to both darkness and daylight. Stocky, durable build.',
    languages: ['Yetgresian Common', 'Undercommon'],
    ability_score_bonus: "Player's choice",
    traits: [
      {
        name: 'Grey Resilience',
        type: 'passive',
        description:
          'Advantage on saving throws against illusions, charm, and paralysis.',
      },
      {
        name: 'Darkvision',
        type: 'passive',
        description:
          'Can see in dim light within 60ft as if it were bright light, and in darkness as if it were dim light. Cannot discern color in darkness.',
      },
      {
        name: 'Gust of Wind',
        type: 'active',
        recharge: 'long_rest',
        description:
          'Cast Gust of Wind once per long rest without requiring a spell slot or material components.',
      },
      {
        name: 'Far Sight',
        type: 'passive',
        description:
          'Advantage on Perception checks targeting creatures or objects 60ft or further away.',
      },
    ],
    notes:
      "Duergar who left the underdark and settled on Yetgrese's surface generations ago. Named Hei'ugar meaning roughly Sky Duergar. Treat the open sky as sacred, bordering on religious. Predominantly farmers and fishermen living on Tilawam's outskirts. Approximately 5% of Tilawam's population.",
    homebrew: true,
  },
]

async function buildSpecies() {
  const races = await getJSON(`${API_BASE}/races`)
  const subraces = await getJSON(`${API_BASE}/subraces`)
  const raceDetails = await mapLimit(races.results, 10, (r) =>
    getJSON(`https://www.dnd5eapi.co${r.url}`)
  )
  const subraceDetails = await mapLimit(subraces.results, 10, (r) =>
    getJSON(`https://www.dnd5eapi.co${r.url}`)
  )
  const srdEntries = [...raceDetails, ...subraceDetails].map((s) => ({
    ...s,
    homebrew: false,
  }))
  writeJSON('species.json', [...srdEntries, ...HOMEBREW_SPECIES])
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  await buildFeatures()
  await buildSpells()
  await buildSpecies()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
