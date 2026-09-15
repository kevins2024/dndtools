<template>
  <div class="action-economy-row">
    <div
      v-for="r in RESOURCES"
      :key="r.key"
      class="chip chip--toggle"
      :title="
        resources[r.key]
          ? `${r.label} available — click to mark spent`
          : `${r.label} spent — click to mark available`
      "
      @click="$emit('toggle', r.key)"
    >
      <ActionCostIcon
        :action-type="r.actionType"
        :toggled="resources[r.key]"
        :size="22"
      />
      <span class="chip-label">{{ r.label }}</span>
    </div>
    <button
      class="chip chip--debug"
      title="Debug/testing only — a real game doesn't let you un-spend an action, bonus action, or reaction"
      @click="$emit('reset')"
    >
      <BugOff class="debug-icon" />
      <span class="chip-label">Reset</span>
    </button>
  </div>
</template>

<script>
import { BugOff } from 'lucide-vue'
import ActionCostIcon from '@/components/ActionCostIcon.vue'

// Purely presentational — relays clicks, no engine/Vuex knowledge. The
// owner (Battle.vue -> CombatContext.vue) applies the actual state change
// via engine/rules/combatTurn.js, same "emits field-level updates, owner
// applies them" pattern EnemyStatsChipRow.vue already uses.
//
// Reuses ActionCostIcon's existing filled/half-filled/outline circle shapes
// (already the app's established action/bonus-action/reaction visual
// language, used on feature and spell pills) rather than a plain Yes/No
// label — its `toggled` prop switches those same shapes to a spent/
// available color instead of the usual per-type color.
const RESOURCES = [
  { key: 'action', label: 'Action', actionType: 'action' },
  { key: 'bonusAction', label: 'Bonus Action', actionType: 'bonus_action' },
  { key: 'reaction', label: 'Reaction', actionType: 'reaction' },
]

export default {
  name: 'ActionEconomyRow',

  components: { BugOff, ActionCostIcon },

  props: {
    resources: { type: Object, required: true },
  },

  emits: ['toggle', 'reset'],

  data() {
    return { RESOURCES }
  },
}
</script>

<style scoped>
.action-economy-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.7rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  min-width: 3.6rem;
}

.chip-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  margin-top: 0.3rem;
}

.chip--toggle {
  cursor: pointer;
  user-select: none;
}

.chip--debug {
  cursor: pointer;
  border-style: dashed;
  background: transparent;
  font: inherit;
}

.debug-icon {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--color-debug, #e0629e);
}
</style>
