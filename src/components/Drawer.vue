<template>
  <div>
    <transition name="drawer">
      <div v-if="open" class="drawer">
        <slot />
      </div>
    </transition>
    <button
      class="drawer-toggle"
      :class="{ open }"
      :title="toggleTitle"
      @click="open = !open"
    >
      &#9776;
    </button>
  </div>
</template>

<script>
export default {
  name: 'Drawer',

  props: {
    toggleTitle: {
      type: String,
      default: 'Toggle drawer',
    },
  },

  data() {
    return {
      open: false,
    }
  },
}
</script>

<style scoped>
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

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s ease;
}
.drawer-enter,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
