// lookupService.js
//
// Two-layer cache for external D&D data lookups:
//   1. memCache (Map)  — module-level, survives re-renders, cleared on page refresh
//   2. localStorage    — survives page refreshes, keyed by CACHE_VERSION so a
//                        version bump here wipes all stale entries automatically
//
// Spell data: published_spells.json (real non-SRD content and homebrew,
// side by side — each entry's own `homebrew` flag tells them apart, see
// engine/CHECKLIST.md) first, then public dnd5eapi.co REST API.
// Feature data: local features.json (SRD) → published_features.json → traits API.

import featuresData from '@/data/api_data_cache/features.json'
import staticPublishedFeatures from '@/data/published_features.json'
import staticPublishedSpells from '@/data/published_spells.json'

const API_BASE = 'https://www.dnd5eapi.co/api/2014'
const DATA_SERVER = ''
const CACHE_VERSION = 'v4'
const CACHE_PREFIX = `dndtools_${CACHE_VERSION}_`
const isDev = process.env.NODE_ENV === 'development'

// In-memory cache: key → normalized object (or null if lookup failed)
const memCache = new Map()

// Session-level homebrew edits: name.toLowerCase() → normalized result object.
// Updated by saveToHomebrew so changes are visible immediately without page reload.
const homebrewEdits = new Map()

// In dev, published_spells.json/published_features.json are fetched live from
// the server so edits saved during a previous session are visible immediately
// without restarting webpack. In prod, the static bundle is used (saves are
// not available anyway).
const staticPublished = {
  spells: staticPublishedSpells,
  features: staticPublishedFeatures,
}
let _homebrewPromise = null

function getHomebrew() {
  if (_homebrewPromise) return _homebrewPromise
  if (isDev) {
    _homebrewPromise = fetch(`${DATA_SERVER}/api/homebrew`)
      .then((r) => (r.ok ? r.json() : staticPublished))
      .catch(() => staticPublished)
  } else {
    _homebrewPromise = Promise.resolve(staticPublished)
  }
  return _homebrewPromise
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function localGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    console.error(
      `lookupService: failed to read localStorage["${CACHE_PREFIX + key}"]`,
      err
    )
    return null
  }
}

function localSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value))
  } catch (err) {
    console.error(
      `lookupService: failed to write localStorage["${CACHE_PREFIX + key}"]`,
      err
    )
  }
}

// ── Spell lookup ──────────────────────────────────────────────────────────────

// "Cure Wounds" → "cure-wounds", "Tasha's Hideous Laughter" → "tasha-s-hideous-laughter"
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Normalize the dnd5eapi.co response shape into a consistent object the
// component can rely on, regardless of future API changes.
function normalizeSpell(data) {
  return {
    name: data.name,
    description: Array.isArray(data.desc)
      ? data.desc.join('\n\n')
      : data.description ?? null,
    level: data.level ?? null,
    school: data.school?.name ?? data.school ?? null,
    casting_time: data.casting_time ?? null,
    range: data.range ?? null,
    duration: data.duration ?? null,
    concentration:
      data.concentration ??
      data.duration?.toLowerCase().startsWith('concentration') ??
      false,
    components: Array.isArray(data.components)
      ? data.components.join(', ')
      : data.components ?? null,
    save:
      data.dc?.dc_type?.name ??
      (typeof data.save === 'object'
        ? data.save?.stat?.toUpperCase()
        : data.save) ??
      null,
    damage_type: data.damage?.damage_type?.name ?? data.damage_type ?? null,
    spell_list: Array.isArray(data.classes)
      ? data.classes
          .map((c) => (typeof c === 'string' ? c : c.name))
          .filter(Boolean)
      : Array.isArray(data.spell_list)
      ? data.spell_list
      : null,
  }
}

async function fetchSpellBySlug(slug) {
  const res = await fetch(`${API_BASE}/spells/${slug}`)
  if (res.ok) return normalizeSpell(await res.json())
  if (res.status !== 404) {
    console.error(
      `lookupService: unexpected status ${res.status} fetching /spells/${slug}`
    )
  }
  return null
}

async function fetchSpellByNameSearch(name) {
  const res = await fetch(`${API_BASE}/spells?name=${encodeURIComponent(name)}`)
  if (!res.ok) {
    console.error(
      `lookupService: spell name search failed for "${name}", status ${res.status}`
    )
    return null
  }
  const { results } = await res.json()
  const match = results?.find(
    (r) => r.name.toLowerCase() === name.toLowerCase()
  )
  if (!match) return null

  const detail = await fetch(`https://www.dnd5eapi.co${match.url}`)
  if (!detail.ok) {
    console.error(
      `lookupService: failed to fetch spell detail at ${match.url}, status ${detail.status}`
    )
    return null
  }
  return normalizeSpell(await detail.json())
}

