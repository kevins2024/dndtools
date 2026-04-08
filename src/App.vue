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
@import './theme.css';

html {
  font-size: 16px;
}

body {
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

p,
div {
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  color: var(--color-text-strong);
  line-height: 1.2;
}

h1 {
  font-size: var(--font-size-3xl);
}

h2 {
  font-size: var(--font-size-2xl);
}

h3 {
  font-size: var(--font-size-xl);
}

h4 {
  font-size: var(--font-size-large);
}

h5 {
  font-size: var(--font-size-base);
}

h6 {
  font-size: var(--font-size-label);
}

button,
input,
textarea {
  font-family: inherit;
}
</style>
