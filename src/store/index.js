import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    selectedPlayers: [],
  },
  mutations: {
    SET_SELECTED_PLAYERS(state, players) {
      state.selectedPlayers = players
    },
  },
})
