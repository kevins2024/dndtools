<template>
  <teleport to="body">
    <div v-if="open" class="cp-backdrop" @mousedown.self="$emit('close')">
      <div class="cp-dialog" role="dialog" aria-label="Command palette">
        <input
          ref="input"
          v-model="query"
          class="cp-input"
          placeholder="Go to context or character…"
          autocomplete="off"
          spellcheck="false"
          @keydown.esc.prevent="$emit('close')"
          @keydown.enter.prevent="confirm"
          @keydown.up.prevent="move(-1)"
          @keydown.down.prevent="move(1)"
        />
        <ul v-if="results.length" class="cp-list" ref="list">
          <li
            v-for="(item, i) in results"
            :key="item.key"
            class="cp-item"
            :class="{ 'cp-item--active': i === cursor }"
            @mousedown.prevent="selectIndex(i)"
            @mousemove="cursor = i"
          >
            <span class="cp-badge" :class="`cp-badge--${item.type}`">
              {{ item.type === 'context' ? 'ctx' : 'chr' }}
            </span>
            <span class="cp-label">{{ item.label }}</span>
          </li>
        </ul>
        <div v-else-if="query.trim()" class="cp-empty">No results</div>
      </div>
    </div>
  </teleport>
</template>

<script>
export default {
  name: 'CommandPalette',

  props: {
    open: { type: Boolean, required: true },
    contexts: { type: Array, required: true },
    characters: { type: Array, required: true },
  },

  emits: ['close', 'navigate-context', 'navigate-character'],

  data() {
    return { query: '', cursor: 0 }
  },

  computed: {
    results() {
      const q = this.query.trim().toLowerCase()
      const ctxItems = this.contexts
        .filter((c) => !q || c.label.toLowerCase().includes(q))
        .map((c) => ({
          type: 'context',
          key: `ctx:${c.id}`,
          id: c.id,
          label: c.label,
        }))
      const chrItems = this.characters
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .map((c) => ({
          type: 'character',
          key: `chr:${c.name}`,
          name: c.name,
          label: c.name,
        }))
      return [...ctxItems, ...chrItems]
    },
  },

  watch: {
    open(val) {
      if (val) {
        this.query = ''
        this.cursor = 0
        this.$nextTick(() => this.$refs.input?.focus())
      }
    },
    query() {
      this.cursor = 0
    },
  },

  methods: {
    move(dir) {
      if (!this.results.length) return
      this.cursor =
        (this.cursor + dir + this.results.length) % this.results.length
      this.$nextTick(() => this.scrollActiveintoView())
    },
    scrollActiveintoView() {
      const list = this.$refs.list
      if (!list) return
      const active = list.children[this.cursor]
      active?.scrollIntoView({ block: 'nearest' })
    },
    confirm() {
      if (this.results.length) this.selectIndex(this.cursor)
    },
    selectIndex(i) {
      const item = this.results[i]
      if (!item) return
      if (item.type === 'context') this.$emit('navigate-context', item.id)
      else this.$emit('navigate-character', item.name)
    },
  },
}
</script>

<style>
.cp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18vh;
  z-index: 9000;
}

.cp-dialog {
  width: min(520px, 90vw);
  background: var(--color-bg-panel-dark);
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
}

.cp-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.85rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  outline: none;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 1rem;
}
.cp-input::placeholder {
  color: var(--color-text-low);
}

.cp-list {
  list-style: none;
  margin: 0;
  padding: 0.3rem 0;
  max-height: 320px;
  overflow-y: auto;
}

.cp-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
  transition: background 0.08s;
}
.cp-item--active {
  background: var(--color-bg-surface);
}

.cp-badge {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}
.cp-badge--context {
  background: rgba(var(--color-accent-rgb), 0.15);
  color: var(--color-accent);
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
}
.cp-badge--character {
  background: rgba(160, 120, 60, 0.15);
  color: #c9a05a;
  border: 1px solid rgba(160, 120, 60, 0.3);
}

.cp-label {
  font-size: 0.9rem;
  color: var(--color-text);
}

.cp-empty {
  padding: 0.8rem 1rem;
  color: var(--color-text-low);
  font-size: 0.85rem;
  font-style: italic;
}
</style>
