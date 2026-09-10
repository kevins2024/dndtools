// dataService.js
// Data access layer — Dawn Blades campaign app
// Dev:  reads and writes via local Express server (server.js)
// Prod: reads from bundled static JSON imports, save() unavailable

import characters from '@/data/characters.json'
import npcs from '@/data/npcs.json'
import places from '@/data/places.json'
import party_items from '@/data/party_items.json'
import world from '@/data/world.json'
import finances from '@/data/finances.json'
import assets from '@/data/assets.json'
import networks from '@/data/networks.json'
import relationships from '@/data/relationships.json'
import companions from '@/data/companions.json'
import lore from '@/data/lore.json'
const SERVER_URL = ''
const isDev = process.env.NODE_ENV === 'development'

const staticTables = {
  characters,
  npcs,
  places,
  party_items,
  world,
  finances,
  assets,
  networks,
  relationships,
  companions,
  lore,
}

const dataService = {
  tables: Object.keys(staticTables),

  isDevMode() {
    return isDev
  },

  // ── JSON file access ──────────────────────────────────
  async get(table) {
    if (isDev) {
      try {
        const res = await fetch(`${SERVER_URL}/api/${table}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      } catch (err) {
        console.warn(
          `dataService: server unavailable, falling back to static data for '${table}'`
        )
        return staticTables[table]
      }
    }
    return staticTables[table]
  },

  // `base` is the last-loaded/last-synced snapshot of this table (used as
  // the common ancestor for a 3-way merge on the server, so this save can't
  // clobber rows/fields that changed on disk since `base` was captured but
  // that `current` never touched). The server writes the merged result and
  // echoes it back — callers should resync their local copy of the table
  // (and their own `base`) to `data` in the response.
  async save(table, current, base) {
    if (!isDev) {
      console.warn('dataService.save() is not available in production')
      return
    }
    const res = await fetch(`${SERVER_URL}/api/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, base }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? `Server returned ${res.status}`)
    }
    return res.json()
  },

  // ── User preferences ──────────────────────────────────
  // Served from project root (not src/) so webpack never watches it.
  // In dev: persists to disk via the Express server.
  // In prod: no-ops silently (saved parties are a DM/dev tool).
  async getUserPrefs() {
    if (!isDev) return { savedParties: [] }
    try {
      const res = await fetch(`${SERVER_URL}/api/user_prefs`)
      return res.ok ? res.json() : { savedParties: [] }
    } catch {
      return { savedParties: [] }
    }
  },

  async patchUserPrefs(updates) {
    if (!isDev) return
    const current = await this.getUserPrefs()
    const merged = { ...current, ...updates }
    try {
      await fetch(`${SERVER_URL}/api/user_prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
    } catch (err) {
      console.error('dataService: failed to save user_prefs', err)
    }
  },
}

export default dataService
