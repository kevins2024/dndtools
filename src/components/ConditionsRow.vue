<template>
  <div class="conditions-row">
    <span
      v-for="cond in CONDITIONS"
      :key="cond"
      class="cond-chip"
      :class="{
        'cond-chip--active':
          cond === 'Exhaustion'
            ? exhaustionLevel > 0
            : cond === 'Poisoned'
            ? poisonLevel > 0
            : activeConditions.includes(cond),
        'cond-chip--positive': isPositiveCondition(cond),
        'cond-chip--negative': !isPositiveCondition(cond),
      }"
      :title="conditionTooltip(cond)"
      @click="
        cond === 'Exhaustion'
          ? cycleExhaustion()
          : cond === 'Poisoned'
          ? cyclePoison()
          : toggleCondition(cond)
      "
      >{{ cond
      }}<span
        v-if="cond === 'Exhaustion' && exhaustionLevel > 0"
        class="exhaustion-level"
      >
        {{ exhaustionLevel }}</span
      ><span
        v-if="cond === 'Poisoned' && poisonLevel > 0"
        class="exhaustion-level"
      >
        {{ poisonLevel }}</span
      ></span
    >
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

const CONDITIONS = sortConditionNames([
  ...POSITIVE_CONDITION_NAMES,
  ...NEGATIVE_CONDITION_NAMES,
])

export default {
  name: 'ConditionsRow',

  props: {
    character: { type: Object, required: true },
    // Which store table `character` lives in — lets this be reused for
    // non-character combatants (e.g. companions) without their condition
    // edits leaking into state.characters.
    table: { type: String, default: 'characters' },
  },

  emits: ['condition-changed'],

  data() {
    return { CONDITIONS }
  },

  computed: {
    activeConditions() {
      return this.character.conditions ?? []
    },
    exhaustionLevel() {
      return this.character.exhaustion_level ?? 0
    },
    poisonLevel() {
      return this.character.poison_level ?? 0
    },
  },

  methods: {
    conditionTooltip,
    isPositiveCondition,

    cycleExhaustion() {
      const next = this.exhaustionLevel >= 6 ? 0 : this.exhaustionLevel + 1
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: { ...this.character, exhaustion_level: next },
      })
      this.$emit(
        'condition-changed',
        next === 0 ? 'Exhaustion removed' : `Exhaustion ${next}`
      )
    },

    cyclePoison() {
      const next = this.poisonLevel >= 2 ? 0 : this.poisonLevel + 1
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: { ...this.character, poison_level: next },
      })
      this.$emit(
        'condition-changed',
        next === 0 ? 'Poisoned removed' : `Poisoned ${next}`
      )
    },

    toggleCondition(cond) {
      const current = [...this.activeConditions]
      const idx = current.indexOf(cond)
      const had = idx >= 0
      if (had) current.splice(idx, 1)
      else current.push(cond)
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: { ...this.character, conditions: current },
      })
      this.$emit(
        'condition-changed',
        had ? `removed ${cond}` : `gained ${cond}`
      )
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

/* Beneficial conditions: pill shape */
.cond-chip--positive {
  border-radius: 999px;
}
.cond-chip--positive.cond-chip--active {
  border-color: var(--color-success);
  color: var(--color-success);
  background: rgba(74, 158, 107, 0.15);
}

/* Detrimental conditions: pointed ends.
   clip-path cuts away a plain border on the diagonal edges, so the outline
   is drawn as a shape-following silhouette via stacked drop-shadows instead. */
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

.exhaustion-level {
  font-weight: 700;
  font-size: 1.05em;
}
</style>
