// server.js
// Local development data server — read/write JSON files
// Run with: node server.js (or via npm run dev using concurrently)
// This server is NEVER deployed — development only

const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const { threeWayMerge } = require('./merge-utils')

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
  'homebrew',
  'factions',
  'quests',
  'finances',
  'networks',
  'assets',
  'relationships',
  'companions',
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
// Upsert a single spell or feature into homebrew.json by name.
app.patch('/api/homebrew/:section', (req, res) => {
  const { section } = req.params
  if (!['spells', 'features'].includes(section)) {
    return res
      .status(400)
      .json({ error: 'Section must be "spells" or "features"' })
  }
  const item = req.body
  if (!item?.name) {
    return res.status(400).json({ error: 'Item must have a name field' })
  }
  const file = path.join(DATA_DIR, 'homebrew.json')
  try {
    const homebrew = readJSON(file)
    if (!Array.isArray(homebrew[section])) homebrew[section] = []
    const idx = homebrew[section].findIndex(
      (x) => x.name.toLowerCase() === item.name.toLowerCase()
    )
    if (idx >= 0) {
      homebrew[section][idx] = { ...homebrew[section][idx], ...item }
    } else {
      homebrew[section].push(item)
    }
    fs.writeFileSync(file, JSON.stringify(homebrew, null, 2), 'utf8')
    console.log(`Saved homebrew ${section}: ${item.name}`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`Error updating homebrew ${section}:`, err.message)
    res.status(500).json({ error: 'Failed to update homebrew.json' })
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
