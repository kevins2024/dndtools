<template>
  <div class="tools-context">
    <div class="tools-nav">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="tool-tab"
        :class="{ active: activeTool === tool.id }"
        @click="activeTool = tool.id"
      >
        {{ tool.label }}
      </button>
    </div>
    <div class="tools-body">
      <keep-alive>
        <component :is="activeComponent" />
      </keep-alive>
    </div>
  </div>
</template>

<script>
import CharacterGenerator from './CharacterGenerator.vue'
import EncounterGenerator from './EncounterGenerator.vue'
import WeeklyEvents from './WeeklyEvents.vue'

export default {
  name: 'ToolsContext',

  components: { CharacterGenerator, EncounterGenerator, WeeklyEvents },

  data() {
    return {
      activeTool: 'weekly',
      tools: [
        { id: 'weekly',     label: 'Weekly Events',        component: 'WeeklyEvents'       },
        { id: 'encounter',  label: 'Encounter Generator',  component: 'EncounterGenerator' },
        { id: 'character',  label: 'Character Generator',  component: 'CharacterGenerator' },
      ],
    }
  },

  computed: {
    activeComponent() {
      return this.tools.find((t) => t.id === this.activeTool)?.component ?? null
    },
  },
}
</script>

<style scoped>
.tools-context {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tools-nav {
  display: flex;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tool-tab {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-tab:hover {
  color: var(--color-accent);
  border-color: var(--color-border);
}

.tool-tab.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.tools-body {
  flex: 1;
  overflow: hidden;
}
</style>
