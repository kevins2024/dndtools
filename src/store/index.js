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
    SET_LOADED(state, value) {
      state.loaded = value
    },
    ADD_PARTY_ITEM(state, item) {
      const nextId =
        state.party_items.length > 0
          ? Math.max(...state.party_items.map((i) => i.id)) + 1
          : 0
      state.party_items.push({ ...item, id: nextId })
    },
    UPDATE_ITEM(state, updatedItem) {
      const idx = state.party_items.findIndex((i) => i.id === updatedItem.id)
      if (idx !== -1) {
        state.party_items.splice(idx, 1, updatedItem)
      }
    },
    DELETE_PARTY_ITEM(state, itemId) {
      const idx = state.party_items.findIndex((i) => i.id === itemId)
      if (idx !== -1) {
        state.party_items.splice(idx, 1)
      }
    },
    ADJUST_PARTY_GOLD(state, amount) {
      if (!state.finances.party_purse) {
        state.finances.party_purse = { gold: 0 }
      }
      state.finances.party_purse.gold += Number(amount) || 0
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
      for (const table of tables) {
        const data = await dataService.get(table)
        commit('SET_TABLE', { table, data })
      }
      commit('SET_LOADED', true)
    },

    async save({ state }, table) {
      await dataService.save(table, state[table])
    },

    async saveAll({ dispatch }) {
      const tables = [
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
    },
  },
})
