<template>
  <div class="pick-list">
    <div class="pick-head">
      <span class="pick-title">{{ title }}</span>
      <span class="pick-count">{{ selectedCount }} / {{ items.length }}</span>
    </div>
    <input
      v-model="search"
      class="pick-search"
      type="search"
      :placeholder="`Search ${title.toLowerCase()}…`"
    />
    <div class="pick-bulk">
      <button class="pick-bulk-btn" type="button" @click="selectVisible">
        All{{ search ? ' shown' : '' }}
      </button>
      <button class="pick-bulk-btn" type="button" @click="clearVisible">
        None{{ search ? ' shown' : '' }}
      </button>
    </div>
    <div class="pick-rows scrollable">
      <label v-for="item in visible" :key="item.key" class="pick-row">
        <input
          type="checkbox"
          :checked="selectedSet.has(item.key)"
          @change="toggle(item.key)"
        />
        <span class="pick-label">{{ item.label }}</span>
        <span v-if="item.hint" class="pick-hint">{{ item.hint }}</span>
      </label>
      <div v-if="!visible.length" class="pick-empty">
        {{ items.length ? 'Nothing matches.' : 'Nothing to list.' }}
      </div>
    </div>
  </div>
</template>

<script>
// A searchable, alphabetized checkbox list. `value` is the array of selected
// keys. Searching only changes what is SHOWN: selections made earlier stay
// selected while hidden, and All / None act on the rows currently shown.
export default {
  name: 'PickList',

  props: {
    title: { type: String, required: true },
    // [{ key, label, hint? }]
    items: { type: Array, default: () => [] },
    value: { type: Array, default: () => [] },
  },

  data() {
    return { search: '' }
  },

  computed: {
    sorted() {
      return [...this.items].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      )
    },
    visible() {
      const q = this.search.trim().toLowerCase()
      if (!q) return this.sorted
      return this.sorted.filter((i) =>
        `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(q)
      )
    },
    selectedSet() {
      return new Set(this.value)
    },
    // Counts only keys that still exist in the list.
    selectedCount() {
      return this.items.filter((i) => this.selectedSet.has(i.key)).length
    },
  },

  methods: {
    toggle(key) {
      const next = new Set(this.value)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      this.$emit('input', [...next])
    },
    selectVisible() {
      const next = new Set(this.value)
      this.visible.forEach((i) => next.add(i.key))
      this.$emit('input', [...next])
    },
    clearVisible() {
      const shown = new Set(this.visible.map((i) => i.key))
      this.$emit(
        'input',
        this.value.filter((k) => !shown.has(k))
      )
    },
  },
}
</script>

<style scoped>
.pick-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem 0.7rem;
}

.pick-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.pick-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
}

.pick-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.pick-search {
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.pick-bulk {
  display: flex;
  gap: 0.4rem;
}

.pick-bulk-btn {
  padding: 0.1rem 0.6rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
}
.pick-bulk-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.pick-rows {
  max-height: 14rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.pick-row {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  padding: 0.12rem 0.2rem;
  border-radius: 3px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
}
.pick-row:hover {
  background: rgba(255, 255, 255, 0.04);
}
.pick-row input {
  accent-color: var(--color-accent);
  flex-shrink: 0;
}

.pick-label {
  flex: 1;
  min-width: 0;
}

.pick-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 45%;
}

.pick-empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  padding: 0.3rem;
}
</style>
