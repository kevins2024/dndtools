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
        <CharacterSheet v-if="activeTab === 'sheet'" :character="selected" />
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
import CharacterSheet from './CharacterSheet.vue'
import Editor from './Editor.vue'

export default {
  name: 'CharacterDetails',
  components: { CharacterSheet, Editor },

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
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-panel-dark);
  flex-shrink: 0;
}

.tab-btn {
  padding: 0.6vh 1.2vw;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-text);
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--color-accent);
}

.tab-btn.active {
  color: var(--color-accent-strong);
  border-bottom-color: var(--color-accent);
}

/* ── Content ── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1vh 1vw;
}

.empty-state {
  color: var(--color-die);
  font-style: italic;
  margin-top: 2vh;
  text-align: center;
}
</style>
