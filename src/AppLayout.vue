<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header">
      <nav class="context-nav">
        <button
          v-for="ctx in contexts"
          :key="ctx.id"
          class="ctx-btn"
          :class="{ active: activeContext === ctx.id }"
          @click="activeContext = ctx.id"
        >
          {{ ctx.label }}
        </button>
      </nav>
      <button class="rest-btn" title="Long rest — recovers all HP and spell slots" @click="longRest">Long Rest</button>
    </header>

    <!-- Context Area -->
    <main class="context-area">
      <keep-alive>
        <component :is="activeContextComponent" v-if="activeContextComponent" />
      </keep-alive>
      <div v-if="!activeContextComponent" class="context-placeholder">{{ activeContextLabel }}</div>
    </main>

    <!-- Dice Drawer (hidden during combat) -->
    <Drawer v-if="!isCombat" toggle-title="Toggle dice roller">
      <DiceRoller />
    </Drawer>


    <!-- Save Dialog -->
    <SaveDialog :open="saveDialogOpen" @close="saveDialogOpen = false" @saved="onSaved" />

    <!-- Save flash -->
    <transition name="save-flash">
      <div v-if="saveFlash" class="save-flash">✓ Saved</div>
    </transition>

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
import DiceRoller from './components/DiceRoller.vue'
import Drawer from './components/Drawer.vue'
import SaveDialog from './components/SaveDialog.vue'
import CombatContext from './components/CombatContext.vue'
import CharacterContext from './components/CharacterContext.vue'
import MapViewer from './components/MapViewer.vue'
import ToolsContext from './components/ToolsContext.vue'
import WorldContext from './components/WorldContext.vue'

export default {
  name: 'AppLayout',

  components: {
    DiceRoller,
    Drawer,
    SaveDialog,
    CombatContext,
    CharacterContext,
    MapViewer,
    ToolsContext,
    WorldContext,
  },

  data() {
    return {
      activeContext: 'combat',
      saveDialogOpen: false,
      saveFlash: false,
      contexts: [
        { id: 'combat',    label: 'Combat',    component: 'CombatContext' },
        { id: 'character', label: 'Character', component: 'CharacterContext' },
        { id: 'map',       label: 'Map',       component: 'MapViewer' },
        { id: 'world',     label: 'World',     component: 'WorldContext' },
        { id: 'story',     label: 'Story',     component: null },
        { id: 'tools',     label: 'Tools',     component: 'ToolsContext' },
      ],
    }
  },

  methods: {
    longRest() {
      this.$store.commit('LONG_REST')
    },
    onSaved() {
      this.saveFlash = true
      setTimeout(() => { this.saveFlash = false }, 600)
    },
  },

  watch: {
    '$store.state.combatNavRequest'(val) {
      if (val) {
        this.activeContext = 'combat'
        this.$store.commit('CLEAR_COMBAT_NAV')
      }
    },
  },

  computed: {
    isCombat() {
      return this.activeContext === 'combat'
    },
    activeContextLabel() {
      const ctx = this.contexts.find((c) => c.id === this.activeContext)
      return ctx ? ctx.label : ''
    },
    activeContextComponent() {
      const ctx = this.contexts.find((c) => c.id === this.activeContext)
      return ctx?.component ?? null
    },
    hasChanges() {
      return this.$store.getters.hasChanges
    },
  },
}
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--color-bg);
  font-family: var(--font-body);
  color: var(--color-text);
  position: relative;
}

/* ── Header ── */
.app-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 2.6rem;
  padding: 0 0.75rem;
  background-color: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
}

.context-nav {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.rest-btn {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}
.rest-btn:hover {
  border-color: #4a9e6b;
  color: #4a9e6b;
}

.ctx-btn {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ctx-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-border);
}

.ctx-btn.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

/* ── Context Area ── */
.context-area {
  flex: 1;
  overflow: hidden;
}

.context-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  letter-spacing: 0.05em;
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
  font-size: var(--font-size-md);
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

/* ── Save flash ── */
.save-flash {
  position: fixed;
  bottom: 1vh;
  right: 5vw;
  padding: 8px 16px;
  background: #2d7a4f;
  border: 1px solid #3a9e64;
  border-radius: 8px;
  color: white;
  font-size: var(--font-size-md);
  font-weight: 600;
  z-index: 102;
  pointer-events: none;
}

.save-flash-enter-active,
.save-flash-leave-active {
  transition: opacity 0.2s ease;
}
.save-flash-enter,
.save-flash-leave-to {
  opacity: 0;
}
</style>
