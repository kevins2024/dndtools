<template>
  <span class="stat-chip" :class="`stat-chip--${size}`" ref="root">
    {{ value }}<button
      v-if="explain"
      class="stat-chip-btn"
      :class="{ 'stat-chip-btn--active': open }"
      type="button"
      aria-label="Show calculation"
      @click.stop="toggle"
    >ⓘ</button>
    <div v-if="open" class="stat-chip-tooltip">{{ breakdown }}</div>
  </span>
</template>

<script>
export default {
  name: 'StatChip',

  props: {
    value: { default: null },
    explain: { type: Function, default: null },
    size: { type: String, default: 'md' },
  },

  data() {
    return {
      open: false,
      breakdown: null,
    }
  },

  methods: {
    toggle() {
      if (!this.open) this.breakdown = this.explain()
      this.open = !this.open
      if (this.open) {
        document.addEventListener('click', this.close, { once: true })
      }
    },
    close() {
      this.open = false
    },
  },

  beforeDestroy() {
    document.removeEventListener('click', this.close)
  },
}
</script>

<style scoped>
.stat-chip {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 0.15em;
}

.stat-chip-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-size: 0.65em;
  color: var(--color-text-muted);
  opacity: 1;
  transition: opacity 0.1s, color 0.1s;
  vertical-align: super;
  user-select: none;
}

.stat-chip-btn:hover,
.stat-chip-btn--active {
  opacity: 1;
  color: var(--color-accent);
}

.stat-chip-tooltip {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: var(--font-size-small);
  color: var(--color-text);
  white-space: pre-line;
  text-align: left;
  min-width: 12rem;
  z-index: 200;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  font-family: var(--font-body);
}

/* The last line "= N" gets accent color via nth-last trick — not possible with pre-line alone,
   so we rely on the step format being clear enough as plain text. */

.stat-chip--sm .stat-chip-btn { font-size: 0.55em; }
.stat-chip--lg .stat-chip-btn { font-size: 0.75em; }
</style>
