<template>
  <div class="app-layout">
    <!-- Header: nav tabs + currency -->
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

      <!-- Party / day context -->
      <div class="header-context" v-if="activeParty">
        <span class="hctx-party">{{ activeParty.name }}</span>
        <span class="hctx-sep">·</span>
        <span class="hctx-day">Day {{ activePartyDay }}</span>
      </div>

      <!-- Currency badges -->
      <div class="currency-bar">
        <label class="currency-badge" title="Party gold (gp)">
          <img :src="goldIcon" class="currency-icon" alt="Gold" />
          <input
            class="currency-input"
            type="number"
            min="0"
            :value="partyGold"
            @change="setCurrency('gold', $event.target.value)"
          />
          <span class="currency-unit">gp</span>
        </label>
        <label class="currency-badge" title="Weave dust">
          <img :src="dustIcon" class="currency-icon" alt="Weave dust" />
          <input
            class="currency-input"
            type="number"
            min="0"
            :value="weaveDust"
            @change="setCurrency('weave_dust', $event.target.value)"
          />
          <span class="currency-unit dust-unit">dust</span>
        </label>
      </div>
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
    <LongRestModal
      v-if="longRestOpen"
      @close="longRestOpen = false"
      @rested="onRested"
    />

    <!-- Save Dialog -->
    <SaveDialog
      :open="saveDialogOpen"
      @close="saveDialogOpen = false"
      @saved="onSaved"
    />

    <!-- Command palette -->
    <CommandPalette
      :open="commandPaletteOpen"
      :contexts="contexts"
      :characters="allCharacters"
      @close="commandPaletteOpen = false"
      @navigate-context="paletteNavigateContext"
      @navigate-character="paletteNavigateCharacter"
    />

    <!-- Save flash -->
    <transition name="save-flash">
      <div v-if="saveFlash" class="save-flash">✓ Saved</div>
    </transition>

    <!-- Long rest date toast -->
    <div v-if="restToast" class="rest-toast" @animationend="restToast = false">
      <div class="rest-toast-label">Long Rest Complete</div>
      <div class="rest-toast-date">{{ restDateLabel }}</div>
    </div>
  </div>
</template>

<script>
import d20 from '@/assets/dice/d20.svg'
import goldIcon from '@/assets/icons/icon-gold.svg'
import dustIcon from '@/assets/icons/icon-dust.svg'
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
import CommandPalette from './components/CommandPalette.vue'

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
    CommandPalette,
  },

  mounted() {
    this._paletteKey = (e) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        this.commandPaletteOpen = !this.commandPaletteOpen
      }
    }
    window.addEventListener('keydown', this._paletteKey)
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this._paletteKey)
  },

  computed: {
    allCharacters() {
      return this.$store.state.characters ?? []
    },
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
    activeParty() {
      return this.$store.getters.activeParty
    },
    activePartyDay() {
      return this.$store.getters.activePartyDay
    },
    partyGold() {
      return this.$store.state.finances?.party_purse?.gold ?? 0
    },
    weaveDust() {
      return this.$store.state.finances?.party_purse?.weave_dust ?? 0
    },
    diceOpen() {
      return this.$store.state.diceDrawerOpen
    },
    restDateLabel() {
      const DAYS_PER_YEAR = 204
      const DAYS_PER_WEEK = 8
      const SEASONS = [
        { name: 'Winter', start: 1, end: 51 },
        { name: 'Spring', start: 52, end: 102 },
        { name: 'Summer', start: 103, end: 153 },
        { name: 'Autumn', start: 154, end: 204 },
      ]
      const currentDay =
        this.$store.getters.activePartyDay || this.$store.state.game_day || 1
      const year = Math.floor((currentDay - 1) / DAYS_PER_YEAR) + 1
      const doy = ((currentDay - 1) % DAYS_PER_YEAR) + 1
      const season = (
        SEASONS.find((s) => doy >= s.start && doy <= s.end) ?? SEASONS[0]
      ).name
      const week =
        doy <= 48
          ? Math.ceil(doy / DAYS_PER_WEEK)
          : doy <= 52
          ? null
          : 6 + Math.ceil((doy - 52) / DAYS_PER_WEEK)
      const dow =
        doy <= 48
          ? ((doy - 1) % DAYS_PER_WEEK) + 1
          : doy <= 52
          ? doy - 48
          : ((doy - 53) % DAYS_PER_WEEK) + 1
      const weekPart = week ? `Week ${week}, ` : 'Festival · '
      return `${season} · Year ${year} · ${weekPart}Day ${dow}`
    },
  },

  data() {
    return {
      d20Icon: d20,
      goldIcon,
      dustIcon,
      activeContext: 'party',
      saveDialogOpen: false,
      saveFlash: false,
      restToast: false,
      partyEditOpen: false,
      shortRestOpen: false,
      longRestOpen: false,
      commandPaletteOpen: false,
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

  methods: {
    paletteNavigateContext(id) {
      this.activeContext = id
      this.commandPaletteOpen = false
    },
    paletteNavigateCharacter(name) {
      this.$store.commit('NAV_TO_CHARACTER', { name, tab: 'sheet' })
      this.commandPaletteOpen = false
    },
    toggleDice() {
      this.$store.commit('SET_DICE_DRAWER_OPEN', !this.diceOpen)
    },
    setCurrency(key, value) {
      this.$store.commit('SET_CURRENCY', { key, value })
    },
    onSaved() {
      this.saveFlash = true
      setTimeout(() => {
        this.saveFlash = false
      }, 600)
    },
    onRested() {
      this.restToast = false
      this.$nextTick(() => {
        this.restToast = true
      })
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

/* ── Currency bar ── */
/* ── Header context (party + day) ── */
.header-context {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0 0.75rem;
  white-space: nowrap;
}
.hctx-party {
  font-family: var(--font-display, serif);
  font-size: 0.75rem;
  color: var(--color-accent);
  letter-spacing: 0.04em;
}
.hctx-sep {
  font-size: 0.7rem;
  color: var(--color-text-low);
}
.hctx-day {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.currency-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  padding-left: 0.5rem;
}

.currency-badge {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.05rem 0.3rem 0.05rem 0.2rem;
  cursor: text;
}

.currency-icon {
  width: 17px;
  height: 14px;
  object-fit: contain;
  display: block;
}

.currency-input {
  width: 56px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.78rem;
  text-align: right;
  padding: 0;
  -moz-appearance: textfield;
}
.currency-input::-webkit-outer-spin-button,
.currency-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
.currency-input:focus {
  color: var(--color-accent);
}

.currency-unit {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-family: var(--font-display);
  letter-spacing: 0.04em;
}
.dust-unit {
  color: #a855f7;
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

/* ── Long rest toast ── */
@keyframes rest-toast-anim {
  0% {
    opacity: 0;
    transform: translate(-50%, -12px);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  78% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -8px);
  }
}

.rest-toast {
  position: fixed;
  top: 4.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  pointer-events: none;
  text-align: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  padding: 0.7rem 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  animation: rest-toast-anim 10.8s ease forwards;
}

.rest-toast-label {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-low);
  margin-bottom: 0.3rem;
}

.rest-toast-date {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-accent);
  letter-spacing: 0.03em;
}
</style>
