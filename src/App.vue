<template>
  <AppLayout />
</template>

<script>
import dataService from '@/utils/dataService'
import AppLayout from '@/AppLayout.vue'

export default {
  name: 'App',
  components: { AppLayout },
  data() {
    return {
      characters: [],
      npcs: [],
      locations: [],
    }
  },
}
</script>

<style>
/* Blank white page */
body,
html,
#app,
div {
  background: #fff;
  min-height: 100vh;
  margin: 0;
}
</style>
