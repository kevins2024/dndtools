<template>
  <div class="stub-panel">
    <h3>Item Details asdf</h3>
    <Editor v-if="selectedItem" :item="selectedItem" store-name="party_items" />
  </div>
</template>
<script>
import Editor from './Editor.vue'

export default {
  name: 'ItemDetails',
  components: {
    Editor,
  },

  computed: {
    selectedItem() {
      return this.$store.state.party_items.find(
        (item) => item.name === this.$store.state.selectedItem
      )
    },
  },
}
</script>
