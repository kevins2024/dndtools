<template>
  <div class="actions-ref">
    <header class="ar-bar">
      <input
        v-model="search"
        class="ar-search"
        placeholder="Search actions and combat rules…"
      />
      <div class="ar-count">{{ visibleCount }} shown</div>
    </header>

    <div class="ar-body scrollable">
      <section v-for="g in groups" :key="g.id" class="ar-group">
        <h3 class="ar-group-title">
          {{ g.label }}
          <span class="ar-group-sub">{{ g.blurb }}</span>
        </h3>
        <article v-for="e in g.entries" :key="e.name" class="ar-row">
          <div class="ar-name">{{ e.name }}</div>
          <div class="ar-text">{{ e.text }}</div>
        </article>
      </section>

      <p v-if="!visibleCount" class="ar-note">
        Nothing matches “{{ search }}”.
      </p>
    </div>
  </div>
</template>

<script>
import { ACTION_GROUPS } from '@/data/actions_2024.js'

export default {
  name: 'ActionsReference',

  data() {
    return { search: '' }
  },

  computed: {
    groups() {
      const q = this.search.trim().toLowerCase()
      return ACTION_GROUPS.map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) =>
            !q ||
            e.name.toLowerCase().includes(q) ||
            e.text.toLowerCase().includes(q)
        ),
      })).filter((g) => g.entries.length)
    },
    visibleCount() {
      return this.groups.reduce((n, g) => n + g.entries.length, 0)
    },
  },
}
</script>

<style scoped>
.actions-ref {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ar-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.5rem 0.9rem;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.ar-search {
  flex: 1 1 18rem;
  max-width: 28rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.ar-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.ar-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.9rem 1.5rem;
}

.ar-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  padding: 1rem 0;
}

.ar-group-title {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 0.5rem 0 0.3rem;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent);
  letter-spacing: 0.04em;
}

.ar-group-sub {
  margin-left: 0.6rem;
  font-family: inherit;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0;
}

.ar-row {
  display: grid;
  grid-template-columns: 12rem 1fr;
  gap: 0.2rem 1.2rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
}

.ar-row:hover {
  background: var(--color-bg-hover, var(--color-bg-surface));
}

.ar-name {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.ar-text {
  font-size: var(--font-size-sm);
  line-height: 1.45;
  color: var(--color-text);
  white-space: pre-line;
}

@media (max-width: 700px) {
  .ar-row {
    grid-template-columns: 1fr;
  }
}
</style>
