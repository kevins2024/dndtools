<template>
  <div class="rel-browser">
    <div class="rel-toolbar">
      <input
        v-model="search"
        class="rel-search"
        placeholder="Filter by name…"
      />
      <span class="rel-count">{{ filtered.length }} relationships</span>
    </div>

    <div class="rel-list">
      <RelationshipCard
        v-for="rel in filtered"
        :key="rel.id"
        :relationship="rel"
        :display-names="[
          displayName(rel.people[0]),
          displayName(rel.people[1]),
        ]"
      />
      <div v-if="!filtered.length" class="rel-empty">
        No relationships match "{{ search }}".
      </div>
    </div>
  </div>
</template>

<script>
import RelationshipCard from './RelationshipCard.vue'

export default {
  name: 'RelationshipBrowser',
  components: { RelationshipCard },

  data() {
    return { search: '' }
  },

  computed: {
    allPeople() {
      const map = {}
      ;[...this.$store.state.characters, ...this.$store.state.npcs].forEach(
        (e) => {
          if (e.name) map[e.name.toLowerCase()] = e.name
        }
      )
      return map
    },

    filtered() {
      const q = this.search.trim().toLowerCase()
      const rels = this.$store.state.relationships ?? []
      if (!q) return rels
      return rels.filter((r) =>
        r.people.some((p) => (this.allPeople[p] ?? p).toLowerCase().includes(q))
      )
    },
  },

  methods: {
    displayName(raw) {
      return (
        this.allPeople[raw.toLowerCase()] ??
        raw.replace(/\b\w/g, (c) => c.toUpperCase())
      )
    },
  },
}
</script>

<style scoped>
.rel-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.rel-toolbar {
  display: flex;
  align-items: center;
  gap: 1vw;
  padding: 0.6vh 1vw;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
}

.rel-search {
  flex: 1;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  padding: 0.3vh 0.6vw;
}
.rel-search:focus {
  outline: none;
  border-color: var(--color-accent);
}

.rel-count {
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.rel-list {
  flex: 1;
  overflow-y: auto;
  padding: 1vh 1vw;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8vh 1vw;
  align-content: start;
}

.rel-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  text-align: center;
  padding: 2vh 0;
}
</style>
