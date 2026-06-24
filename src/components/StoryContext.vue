<template>
  <div class="story-context">
    <nav class="story-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="story-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>
    <div class="story-content">
      <keep-alive>
        <component :is="activeComponent" />
      </keep-alive>
    </div>
  </div>
</template>

<script>
import NpcBrowser from './NpcBrowser.vue'
import AssetBrowser from './AssetBrowser.vue'
import RelationshipBrowser from './RelationshipBrowser.vue'

export default {
  name: 'StoryContext',
  components: { NpcBrowser, AssetBrowser, RelationshipBrowser },

  data() {
    return {
      activeTab: 'npcs',
      tabs: [
        { id: 'npcs', label: 'NPCs', component: 'NpcBrowser' },
        { id: 'assets', label: 'Assets', component: 'AssetBrowser' },
        {
          id: 'relationships',
          label: 'Relationships',
          component: 'RelationshipBrowser',
        },
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
.story-context {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.story-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.story-tab {
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
.story-tab:hover {
  color: var(--color-text-muted);
}
.story-tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.story-content {
  flex: 1;
  overflow: hidden;
}
</style>
