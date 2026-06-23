<template>
  <div class="world-context">
    <nav class="world-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="world-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>
    <div class="world-content">
      <keep-alive>
        <component :is="activeComponent" />
      </keep-alive>
    </div>
  </div>
</template>

<script>
import MonsterBrowser from './MonsterBrowser.vue'
import TellondeCalendar from './TellondeCalendar.vue'

export default {
  name: 'WorldContext',
  components: { MonsterBrowser, TellondeCalendar },

  data() {
    return {
      activeTab: 'monsters',
      tabs: [
        { id: 'monsters', label: 'Monsters', component: 'MonsterBrowser' },
        { id: 'calendar', label: 'Calendar', component: 'TellondeCalendar' },
      ],
    }
  },

  computed: {
    activeComponent() {
      return this.tabs.find((t) => t.id === this.activeTab)?.component ?? null
    },
  },
}
</script>

<style scoped>
.world-context {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.world-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.world-tab {
  font-size: var(--font-size-base);
  font-family: var(--font-display);
  letter-spacing: 0.04em;
  padding: 0.4rem 1rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
  margin-bottom: -1px;
}

.world-tab:hover {
  color: var(--color-text-muted);
}

.world-tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.world-content {
  flex: 1;
  overflow: hidden;
}
</style>
