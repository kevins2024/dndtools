<template>
  <div class="app-layout">
    <!-- Side Panel -->
    <aside class="side-panel">
      <!-- Icon Tab Buttons -->
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

      <!-- Dynamic Component Area -->
      <div class="panel-content">
        <component :is="activeSidebarComponent" />
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <component :is="activeDetailComponent" />
    </main>
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
import dataService from '@/utils/dataService'

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
  },

  data() {
    return {
      activeTab: 'players',
      tabs: [
        {
          id: 'players',
          label: 'Player Characters',
          icon: '&#9876;', // ⚔
          component: 'PlayerCharacterSelect',
        },
        {
          id: 'npcs',
          label: 'NPCs',
          icon: '&#128100;', // 👤
          component: 'NPCSelect',
        },
        {
          id: 'locations',
          label: 'Locations',
          icon: '&#127956;', // 🏔
          component: 'Locations',
        },
        {
          id: 'items',
          label: 'Items',
          icon: '&#128188;', // 💼
          component: 'Items',
        },
        {
          id: 'placeholder',
          label: 'More',
          icon: '&#8230;', // …
          component: 'Placeholder',
        },
      ],
      details: [
        {
          id: 'character',
          title: 'Character',
          component: 'CharacterDetails',
        },
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

      return null
    },
    selectedPlayers() {
      return this.$store.state.selectedPlayers
    },
  },
  async created() {
    this.characters = await dataService.get('characters')
    this.locations = await dataService.get('locations')
    this.npcs = await dataService.get('npcs')
    this.partyItems = await dataService.get('party_items')
    this.world = await dataService.get('world')
  },
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

/* ── Layout ── */
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #1a1612;
  font-family: 'Crimson Text', Georgia, serif;
  color: #e8dcc8;
}

/* ── Side Panel ── */
.side-panel {
  width: 20vw;
  min-width: 160px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #13100d;
  border-right: 1px solid #3a2e22;
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
  border-bottom: 1px solid #3a2e22;
  background-color: #0e0c09;
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
  background: #1e1a14;
  border: 1px solid #3a2e22;
  border-radius: 4px;
  cursor: pointer;
  color: #8a7a60;
  font-size: 1.1vw;
  transition: all 0.15s ease;
  padding: 0;
}

.nav-btn:hover {
  background: #2a2318;
  border-color: #c8a96e;
  color: #c8a96e;
  box-shadow: 0 0 8px rgba(200, 169, 110, 0.2);
}

.nav-btn.active {
  background: #2a2318;
  border-color: #c8a96e;
  color: #e8c87a;
  box-shadow: 0 0 10px rgba(200, 169, 110, 0.3);
}

.nav-icon {
  line-height: 1;
  pointer-events: none;
}

/* ── Panel Content ── */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.2vh 0.8vw;
  scrollbar-width: thin;
  scrollbar-color: #3a2e22 transparent;
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #3a2e22;
  border-radius: 2px;
}

/* ── Main Content ── */
.main-content {
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  padding: 2vh 2vw;
}
</style>
