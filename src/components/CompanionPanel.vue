<template>
  <div class="companion-panel">
    <div class="companion-panel-header">
      <img :src="companion.image" class="companion-panel-thumb" />
      <div>
        <div class="companion-panel-name">{{ companion.name }}</div>
        <div class="companion-panel-species">{{ companion.species }}</div>
      </div>
    </div>

    <div class="chip-row">
      <div class="chip">
        <span class="chip-val">{{ companion.ac }}</span>
        <span class="chip-label">AC</span>
      </div>
      <div class="chip">
        <span class="chip-val">{{ companion.speed }}</span>
        <span class="chip-label">Speed</span>
      </div>
    </div>

    <HpTracker :character="companion" table="companions" />
    <ConditionsRow :character="companion" table="companions" />

    <div v-if="companion.attacks && companion.attacks.length" class="attacks">
      <div class="section-label">Attacks</div>
      <div
        v-for="atk in companion.attacks"
        :key="atk.name"
        class="attack-row"
        :title="atk.effect"
      >
        <span class="attack-name">{{ atk.name }}</span>
        <span class="attack-stat"
          >{{ dnd.signed(atk.attack_bonus) }} to hit, {{ atk.damage_dice
          }}{{ dnd.signed(atk.damage_bonus) }} {{ atk.damage_type }}</span
        >
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import HpTracker from '@/components/HpTracker.vue'
import ConditionsRow from '@/components/ConditionsRow.vue'

// A summoned companion is effectively its own mini-combatant (own ability
// scores, AC, HP, attacks — a different shape than party-item weapons, so
// attacks render as a simple inline list rather than through WeaponTable).
// Reuses HpTracker/ConditionsRow directly (both are generic enough to apply
// as-is) but NOT VitalsChipRow — its AC chip derives AC from armor/DEX, which
// would silently produce the wrong number for a companion that already has a
// correct, direct stat-block `ac` field.
export default {
  name: 'CompanionPanel',

  components: { HpTracker, ConditionsRow },

  props: {
    companion: { type: Object, required: true },
  },

  data() {
    return { dnd }
  },
}
</script>

<style scoped>
.companion-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-panel);
}

.companion-panel-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.companion-panel-thumb {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.companion-panel-name {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  font-size: var(--font-size-lg);
}

.companion-panel-species {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.chip-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.9rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  min-width: 4rem;
}

.chip-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  line-height: 1;
}

.chip-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  margin-top: 0.15rem;
}

.attacks {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.attack-row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: var(--font-size-base);
}

.attack-name {
  color: var(--color-text);
}

.attack-stat {
  color: var(--color-text-muted);
}
</style>
