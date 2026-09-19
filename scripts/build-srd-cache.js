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
// (gitignored, since-lost) cache file — see git commit ce5a64f. Plus 3 more
// (Lithkin, Dhovari, Olwood Trolls) added directly to the committed
// species.json in a later session (2026-09-09, lore extraction from The
// Liliveth arc) without this script ever being updated to match — a real
// bug found 2026-09-19 while reconciling this file's SRD scope: re-running
// this script would have silently deleted all 3 on the next cache refresh,
// with no warning. All 3 are `playable: false` (world-flavor species, not
// real PC options — see each entry's own `playable_note`; server.js's
// /api/engine/species route respects that flag) — this reverses the
// earlier note here that Dhovari specifically was "deliberately omitted";
// it was later added back on purpose, just never synced to this file.
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
    ability_score_bonus: { con: 2, wis: 1 },
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
    ability_score_bonus: { dex: 2, cha: 1 },
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
    ability_score_bonus: { wis: 2, con: 1 },
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
  {
    name: 'Lithkin',
    plural: 'Lithkin',
    adjective: 'Lithkin',
    type: 'homebrew_race',
    size: 'Small',
    appearance:
      "Smaller than halflings, with a build closer to childlike proportions but adult bearing. Long tapered ears, a sharp pointed chin, a downward-tipped nose, two visible pointed teeth at the corners of the mouth, and diamond-shaped eye openings that give the eyes within an angular cast. Skin tone and coloration are not fixed at birth — they are naturalistic to wherever a Lithkin has spent the majority of their life, and the shift can continue mid-life: a Lithkin who relocates to a new environment for long enough gradually takes on that environment's dominant palette, and in extreme or magically saturated environments even textural qualities of the local flora or fauna. The mechanism is not fully understood even by Lithkin themselves — treated as an accepted fact of the species rather than a studied phenomenon. When a Lithkin's coloration has shifted extensively, they sometimes lose an accurate sense of their own 'natural' appearance, having gone long periods without seeing themselves reflected.",
    notes:
      'Aging is difficult for outsiders to judge — a Lithkin may look the same for centuries, and lifespan expectations vary by regional lore rather than any agreed species standard. Generally solitary-leaning by temperament but not reclusive — tend toward quiet, meticulous work (craftsmanship, maintenance, tending) and often settle in isolated postings for very long stretches without apparent discomfort, though the isolation eventually does register even in a long-lived species.',
    homebrew: true,
    playable: false,
    playable_note:
      "World-flavor species, not offered as a player option — introduced 2026-09-09 via lore extraction (The Liliveth arc). See src/data/lore.json / server.js's /api/engine/species route for how the playable:false flag is respected.",
  },
  {
    name: 'Dhovari',
    plural: 'Dhovari',
    adjective: 'Dhovari',
    type: 'homebrew_race',
    origin: 'Olwood Verge',
    size: 'Medium to Large (6-7ft)',
    appearance:
      'Bipedal, digitigrade legs, six to seven feet tall. Broad through chest and shoulders. Patterned fur-feather covering that lies flat when calm and raises when alert — darker along spine and shoulders, lighter at throat and chest. Forward-facing luminescent eyes. Hands with four long flexible fingers, hardened dark fingertips. Vocal anatomy suggests a different structure than humanoid — language is tonal and layered, chest and throat operating simultaneously.',
    notes:
      "Uncontacted by wider civilization. Patient, hierarchical, deliberate — think before speaking as a deep habit, not demonstrative but not cold. Ancestors co-built a ridge complex with another (human) civilization long ago; eleven generations have each carried one quarter of a broken disc, and a statue found in nearby ruins depicts them. The name \"Dhovari\" is rendered through a Helm of Comprehending Languages — pronunciation uncertain, so treat the spelling as an approximation rather than confirmed. Relationship to the Olwood Trolls (also native to Fynesmarch/Olwood Verge) is unclear but possibly connected — doorway proportions in the ridge complex may match the Trolls' height instead of the Dhovari's, per the Trolls' own account.",
    homebrew: true,
    playable: false,
    playable_note:
      "World-flavor species (an uncontacted people, not a PC option), added 2026-09-09 alongside Lithkin — the full lore entry also still lives at src/data/lore.json's lore_species_01 (kept in both places on purpose, per project owner: this file is the quick-reference/browsable version, lore.json keeps the fuller narrative for a genuinely rare species). See server.js's /api/engine/species route for how the playable:false flag is respected.",
  },
  {
    name: 'Olwood Trolls',
    plural: 'Olwood Trolls',
    adjective: 'Olwood',
    type: 'homebrew_race',
    origin: 'Fynesmarch, Olwood Verge',
    size: 'Large (7-8ft)',
    appearance:
      'Seven to eight feet tall, lean relative to species reputation, grey-green skin that disappears against bark in low light. More intelligent in bearing than common reputation suggests.',
    notes:
      'Neutral to friendly — individual variance likely. Precise with language, patient, dry humor; complete in their attention, with a meditative stillness that reads as presence rather than absence. Distinct from feral trolls, which they do not claim as kin — consider them as a feral dog is to a domestic one. May have built or used the ridge complex near Olwood Verge given doorway proportions matching their height. Relationship to the Dhovari\'s ancestors is unclear but possibly connected. Aware of another, unnamed people from deep northeast (referred to as "Vessel\'s kind") — encountered them once, and the one survivor of that encounter could not describe the color of the sky there.',
    homebrew: true,
    playable: false,
    playable_note:
      "World-flavor species, added 2026-09-09 alongside Lithkin and Dhovari — the full lore entry also still lives at src/data/lore.json's lore_species_03 (kept in both places on purpose, per project owner: this file is the quick-reference/browsable version, lore.json keeps the fuller narrative for a genuinely rare species). See server.js's /api/engine/species route for how the playable:false flag is respected.",
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
