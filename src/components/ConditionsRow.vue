<template>
  <div>
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
      <span
        v-for="cond in customConditions"
        :key="'custom-' + cond"
        class="cond-chip cond-chip--active cond-chip--custom"
        title="Custom condition — click to remove"
        @click="toggleCondition(cond)"
      >
        {{ cond }} ✕
      </span>
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
    return { CONDITIONS, newCustomCond: '' }
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
    // Real gap found 2026-09-18: free-text custom conditions (super useful
    // on enemies via EnemyConditionsRow) had no player-facing equivalent —
    // same idea, ported over: any active condition name that isn't in the
    // catalog is a custom one, shown as its own removable chip.
    customConditions() {
      return this.activeConditions.filter((c) => !CONDITIONS.includes(c))
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

    addCustom() {
      const cond = this.newCustomCond.trim()
      if (!cond) return
      this.toggleCondition(cond)
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

/* Solid background + var(--color-bg) text (same "readable text on a
colored surface" pattern already used elsewhere, e.g. .pill-cast-btn:hover)
— real legibility bug found 2026-09-18: this used to be condition-colored
TEXT on a barely-tinted condition-colored BACKGROUND (same hue at two
opacities), which read poorly for several conditions (Muddled's orange on
orange being the reported case) and was hardcoded rgba rather than derived
from --color-condition, so it also didn't track the graphite theme's
different accent color at all. */
.cond-chip--active {
  border-color: var(--color-condition);
  color: var(--color-bg);
  background: var(--color-condition);
}

/* Beneficial conditions: pill shape */
.cond-chip--positive {
  border-radius: 999px;
}
.cond-chip--positive.cond-chip--active {
  border-color: var(--color-success);
  color: var(--color-bg);
  background: var(--color-success);
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
}

.exhaustion-level {
  font-weight: 700;
  font-size: 1.05em;
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
