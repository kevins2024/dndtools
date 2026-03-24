<template>
  <AppLayout />
</template>

<script>
import AppLayout from '@/AppLayout.vue'
import dataService from './utils/dataService'

export default {
  name: 'App',
  components: { AppLayout },
  data() {
    return {}
  },
  async created() {
    await this.$store.dispatch('loadAll')
    const existingParty = dataService.loadSelectedPlayers()
    if (existingParty.length > 0) {
      this.$store.commit('SET_SELECTED_PLAYERS', existingParty)
    }
  },
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
}
html,
#app,
div {
}
</style>
