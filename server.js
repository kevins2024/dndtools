// server.js
// Local development data server — read/write JSON files
// Run with: node server.js (or via npm run dev using concurrently)
// This server is NEVER deployed — development only

const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const { threeWayMerge } = require('./merge-utils')
const engine = require('./engine/index')

const app = express()
const PORT = process.env.PORT || 3001
const DATA_DIR = path.resolve(__dirname, './src/data')
const PREFS_FILE = path.resolve(__dirname, './user_prefs.json')

// Strip UTF-8 BOM before parsing — some editors write BOMs that break JSON.parse
const readJSON = (file) =>
  JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))

// Whitelist of allowed table names — prevents arbitrary file access
const ALLOWED_TABLES = [
  'characters',
  'npcs',
  'places',
  'party_items',
  'world',
  'factions',
  'quests',
  'finances',
  'networks',
  'assets',
  'relationships',
  'companions',
  'lore',
  'spellbooks',
  'mounts',
]

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── GET /hello ───────────────────────────────────────────
app.get('/hello', (req, res) => {
  res.send('World!')
})

// ── GET /api/user_prefs ──────────────────────────────────
// Served from project root (not src/) so webpack never watches it.
app.get('/api/user_prefs', (req, res) => {
  try {
    const data = fs.existsSync(PREFS_FILE)
      ? readJSON(PREFS_FILE)
      : { savedParties: [] }
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to read user_prefs.json' })
  }
})

app.post('/api/user_prefs', (req, res) => {
  try {
    fs.writeFileSync(PREFS_FILE, JSON.stringify(req.body, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to write user_prefs.json' })
  }
})

// ── GET /api/homebrew ─────────────────────────────────────
// Combined read for lookupService's dev-mode freshness check — returns both
// files in the shape the client already expects ({ spells, features }).
// Registered BEFORE the generic /api/:table route below so it isn't shadowed
// (Express tries routes in registration order; the generic handler would
// otherwise 400 on "homebrew" once it's removed from ALLOWED_TABLES).
app.get('/api/homebrew', (req, res) => {
  try {
    const spells = readJSON(path.join(DATA_DIR, 'published_spells.json'))
    const features = readJSON(path.join(DATA_DIR, 'published_features.json'))
    res.json({ spells, features })
  } catch (err) {
    console.error('Error reading published spells/features:', err.message)
    res.status(500).json({
      error: 'Failed to read published_spells.json / published_features.json',
    })
  }
})

// ── GET /api/:table ──────────────────────────────────────
app.get('/api/:table', (req, res) => {
  const { table } = req.params

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Unknown table: ${table}` })
  }

  const file = path.join(DATA_DIR, `${table}.json`)

  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: `File not found: ${table}.json` })
  }

  try {
    const data = readJSON(file)
    res.json(data)
  } catch (err) {
    console.error(`Error reading ${table}.json:`, err.message)
    res.status(500).json({ error: `Failed to read ${table}.json` })
  }
})

// ── POST /api/:table ─────────────────────────────────────
// Body is { current, base }: `current` is the client's in-memory value for
// this table, `base` is what the client loaded/last synced (the common
// ancestor). The file on disk is re-read fresh right here and 3-way merged
// against those two, so a save from a stale browser tab only ever applies
// the rows/fields that tab actually changed — it can't clobber rows that
// changed on disk (e.g. a direct edit) since it last loaded. The merged
// result is written to disk and echoed back so the client can resync its
// local state to match what was actually persisted.
app.post('/api/:table', (req, res) => {
  const { table } = req.params

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Unknown table: ${table}` })
  }

  const body = req.body
  const isMergeShape =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'current' in body

  if (!body || typeof body !== 'object') {
    return res
      .status(400)
      .json({ error: 'Request body must be a JSON object or array' })
  }

  const current = isMergeShape ? body.current : body
  const base = isMergeShape ? body.base : undefined

  if (
    current == null ||
    (typeof current !== 'object' && !Array.isArray(current))
  ) {
    return res
      .status(400)
      .json({ error: '"current" must be a JSON object or array' })
  }

  const file = path.join(DATA_DIR, `${table}.json`)

  try {
    const theirs = fs.existsSync(file)
      ? readJSON(file)
      : Array.isArray(current)
      ? []
      : {}

    const { merged, conflicts } = threeWayMerge(base, current, theirs)

    fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf8')
    console.log(
      `Saved: ${table}.json${
        conflicts.length
          ? ` (${
              conflicts.length
            } conflict(s) resolved in favor of disk: ${conflicts.join(', ')})`
          : ''
      }`
    )
    res.json({ ok: true, data: merged, conflicts })
  } catch (err) {
    console.error(`Error writing ${table}.json:`, err.message)
    res.status(500).json({ error: `Failed to write ${table}.json` })
  }
})

