import Vue from 'vue'
import Vuex from 'vuex'
import dataService from '@/utils/dataService'

Vue.use(Vuex)

function rollDiceExpr(expr) {
  const match = String(expr).match(/(\d+)d(\d+)([+-]\d+)?/)
  if (!match) return 0
  const count = parseInt(match[1])
  const sides = parseInt(match[2])
  const mod = match[3] ? parseInt(match[3]) : 0
  let total = mod
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1
  return Math.max(0, total)
}

function nextPartyItemNum(items) {
  const nums = items
    .map((i) => /^items_(\d+)$/.exec(String(i.id ?? ''))?.[1])
    .filter(Boolean)
    .map(Number)
  return nums.length ? Math.max(...nums) + 1 : 0
}

function nextPartyItemId(items) {
  return `items_${nextPartyItemNum(items)}`
}

// Same numeric-suffix-parsing approach as nextPartyItemNum, generalized to
// any "<prefix>_<N>" id convention (npcs_N, assets_N, ...) — see
// JsonIntakeTool.vue, the only caller of ADD_TABLE_ROWS below.
function nextSequentialNum(rows, prefix) {
  const re = new RegExp(`^${prefix}_(\\d+)$`)
  const nums = rows
    .map((r) => re.exec(String(r.id ?? ''))?.[1])
    .filter(Boolean)
    .map(Number)
  return nums.length ? Math.max(...nums) + 1 : 0
}

// A dice-expression recharge (e.g. a wand's "1d6+1") rolls on any
// qualifying rest call regardless of which rechargeTypes bucket that call
// passes — matches this function's pre-existing behavior, kept as-is.
function shouldGrantRecharge(recharge, rechargeTypes) {
  if (!recharge || recharge === 'none') return false
  if (String(recharge).match(/\d+d\d+/)) return true
  return rechargeTypes.includes(recharge)
}

function rechargeItems(items, rechargeTypes) {
  return items.map((item) => {
    let next = item

    if (item.charges_current != null && item.charges_max != null) {
      const r = item.charges_recharge
      if (shouldGrantRecharge(r, rechargeTypes)) {
        next = String(r).match(/\d+d\d+/)
          ? {
              ...next,
              charges_current: Math.min(
                next.charges_max,
                (next.charges_current ?? 0) + rollDiceExpr(r)
              ),
            }
          : { ...next, charges_current: next.charges_max }
      }
    }

    // Independent per-spell uses (spells_granted objects with their own
    // uses_max/recharge, not drawn from the item's shared charge pool —
    // see dnd.normalizeItemSpellGrant) recharge the same way, per-entry.
    if (Array.isArray(item.spells_granted)) {
      let changed = false
      const newGrants = item.spells_granted.map((g) => {
        if (typeof g === 'string' || g.uses_max == null) return g
        if (!shouldGrantRecharge(g.recharge, rechargeTypes)) return g
        changed = true
        return { ...g, uses_current: g.uses_max }
      })
      if (changed) next = { ...next, spells_granted: newGrants }
    }

    return next
  })
}

