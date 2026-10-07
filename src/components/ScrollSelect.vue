<template>
  <div ref="root" class="ss-root" :class="{ 'ss-open': open }">
    <button
      type="button"
      class="ss-button"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onButtonKeydown"
    >
      <span class="ss-label" :class="{ 'ss-placeholder': !selected }">{{
        selected ? selected.label : placeholder
      }}</span>
      <span class="ss-caret" aria-hidden="true">▾</span>
    </button>

    <!-- The whole list, in a panel that scrolls with a normal scrollbar —
         unlike a native <select>, whose popup caps its own height and
         scrolls via little arrows. -->
    <ul
      v-if="open"
      ref="list"
      class="ss-list"
      role="listbox"
      tabindex="-1"
      @keydown="onListKeydown"
    >
      <li
        v-for="(o, i) in options"
        :key="String(o.value)"
        class="ss-option"
        role="option"
        :aria-selected="o.value === value ? 'true' : 'false'"
        :class="{
          'ss-option--selected': o.value === value,
          'ss-option--active': i === activeIndex,
        }"
        @mouseenter="activeIndex = i"
        @click="choose(o)"
      >
        {{ o.label }}
      </li>
    </ul>
  </div>
</template>

<script>
// A dropdown that always lists everything and scrolls normally. Built for
// the Level Up tool's character picker (the browser's native <select> popup
// truncated a long roster behind scroll arrows).
//
//   <ScrollSelect v-model="x" :options="[{ value, label }]" placeholder="…" />
//
// Keyboard: Enter/Space/ArrowDown opens; ArrowUp/Down moves; Enter picks;
// Esc closes; typing a letter jumps to the next option starting with it.
export default {
  name: 'ScrollSelect',

  props: {
    value: { default: null },
    options: { type: Array, required: true }, // [{ value, label }]
    placeholder: { type: String, default: 'Choose…' },
  },

  model: { prop: 'value', event: 'input' },

  data() {
    return { open: false, activeIndex: -1 }
  },

  computed: {
    selected() {
      return this.options.find((o) => o.value === this.value) ?? null
    },
  },

  beforeDestroy() {
    document.removeEventListener('mousedown', this.onOutside)
  },

  methods: {
    toggle() {
      this.open ? this.close() : this.openList()
    },
    openList() {
      this.open = true
      const i = this.options.findIndex((o) => o.value === this.value)
      this.activeIndex = i >= 0 ? i : 0
      document.addEventListener('mousedown', this.onOutside)
      this.$nextTick(() => {
        this.scrollActiveIntoView()
        this.$refs.list?.focus()
      })
    },
    close() {
      this.open = false
      document.removeEventListener('mousedown', this.onOutside)
      this.$refs.root?.querySelector('.ss-button')?.focus()
    },
    onOutside(e) {
      if (this.$refs.root && !this.$refs.root.contains(e.target)) {
        this.open = false
        document.removeEventListener('mousedown', this.onOutside)
      }
    },
    choose(option) {
      this.$emit('input', option.value)
      this.close()
    },
    scrollActiveIntoView() {
      const li = this.$refs.list?.children[this.activeIndex]
      if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' })
    },
    move(delta) {
      const n = this.options.length
      if (!n) return
      this.activeIndex = (this.activeIndex + delta + n) % n
      this.$nextTick(this.scrollActiveIntoView)
    },
    onButtonKeydown(e) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        if (!this.open) this.openList()
      }
    },
    onListKeydown(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        this.move(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        this.move(-1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        this.activeIndex = 0
        this.$nextTick(this.scrollActiveIntoView)
      } else if (e.key === 'End') {
        e.preventDefault()
        this.activeIndex = this.options.length - 1
        this.$nextTick(this.scrollActiveIntoView)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const o = this.options[this.activeIndex]
        if (o) this.choose(o)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.close()
      } else if (e.key === 'Tab') {
        this.open = false
        document.removeEventListener('mousedown', this.onOutside)
      } else if (e.key.length === 1 && /\S/.test(e.key)) {
        // type-ahead: next option starting with this letter, wrapping around
        const ch = e.key.toLowerCase()
        const n = this.options.length
        for (let step = 1; step <= n; step++) {
          const i = (this.activeIndex + step) % n
          if (String(this.options[i].label).toLowerCase().startsWith(ch)) {
            this.activeIndex = i
            this.$nextTick(this.scrollActiveIntoView)
            break
          }
        }
      }
    },
  },
}
</script>

<style scoped>
.ss-root {
  position: relative;
  display: inline-block;
}

.ss-button {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 12rem;
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  cursor: pointer;
  text-align: left;
}

.ss-button:hover,
.ss-open .ss-button {
  border-color: var(--color-accent);
}

.ss-placeholder {
  color: var(--color-text-low);
}

.ss-caret {
  color: var(--color-text-low);
  font-size: 0.8em;
}

.ss-list {
  position: absolute;
  z-index: 50;
  top: calc(100% + 2px);
  left: 0;
  min-width: 100%;
  /* The whole list, scrolled normally: tall as the screen allows, then a
     real scrollbar. */
  max-height: min(60vh, 28rem);
  overflow-y: auto;
  margin: 0;
  padding: 0.2rem 0;
  list-style: none;
  background: var(--color-bg-panel, var(--color-bg-surface));
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  outline: none;
}

.ss-option {
  padding: 0.3rem 0.7rem;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  white-space: nowrap;
  cursor: pointer;
}

.ss-option--active {
  background: var(--color-bg-surface);
  color: var(--color-accent-strong);
}

.ss-option--selected {
  color: var(--color-accent);
  font-weight: 600;
}
</style>
