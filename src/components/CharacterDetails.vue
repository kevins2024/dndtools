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
      <button
        v-if="hasSpells"
        class="tab-btn"
        :class="{ active: activeTab === 'spellbook' }"
        @click="activeTab = 'spellbook'"
      >
        Spellbook
      </button>
    </div>

    <!-- Content -->
    <div class="tab-content">
      <template v-if="selected">
        <CharacterSheet v-if="activeTab === 'sheet'" :character="selected" />
        <CharacterInventory
          v-else-if="activeTab === 'equipment'"
          :character="selected"
        />
        <CharacterSpellbook
          v-else-if="activeTab === 'spellbook'"
          :character="selected"
        />
      </template>
      <div v-else class="empty-state">No character selected.</div>
    </div>
  </div>
</template>

<script>
import CharacterInventory from './CharacterInventory.vue'
import CharacterSheet from './CharacterSheet.vue'
import CharacterSpellbook from './CharacterSpellbook.vue'
import Editor from './Editor.vue'
import { characterHasSpells } from '@/utils/spellUtils.js'

export default {
  name: 'CharacterDetails',
  components: { CharacterInventory, CharacterSheet, CharacterSpellbook, Editor },

  props: {
    character: { type: Object, default: null },
  },

  data() {
    return {
      activeTab: 'sheet',
    }
  },

  computed: {
    selected() {
      if (this.character) return this.character
      if (this.$store.state.selectedPlayers.length === 1) {
        const name = this.$store.state.selectedPlayers[0]
        return this.$store.state.characters.find((c) => c.name === name)
      }
      return null
    },
    hasSpells() {
      return characterHasSpells(this.selected)
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
  font-size: var(--font-size-lg);
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

</style>
