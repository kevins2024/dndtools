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
]

app.use(cors({ origin: 'http://localhost:8080' }))
app.use(express.json({ limit: '10mb' }))

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
  if (fs.existsSync(file)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(DATA_DIR, '.backups')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir)
    const backup = path.join(backupDir, `${table}.${timestamp}.json`)
    fs.copyFileSync(file, backup)
  }

  try {
    fs.writeFileSync(file, JSON.stringify(req.body, null, 2), 'utf8')
    console.log(`Saved: ${table}.json`)
    res.json({ ok: true })
  } catch (err) {
    console.error(`Error writing ${table}.json:`, err.message)
    res.status(500).json({ error: `Failed to write ${table}.json` })
  }
})

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Data server running on http://localhost:${PORT}`)
  console.log(`Serving files from: ${DATA_DIR}`)
})
