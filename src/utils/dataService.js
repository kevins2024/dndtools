// dataService.js
// Data access layer — Dawn Blades campaign app
// Dev:  reads and writes via local Express server (server.js)
// Prod: reads from bundled static JSON imports, save() unavailable

import characters from '@/data/characters.json'
import npcs from '@/data/npcs.json'
import locations from '@/data/locations.json'
import party_items from '@/data/party_items.json'
import world from '@/data/world.json'
import homebrew from '@/data/homebrew.json'
import finances from '@/data/finances.json'
import assets from '@/data/assets.json'
import networks from '@/data/networks.json'
const SERVER_URL = ''
const isDev = process.env.NODE_ENV === 'development'

const staticTables = {
  characters,
  npcs,
  locations,
  party_items,
  world,
  homebrew,
  finances,
  assets,
  networks,
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

  async save(table, data) {
    if (!isDev) {
      console.warn('dataService.save() is not available in production')
      return
    }
    const res = await fetch(`${SERVER_URL}/api/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? `Server returned ${res.status}`)
    }
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
