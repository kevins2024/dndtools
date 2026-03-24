<template>
  <div class="stub-panel">
    <h3>Character Details</h3>
    <Editor v-if="selected" :item="selected" store-name="player-characters" />
  </div>
</template>
<script>
import Editor from './Editor.vue'
export default {
  name: 'CharacterDetails',
  components: {
    Editor,
  },
  computed: {
    selected() {
      if (this.$store.state.selectedPlayers.length === 1) {
        const name = this.$store.state.selectedPlayers[0]
        return this.$store.state.characters.find((c) => c.name === name)
      }
      return null
    },
  },
}
</script>
