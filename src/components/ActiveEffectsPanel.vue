<template>
  <div
    class="sheet-section"
    v-if="character.active_effects && character.active_effects.length"
  >
    <div class="section-title">Active Effects</div>
    <div class="feature-list">
      <div
        v-for="effect in character.active_effects"
        :key="effect.id || effect.name"
        class="feature-item"
      >
        <span class="feature-name"
          >{{ effect.name
          }}<span v-for="d in details(effect)" :key="d" class="effect-detail">
            · {{ d }}</span
          ></span
        >
        <button
          v-if="effect.id"
          class="effect-end-btn"
          title="End this effect"
          @click="end(effect)"
        >
          End
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { endActiveEffect } from '@/utils/featureUse.js'

// A temporary state the character is in (Celestial Revelation, Draconic Flight, Large Form, Stonecunning),
// started by the Use button on its feature. What it gives is the engine's (featureGrants.activeGrants);
// this shows the numbers and ends it. A rest ends them all.
export default {
  name: 'ActiveEffectsPanel',

  props: {
    character: { type: Object, required: true },
    table: { type: String, default: 'characters' },
  },

  computed: {
    known() {
      return Object.fromEntries(
        dnd.characterGrants(this.character).activeEffects.map((e) => [e.id, e])
      )
    },
  },

  methods: {
    details(effect) {
      const e = this.known[effect.id]
      if (!e) return []
      const out = []
      if (e.durationMinutes) out.push(`${e.durationMinutes} min.`)
      if (e.extraDamage)
        out.push(
          `+${e.extraDamage.amount.value} ${e.extraDamage.type} damage once per turn`
        )
      if (e.aura)
        out.push(
          `${e.aura.damage.amount.value} ${e.aura.damage.type} damage to creatures within ${e.aura.radiusFeet} ft. at the ${e.aura.timing}`
        )
      return out
    },
    end(effect) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: {
          ...this.character,
          ...endActiveEffect(this.character, effect.id).patch,
        },
      })
    },
  },
}
</script>

<style scoped>
.sheet-section {
  border-top: 1px solid var(--color-bg-surface-alt);
  padding-top: 0.8vh;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.6vh;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.6vw;
  font-size: var(--font-size-md);
}

.feature-name {
  color: var(--color-text);
  flex: 1;
}

.effect-detail {
  color: var(--color-text-muted);
}

.effect-end-btn {
  font-size: 0.75em;
  padding: 0.1em 0.5em;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
}

.effect-end-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