export async function lookupSpell(name) {
  const cacheKey = `spell_${toSlug(name)}`

  // 1. In-memory hit (null is a valid cached value — means "not found")
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)

  // 2. localStorage hit
  const stored = localGet(cacheKey)
  if (stored !== null) {
    memCache.set(cacheKey, stored)
    return stored
  }

  // Strip trailing parenthetical notes (e.g. "Negative Energy Flood (homebrew spell from necromancer's spellbook)")
  // so the base name can be matched against homebrew and API entries.
  const baseName = name.replace(/\s*\([^)]*\)\s*$/, '').trim()

  // 3. Session edits (saved this session via saveToHomebrew)
  const hbEdit =
    homebrewEdits.get(name.toLowerCase()) ??
    (baseName !== name ? homebrewEdits.get(baseName.toLowerCase()) : undefined)
  if (hbEdit !== undefined) {
    memCache.set(cacheKey, hbEdit)
    return hbEdit
  }

  // 4. Published spells — real non-SRD content and homebrew side by side
  // (each entry's own `homebrew` flag tells them apart), live-fetched in dev
  // so edits show up without a rebuild, static bundle otherwise.
  const nameLower = name.toLowerCase()
  const baseNameLower = baseName.toLowerCase()
  const published = await getHomebrew()
  const pubSpell = (published.spells ?? []).find(
    (s) =>
      s.name.toLowerCase() === nameLower ||
      (baseName !== name && s.name.toLowerCase() === baseNameLower)
  )
  if (pubSpell) {
    const normalized = normalizeSpell(pubSpell)
    memCache.set(cacheKey, normalized)
    localSet(cacheKey, normalized)
    return normalized
  }

  // 5. API fetch — slug first, name search as fallback; retry with baseName if parenthetical stripped
  let result = null
  try {
    result = await fetchSpellBySlug(toSlug(name))
    if (!result) result = await fetchSpellByNameSearch(name)
    if (!result && baseName !== name) {
      result = await fetchSpellBySlug(toSlug(baseName))
      if (!result) result = await fetchSpellByNameSearch(baseName)
    }
  } catch (err) {
    console.error(
      `lookupService: network error looking up spell "${name}"`,
      err
    )
  }

  // Cache successes in localStorage; cache both outcomes in memory so we
  // don't retry a failed lookup repeatedly within the same session.
  memCache.set(cacheKey, result)
  if (result) localSet(cacheKey, result)

  return result
}

// ── Feature lookup ────────────────────────────────────────────────────────────
// Lookup order:
//   1. Session edits (homebrewEdits)
//   2. Local features.json           (SRD class features, bundled)
//   3. Local published_features.json (real non-SRD content + homebrew, bundled)
//   4. /api/2014/traits               (racial/species traits — Fey Ancestry, Darkvision, etc.)

