<template>
  <div class="saves-row">
    <span
      v-for="s in savingThrows"
      :key="s.key"
      class="save-chip has-tip"
      :class="{ 'save-chip--prof': s.proficient }"
      :title="s.tooltip"
      >{{ s.label }} {{ s.valueStr }}</span
    >
  </div>
</template>

<script>
import { dnd, STAT_KEYS } from '@/utils/dnd_utils.js'

// The single source of truth for saving-throw math is now
// engine/rules/5e/checks.js's savingThrow/savingThrowBreakdown (moved
// 2026-09-30 — this component used to hand-roll the same formula a second
// time just to build its tooltip string; see engine/CHECKLIST.md's entry
// that day). AbilityScoreGrid (which shows the same numbers inline
// per-ability on the full sheet) calls the same dnd_utils functions
// directly rather than wrapping this component, so there's still exactly
// one implementation of the math either way. (It actually still had its
// own copy until 2026-10-01 — the 09-30 migration missed it.)
export default {
  name: 'SavingThrowsPanel',

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    savingThrows() {
      const proficient = new Set(this.character.saving_throws ?? [])
      return STAT_KEYS.map(({ key, label }) => ({
        key,
        label,
        proficient: proficient.has(key),
        valueStr: dnd.signed(
          dnd.savingThrow(this.character, key, this.partyItems)
        ),
        tooltip: dnd.savingThrowBreakdown(this.character, key, this.partyItems),
      }))
    },
  },
}
</script>

<style scoped>
.saves-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.save-chip {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
  white-space: nowrap;
}

.save-chip--prof {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
</style>