export default new Vuex.Store({
  state: {
    selectedPlayers: [],
    selectedItem: null,
    diceDrawerOpen: false,
    pendingRoll: null,
    game_day: Number(localStorage.getItem('game_day')) || 1,
    level_cap: null,
    // Every subclass's data (incl. expanded_spell_list), loaded once at
    // startup — see LOAD_SUBCLASSES and spellUtils.js's bonus-spell
    // derivation, which reads this instead of a per-character copy.
    subclasses: [],
    parties: [],
    characterNavRequest: null,
    placeNavRequest: null,
    levelUpNavRequest: null,
    newCharacterNavRequest: null,
    characters: [],
    npcs: [],
    places: [],
    party_items: [],
    companions: [],
    world: [],
    networks: {
      sending_stone_networks: [],
      sending_stones: [],
      teleportation_circles: [],
    },
    assets: [],
    relationships: [],
    lore: [],
    finances: {},
    calendar_notes: [],
    loaded: false,
    originals: {},
    dirtyTables: [],
    restVersion: 0,
    currentEncounter: null,
    lastEncounter: null,
    showVehicleCombat: false,
    showVehicleWizard: false,
    vehicleCombatSession: null,
    savedEncounters: JSON.parse(
      localStorage.getItem('savedEncounters') || '[]'
    ),
    combatNavRequest: false,
    pendingCombatEnemies: null,
    openEncounterGeneratorRequest: false,
    encounterSeed: null,
    // Mirrors CombatContext.vue's local `phase` ('setup'|'battle') so a
    // different top-level context (Tools) can tell whether a live fight is
    // running, without CombatContext needing to be mounted at all.
    combatPhase: 'setup',
    // A single enemy to push into a LIVE fight's existing roster — distinct
    // from pendingCombatEnemies, which REPLACES the whole enemy list (built
    // for "load a freshly generated encounter", wrong for "reinforcements
    // arrive mid-fight").
    queuedReinforcement: null,
  },

  mutations: {
    SET_DICE_DRAWER_OPEN(state, val) {
      state.diceDrawerOpen = val
    },
    // Hands the dice drawer a pre-filled d20 roll (a check or save from
    // AbilityScoreGrid) and opens the drawer as a side effect, so callers
    // don't have to also commit SET_DICE_DRAWER_OPEN themselves.
    SET_PENDING_ROLL(state, roll) {
      state.pendingRoll = roll
      state.diceDrawerOpen = true
    },
    CLEAR_PENDING_ROLL(state) {
      state.pendingRoll = null
    },
    SET_GAME_DAY(state, day) {
      // Per-party day — update the active party object and persist
      const active = state.parties.find((p) => p.active)
      if (active) {
        active.game_day = day
        dataService
          .patchUserPrefs({ parties: state.parties })
          .catch(console.warn)
      } else {
        state.game_day = day
        localStorage.setItem('game_day', day)
      }
    },
    LOAD_PARTIES(state, parties) {
      // Seed game_day on parties that don't have one yet
      const fallbackDay = state.game_day || 1
      state.parties = parties.map((p) => ({
        ...p,
        game_day: p.game_day ?? fallbackDay,
        marching_order: p.marching_order ?? [...(p.members ?? [])],
      }))
    },
    SET_PARTIES(state, parties) {
      state.parties = parties
      dataService
        .patchUserPrefs({ parties })
        .catch((e) => console.warn('Failed to save parties', e))
    },
    ACTIVATE_PARTY(state, id) {
      const updated = state.parties.map((p) => ({ ...p, active: p.id === id }))
      state.parties = updated
      dataService
        .patchUserPrefs({ parties: updated })
        .catch((e) => console.warn('Failed to save parties', e))
    },
    NAV_TO_CHARACTER(state, payload) {
      // payload: { name, tab } or legacy string
      state.characterNavRequest =
        typeof payload === 'string' ? { name: payload, tab: 'sheet' } : payload
    },
    CLEAR_CHARACTER_NAV(state) {
      state.characterNavRequest = null
    },
    NAV_TO_PLACE(state, placeName) {
      state.placeNavRequest = placeName
    },
    CLEAR_PLACE_NAV(state) {
      state.placeNavRequest = null
    },
    NAV_TO_LEVEL_UP(state, name) {
      state.levelUpNavRequest = { name }
    },
    CLEAR_LEVEL_UP_NAV(state) {
      state.levelUpNavRequest = null
    },
    NAV_TO_NEW_CHARACTER(state, seed) {
      state.newCharacterNavRequest = seed ?? {}
    },
    CLEAR_NEW_CHARACTER_NAV(state) {
      state.newCharacterNavRequest = null
    },
    SET_SELECTED_PLAYERS(state, players) {
      state.selectedPlayers = players
    },
    SET_SELECTED_ITEM(state, item) {
      state.selectedItem = item
    },
    SET_TABLE(state, { table, data }) {
      state[table] = data
    },
    SET_ORIGINALS(state, originals) {
      state.originals = originals
      state.dirtyTables = []
    },
    // Updates the 3-way-merge base for ONE table without touching
    // dirtyTables — unlike SET_ORIGINALS (which always clears ALL of it, the
    // right call after a full saveAll, the wrong one after a single
    // out-of-band save like LevelUpTool.vue's, which shouldn't wipe out some
    // OTHER table's unrelated pending changes).
    SET_ORIGINAL_TABLE(state, { table, data }) {
      state.originals = { ...state.originals, [table]: data }
    },
    // Replaces ONE row of a table by `name` — either in the live table itself
    // (revert-to-baseline, or adopt a just-saved row) or in that table's
    // 3-way-merge base (after a per-row save). Used by LevelUpTool.vue so a
    // single character can be saved or reverted without touching any other
    // character's independent in-progress edits, in either the live table or
    // its saved baseline.
    SET_TABLE_ROW(state, { table, name, data }) {
      const rows = state[table] || []
      const idx = rows.findIndex((r) => r.name === name)
      state[table] =
        idx === -1
          ? [...rows, data]
          : rows.map((r, i) => (i === idx ? data : r))
    },
    SET_ORIGINAL_ROW(state, { table, name, data }) {
      const rows = state.originals[table] || []
      const idx = rows.findIndex((r) => r.name === name)
      const updated =
        idx === -1
          ? [...rows, data]
          : rows.map((r, i) => (i === idx ? data : r))
      state.originals = { ...state.originals, [table]: updated }
    },
    MARK_DIRTY_TABLE(state, table) {
      if (!state.dirtyTables.includes(table)) {
        state.dirtyTables.push(table)
      }
    },
    PATCH_ASSET(state, patch) {
      const idx = state.assets.findIndex((a) => a.id === patch.id)
      if (idx === -1) return
      const updated = [...state.assets]
      updated[idx] = { ...updated[idx], ...patch }
      state.assets = updated
      if (!state.dirtyTables.includes('assets'))
        state.dirtyTables.push('assets')
    },
    TOGGLE_VEHICLE_COMBAT(state) {
      state.showVehicleCombat = !state.showVehicleCombat
    },
    OPEN_VEHICLE_WIZARD(state) {
      state.showVehicleWizard = true
    },
    CLOSE_VEHICLE_WIZARD(state) {
      state.showVehicleWizard = false
    },
    START_VEHICLE_COMBAT(state, ships) {
      state.vehicleCombatSession = { ships }
      state.showVehicleWizard = false
      state.showVehicleCombat = true
    },
    END_VEHICLE_COMBAT(state) {
      state.vehicleCombatSession = null
      state.showVehicleCombat = false
    },
    PATCH_VEHICLE_SHIP(state, patch) {
      if (!state.vehicleCombatSession) return
      const ships = [...state.vehicleCombatSession.ships]
      const idx = ships.findIndex((s) => s.id === patch.id)
      if (idx === -1) return
      ships[idx] = { ...ships[idx], ...patch }
      state.vehicleCombatSession = { ...state.vehicleCombatSession, ships }
    },
    CLEAR_DIRTY_TABLES(state) {
      state.dirtyTables = []
    },
    SET_LOADED(state, value) {
      state.loaded = value
    },
    // nextPartyItemId: ids are "items_N" strings (every existing entry, per
    // party_items.json), not bare numbers — Math.max(...ids) against those
    // silently produces NaN (Number("items_1") is NaN), so every call here
    // used to mint a broken `id: NaN` item. Parse the numeric suffix instead,
    // same fix pattern as nextCharacterId() in NewCharacterTool.vue.
    ADD_PARTY_ITEM(state, item) {
      const nextId = nextPartyItemId(state.party_items)
      const activeParty = state.parties.find((p) => p.active)
      const newItem = { ...item, id: nextId }
      if (newItem.carried_by === 'party' && !newItem.party_id && activeParty) {
        newItem.party_id = activeParty.id
      }
      state.party_items.push(newItem)
      if (!state.dirtyTables.includes('party_items')) {
        state.dirtyTables.push('party_items')
      }
    },
    // Batch version — mints sequential ids for a whole loadout (e.g. New
    // Character Tool's starting equipment) in one commit, rather than N
    // separate commits each re-scanning party_items for the next id.
    ADD_PARTY_ITEMS(state, items) {
      let nextNum = nextPartyItemNum(state.party_items)
      const activeParty = state.parties.find((p) => p.active)
      for (const item of items ?? []) {
        const newItem = { ...item, id: `items_${nextNum++}` }
        if (
          newItem.carried_by === 'party' &&
          !newItem.party_id &&
          activeParty
        ) {
          newItem.party_id = activeParty.id
        }
        state.party_items.push(newItem)
      }
      if (!state.dirtyTables.includes('party_items')) {
        state.dirtyTables.push('party_items')
      }
    },
    // Generic "append N validated new rows to a table" mutation — used by
    // JsonIntakeTool.vue for the tables that don't already have a dedicated
    // add-mutation (party_items keeps using ADD_PARTY_ITEMS above, since it
    // also needs the active-party-id injection that's specific to items).
    // `idPrefix` mints sequential "<prefix>_<N>" ids the same way
    // nextPartyItemId does (npcs, assets); pass null for tables that don't
    // use a synthetic id at all (places, keyed by name) or that already
    // carry a caller-assigned id (lore's hand-authored slugs).
    ADD_TABLE_ROWS(state, { table, rows, idPrefix }) {
      const existing = state[table] || []
      let nextNum = idPrefix ? nextSequentialNum(existing, idPrefix) : 0
      const newRows = rows.map((row) =>
        idPrefix ? { ...row, id: `${idPrefix}_${nextNum++}` } : row
      )
      state[table] = [...existing, ...newRows]
      if (!state.dirtyTables.includes(table)) {
        state.dirtyTables.push(table)
      }
    },
    // Reassigns every party-pool item (carried_by:'party') from one party to
    // another (or to null — "Unassigned", the existing no-party pool bucket
    // CharacterInventory.vue already treats as a valid state) — used when a
    // party is deleted, so its loose gear doesn't silently orphan onto a
    // party_id that no longer exists.
    REASSIGN_PARTY_POOL(state, { fromPartyId, toPartyId }) {
      state.party_items = state.party_items.map((item) =>
        item.carried_by === 'party' && item.party_id === fromPartyId
          ? { ...item, party_id: toPartyId }
          : item
      )
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')
    },
    UPDATE_ITEM(state, updatedItem) {
      const idx = state.party_items.findIndex((i) => i.id === updatedItem.id)
      if (idx !== -1) {
        state.party_items.splice(idx, 1, updatedItem)
        if (!state.dirtyTables.includes('party_items')) {
          state.dirtyTables.push('party_items')
        }
      }
    },
    UPDATE_TABLE_ITEM(state, { table, updatedItem }) {
      const tableData = state[table]
      if (Array.isArray(tableData)) {
        const key =
          updatedItem.id != null
            ? 'id'
            : updatedItem.name != null
            ? 'name'
            : null
        const idx = key
          ? tableData.findIndex(
              (item) => item && item[key] === updatedItem[key]
            )
          : -1
        if (idx !== -1) {
          tableData.splice(idx, 1, updatedItem)
        } else {
          tableData.push(updatedItem)
        }
      } else if (tableData && typeof tableData === 'object') {
        state[table] = { ...tableData, ...updatedItem }
      } else {
        state[table] = updatedItem
      }
      if (!state.dirtyTables.includes(table)) {
        state.dirtyTables.push(table)
      }
    },
    SET_ENCOUNTER(state, encounter) {
      state.lastEncounter = state.currentEncounter
      state.currentEncounter = encounter
    },
    SET_COMBAT_PHASE(state, phase) {
      state.combatPhase = phase
    },
    QUEUE_REINFORCEMENT(state, enemy) {
      state.queuedReinforcement = enemy
    },
    CLEAR_REINFORCEMENT(state) {
      state.queuedReinforcement = null
    },
    // Pushes one enemy onto the encounter a DM hasn't started yet — creates
    // a minimal encounter shell first if none exists. Surfaces automatically
    // through CombatContext's existing "Load Encounter" button, no new UI
    // needed to consume it.
    ENQUEUE_ENCOUNTER_ENEMY(state, enemy) {
      const base = state.currentEncounter ?? {
        id: 'enc_custom_' + Date.now(),
        generatedAt: new Date().toISOString(),
        difficulty: null,
        type: 'Custom',
        typeConfig: 'Enemies added individually via NPC Generator.',
        partySize: null,
        partyLevel: null,
        enemies: [],
      }
      state.currentEncounter = {
        ...base,
        enemies: [...base.enemies, enemy],
      }
    },
    SAVE_ENCOUNTER_SLOT(state, { name, encounter }) {
      state.savedEncounters = [
        {
          name,
          encounter,
          savedAt: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        ...state.savedEncounters,
      ].slice(0, 10)
      localStorage.setItem(
        'savedEncounters',
        JSON.stringify(state.savedEncounters)
      )
    },
    DELETE_ENCOUNTER_SLOT(state, idx) {
      state.savedEncounters = state.savedEncounters.filter((_, i) => i !== idx)
      localStorage.setItem(
        'savedEncounters',
        JSON.stringify(state.savedEncounters)
      )
    },
    UPDATE_ENCOUNTER_ENEMY(state, { enemyId, newEnemy }) {
      if (!state.currentEncounter) return
      const idx = state.currentEncounter.enemies.findIndex(
        (e) => e.id === enemyId
      )
      if (idx !== -1) {
        state.currentEncounter.enemies.splice(idx, 1, newEnemy)
      }
    },
    REQUEST_COMBAT_NAV(state) {
      state.combatNavRequest = true
    },
    CLEAR_COMBAT_NAV(state) {
      state.combatNavRequest = false
    },
    SET_PENDING_COMBAT_ENEMIES(state, enemies) {
      state.pendingCombatEnemies = enemies
    },
    CLEAR_PENDING_COMBAT_ENEMIES(state) {
      state.pendingCombatEnemies = null
    },
    REQUEST_OPEN_ENCOUNTER_GENERATOR(state, seed = null) {
      state.encounterSeed = seed
      state.openEncounterGeneratorRequest = true
    },
    CLEAR_OPEN_ENCOUNTER_GENERATOR(state) {
      state.openEncounterGeneratorRequest = false
      state.encounterSeed = null
    },
    LOAD_CALENDAR_NOTES(state, notes) {
      state.calendar_notes = notes ?? []
    },
    LOAD_LEVEL_CAP(state, cap) {
      state.level_cap = cap ?? null
    },
    LOAD_SUBCLASSES(state, subclasses) {
      state.subclasses = subclasses ?? []
    },
    SET_LEVEL_CAP(state, cap) {
      state.level_cap = cap
      dataService.patchUserPrefs({ level_cap: cap }).catch(console.warn)
    },
    SAVE_CALENDAR_NOTE(state, note) {
      const idx = state.calendar_notes.findIndex((n) => n.id === note.id)
      if (idx !== -1) {
        state.calendar_notes.splice(idx, 1, note)
      } else {
        state.calendar_notes.push(note)
      }
      dataService
        .patchUserPrefs({ calendar_notes: state.calendar_notes })
        .catch(console.warn)
    },
    DELETE_CALENDAR_NOTE(state, id) {
      state.calendar_notes = state.calendar_notes.filter((n) => n.id !== id)
      dataService
        .patchUserPrefs({ calendar_notes: state.calendar_notes })
        .catch(console.warn)
    },
    LONG_REST(state, payload = {}) {
      const skipChars = payload?.skipChars ?? []
      state.characters = state.characters.map((char) => {
        if (skipChars.includes(char.name)) {
          // No LR benefit; gain 1 level of Exhaustion for interrupted rest
          const conditions = [...(char.conditions ?? [])]
          const exIdx = conditions.findIndex((c) =>
            typeof c === 'string'
              ? c === 'Exhaustion'
              : c?.name === 'Exhaustion'
          )
          if (exIdx !== -1) {
            const ex = conditions[exIdx]
            if (typeof ex === 'string') {
              conditions.splice(exIdx, 0, 'Exhaustion')
            } else {
              const lvl = (ex.stacks ?? ex.level ?? 1) + 1
              conditions[exIdx] = { ...ex, stacks: lvl, level: lvl }
            }
          } else {
            conditions.push('Exhaustion')
          }
          return { ...char, conditions }
        }
        const updated = { ...char, hp_current: char.hp_max }
        // Spell slots
        if (char.spell_slots) {
          const slots = {}
          for (const [level, slot] of Object.entries(char.spell_slots)) {
            slots[level] = { ...slot, current: slot.max }
          }
          updated.spell_slots = slots
        }
        // Pact magic
        if (char.pact_magic)
          updated.pact_magic = {
            ...char.pact_magic,
            current: char.pact_magic.max,
          }
        // Ki / monk resources
        if (char.ki_points)
          updated.ki_points = { ...char.ki_points, current: char.ki_points.max }
        // Feature uses (long rest recharge; short rest charges also refill on long rest)
        if (char.features) {
          updated.features = char.features.map((f) =>
            f.uses_max != null && f.recharge
              ? { ...f, uses_current: f.uses_max }
              : f
          )
        }
        // Generic resources (sorcery points, etc.) — recharge on long rest
        if (char.resources) {
          updated.resources = char.resources.map((r) =>
            r.max != null &&
            (r.recharge === 'long_rest' || r.recharge === 'short_rest')
              ? { ...r, current: r.max }
              : r
          )
        }
        // Hit dice: recover half max, rounded down, minimum 1 (PHB "Resting")
        const hdMax = char.level ?? 1
        const hdCurrent = char.hit_dice_current ?? hdMax
        const hdRecover = Math.max(1, Math.floor(hdMax / 2))
        updated.hit_dice_current = Math.min(hdMax, hdCurrent + hdRecover)
        // Exhaustion: reduce by 1 level on successful long rest
        if (char.exhaustion_level > 0) {
          updated.exhaustion_level = char.exhaustion_level - 1
        }
        // Conditions: clear all non-exhaustion conditions
        if (char.conditions?.length) {
          updated.conditions = char.conditions.filter((c) =>
            typeof c === 'string'
              ? c === 'Exhaustion'
              : c?.name === 'Exhaustion'
          )
        }
        return updated
      })
      if (!state.dirtyTables.includes('characters'))
        state.dirtyTables.push('characters')
      state.restVersion += 1

      // Item charges — daily and short_rest both recharge on long rest; dice items auto-roll.
      // 'long_rest' itself was missing from this list (a real pre-existing bug —
      // items_228's Signet Ring uses charges_recharge: "long_rest" and never
      // actually recharged on any rest before this fix, since this was the only
      // call site that could plausibly match it).
      state.party_items = rechargeItems(state.party_items, [
        'daily',
        'short_rest',
        'long_rest',
      ])
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')

      // Advance active party's day (immutable update — no patchUserPrefs here;
      // the modal's Save/Skip path calls SET_PARTIES which owns party persistence)
      const activeIdx = state.parties.findIndex((p) => p.active)
      if (activeIdx !== -1) {
        const p = state.parties[activeIdx]
        const updated = [...state.parties]
        updated[activeIdx] = { ...p, game_day: (p.game_day ?? 1) + 1 }
        state.parties = updated
      } else {
        state.game_day += 1
        localStorage.setItem('game_day', state.game_day)
      }
    },
    SHORT_REST(state, spentMap) {
      // spentMap: { [charName]: { diceSpent: number, hpGained: number } }
      state.characters = state.characters.map((char) => {
        const spent = spentMap[char.name]
        const updated = { ...char }
        if (spent?.hpGained > 0)
          updated.hp_current = Math.min(
            char.hp_max,
            char.hp_current + spent.hpGained
          )
        if (spent?.diceSpent > 0)
          updated.hit_dice_current = Math.max(
            0,
            (char.hit_dice_current ?? char.level ?? 1) - spent.diceSpent
          )
        // Reset short-rest features
        if (char.features)
          updated.features = char.features.map((f) =>
            f.uses_max != null && f.recharge === 'short_rest'
              ? { ...f, uses_current: f.uses_max }
              : f
          )
        // Pact magic (short rest)
        if (char.pact_magic?.recharge === 'short_rest')
          updated.pact_magic = {
            ...char.pact_magic,
            current: char.pact_magic.max,
          }
        // Ki points (short rest)
        if (char.ki_points)
          updated.ki_points = { ...char.ki_points, current: char.ki_points.max }
        // Generic resources (short rest recharge)
        if (char.resources) {
          updated.resources = char.resources.map((r) =>
            r.max != null && r.recharge === 'short_rest'
              ? { ...r, current: r.max }
              : r
          )
        }
        return updated
      })
      if (!state.dirtyTables.includes('characters'))
        state.dirtyTables.push('characters')
      state.restVersion += 1

      // Item charges — recharge short_rest items
      state.party_items = rechargeItems(state.party_items, ['short_rest'])
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')
    },
    // patch: the `patch` object returned by engine.diffLevelUp (see
    // /api/engine/preview-level-up and LevelUpTool.vue) — applied as-is via
    // a shallow merge, since diffLevelUp already computed every field that
    // actually changed (level, hp, classes, features, spell_slots/pact_magic,
    // stat_* if an ASI/feat was resolved).
    //
    // Deliberately does NOT mark 'characters' dirty — a level-up is a big
    // enough edit that the project owner wants it exempt from the ambient
    // 1.5s autosave (AppLayout.vue's `hasChanges` watcher) and persisted only
    // via LevelUpTool.vue's explicit "Save Changes" button instead.
    APPLY_LEVEL_UP(state, { characterName, patch }) {
      state.characters = state.characters.map((char) =>
        char.name === characterName ? { ...char, ...patch } : char
      )
    },
    // A brand-new character built by NewCharacterTool.vue. Deliberately does
    // NOT mark 'characters' dirty, same reasoning as APPLY_LEVEL_UP — new
    // characters go through the explicit save/revert bar
    // (pendingCharacterSaves.js), not the ambient autosave.
    ADD_CHARACTER(state, character) {
      state.characters = [...state.characters, character]
    },
    // Discards a character that was never saved — 'characters' has no
    // matching row in `originals` for it at all, so reverting it means
    // removing it, not restoring some baseline that doesn't exist.
    REMOVE_CHARACTER(state, { characterName }) {
      state.characters = state.characters.filter(
        (c) => c.name !== characterName
      )
    },
    // Payload is either a bare itemId (spend/restore 1, the original shape —
    // still what CharacterInventory.vue's flat +/- buttons pass) or
    // {itemId, amount} for a specific-cost spend, e.g. BattleItemsPanel
    // casting a spell with a real charge_cost > 1.
    SPEND_CHARGE(state, payload) {
      const { itemId, amount = 1 } =
        typeof payload === 'string' ? { itemId: payload } : payload
      state.party_items = state.party_items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              charges_current: Math.max(0, item.charges_current - amount),
            }
          : item
      )
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')
    },
    RESTORE_CHARGE(state, payload) {
      const { itemId, amount = 1 } =
        typeof payload === 'string' ? { itemId: payload } : payload
      state.party_items = state.party_items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              charges_current: Math.min(
                item.charges_max,
                item.charges_current + amount
              ),
            }
          : item
      )
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')
    },
    // Spends one use of an independent, non-pooled spell grant (see
    // dnd.normalizeItemSpellGrant's uses_max/uses_current) — e.g. one bead of
    // a Necklace of Prayer Beads. When choiceGroup is set, every grant entry
    // sharing that choice_group is decremented together, since they
    // represent alternative effects drawn from the SAME single use (e.g. a
    // Curing bead's choice of Cure Wounds or Lesser Restoration).
    SPEND_GRANT_USE(state, { itemId, spellName, choiceGroup }) {
      state.party_items = state.party_items.map((item) => {
        if (item.id !== itemId || !Array.isArray(item.spells_granted))
          return item
        const newGrants = item.spells_granted.map((g) => {
          if (typeof g === 'string' || g.uses_current == null) return g
          const matches = choiceGroup
            ? g.choice_group === choiceGroup
            : g.name === spellName
          if (!matches || g.uses_current <= 0) return g
          return { ...g, uses_current: g.uses_current - 1 }
        })
        return { ...item, spells_granted: newGrants }
      })
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')
    },
    RESTORE_GRANT_USE(state, { itemId, spellName, choiceGroup }) {
      state.party_items = state.party_items.map((item) => {
        if (item.id !== itemId || !Array.isArray(item.spells_granted))
          return item
        const newGrants = item.spells_granted.map((g) => {
          if (typeof g === 'string' || g.uses_current == null) return g
          const matches = choiceGroup
            ? g.choice_group === choiceGroup
            : g.name === spellName
          if (!matches || g.uses_current >= g.uses_max) return g
          return { ...g, uses_current: g.uses_current + 1 }
        })
        return { ...item, spells_granted: newGrants }
      })
      if (!state.dirtyTables.includes('party_items'))
        state.dirtyTables.push('party_items')
    },
    DELETE_PARTY_ITEM(state, itemId) {
      const idx = state.party_items.findIndex((i) => i.id === itemId)
      if (idx !== -1) {
        state.party_items.splice(idx, 1)
        if (!state.dirtyTables.includes('party_items')) {
          state.dirtyTables.push('party_items')
        }
      }
    },
    ADJUST_PARTY_GOLD(state, amount) {
      if (!state.finances.party_purse) {
        state.finances.party_purse = { gold: 0 }
      }
      state.finances.party_purse.gold += Number(amount) || 0
      if (!state.dirtyTables.includes('finances')) {
        state.dirtyTables.push('finances')
      }
    },
    // Crossing Profit System (house_rules.json) — `pending` holds week 1's
    // rolled result across the tool's two-week cycle; null between cycles
    // (right after week 2 combines, or before week 1 has ever been rolled).
    // See WeeklyEvents.vue's rollCrossingProfit().
    SET_CROSSING_PROFIT_PENDING(state, pending) {
      state.finances = {
        ...state.finances,
        crossing_profit: { ...(state.finances.crossing_profit || {}), pending },
      }
      if (!state.dirtyTables.includes('finances')) {
        state.dirtyTables.push('finances')
      }
    },
    // Holds the computed 2-week combined result once week 2 has been
    // rolled but before it's actually been applied to party_purse.gold —
    // real gold changing hands is a deliberate explicit action (an "Apply"
    // button), not automatic. See WeeklyEvents.vue's applyCrossingProfit().
    SET_CROSSING_PROFIT_AWAITING(state, awaiting) {
      state.finances = {
        ...state.finances,
        crossing_profit: {
          ...(state.finances.crossing_profit || {}),
          awaiting_application: awaiting,
        },
      }
      if (!state.dirtyTables.includes('finances')) {
        state.dirtyTables.push('finances')
      }
    },
    SET_CURRENCY(state, { key, value }) {
      if (!state.finances.party_purse) state.finances.party_purse = {}
      state.finances.party_purse[key] = Number(value) || 0
      if (!state.dirtyTables.includes('finances')) {
        state.dirtyTables.push('finances')
      }
    },
    ADJUST_CURRENCY(state, { key, amount }) {
      if (!state.finances.party_purse) state.finances.party_purse = {}
      const current = Number(state.finances.party_purse[key]) || 0
      state.finances.party_purse[key] = current + (Number(amount) || 0)
      if (!state.dirtyTables.includes('finances')) {
        state.dirtyTables.push('finances')
      }
    },
  },

  actions: {
    async loadAll({ commit }) {
      const tables = [
        'characters',
        'npcs',
        'places',
        'party_items',
        'companions',
        'world',
        'finances',
        'networks',
        'assets',
        'relationships',
        'lore',
      ]
      const originals = {}
      for (const table of tables) {
        const data = await dataService.get(table)
        if (data !== undefined)
          originals[table] = JSON.parse(JSON.stringify(data))
        commit('SET_TABLE', { table, data })
      }
      commit('SET_ORIGINALS', originals)

      try {
        const res = await fetch('/api/engine/subclasses')
        if (res.ok) commit('LOAD_SUBCLASSES', await res.json())
      } catch (e) {
        console.warn('Failed to load subclasses', e)
      }
      commit('SET_LOADED', true)

      // Load parties from user_prefs (migrating old savedParties format if needed)
      try {
        const prefs = await dataService.getUserPrefs()
        if (prefs.parties?.length) {
          commit('LOAD_PARTIES', prefs.parties)
        } else if (prefs.savedParties?.length) {
          // Migrate old combat-context format → new parties format
          const migrated = prefs.savedParties.map((p, i) => ({
            id: `party_${Date.now()}_${i}`,
            name: p.name,
            members: p.members,
            active: i === 0,
          }))
          commit('LOAD_PARTIES', migrated)
          dataService.patchUserPrefs({ parties: migrated }).catch(console.warn)
        }
        if (prefs.calendar_notes) {
          commit('LOAD_CALENDAR_NOTES', prefs.calendar_notes)
        }
        if (prefs.level_cap != null) {
          commit('LOAD_LEVEL_CAP', prefs.level_cap)
        }
      } catch (e) {
        console.warn('Failed to load user_prefs', e)
      }
    },

    // Saves one table via a 3-way merge against whatever's currently on
    // disk (see dataService.save / server.js). The server may return a
    // merged result that differs from what we sent — e.g. a row a direct
    // file edit added that this tab never loaded — so we resync local
    // state to that merged truth rather than assuming our copy was final.
    async save({ state, commit }, table) {
      const result = await dataService.save(
        table,
        state[table],
        state.originals[table]
      )
      if (result && result.data !== undefined) {
        commit('SET_TABLE', { table, data: result.data })
      }
      return result
    },

    async saveAll({ dispatch, commit, state }) {
      const tables = state.dirtyTables.length
        ? [...state.dirtyTables]
        : ['characters', 'npcs', 'places', 'party_items', 'world', 'finances']
      const conflicts = []
      for (const table of tables) {
        const result = await dispatch('save', table)
        if (result?.conflicts?.length) {
          conflicts.push(
            ...result.conflicts.map((path) => `${table}${path.slice(1)}`)
          )
        }
      }
      // Update originals to the merged (post-save) state and clear dirty
      // tracking — state[table] now reflects the merged truth on disk,
      // written by each 'save' dispatch above.
      const newOriginals = {}
      tables.forEach((table) => {
        newOriginals[table] = JSON.parse(JSON.stringify(state[table]))
      })
      commit('SET_ORIGINALS', {
        ...state.originals,
        ...newOriginals,
      })
      commit('CLEAR_DIRTY_TABLES')
      return { conflicts }
    },
  },

  getters: {
    activeParty: (state) => state.parties.find((p) => p.active) ?? null,
    activePartyDay: (state) => {
      const active = state.parties.find((p) => p.active)
      return active?.game_day ?? state.game_day
    },
    dirtyTables: (state) => state.dirtyTables,
    hasChanges: (state) => state.dirtyTables.length > 0,
    changes: (state) => {
      const changes = {}
      state.dirtyTables.forEach((table) => {
        if (
          JSON.stringify(state[table]) !==
          JSON.stringify(state.originals[table])
        ) {
          changes[table] = {
            original: state.originals[table],
            current: state[table],
          }
        }
      })
      return changes
    },
  },
})