// ── PATCH /api/homebrew/:section ─────────────────────────
// Upsert a single spell or feature by name. "Homebrew" here means "the
// project's own catalog of non-SRD content" — spells/features now live
// directly alongside their RAW counterparts (published_spells.json /
// published_features.json), each entry marked `homebrew: true` only if it's
// genuinely custom rather than real official content missing from the SRD
// cache. See engine/CHECKLIST.md for the full reorg story.
const SECTION_FILES = {
  spells: 'published_spells.json',
  features: 'published_features.json',
}
app.patch('/api/homebrew/:section', (req, res) => {
  const { section } = req.params
  if (!SECTION_FILES[section]) {
    return res
      .status(400)
      .json({ error: 'Section must be "spells" or "features"' })
  }
  const item = req.body
  if (!item?.name) {
    return res.status(400).json({ error: 'Item must have a name field' })
  }
  const file = path.join(DATA_DIR, SECTION_FILES[section])
  try {
    const list = readJSON(file)
    const idx = list.findIndex(
      (x) => x.name.toLowerCase() === item.name.toLowerCase()
    )
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item }
    } else {
      list.push(item)
    }
    fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8')
    console.log(`Saved ${section}: ${item.name}`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`Error updating ${section}:`, err.message)
    res
      .status(500)
      .json({ error: `Failed to update ${SECTION_FILES[section]}` })
  }
})

// ── GET /api/cache/:filename ─────────────────────────────
const CACHE_DIR = path.resolve(__dirname, './src/data/api_data_cache')
const ALLOWED_CACHE_FILES = [
  'spells',
  'features',
  'items',
  'monsters',
  'species',
  'backgrounds',
]

app.get('/api/cache/:filename', (req, res) => {
  const { filename } = req.params
  if (!ALLOWED_CACHE_FILES.includes(filename)) {
    return res.status(400).json({ error: `Unknown cache file: ${filename}` })
  }
  const file = path.join(CACHE_DIR, `${filename}.json`)
  if (!fs.existsSync(file)) {
    return res
      .status(404)
      .json({ error: `Cache file not found: ${filename}.json` })
  }
  try {
    const data = readJSON(file)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: `Failed to read ${filename}.json` })
  }
})