export async function lookupFeature(name) {
  const lower = name.toLowerCase()

  // 1. Session edits
  if (homebrewEdits.has(lower)) return homebrewEdits.get(lower)

  // 2. Exact matches first, wherever they come from — an exact match always
  //    wins over a fuzzy one. Without this, a feat like "Metamagic Adept"
  //    gets swallowed by a fuzzy match against the SRD's "Metamagic" class
  //    feature (since "Metamagic Adept".startsWith("Metamagic")) before its
  //    own homebrew entry is ever checked.
  const srdExact = featuresData.find((f) => f.name.toLowerCase() === lower)
  if (srdExact) {
    return {
      subtitle: `${srdExact.class.name} · Level ${srdExact.level}`,
      description: srdExact.desc.join('\n\n'),
    }
  }

  const published = await getHomebrew()
  const pubExact = published.features?.find(
    (f) => f.name.toLowerCase() === lower
  )
  if (pubExact) {
    return {
      subtitle:
        pubExact.category ||
        pubExact.class ||
        pubExact.source ||
        (pubExact.homebrew ? 'Homebrew' : 'Published'),
      description: pubExact.description,
    }
  }

  // 3. SRD fuzzy match (only once no exact match exists anywhere) — startsWith
  //    in either direction for variants: cache "Action Surge (1 use)" for
  //    character "Action Surge", or character "Sneak Attack (2d6)" for cache
  //    "Sneak Attack". The reverse direction requires a space/paren right
  //    after the cache name so "Sneak Attack" doesn't match "Sneak Attacker".
  const found =
    featuresData.find((f) => f.name.toLowerCase().startsWith(lower)) ??
    featuresData.find((f) => {
      const cacheLower = f.name.toLowerCase()
      return (
        lower.startsWith(cacheLower) &&
        /^[\s(]/.test(lower.slice(cacheLower.length))
      )
    })

  if (found) {
    return {
      subtitle: `${found.class.name} · Level ${found.level}`,
      description: found.desc.join('\n\n'),
    }
  }

  // 4. Racial/species traits via API (e.g. Fey Ancestry, Darkvision)
  const traitCacheKey = `trait_${toSlug(name)}`

  if (memCache.has(traitCacheKey)) return memCache.get(traitCacheKey)

  const stored = localGet(traitCacheKey)
  if (stored !== null) {
    memCache.set(traitCacheKey, stored)
    return stored
  }

  let result = null
  try {
    const res = await fetch(`${API_BASE}/traits/${toSlug(name)}`)
    if (res.ok) {
      const data = await res.json()
      result = {
        subtitle: data.races?.map((r) => r.name).join(', ') || 'Racial trait',
        description: data.desc?.join('\n\n') ?? null,
      }
    } else if (res.status !== 404) {
      console.error(
        `lookupService: unexpected status ${res.status} fetching trait "${name}"`
      )
    }
  } catch (err) {
    console.error(`lookupService: network error fetching trait "${name}"`, err)
  }

  memCache.set(traitCacheKey, result)
  if (result) localSet(traitCacheKey, result)

  return result
}

// ── Monster lookup ────────────────────────────────────────────────────────────

function normalizeMonster(data) {
  const ac = Array.isArray(data.armor_class) ? data.armor_class[0] : null
  return {
    name: data.name,
    size: data.size ?? null,
    type: data.type ?? null,
    alignment: data.alignment ?? null,
    ac: ac?.value ?? null,
    ac_note: ac?.type ?? null,
    hp: data.hit_points ?? null,
    hit_dice: data.hit_dice ?? null,
    speed: data.speed ?? null,
    str: data.strength ?? null,
    dex: data.dexterity ?? null,
    con: data.constitution ?? null,
    int: data.intelligence ?? null,
    wis: data.wisdom ?? null,
    cha: data.charisma ?? null,
    saving_throws: (data.proficiencies ?? [])
      .filter((p) => p.proficiency?.index?.startsWith('saving-throw'))
      .map((p) => ({
        stat: p.proficiency.name.replace('Saving Throw: ', ''),
        bonus: p.value,
      })),
    skills: (data.proficiencies ?? [])
      .filter((p) => p.proficiency?.index?.startsWith('skill'))
      .map((p) => ({
        name: p.proficiency.name.replace('Skill: ', ''),
        bonus: p.value,
      })),
    damage_vulnerabilities: data.damage_vulnerabilities ?? [],
    damage_resistances: data.damage_resistances ?? [],
    damage_immunities: data.damage_immunities ?? [],
    condition_immunities: (data.condition_immunities ?? []).map((c) => c.name),
    senses: data.senses ?? null,
    languages: data.languages ?? null,
    cr: data.challenge_rating ?? null,
    xp: data.xp ?? null,
    special_abilities: data.special_abilities ?? [],
    actions: data.actions ?? [],
    legendary_actions: data.legendary_actions ?? [],
    reactions: data.reactions ?? [],
  }
}

export async function lookupMonster(name) {
  const slug = toSlug(name)
  const cacheKey = `monster_${slug}`

  if (memCache.has(cacheKey)) return memCache.get(cacheKey)

  const stored = localGet(cacheKey)
  if (stored !== null) {
    memCache.set(cacheKey, stored)
    return stored
  }

  let result = null
  try {
    const res = await fetch(`${API_BASE}/monsters/${slug}`)
    if (res.ok) result = normalizeMonster(await res.json())
  } catch (err) {
    console.error(
      `lookupService: network error looking up monster "${name}"`,
      err
    )
  }

  memCache.set(cacheKey, result)
  if (result) localSet(cacheKey, result)
  return result
}

// ── Save to homebrew ──────────────────────────────────────────────────────────
// Persists a spell or feature to published_spells.json / published_features.json
// via the dev server, then updates in-memory caches so the change is visible
// immediately.

export async function saveToHomebrew(section, data) {
  try {
    const res = await fetch(`${DATA_SERVER}/api/homebrew/${section}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error(
        `lookupService: server returned ${res.status} saving ${section}/${data.name}`,
        body
      )
      return false
    }
  } catch (err) {
    console.error(
      `lookupService: network error saving ${section}/${data.name}`,
      err
    )
    return false
  }

  // Invalidate the live homebrew cache so the next lookup re-fetches from disk.
  _homebrewPromise = null

  // Update session override so the next lookup returns new data immediately.
  const lower = data.name.toLowerCase()
  if (section === 'spells') {
    const normalized = normalizeSpell(data)
    homebrewEdits.set(lower, normalized)
    const cacheKey = `spell_${toSlug(data.name)}`
    memCache.set(cacheKey, normalized)
    localSet(cacheKey, normalized)
  } else {
    const result = {
      subtitle: data.subtitle || data.category || 'Homebrew',
      description: data.description ?? null,
    }
    homebrewEdits.set(lower, result)
    // Clear any stale trait-API cache entry for this feature name.
    memCache.delete(`trait_${toSlug(data.name)}`)
  }

  return true
}
