<template>
  <span
    v-if="isKnown"
    class="action-cost-icon"
    :class="actionType"
    :style="{ width: size + 'px', height: size + 'px' }"
    :title="title"
  >
    <svg v-if="actionType === 'action'" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="currentColor" />
    </svg>
    <svg v-else-if="actionType === 'bonus_action'" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      />
      <path d="M12 3 A9 9 0 0 1 12 21 Z" fill="currentColor" />
    </svg>
    <svg v-else-if="actionType === 'reaction'" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      />
    </svg>
  </span>
</template>

<script>
const TITLE = {
  action: 'Action',
  bonus_action: 'Bonus action',
  reaction: 'Reaction',
}

// Shared cost icon for feature/feat/spell pills — same circle at three fill
// levels: filled (Action), half-filled (Bonus Action), unfilled/outline
// only (Reaction). Renders nothing for a passive entry (no action_type).
export default {
  name: 'ActionCostIcon',

  props: {
    actionType: { type: String, default: null },
    size: { type: Number, default: 14 },
  },

  computed: {
    isKnown() {
      return ['action', 'bonus_action', 'reaction'].includes(this.actionType)
    },
    title() {
      return TITLE[this.actionType] ?? ''
    },
  },
}
</script>

<style scoped>
.action-cost-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
}

.action-cost-icon svg {
  width: 100%;
  height: 100%;
}

.action-cost-icon.action {
  color: var(--color-accent);
}

.action-cost-icon.bonus_action {
  color: var(--color-accent-strong);
}

.action-cost-icon.reaction {
  color: var(--color-text-danger);
}
</style>
