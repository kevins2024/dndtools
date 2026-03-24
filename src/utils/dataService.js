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

const SERVER_URL = 'http://localhost:3001'
const isDev = process.env.NODE_ENV === 'development'

const staticTables = {
  characters,
  npcs,
  locations,
  party_items,
  world,
  homebrew,
  finances,
}

// ── Cookie helpers ────────────────────────────────────────
const COOKIE_EXPIRY_DAYS = 365

function setCookie(name, value, days) {
  const expires = new Date()
  expires.setDate(expires.getDate() + days)
  document.cookie = `${name}=${encodeURIComponent(
    JSON.stringify(value)
  )};expires=${expires.toUTCString()};path=/`
}

function getCookie(name) {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match.split('=')[1]))
  } catch {
    return null
  }
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

  // ── Persistent preferences (cookies) ─────────────────
  saveSelectedPlayers(players) {
    setCookie('selectedPlayers', players, COOKIE_EXPIRY_DAYS)
  },

  loadSelectedPlayers() {
    return getCookie('selectedPlayers') ?? []
  },
}

export default dataService
