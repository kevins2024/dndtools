<template>
  <div class="feature-filter-row">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="filter-btn"
      :class="{ 'filter-btn--active': value === opt.value }"
      @click="$emit('input', opt.value)"
    >
      <ActionCostIcon :action-type="opt.value" :size="10" />{{ opt.label }}
    </button>
  </div>
</template>

<script>
import ActionCostIcon from '@/components/ActionCostIcon.vue'

const DEFAULT_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'action', label: 'Action' },
  { value: 'bonus_action', label: 'Bonus' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'passive', label: 'Passive' },
]

// Controls a shared filter value used by both FeaturePillsPanel and
// SpellPillsByLevel at once — a single filter row above two independent
// pill lists, not owned by either one.
export default {
  name: 'ContentFilterRow',

  components: { ActionCostIcon },

  props: {
    value: { type: String, default: 'all' },
    options: { type: Array, default: () => DEFAULT_OPTIONS },
  },

  emits: ['input'],
}
</script>

<style scoped>
.feature-filter-row {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-low);
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: border-color 0.12s, color 0.12s;
}

.filter-btn:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.filter-btn--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
