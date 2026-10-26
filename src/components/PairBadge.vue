<template>
  <!-- Chain-link marker for a spell or feature that only works while its
       paired item is nearby. Hover for who has the other half and the range;
       click (emits `open`) to open the effect's own detail popup, which lists
       the same thing. The app can't tell whether the two bearers are in
       range, so this is a reminder for the player, not a check. -->
  <button
    class="pair-badge"
    type="button"
    :title="tip"
    :aria-label="tip"
    @click.stop="$emit('open')"
  >
    <Link class="pair-badge-icon" />
  </button>
</template>

<script>
import { Link } from 'lucide-vue'
import { describePair } from '@/utils/pairedItems.js'

export default {
  name: 'PairBadge',

  components: { Link },

  props: {
    // pairInfo() / pairRequirement() result from the engine
    info: { type: Object, required: true },
    // Name of the spell or feature this marks
    effect: { type: String, default: null },
  },

  emits: ['open'],

  computed: {
    tip() {
      return describePair(this.info, this.effect)
    },
  },
}
</script>

<style scoped>
.pair-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 2px;
  background: transparent;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  flex-shrink: 0;
}
.pair-badge:hover {
  color: var(--color-accent-strong);
}
.pair-badge-icon {
  width: 0.95em;
  height: 0.95em;
}
</style>
