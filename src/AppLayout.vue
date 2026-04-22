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
    </header>

    <!-- Context Area -->
    <main class="context-area">
      <keep-alive>
        <component :is="activeContextComponent" v-if="activeContextComponent" />
      </keep-alive>
      <div v-if="!activeContextComponent" class="context-placeholder">{{ activeContextLabel }}</div>
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
import DiceRoller from './components/DiceRoller.vue'
import Drawer from './components/Drawer.vue'
import SaveDialog from './components/SaveDialog.vue'
import CombatContext from './components/CombatContext.vue'
import CharacterContext from './components/CharacterContext.vue'

export default {
  name: 'AppLayout',

  components: {
    DiceRoller,
    Drawer,
    SaveDialog,
    CombatContext,
    CharacterContext,
  },

  data() {
    return {
      activeContext: 'combat',
      saveDialogOpen: false,
      contexts: [
        { id: 'combat',    label: 'Combat',    component: 'CombatContext' },
        { id: 'character', label: 'Character', component: 'CharacterContext' },
        { id: 'world',     label: 'World',     component: null },
        { id: 'story',     label: 'Story',     component: null },
        { id: 'tools',     label: 'Tools',     component: null },
      ],
    }
  },

  computed: {
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
}

.ctx-btn {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
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
  font-size: var(--font-size-base);
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
