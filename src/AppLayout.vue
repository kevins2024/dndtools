<template>
  <div class="app-layout">
    <!-- Side Panel -->
    <aside class="side-panel">
      <nav class="side-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="nav-btn"
          :class="{ active: activeTab === tab.id }"
          :title="tab.label"
          @click="activeTab = tab.id"
        >
          <span class="nav-icon" v-html="tab.icon"></span>
        </button>
      </nav>
      <div class="panel-content">
        <component :is="activeSidebarComponent" />
      </div>
      <button
        v-if="activeTab === 'players'"
        class="deselect-all-btn"
        @click="deselectAll"
      >
        Deselect all
      </button>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <component :is="activeDetailComponent" />
    </main>

    <!-- Dice Drawer -->
    <Drawer toggle-title="Toggle dice roller">
      <DiceRoller />
    </Drawer>

    <!-- Save Dialog -->
    <SaveDialog :open="saveDialogOpen" @close="saveDialogOpen = false" />

    <!-- Save Button -->
    <button
      v-if="hasChanges"
      class="save-btn"
      title="Save changes"
      @click="saveDialogOpen = true"
    >
      💾 Save
    </button>
  </div>
</template>

<script>
import PlayerCharacterSelect from './components/PlayerCharacterSelect.vue'
import NPCSelect from './components/NPCSelect.vue'
import Locations from './components/Locations.vue'
import Items from './components/Items.vue'
import Placeholder from './components/Placeholder.vue'
import CharacterDetails from './components/CharacterDetails.vue'
import ItemDetails from './components/ItemDetails.vue'
import LocationDetails from './components/LocationDetails.vue'
import PartyDetails from './components/PartyDetails.vue'
import DiceRoller from './components/DiceRoller.vue'
import Drawer from './components/Drawer.vue'
import SaveDialog from './components/SaveDialog.vue'

export default {
  name: 'AppLayout',

  components: {
    PlayerCharacterSelect,
    NPCSelect,
    Locations,
    Items,
    Placeholder,
    CharacterDetails,
    ItemDetails,
    LocationDetails,
    PartyDetails,
    DiceRoller,
    Drawer,
    SaveDialog,
  },

  data() {
    return {
      activeTab: 'players',
      saveDialogOpen: false,
      tabs: [
        {
          id: 'players',
          label: 'Player Characters',
          icon: '&#9876;',
          component: 'PlayerCharacterSelect',
        },
        {
          id: 'npcs',
          label: 'NPCs',
          icon: '&#128100;',
          component: 'NPCSelect',
        },
        {
          id: 'locations',
          label: 'Locations',
          icon: '&#127956;',
          component: 'Locations',
        },
        { id: 'items', label: 'Items', icon: '&#128188;', component: 'Items' },
        {
          id: 'placeholder',
          label: 'More',
          icon: '&#8230;',
          component: 'Placeholder',
        },
      ],
      details: [
        { id: 'character', title: 'Character', component: 'CharacterDetails' },
        { id: 'item', title: 'Item', component: 'ItemDetails' },
        { id: 'location', title: 'Location', component: 'LocationDetails' },
        { id: 'party', title: 'Party Overview', component: 'PartyDetails' },
      ],
    }
  },

  computed: {
    activeSidebarComponent() {
      const tab = this.tabs.find((t) => t.id === this.activeTab)
      return tab ? tab.component : null
    },
    activeDetailComponent() {
      const detail = this.details.find((d) => d.id === this.activeDetail)
      return detail ? detail.component : null
    },
    activeDetail() {
      if (this.activeTab === 'players' && this.selectedPlayers.length === 1)
        return 'character'
      if (this.activeTab === 'players' && this.selectedPlayers.length > 1)
        return 'party'
      if (this.activeTab === 'items') return 'item'
      return null
    },
    selectedPlayers() {
      return this.$store.state.selectedPlayers
    },
    hasChanges() {
      return this.$store.getters.hasChanges
    },
  },

  methods: {
    deselectAll() {
      this.$store.commit('SET_SELECTED_PLAYERS', [])
    },
  },
}
</script>

<style scoped>
/* ── Layout ── */
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--color-bg);
  font-family: var(--font-body);
  color: var(--color-text);
  position: relative;
}

/* ── Side Panel ── */
.side-panel {
  width: 20vw;
  min-width: 160px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

/* ── Nav Button Strip ── */
.side-nav {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  padding: 0.6vh 0.4vw;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-panel-dark);
  gap: 0.3vw;
}

.nav-btn {
  width: 2.4vw;
  height: 2.4vw;
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--font-size-nav);
  transition: all 0.15s ease;
  padding: 0;
}

.nav-btn:hover {
  background: var(--color-bg-surface-alt);
  border-color: var(--color-accent);
  color: var(--color-accent);
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.2);
}

.nav-btn.active {
  background: var(--color-bg-surface-alt);
  border-color: var(--color-accent);
  color: var(--color-accent-strong);
  box-shadow: 0 0 10px rgba(var(--color-accent-rgb), 0.3);
}

.nav-icon {
  line-height: 1;
  pointer-events: none;
}

/* ── Panel Content ── */
.panel-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.deselect-all-btn {
  margin: 0.8rem;
  align-self: stretch;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  color: var(--color-text);
  padding: 0.75rem 0.9rem;
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.15s ease;
}

.deselect-all-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-bg-surface-alt);
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}
.panel-content::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar);
  border-radius: 2px;
}

/* ── Main Content ── */
.main-content {
  flex: 1;
  height: 100vh;
  overflow-y: auto;
}

/* ── Save Button ── */
.save-btn {
  position: fixed;
  bottom: 1vh;
  right: 5vw;
  padding: 8px 16px;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  color: white;
  font-size: var(--font-size-small);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.15s ease;
  z-index: 102;
}

.save-btn:hover {
  background: var(--color-accent-strong);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}
</style>
