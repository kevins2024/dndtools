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

// The single source of truth for saving-throw math — CharacterSheet.vue used
// to hand-roll this same computation a second time for its own fuller-row
// display; that duplication is why saves used to render twice. AbilityScoreGrid
// (which shows the same numbers inline per-ability on the full sheet) calls
// these same dnd_utils functions directly rather than wrapping this component,
// so there's still exactly one implementation of the math either way.
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
      const { stats, bonuses } = dnd.resolveStats(
        this.character,
        this.partyItems
      )
      const prof = dnd._prof(this.character, bonuses)
      const proficient = new Set(this.character.saving_throws ?? [])
      return STAT_KEYS.map(({ key, label }) => {
        const isProficient = proficient.has(key)
        const mod = dnd.mod(stats[key])
        const flatBonus = bonuses.saving_throws ?? 0
        const total = mod + (isProficient ? prof : 0) + flatBonus
        const parts = [`${label} ${dnd.signed(mod)}`]
        if (isProficient) parts.push(`prof ${dnd.signed(prof)}`)
        if (flatBonus) parts.push(`bonus ${dnd.signed(flatBonus)}`)
        parts.push(`= ${dnd.signed(total)}`)
        return {
          key,
          label,
          proficient: isProficient,
          valueStr: dnd.signed(total),
          tooltip: parts.join(' · '),
        }
      })
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
