<template>
  <div class="character-details">
    <!-- Tabs -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'sheet' }"
        @click="activeTab = 'sheet'"
      >
        Character Sheet
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'equipment' }"
        @click="activeTab = 'equipment'"
      >
        Equipment
      </button>
    </div>

    <!-- Content -->
    <div class="tab-content">
      <template v-if="selected">
        <Editor
          v-if="activeTab === 'sheet'"
          :item="selected"
          store-name="characters"
        />
        <Editor
          v-if="activeTab === 'equipment'"
          :item="selected"
          store-name="characters"
        />
      </template>
      <div v-else class="empty-state">No character selected.</div>
    </div>
  </div>
</template>

<script>
import Editor from './Editor.vue'

export default {
  name: 'CharacterDetails',
  components: { Editor },

  data() {
    return {
      activeTab: 'sheet',
    }
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

<style scoped>
.character-details {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Tabs ── */
.tab-bar {
  display: flex;
  border-bottom: 1px solid #3a2e22;
  background-color: #0e0c09;
  flex-shrink: 0;
}

.tab-btn {
  padding: 0.6vh 1.2vw;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #8a7a60;
  cursor: pointer;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #c8a96e;
}

.tab-btn.active {
  color: #e8c87a;
  border-bottom-color: #c8a96e;
}

/* ── Content ── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1vh 1vw;
}

.empty-state {
  color: #4a3a22;
  font-style: italic;
  margin-top: 2vh;
  text-align: center;
}
</style>
