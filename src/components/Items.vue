<template>
  <div class="stub-panel">
    <h3>Items</h3>
    <button @click="toggleAddItem">
      {{ addItemOpen ? 'Close Adder' : 'Add Items' }}
    </button>
    <div class="item-add-container" v-if="addItemOpen">
      <textarea
        class="item-add-textbox"
        placeholder="Item JSON Here"
        v-model="newItemJSON"
      />
      <button @click="addItems">Add Items</button>
    </div>
    <div v-for="item in items" :key="item.id">
      <div
        @click="selectItem(item)"
        class="item-label"
        :class="{ selected: selectedItem === item.name }"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>
<script>
export default {
  name: 'Items',
  data() {
    return {
      addItemOpen: false,
      newItemJSON: '[]',
    }
  },
  methods: {
    toggleAddItem() {
      this.addItemOpen = !this.addItemOpen
    },
    selectItem(item) {
      this.$store.commit('SET_SELECTED_ITEM', item.name)
    },
    addItems() {
      try {
        const itemsToAdd = JSON.parse(this.newItemJSON)
        if (Array.isArray(itemsToAdd)) {
          itemsToAdd.forEach((item) =>
            this.$store.commit('ADD_PARTY_ITEM', item)
          )
        } else {
          this.$store.commit('ADD_PARTY_ITEM', itemsToAdd)
        }
        this.newItemJSON = ''
      } catch (error) {
        console.error('Invalid JSON:', error)
      }
    },
    save() {
      this.$store.dispatch('save', 'party_items')
      console.log('Saving items!')
    },
  },
  computed: {
    items() {
      return this.$store.state.party_items || []
    },
    selectedItem() {
      return this.$store.state.selectedItem
    },
  },
}
</script>
<style scoped>
.item-add-container {
  margin: 8px 0;
}
.item-add-textbox {
  width: 98%;
  height: 80px;
  margin-bottom: 4px;
}
.item-label {
  cursor: pointer;
  padding: 4px;
}
.selected {
  font-weight: bold;
}
</style>
