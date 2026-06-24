import Vue from 'vue'
import Vuex from 'vuex'
import dataService from '@/utils/dataService'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    selectedPlayers: [],
    selectedItem: null,
    diceDrawerOpen: false,
    game_day: Number(localStorage.getItem('game_day')) || 1,
    parties: [],
    characterNavRequest: null,
    characters: [],
    npcs: [],
    locations: [],
    party_items: [],
    world: [],
    networks: { sending_stones: [], teleportation_circles: [] },
    assets: [],
    relationships: [],
    homebrew: {},
    finances: {},
    loaded: false,
    originals: {},
    dirtyTables: [],
    restVersion: 0,
    currentEncounter: null,
    lastEncounter: null,
    savedEncounters: JSON.parse(
      localStorage.getItem('savedEncounters') || '[]'
    ),
    combatNavRequest: false,
    pendingCombatEnemies: null,
  },

  mutations: {
    SET_DICE_DRAWER_OPEN(state, val) {
      state.diceDrawerOpen = val
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
    MARK_DIRTY_TABLE(state, table) {
      if (!state.dirtyTables.includes(table)) {
        state.dirtyTables.push(table)
      }
    },
    CLEAR_DIRTY_TABLES(state) {
      state.dirtyTables = []
    },
    SET_LOADED(state, value) {
      state.loaded = value
    },
    ADD_PARTY_ITEM(state, item) {
      const nextId =
        state.party_items.length > 0
          ? Math.max(...state.party_items.map((i) => i.id)) + 1
          : 0
      state.party_items.push({ ...item, id: nextId })
      if (!state.dirtyTables.includes('party_items')) {
        state.dirtyTables.push('party_items')
      }
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
    LONG_REST(state, payload = {}) {
      const skipChars = payload?.skipChars ?? []
      state.characters = state.characters.map((char) => {
        if (skipChars.includes(char.name)) return char
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
        // Hit dice: recover up to half max (rounded up), capped at level
        const hdMax = char.level ?? 1
        const hdCurrent = char.hit_dice_current ?? hdMax
        const hdRecover = Math.ceil(hdMax / 2)
        updated.hit_dice_current = Math.min(hdMax, hdCurrent + hdRecover)
        // Conditions: clear everything except Exhaustion; reduce Exhaustion by 1 level
        if (char.conditions?.length) {
          let exhaustion = char.conditions.filter((c) =>
            typeof c === 'string'
              ? c === 'Exhaustion'
              : c?.name === 'Exhaustion'
          )
          // Reduce by one level: remove one string entry, or decrement object stacks
          if (exhaustion.length > 0) {
            if (typeof exhaustion[0] === 'string') {
              exhaustion = exhaustion.slice(1) // each entry = one level
            } else {
              const e = { ...exhaustion[0] }
              const lvl = (e.stacks ?? e.level ?? 1) - 1
              exhaustion = lvl > 0 ? [{ ...e, stacks: lvl, level: lvl }] : []
            }
          }
          updated.conditions = exhaustion
        }
        return updated
      })
      if (!state.dirtyTables.includes('characters'))
        state.dirtyTables.push('characters')
      state.restVersion += 1

      // Advance active party's day
      const activeParty = state.parties.find((p) => p.active)
      if (activeParty) {
        activeParty.game_day = (activeParty.game_day ?? 1) + 1
        dataService
          .patchUserPrefs({ parties: state.parties })
          .catch(console.warn)
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
        return updated
      })
      if (!state.dirtyTables.includes('characters'))
        state.dirtyTables.push('characters')
      state.restVersion += 1
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
  },

  actions: {
    async loadAll({ commit }) {
      const tables = [
        'characters',
        'npcs',
        'locations',
        'party_items',
        'world',
        'homebrew',
        'finances',
        'networks',
        'assets',
        'relationships',
      ]
      const originals = {}
      for (const table of tables) {
        const data = await dataService.get(table)
        if (data !== undefined)
          originals[table] = JSON.parse(JSON.stringify(data))
        commit('SET_TABLE', { table, data })
      }
      commit('SET_ORIGINALS', originals)
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
      } catch (e) {
        console.warn('Failed to load user_prefs', e)
      }
    },

    async save({ state }, table) {
      await dataService.save(table, state[table])
    },

    async saveAll({ dispatch, commit, state }) {
      const tables = state.dirtyTables.length
        ? [...state.dirtyTables]
        : [
            'characters',
            'npcs',
            'locations',
            'party_items',
            'world',
            'homebrew',
            'finances',
          ]
      for (const table of tables) {
        await dispatch('save', table)
      }
      // Update originals to current state and clear dirty tracking
      const newOriginals = {}
      tables.forEach((table) => {
        newOriginals[table] = JSON.parse(JSON.stringify(state[table]))
      })
      commit('SET_ORIGINALS', {
        ...state.originals,
        ...newOriginals,
      })
      commit('CLEAR_DIRTY_TABLES')
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
