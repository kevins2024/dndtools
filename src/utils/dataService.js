// dataService.js
// Unified data access layer for Dawn Blades campaign app
//
// Development: reads and writes via local Express server (server.js)
// Production:  reads from bundled static JSON imports, save() is disabled
//
// Usage:
//   import dataService from '@/services/dataService'
//   const characters = await dataService.get('characters')
//   await dataService.save('characters', updatedCharacters)

// Static imports — used as production fallback and for initial bundle
import characters from '@/data/characters.json'
import npcs from '@/data/npcs.json'
import locations from '@/data/locations.json'
import party_items from '@/data/party_items.json'
import world from '@/data/world.json'
import homebrew from '@/data/homebrew.json'
import finances from '@/data/finances.json'

const SERVER_URL = 'http://localhost:3001'

const isDev = process.env.NODE_ENV === 'development'

// Static data tables — production fallback
const staticTables = {
  characters,
  npcs,
  locations,
  party_items,
  world,
  homebrew,
  finances,
}

// In-memory cache — populated on first get() call
// Ensures repeated get() calls in the same session don't re-fetch
const cache = {}

const dataService = {
  // List of all known tables
  tables: Object.keys(staticTables),

  // ── get(table) ───────────────────────────────────────────
  // Returns the data for a given table.
  // Dev: fetches from local server (live file contents)
  // Prod: returns static bundled import
  async get(table) {
    if (!staticTables[table] && !isDev) {
      throw new Error(`Unknown table: ${table}`)
    }

    // Return cached version if available
    if (cache[table]) {
      return cache[table]
    }

    if (isDev) {
      try {
        const res = await fetch(`${SERVER_URL}/api/${table}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const data = await res.json()
        cache[table] = data
        return data
      } catch (err) {
        console.warn(
          `dataService: server unavailable, falling back to static data for '${table}'`
        )
        console.warn(err.message)
        cache[table] = staticTables[table]
        return staticTables[table]
      }
    }

    // Production — return static import
    cache[table] = staticTables[table]
    return staticTables[table]
  },

  // ── save(table, data) ────────────────────────────────────
  // Persists data for a given table.
  // Dev: POSTs to local server which writes the JSON file
  // Prod: not available (UI should hide save controls in production)
  async save(table, data) {
    if (!isDev) {
      console.warn('dataService.save() is not available in production')
      return { ok: false, reason: 'production' }
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? `Server returned ${res.status}`)
      }

      // Update cache with saved data
      cache[table] = data
      console.log(`dataService: saved '${table}'`)
      return { ok: true }
    } catch (err) {
      console.error(`dataService: failed to save '${table}':`, err.message)
      throw err
    }
  },

  // ── invalidate(table) ────────────────────────────────────
  // Clears the cache for a table so next get() re-fetches from server.
  // Call this if you know the data has changed externally.
  invalidate(table) {
    delete cache[table]
  },

  // ── invalidateAll() ──────────────────────────────────────
  invalidateAll() {
    Object.keys(cache).forEach((k) => delete cache[k])
  },

  // ── isDevMode() ──────────────────────────────────────────
  // Useful for conditionally showing save/edit UI in components
  isDevMode() {
    return isDev
  },
}

export default dataService
