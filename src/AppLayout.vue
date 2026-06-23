<template>
  <div class="app-layout">
    <!-- Header: nav tabs only -->
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
      <div v-if="!activeContextComponent" class="context-placeholder">
        {{ activeContextLabel }}
      </div>
    </main>

    <!-- Dice panel (toggle owned by bottom bar) -->
    <Drawer :show-toggle="false">
      <DiceRoller />
    </Drawer>

    <!-- Bottom bar: contextual actions left, dice toggle right -->
    <div class="bottom-bar">
      <div class="bar-left">
        <template v-if="activeContext === 'party'">
          <button
            class="bar-btn"
            @click="shortRestOpen = true"
            title="Take a short rest"
          >
            Short Rest
          </button>
          <button
            class="bar-btn"
            @click="longRestOpen = true"
            title="Begin a long rest"
          >
            Long Rest
          </button>
          <button class="bar-btn accent" @click="partyEditOpen = true">
            Manage Parties
          </button>
        </template>
      </div>
      <button
        class="bar-dice-btn"
        :class="{ open: diceOpen }"
        @click="toggleDice"
      >
        <img
          :src="d20Icon"
          class="bar-d20"
          :class="{ 'bar-d20--open': diceOpen }"
        />
        {{ diceOpen ? 'Hide Dice' : 'Dice Roller' }}
      </button>
    </div>

    <!-- Party edit modal -->
    <PartyEditModal v-if="partyEditOpen" @close="partyEditOpen = false" />

    <!-- Short rest modal -->
    <ShortRestModal v-if="shortRestOpen" @close="shortRestOpen = false" />

    <!-- Long rest modal -->
    <LongRestModal v-if="longRestOpen" @close="longRestOpen = false" />

    <!-- Save Dialog -->
    <SaveDialog
      :open="saveDialogOpen"
      @close="saveDialogOpen = false"
      @saved="onSaved"
    />

    <!-- Save flash -->
    <transition name="save-flash">
      <div v-if="saveFlash" class="save-flash">✓ Saved</div>
    </transition>
  </div>
</template>

<script>
import d20 from '@/assets/dice/d20.svg'
import DiceRoller from './components/DiceRoller.vue'
import Drawer from './components/Drawer.vue'
import SaveDialog from './components/SaveDialog.vue'
import CombatContext from './components/CombatContext.vue'
import CharacterContext from './components/CharacterContext.vue'
import MapViewer from './components/MapViewer.vue'
import ToolsContext from './components/ToolsContext.vue'
import WorldContext from './components/WorldContext.vue'
import StoryContext from './components/StoryContext.vue'
import PartyContext from './components/PartyContext.vue'
import PartyEditModal from './components/PartyEditModal.vue'
import LongRestModal from './components/LongRestModal.vue'
import ShortRestModal from './components/ShortRestModal.vue'

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
    StoryContext,
    PartyContext,
    PartyEditModal,
    LongRestModal,
    ShortRestModal,
  },

  data() {
    return {
      d20Icon: d20,
      activeContext: 'party',
      saveDialogOpen: false,
      saveFlash: false,
      partyEditOpen: false,
      shortRestOpen: false,
      longRestOpen: false,
      contexts: [
        { id: 'party', label: 'Party', component: 'PartyContext' },
        { id: 'combat', label: 'Combat', component: 'CombatContext' },
        { id: 'character', label: 'Character', component: 'CharacterContext' },
        { id: 'map', label: 'Map', component: 'MapViewer' },
        { id: 'world', label: 'World', component: 'WorldContext' },
        { id: 'story', label: 'Story', component: 'StoryContext' },
        { id: 'tools', label: 'Tools', component: 'ToolsContext' },
      ],
    }
  },

  computed: {
    activeContextLabel() {
      return this.contexts.find((c) => c.id === this.activeContext)?.label ?? ''
    },
    activeContextComponent() {
      return (
        this.contexts.find((c) => c.id === this.activeContext)?.component ??
        null
      )
    },
    hasChanges() {
      return this.$store.getters.hasChanges
    },
    diceOpen() {
      return this.$store.state.diceDrawerOpen
    },
  },

  methods: {
    toggleDice() {
      this.$store.commit('SET_DICE_DRAWER_OPEN', !this.diceOpen)
    },
    onSaved() {
      this.saveFlash = true
      setTimeout(() => {
        this.saveFlash = false
      }, 600)
    },
  },

  watch: {
    '$store.state.combatNavRequest'(val) {
      if (val) {
        this.activeContext = 'combat'
        this.$store.commit('CLEAR_COMBAT_NAV')
      }
    },
    '$store.state.characterNavRequest'(req) {
      if (req) {
        this.activeContext = 'character'
        // Do NOT clear here — CharacterContext reads it on mount and clears it itself
      }
    },
    hasChanges(val) {
      if (!val) return
      clearTimeout(this._autosaveTimer)
      this._autosaveTimer = setTimeout(async () => {
        await this.$store.dispatch('saveAll')
        this.onSaved()
      }, 1500)
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
  min-height: 0;
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

/* ── Bottom bar ── */
.bottom-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 28px;
  background: var(--color-bg-panel-dark);
  border-top: 1px solid var(--color-border);
  padding: 0 0.5rem;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
}

.bar-btn {
  padding: 0.15rem 0.7rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.bar-btn:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
}
.bar-btn.accent {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.bar-btn.accent:hover {
  background: rgba(var(--color-accent-rgb), 0.1);
}

.bar-dice-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.75rem;
  background: none;
  border: none;
  color: var(--color-text-low);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: color 0.15s;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.bar-dice-btn:hover,
.bar-dice-btn.open {
  color: var(--color-accent);
}

.bar-d20 {
  width: 14px;
  height: 14px;
  opacity: 0.5;
  transition: transform 0.22s ease, opacity 0.15s;
}
.bar-dice-btn:hover .bar-d20,
.bar-dice-btn.open .bar-d20 {
  opacity: 1;
}
.bar-d20--open {
  transform: rotate(180deg);
}

/* ── Save button / flash ── */
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
