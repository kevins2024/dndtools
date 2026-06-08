<template>
  <span class="stat-chip" :class="`stat-chip--${size}`">
    <span :class="{ 'has-tip': explain }">{{ value }}</span>
    <div v-if="explain" class="stat-chip-tooltip">{{ breakdown }}</div>
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

  computed: {
    breakdown() {
      return this.explain ? this.explain() : null
    },
  },
}
</script>

<style scoped>
.stat-chip {
  position: relative;
  display: inline-flex;
  align-items: baseline;
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
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
  font-size: var(--font-size-md);
  color: var(--color-text);
  white-space: pre-line;
  text-align: left;
  min-width: 12rem;
  z-index: 200;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  font-family: var(--font-body);
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.15s;
}

.stat-chip:hover .stat-chip-tooltip {
  visibility: visible;
  opacity: 1;
}

.stat-chip--sm .has-tip {
  font-size: 0.9em;
}
.stat-chip--lg .has-tip {
  font-size: 1.1em;
}
</style>
