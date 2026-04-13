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

    <!-- Drawer -->
    <transition name="drawer">
      <div v-if="drawerOpen" class="drawer">
        <DiceRoller />
      </div>
    </transition>

    <!-- Save Dialog -->
    <div
      v-if="saveDialogOpen"
      class="dialog-backdrop"
      @click.self="closeSaveDialog"
    >
      <div class="dialog-panel save-dialog">
        <div class="dialog-title">Save Changes</div>
        <p>The following data has been modified:</p>
        <div class="changes-list">
          <div
            v-for="entry in changeEntries"
            :key="entry.table"
            class="change-item"
          >
            <strong>{{ entry.table }}.json</strong> - {{ entry.summary }}
            <ul class="change-detail-list">
              <li v-for="(detail, idx) in entry.details" :key="idx">
                {{ detail }}
              </li>
            </ul>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="act-btn dim" @click="closeSaveDialog">Cancel</button>
          <button class="act-btn" @click="confirmSave">Save All Changes</button>
        </div>
      </div>
    </div>

    <!-- Drawer Toggle Button -->
    <button
      class="drawer-toggle"
      :class="{ open: drawerOpen }"
      @click="drawerOpen = !drawerOpen"
      title="Toggle dice roller"
    >
      &#9776;
    </button>

    <!-- Save Button -->
    <button
      v-if="hasChanges"
      class="save-btn"
      @click="showSaveDialog"
      title="Save changes"
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
  },

  data() {
    return {
      activeTab: 'players',
      drawerOpen: false,
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
    changeEntries() {
      return Object.entries(this.$store.getters.changes).map(
        ([table, change]) => ({
          table,
          summary: this.getChangeSummary(change),
          details: this.getChangeDetails(table, change),
        })
      )
    },
  },

  methods: {
    deselectAll() {
      this.$store.commit('SET_SELECTED_PLAYERS', [])
    },
    showSaveDialog() {
      this.saveDialogOpen = true
    },
    closeSaveDialog() {
      this.saveDialogOpen = false
    },
    async confirmSave() {
      try {
        await this.$store.dispatch('saveAll')
        this.closeSaveDialog()
        // Optionally show success message
        alert('Changes saved successfully!')
      } catch (error) {
        alert('Error saving changes: ' + error.message)
      }
    },
    getChangeSummary(change) {
      const isArray = Array.isArray(change.original)
      const origCount = isArray
        ? change.original.length
        : Object.keys(change.original).length
      const currCount = isArray
        ? change.current.length
        : Object.keys(change.current).length
      const type = isArray ? 'items' : 'properties'
      return `${origCount} → ${currCount} ${type}`
    },
    getChangeDetails(table, change) {
      if (Array.isArray(change.original) && Array.isArray(change.current)) {
        return this.getArrayDiffDetails(change.original, change.current)
      }
      if (
        change.original &&
        typeof change.original === 'object' &&
        change.current &&
        typeof change.current === 'object'
      ) {
        return this.getObjectDiffDetails(change.original, change.current)
      }
      return ['Change detected']
    },
    getArrayDiffDetails(original, current) {
      const byId = (items) =>
        items.reduce((map, item) => {
          if (item && item.id != null) {
            map[item.id] = item
          }
          return map
        }, {})

      const originalById = byId(original)
      const currentById = byId(current)
      const originalIds = Object.keys(originalById)
      const currentIds = Object.keys(currentById)
      if (originalIds.length > 0 && currentIds.length > 0) {
        const added = currentIds.filter((id) => !originalIds.includes(id))
        const removed = originalIds.filter((id) => !currentIds.includes(id))
        const modified = currentIds
          .filter((id) => originalIds.includes(id))
          .filter(
            (id) =>
              JSON.stringify(originalById[id]) !==
              JSON.stringify(currentById[id])
          )

        const details = []
        if (added.length) {
          details.push(
            `Added: ${added
              .map((id) => this.describeItem(currentById[id]))
              .join(', ')}`
          )
        }
        if (removed.length) {
          details.push(
            `Removed: ${removed
              .map((id) => this.describeItem(originalById[id]))
              .join(', ')}`
          )
        }
        modified.forEach((id) => {
          const originalItem = originalById[id]
          const currentItem = currentById[id]
          const changedKeys = this.getObjectDiffKeys(originalItem, currentItem)
          details.push(
            `Modified ${this.describeItem(currentItem)}: ${changedKeys.join(
              ', '
            )}`
          )
        })
        return details.length
          ? details
          : ['No item-level change details available']
      }

      return ['Array changed']
    },
    getObjectDiffDetails(original, current) {
      const keys = Array.from(
        new Set([...Object.keys(original), ...Object.keys(current)])
      )
      const changes = keys
        .filter(
          (key) =>
            JSON.stringify(original[key]) !== JSON.stringify(current[key])
        )
        .map(
          (key) =>
            `${key}: ${JSON.stringify(original[key])} → ${JSON.stringify(
              current[key]
            )}`
        )
      return changes.length ? changes : ['No property-level changes detected']
    },
    getObjectDiffKeys(original, current) {
      const keys = Array.from(
        new Set([...Object.keys(original), ...Object.keys(current)])
      )
      return keys.filter(
        (key) => JSON.stringify(original[key]) !== JSON.stringify(current[key])
      )
    },
    describeItem(item) {
      if (!item) return 'unknown'
      if (item.name) return `${item.name} (${item.id})`
      return item.id || 'unknown'
    },
  },

  async created() {},
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

/* ── Drawer ── */
.drawer {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 80vw;
  max-width: 80vw;
  height: 25vh;
  background-color: var(--color-bg-panel);
  border-left: 1px solid var(--color-border);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

/* ── Drawer Toggle Button ── */
.drawer-toggle {
  position: fixed;
  bottom: 2vh;
  right: 1vw;
  width: 42px;
  height: 42px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-toggle);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  z-index: 101;
}

.drawer-toggle:hover,
.drawer-toggle.open {
  border-color: var(--color-accent);
  color: var(--color-accent);
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.2);
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

/* ── Save Dialog ── */
.save-dialog {
  width: min(92vw, 500px);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.changes-list {
  margin: 1rem 0;
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.change-item {
  padding: 0.75rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: var(--font-size-small);
}

.change-detail-list {
  list-style: disc;
  margin: 0.5rem 0 0 1rem;
  padding: 0;
  color: var(--color-text-muted);
}

.change-detail-list li {
  margin-bottom: 0.35rem;
  line-height: 1.4;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 18, 0.7);
  z-index: 20;
}

.dialog-panel {
  width: min(92vw, 420px);
  padding: 1.2rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  font-size: var(--font-size-small);
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.dialog-field {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.dialog-field input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.act-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-small);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: color 0.15s ease;
}

.act-btn:disabled {
  color: var(--color-text-low);
  cursor: not-allowed;
}

.act-btn:hover {
  color: var(--color-accent);
}

.act-btn.dim:hover {
  color: var(--color-text-danger);
}

/* ── Drawer Transition ── */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s ease;
}
.drawer-enter,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
