<template>
  <span
    class="stat-chip"
    :class="`stat-chip--${size}`"
    @mouseenter="placeTooltip"
  >
    <span :class="{ 'has-tip': explain }">{{ value }}</span>
    <div v-if="explain" ref="tip" class="stat-chip-tooltip" :style="tipStyle">
      {{ breakdown }}
    </div>
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
    return { tipStyle: {} }
  },

  computed: {
    breakdown() {
      return this.explain ? this.explain() : null
    },
  },

  methods: {
    // The tooltip is position: fixed so a panel with overflow: hidden/auto
    // (the battle sheet's turn panel) can't clip it; this puts it under the
    // chip and keeps it inside the window.
    placeTooltip() {
      const tip = this.$refs.tip
      if (!tip) return
      const margin = 8
      const chip = this.$el.getBoundingClientRect()
      const { offsetWidth: w, offsetHeight: h } = tip
      const left = Math.max(
        margin,
        Math.min(
          chip.left + chip.width / 2 - w / 2,
          window.innerWidth - w - margin
        )
      )
      const below = chip.bottom + 6
      const top =
        below + h > window.innerHeight - margin
          ? Math.max(margin, chip.top - h - 6)
          : below
      this.tipStyle = { left: `${left}px`, top: `${top}px` }
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
  position: fixed;
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
