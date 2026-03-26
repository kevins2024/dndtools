import Vue from 'vue'
import Vuex from 'vuex'
import dataService from '@/services/dataService'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    selectedPlayers: [],
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
    SET_TABLE(state, { table, data }) {
      state[table] = data
    },
    SET_LOADED(state, value) {
      state.loaded = value
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
