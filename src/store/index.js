import Vue from 'vue'
import Vuex from 'vuex'
import dataService from '@/utils/dataService'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    selectedPlayers: [],
    selectedItem: null,
    characters: [],
    npcs: [],
    locations: [],
    party_items: [],
    world: [],
    homebrew: {},
    finances: {},
    loaded: false,
    originals: {},
    dirtyTables: [],
  },

  mutations: {
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
      ]
      const originals = {}
      for (const table of tables) {
        const data = await dataService.get(table)
        originals[table] = JSON.parse(JSON.stringify(data)) // deep copy
        commit('SET_TABLE', { table, data })
      }
      commit('SET_ORIGINALS', originals)
      commit('SET_LOADED', true)
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
