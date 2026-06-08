<template>
  <div class="drawer-wrap">
    <transition name="dice-slide">
      <div v-if="open" class="drawer-panel">
        <slot />
      </div>
    </transition>
    <button
      v-if="showToggle"
      class="drawer-toggle"
      :class="{ open }"
      :title="toggleTitle"
      @click="toggle"
    >
      <img
        :src="d20"
        class="toggle-d20"
        :class="{ 'toggle-d20--open': open }"
      />
      <span class="toggle-label">{{ open ? 'Hide Dice' : 'Dice Roller' }}</span>
    </button>
  </div>
</template>

<script>
import d20 from '@/assets/dice/d20.svg'

export default {
  name: 'Drawer',

  props: {
    toggleTitle: { type: String, default: 'Toggle dice roller' },
    showToggle: { type: Boolean, default: true },
  },

  data() {
    return { d20 }
  },

  computed: {
    open() {
      return this.$store.state.diceDrawerOpen
    },
  },

  methods: {
    toggle() {
      this.$store.commit('SET_DICE_DRAWER_OPEN', !this.open)
    },
  },
}
</script>

<style scoped>
.drawer-wrap {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border);
}

/* ── Dice panel ── */
.drawer-panel {
  height: 17vh;
  min-height: 90px;
  overflow: hidden;
  background: var(--color-bg-panel-dark);
}

/* ── Toggle strip ── */
.drawer-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 28px;
  background: var(--color-bg-panel-dark);
  border: none;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-low);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
}

.drawer-toggle:hover,
.drawer-toggle.open {
  color: var(--color-accent);
  background: var(--color-bg-surface);
}

.toggle-d20 {
  width: 16px;
  height: 16px;
  opacity: 0.6;
  transition: transform 0.22s ease, opacity 0.15s ease;
}
.toggle-d20--open {
  transform: rotate(180deg);
}
.drawer-toggle:hover .toggle-d20,
.drawer-toggle.open .toggle-d20 {
  opacity: 1;
}

.toggle-label {
  letter-spacing: 0.04em;
}

/* ── Slide animation ── */
.dice-slide-enter-active,
.dice-slide-leave-active {
  transition: height 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
}
.dice-slide-enter,
.dice-slide-leave-to {
  height: 0 !important;
  opacity: 0;
}
</style>
