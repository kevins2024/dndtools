<template>
  <div>
    <div class="conditions-row">
      <button
        v-for="cond in CONDITIONS"
        :key="cond"
        class="cond-chip"
        :class="{
          'cond-chip--active': conditions.includes(cond),
          'cond-chip--positive': isPositiveCondition(cond),
          'cond-chip--negative': !isPositiveCondition(cond),
        }"
        :title="conditionTooltip(cond)"
        @click="$emit('toggle', cond)"
      >
        {{ cond }}
      </button>
      <button
        v-for="cond in customConditions"
        :key="'custom-' + cond"
        class="cond-chip cond-chip--active cond-chip--custom"
        @click="$emit('toggle', cond)"
      >
        {{ cond }} ✕
      </button>
    </div>
    <div class="custom-cond-row">
      <input
        v-model="newCustomCond"
        class="custom-cond-input"
        placeholder="Add condition…"
        @keyup.enter="addCustom"
      />
      <button
        class="add-btn"
        :disabled="!newCustomCond.trim()"
        @click="addCustom"
      >
        +
      </button>
    </div>
  </div>
</template>

<script>
import {
  conditionTooltip,
  isPositiveCondition,
  POSITIVE_CONDITION_NAMES,
  NEGATIVE_CONDITION_NAMES,
  sortConditionNames,
} from '@/data/conditions.js'

const CONDITIONS = Object.freeze(
  sortConditionNames([...POSITIVE_CONDITION_NAMES, ...NEGATIVE_CONDITION_NAMES])
)

// Same chip look as ConditionsRow.vue, but a flat toggle list (no
// exhaustion/poison stack-level cycling) plus free-text custom conditions —
// matches how enemies already track conditions in Battle.vue (a plain
// array of strings, no Vuex record to commit to).
export default {
  name: 'EnemyConditionsRow',

  props: {
    conditions: { type: Array, default: () => [] },
  },

  emits: ['toggle', 'add'],

  data() {
    return { CONDITIONS, newCustomCond: '' }
  },

  computed: {
    customConditions() {
      return this.conditions.filter((c) => !CONDITIONS.includes(c))
    },
  },

  methods: {
    conditionTooltip,
    isPositiveCondition,
    addCustom() {
      const cond = this.newCustomCond.trim()
      if (!cond) return
      this.$emit('add', cond)
      this.newCustomCond = ''
    },
  },
}
</script>

<style scoped>
.conditions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.cond-chip {
  font-size: var(--font-size-xs);
  padding: 2px 7px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-low);
  cursor: pointer;
  letter-spacing: 0.03em;
  user-select: none;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.cond-chip:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.cond-chip--active {
  border-color: var(--color-condition);
  color: var(--color-condition);
  background: rgba(230, 126, 34, 0.12);
}

.cond-chip--positive {
  border-radius: 999px;
}
.cond-chip--positive.cond-chip--active {
  border-color: var(--color-success);
  color: var(--color-success);
  background: rgba(74, 158, 107, 0.15);
}

.cond-chip--negative {
  --cond-outline: var(--color-border);
  clip-path: polygon(
    8px 0,
    calc(100% - 8px) 0,
    100% 50%,
    calc(100% - 8px) 100%,
    8px 100%,
    0 50%
  );
  padding: 2px 13px;
  border: none;
  background: var(--color-bg-surface);
  filter: drop-shadow(1px 0 0 var(--cond-outline))
    drop-shadow(-1px 0 0 var(--cond-outline))
    drop-shadow(0 1px 0 var(--cond-outline))
    drop-shadow(0 -1px 0 var(--cond-outline));
}
.cond-chip--negative:hover {
  --cond-outline: var(--color-text-muted);
}
.cond-chip--negative.cond-chip--active {
  --cond-outline: var(--color-condition);
  background: rgba(230, 126, 34, 0.2);
}

.custom-cond-row {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.4rem;
}

.custom-cond-input {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
}

.custom-cond-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.add-btn {
  padding: 0.25rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  cursor: pointer;
}

.add-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
