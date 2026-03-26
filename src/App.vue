<template>
  <AppLayout />
</template>

<script>
import AppLayout from '@/AppLayout.vue'

export default {
  name: 'App',
  components: { AppLayout },
  data() {
    return {}
  },
  async created() {
    await this.$store.dispatch('loadAll')
  },
}
</script>

<style>
body,
html,
#app,
div {
}
</style>
