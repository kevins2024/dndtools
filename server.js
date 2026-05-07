// server.js
// Local development data server — read/write JSON files
// Run with: node server.js (or via npm run dev using concurrently)
// This server is NEVER deployed — development only

const express = require('express')
const fs = require('fs')
const path = require('path')
const cors = require('cors')

const app = express()
const PORT = 3001
const DATA_DIR = path.resolve(__dirname, './src/data')
const PREFS_FILE = path.resolve(__dirname, './user_prefs.json')

// Whitelist of allowed table names — prevents arbitrary file access
const ALLOWED_TABLES = [
  'characters',
  'npcs',
  'locations',
  'party_items',
  'world',
  'homebrew',
  'factions',
  'quests',
  'finances',
]

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── GET /api/user_prefs ──────────────────────────────────
// Served from project root (not src/) so webpack never watches it.
app.get('/api/user_prefs', (req, res) => {
  try {
    const data = fs.existsSync(PREFS_FILE)
      ? JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'))
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
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    res.json(data)
  } catch (err) {
    console.error(`Error reading ${table}.json:`, err.message)
    res.status(500).json({ error: `Failed to read ${table}.json` })
  }
})

// ── POST /api/:table ─────────────────────────────────────
app.post('/api/:table', (req, res) => {
  const { table } = req.params

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: `Unknown table: ${table}` })
  }

  if (!req.body || (typeof req.body !== 'object' && !Array.isArray(req.body))) {
    return res
      .status(400)
      .json({ error: 'Request body must be a JSON object or array' })
  }

  const file = path.join(DATA_DIR, `${table}.json`)

  // Write a timestamped backup before overwriting
  // if (fs.existsSync(file)) {
  //   const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  //   const backupDir = path.join(DATA_DIR, '.backups')
  //   if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir)
  //   const backup = path.join(backupDir, `${table}.${timestamp}.json`)
  //   fs.copyFileSync(file, backup)
  // }

  try {
    fs.writeFileSync(file, JSON.stringify(req.body, null, 2), 'utf8')
    console.log(`Saved: ${table}.json`)
    res.json({ ok: true })
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
    return res.status(400).json({ error: 'Section must be "spells" or "features"' })
  }
  const item = req.body
  if (!item?.name) {
    return res.status(400).json({ error: 'Item must have a name field' })
  }
  const file = path.join(DATA_DIR, 'homebrew.json')
  try {
    const homebrew = JSON.parse(fs.readFileSync(file, 'utf8'))
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
const ALLOWED_CACHE_FILES = ['spells', 'features', 'items', 'monsters', 'species', 'backgrounds']

app.get('/api/cache/:filename', (req, res) => {
  const { filename } = req.params
  if (!ALLOWED_CACHE_FILES.includes(filename)) {
    return res.status(400).json({ error: `Unknown cache file: ${filename}` })
  }
  const file = path.join(CACHE_DIR, `${filename}.json`)
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: `Cache file not found: ${filename}.json` })
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: `Failed to read ${filename}.json` })
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
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
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