// ── POST /api/dm-context ─────────────────────────────────
// Writes a Markdown context file to public/dm-context/ for GitHub hosting.
// Overwrites if the file already exists.
app.post('/api/dm-context', (req, res) => {
  const { filename, content } = req.body
  if (!filename || !content) {
    return res.status(400).json({ error: 'filename and content are required' })
  }
  const safe = filename.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()
  const dir = path.resolve(__dirname, 'public', 'dm-context')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${safe}.md`)
  try {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`DM context written: ${filePath}`)
    res.json({ ok: true, path: `/dm-context/${safe}.md` })
  } catch (err) {
    console.error('Error writing DM context:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/engine/preview-level-up ────────────────────
// Wraps engine/rules/diffLevelUp.js. Pure computation, no disk writes — the
// client sends its own in-memory copy of the character plus whatever
// level-up choices have been made so far (HP roll/average, resolved ASI/feat
// picks), gets back { patch, pendingChoices, warnings, description }, and
// applies `patch` to its own store once the DM confirms (APPLY_LEVEL_UP
// mutation in store/index.js) — persisted through the normal characters.json
// save path like any other character edit, not a separate write endpoint.
app.post('/api/engine/preview-level-up', (req, res) => {
  const {
    character,
    className,
    toLevel,
    hpMethod,
    hpRolls,
    asiOrFeatResolutions,
    invocationChoices,
    pactBoonChoice,
    pactBoonBonusSpells,
    spellChoices,
    spellSwap,
    spellbookChoices,
    multiclassSkillChoice,
    fightingStyleChoice,
    favoredEnemyChoice,
    naturalExplorerChoice,
    expertiseChoice,
    metamagicChoice,
    maneuverChoices,
    magicalSecretsChoice,
    ironMindChoice,
    bladesingerWeaponChoice,
    divineMagicChoice,
    dragonAncestorChoice,
    mysticArcanumChoice,
    spellMasteryChoice,
    signatureSpellsChoice,
    masterOfIntrigueGamingSetChoice,
    masterOfIntrigueLanguageChoices,
    bonusProficienciesChoice,
  } = req.body
  if (!character || !className) {
    return res
      .status(400)
      .json({ error: '"character" and "className" are required' })
  }
  try {
    const result = engine.diffLevelUp(character, {
      className,
      toLevel,
      hpMethod,
      hpRolls,
      asiOrFeatResolutions,
      invocationChoices,
      pactBoonChoice,
      pactBoonBonusSpells,
      spellChoices,
      spellSwap,
      spellbookChoices,
      multiclassSkillChoice,
      fightingStyleChoice,
      favoredEnemyChoice,
      naturalExplorerChoice,
      expertiseChoice,
      metamagicChoice,
      maneuverChoices,
      magicalSecretsChoice,
      ironMindChoice,
      bladesingerWeaponChoice,
      divineMagicChoice,
      dragonAncestorChoice,
      mysticArcanumChoice,
      spellMasteryChoice,
      signatureSpellsChoice,
      masterOfIntrigueGamingSetChoice,
      masterOfIntrigueLanguageChoices,
      bonusProficienciesChoice,
    })
    res.json(result)
  } catch (err) {
    console.error('Error computing level-up preview:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/subclasses ────────────────────────────
// Every subclass across every class, unfiltered, expanded_spell_list
// included — loaded once at app startup so the frontend can derive
// subclass-granted bonus spells (see spellUtils.js) without a per-character
// copy of that table living on each character record.
app.get('/api/engine/subclasses', (req, res) => {
  try {
    res.json(engine.listSubclasses())
  } catch (err) {
    console.error('Error listing all subclasses:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/subclasses/:className ────────────────
// Lists the subclasses the engine actually has data for, so the UI can offer
// real choices instead of free text when a subclass pick is needed.
app.get('/api/engine/subclasses/:className', (req, res) => {
  try {
    const all = engine.listSubclasses()
    res.json(
      all.filter(
        (s) => s.class.toLowerCase() === req.params.className.toLowerCase()
      )
    )
  } catch (err) {
    console.error('Error listing subclasses:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/feats ─────────────────────────────────
// Full PHB/XGE/TCE 2014-ruleset feat catalog (engine/data/feats.json, 72
// entries — see engine/CHECKLIST.md Phase 7b). The UI uses this to offer
// real choices for every cataloged feat (ability score bump, the generic
// `choices` array, prerequisite), falling back to free text for anything
// not in the catalog.
app.get('/api/engine/feats', (req, res) => {
  try {
    const raw = require('./engine/data/5e/feats.json')
    const feats = Object.entries(raw)
      .filter(([name]) => !name.startsWith('_'))
      .map(([name, data]) => ({
        name,
        source: data.source ?? null,
        prerequisite: data.prerequisite ?? null,
        ability_score_increase: data.ability_score_increase ?? null,
        grants_spells: data.grants_spells ?? null,
        choices: data.choices ?? null,
        stat_bonuses: data.stat_bonuses ?? null,
      }))
    res.json(feats)
  } catch (err) {
    console.error('Error listing feats:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/engine/feat-eligibility ─────────────────────
// Given a character, evaluate every cataloged feat's prerequisite
// (engine.meetsFeatPrerequisites) and return { featName: {met, reason,
// unknown} } for all of them. Separate from GET /api/engine/feats (which is
// character-agnostic and cacheable) — mirrors preview-level-up's own
// pattern of POSTing the client's in-memory character for a pure
// computation, no disk access. `unknown: true` means a proficiency-based
// prerequisite couldn't be reliably checked (most characters don't track
// armor/weapon proficiencies explicitly) — treated as met, not blocked.
app.post('/api/engine/feat-eligibility', (req, res) => {
  const { character } = req.body
  if (!character) {
    return res.status(400).json({ error: '"character" is required' })
  }
  try {
    const raw = require('./engine/data/5e/feats.json')
    const result = {}
    for (const name of Object.keys(raw)) {
      if (name.startsWith('_')) continue
      result[name] = engine.meetsFeatPrerequisites(character, name)
    }
    res.json(result)
  } catch (err) {
    console.error('Error computing feat eligibility:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/invocations ───────────────────────────
// Full 32-entry Eldritch Invocations catalog (engine/data/invocations.json
// — see engine/CHECKLIST.md). Mirrors GET /api/engine/feats.
app.get('/api/engine/invocations', (req, res) => {
  try {
    res.json(engine.listInvocations())
  } catch (err) {
    console.error('Error listing invocations:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/engine/invocation-eligibility ───────────────
// Given a character, evaluate every cataloged invocation's prerequisite
// against it and return { invocationName: {met, reason, unknown} } for all
// of them — mirrors POST /api/engine/feat-eligibility exactly (same
// "POST the client's in-memory draft character, get a pure computation
// back" pattern, same soft-filter philosophy in the UI).
app.post('/api/engine/invocation-eligibility', (req, res) => {
  const { character } = req.body
  if (!character) {
    return res.status(400).json({ error: '"character" is required' })
  }
  try {
    const result = {}
    for (const inv of engine.listInvocations()) {
      result[inv.name] = engine.meetsInvocationPrerequisite(character, inv.name)
    }
    res.json(result)
  } catch (err) {
    console.error('Error computing invocation eligibility:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/pact-boons ────────────────────────────
// The 3 Pact Boon options (engine/data/pact-boons.json).
app.get('/api/engine/pact-boons', (req, res) => {
  try {
    res.json(engine.listPactBoons())
  } catch (err) {
    console.error('Error listing pact boons:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/engine/spell-choices ────────────────────────
// Powers the generic known-spell/cantrip picker in LevelUpTool.vue — given
// a character mid-level-up (className/subclassName/toLevel describe the
// level-up in progress, same params preview-level-up already takes),
// returns the real eligible spell/cantrip list to pick from: class-list
// membership and the character's currently-selectable max spell level are
// both computed here (engine-side), not client-side, per this project's
// "engine stays the source of truth" architecture — a future non-Vue
// frontend gets the same answer. `pool: 'any'` (Pact of the Tome's "3
// cantrips from any class's list") skips the class-list filter entirely.
// `excludeNames` lets the caller pass the character's already-known
// spells/cantrips so the picker doesn't offer a duplicate — normally just
// character.spells's own names, computed here so the client doesn't have to.
app.post('/api/engine/spell-choices', (req, res) => {
  const { character, className, subclassName, toLevel, cantripsOnly, pool } =
    req.body
  if (!character || !className) {
    return res
      .status(400)
      .json({ error: '"character" and "className" are required' })
  }
  try {
    // Third-casters (Eldritch Knight/Arcane Trickster) draw from WIZARD's
    // spell list, not a list of their own — same mapping the rest of this
    // project's spellcasting code keys off subclass name for.
    const listClassName =
      subclassName === 'Eldritch Knight' || subclassName === 'Arcane Trickster'
        ? 'Wizard'
        : className
    const otherClasses = (character.classes || [])
      .filter((c) => c.name?.toLowerCase() !== className.toLowerCase())
      .map((c) => ({ name: c.name, level: c.level, subclass: c.subclass }))
    const existingEntry = (character.classes || []).find(
      (c) => c.name?.toLowerCase() === className.toLowerCase()
    )
    const level = toLevel ?? (existingEntry?.level ?? 0) + 1
    const maxLevel = cantripsOnly
      ? 0
      : engine.effectiveMaxSpellLevel({
          className,
          subclassName,
          level,
          otherClasses,
        })
    const excludeNames = (character.spells || []).map((s) => s.name)
    const options = engine.listSpellsForClass(listClassName, {
      maxLevel,
      cantripsOnly: Boolean(cantripsOnly),
      pool: pool === 'any' ? 'any' : 'class',
      excludeNames,
    })
    res.json({ maxLevel, options })
  } catch (err) {
    console.error('Error computing spell choices:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/engine/feat-spell-choices ───────────────────
// Powers LevelUpTool.vue's 'spell_choice'-type feat choices (Magic
// Initiate, Ritual Caster, Spell Sniper, Artificer Initiate, Wood Elf
// Magic, Fey Touched, Shadow Touched — see feats.json's own
// _schema.choices doc for the full spell_filter shape). Unlike
// /api/engine/spell-choices above, this isn't tied to any class's caster
// progression — a feat grants a spell at a level the FEAT fixes, whether
// or not the character can even cast spells that high yet (a Fighter with
// Fey Touched still gets a real 1st-level spell). className is optional —
// omit it (or the caller passes null) for Fey Touched/Shadow Touched's
// "any spellbook" grants, which aren't tied to one class's list at all.
app.post('/api/engine/feat-spell-choices', (req, res) => {
  const {
    character,
    className,
    level,
    cantripsOnly,
    schools,
    ritualOnly,
    attackRollOnly,
  } = req.body
  try {
    const excludeNames = (character?.spells || []).map((s) => s.name)
    const options = engine.listFeatSpellChoices({
      className: className || null,
      level: level ?? null,
      cantripsOnly: Boolean(cantripsOnly),
      schools: schools ?? null,
      ritualOnly: Boolean(ritualOnly),
      attackRollOnly: Boolean(attackRollOnly),
      excludeNames,
    })
    res.json({ options })
  } catch (err) {
    console.error('Error computing feat spell choices:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/classes ───────────────────────────────
// Full class records (hit die, spellcasting ability/type, saving throws,
// subclass timing), not just names — the New Character tool needs
// spellcasting.ability to build a correct character shell before it can even
// call preview-level-up.
app.get('/api/engine/classes', (req, res) => {
  try {
    const classes = engine.listClasses().map((name) => ({
      name,
      ...engine.loadClass(name),
      hitDie: engine.hitDieForClass(name),
    }))
    res.json(classes)
  } catch (err) {
    console.error('Error listing classes:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/species ───────────────────────────────
// Combines the engine's own mechanical species catalog (9 standard PHB
// species — real ability score bonuses, speed, darkvision) with this
// project's homebrew species — Catrin, Drevani, Hei'ugar, Dhovari — pulled
// live from api_data_cache/species.json, which already carries their own
// ability_score_bonus/traits/speed (added when homebrew.json was split up,
// see engine/CHECKLIST.md). The other ~380 entries in that cache are pure
// SRD flavor text with no mechanical fields, so they're deliberately
// excluded here rather than offered as a choice that silently does nothing.
app.get('/api/engine/species', (req, res) => {
  try {
    const standard = engine.listSpecies().map((s) => ({
      ...engine.loadSpecies(s.name),
      homebrew: false,
    }))
    const cache = readJSON(
      path.join(DATA_DIR, 'api_data_cache', 'species.json')
    )
    const cacheArr = Array.isArray(cache) ? cache : Object.values(cache)[0]
    // playable: false is an explicit opt-out for a homebrew species that's
    // real world-flavor but was never meant to be a player option (Lithkin,
    // added 2026-09-09 via lore extraction) — same "don't offer a choice
    // that silently does nothing" spirit as the SRD-flavor-text exclusion
    // above, just for a homebrew entry instead of a mechanically-empty one.
    const homebrew = cacheArr.filter(
      (s) => s.homebrew === true && s.playable !== false
    )
    res.json([...standard, ...homebrew])
  } catch (err) {
    console.error('Error listing species:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/engine/build-npc ────────────────────────────
// Headless "real class-built enemy" — engine.buildCombatant drives the same
// diffLevelUp engine LevelUpTool.vue uses, with an automatic chooser instead
// of a human, so NpcGenerator.vue / EncounterGenerator.vue can get a
// mechanically real, level-appropriate combatant (real class features, real
// spells, real subclass) instead of encounter_utils.js's level-insensitive
// synthetic generator. See engine/rules/npcBuilder.js for the "why."
//
// Species is randomized HERE, not inside buildCombatant, and deliberately
// restricted to engine.listSpecies()'s 9 real SRD entries — NOT the full
// 13-entry merged catalog /api/engine/species exposes. applySpeciesBonus
// (called inside buildCombatant) only reads engine/data/species.json itself;
// it has no access to the 4 homebrew species that live in
// api_data_cache/species.json and only get merged in by the /species route
// above. Randomizing across the full 13 would silently build a homebrew-
// species NPC with a ZERO ability-score bonus applied — a real species
// picker for the auto-builder is a reasonable fast-follow, not this pass.
//
// Gender is cosmetic flavor only (nothing in this app reads it
// mechanically) — GENDERS is duplicated from src/utils/character_utils.js
// rather than required, since that file is an ES module (webpack-bundled
// for the browser) and this is a plain CommonJS server file.
const GENDERS = ['Male', 'Female']
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
app.post('/api/engine/build-npc', (req, res) => {
  const { role, targetLevel, isBoss, speciesName } = req.body
  if (!role || !targetLevel) {
    return res
      .status(400)
      .json({ error: '"role" and "targetLevel" are required' })
  }
  try {
    const species = speciesName || pick(engine.listSpecies()).name
    const gender = pick(GENDERS)
    const { character, warnings } = engine.buildCombatant({
      speciesName: species,
      role,
      targetLevel,
    })
    const encounterData = engine.toEncounterData(character, role, !!isBoss)
    res.json({ character, encounterData, gender, warnings })
  } catch (err) {
    console.error('Error building NPC:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/roles ─────────────────────────────────
// Catalog for NpcGenerator.vue's / EncounterGenerator.vue's role pickers —
// the 5 role→class→subclass combos build-npc actually supports.
app.get('/api/engine/roles', (req, res) => {
  res.json(engine.listRoles())
})

// ── GET /api/engine/backgrounds ───────────────────────────
// A curated 40 real backgrounds with verified RAW skill proficiencies (see
// engine/data/backgrounds.json / CHECKLIST.md) — replaces the raw
// api_data_cache/backgrounds.json (405 entries, ~360 unique names, no skill
// data at all) as the New Character tool's background picker.
app.get('/api/engine/backgrounds', (req, res) => {
  try {
    res.json(engine.listBackgrounds())
  } catch (err) {
    console.error('Error listing backgrounds:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/skills ────────────────────────────────
app.get('/api/engine/skills', (req, res) => {
  try {
    res.json(engine.listSkills())
  } catch (err) {
    console.error('Error listing skills:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/engine/languages ─────────────────────────────
// The 16 real PHB standard/exotic languages a player can pick for a
// background's or species' "N languages of your choice" grant — see
// engine/data/languages.json.
app.get('/api/engine/languages', (req, res) => {
  try {
    res.json(engine.listLanguages())
  } catch (err) {
    console.error('Error listing languages:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Startup Scripts ───────────────────────────────────────
// Add one-off data migration functions here, then clear them out when done.
// Each function receives DATA_DIR and should log what it did.

function addIndexToFile(filename) {
  const file = path.join(DATA_DIR, filename)
  if (!fs.existsSync(file)) {
    console.log(`[startup] Skipping ${filename} — file not found`)
    return
  }
  const data = readJSON(file)
  if (!Array.isArray(data)) {
    console.log(`[startup] Skipping ${filename} — not an array`)
    return
  }
  const updated = data.map((obj, i) => ({ ...obj, id: i }))
  fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf8')
  console.log(`[startup] Indexed ${updated.length} entries in ${filename}`)
}

function startupScripts() {
  // addIndexToFile('party_items.json')
}

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Data server running on http://localhost:${PORT}`)
  console.log(`Serving files from: ${DATA_DIR}`)
  startupScripts()
})
