<template>
  <div class="hp-tracker">
    <div class="hp-chip">
      <span class="hp-val">
        {{ character.hp_current }}/{{ effectiveMax
        }}<span v-if="tempHp > 0" class="hp-temp"> +{{ tempHp }}tmp</span>
        <span
          v-if="maxModifier"
          class="hp-max-mod has-tip"
          :title="maxModifierTooltip"
        >
          ({{ dnd.signed(maxModifier) }})
        </span>
      </span>
      <span class="chip-label">HP</span>
    </div>

    <div class="hp-controls">
      <input
        v-model.number="damageInput"
        class="hp-input"
        type="number"
        min="0"
        placeholder="Dmg"
        @blur="applyDamage"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="damageInput = null"
      />
      <input
        v-model.number="healInput"
        class="hp-input"
        type="number"
        min="0"
        placeholder="Heal"
        @blur="applyHeal"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="healInput = null"
      />
      <input
        v-model.number="tempInput"
        class="hp-input"
        type="number"
        min="0"
        placeholder="Temp"
        @blur="applyTemp"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="tempInput = null"
      />
      <input
        v-model.number="maxModInput"
        class="hp-input"
        type="number"
        placeholder="Max Mod"
        @blur="applyMaxMod"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="maxModInput = null"
      />
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { Brain } from 'lucide-vue'

// The one real, persisting way to change a character's HP — replaces
// Battle.vue's old playerHpDelta/playerTempHp scratchpad, which looked like
// it worked during a session but never actually wrote back to the character
// record (reset silently on rest, discarded on reload). Damage hits hp_temp
// first (RAW temp-HP absorption), then hp_current. hp_max_modifier is a
// signed adjustment to max HP — positive for something like Aid's "+5 max HP
// for 8 hours," negative for a max-HP-draining effect — separate from and
// stacking independently of hp_temp.
export default {
  name: 'HpTracker',

  props: {
    character: { type: Object, required: true },
    table: { type: String, default: 'characters' },
  },

  emits: ['concentration-check', 'hp-changed'],

  data() {
    return {
      dnd,
      damageInput: null,
      healInput: null,
      tempInput: null,
      maxModInput: null,
    }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    conSaveMod() {
      return dnd.savingThrow(this.character, 'con', this.partyItems)
    },
    // Reuses the existing "Concentrating" condition (src/data/conditions.js,
    // toggled via ConditionsRow.vue right above this component in
    // CharacterCombatPanel.vue) instead of a separate flag — one status
    // marker for the whole app rather than two ways to say the same thing.
    isConcentrating() {
      return (this.character.conditions ?? []).includes('Concentrating')
    },
    tempHp() {
      return this.character.hp_temp ?? 0
    },
    maxModifier() {
      return this.character.hp_max_modifier ?? 0
    },
    effectiveMax() {
      return this.character.hp_max + this.maxModifier
    },
    maxModifierTooltip() {
      return this.maxModifier > 0
        ? `Max HP temporarily increased by ${this.maxModifier}`
        : `Max HP temporarily reduced by ${-this.maxModifier}`
    },
  },

  methods: {
    commit(updates) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: { ...this.character, ...updates },
      })
    },

    applyDamage() {
      const amount = Number(this.damageInput)
      if (!amount || amount <= 0) return
      const temp = this.tempHp
      const absorbed = Math.min(temp, amount)
      const remaining = amount - absorbed
      this.commit({
        hp_temp: temp - absorbed,
        hp_current: Math.max(0, this.character.hp_current - remaining),
      })
      this.damageInput = null
      // Mirrors EnemyHpTracker/Battle.vue's own applyDamage wording, so the
      // Battle Log reads consistently regardless of who took the hit — real
      // bug found 2026-09-18: player HP changes never showed up in the log
      // at all, only enemy ones, since this component never emitted
      // anything for its own damage/heal/temp actions.
      this.$emit(
        'hp-changed',
        absorbed > 0
          ? `${amount} damage (${absorbed} absorbed by temp HP)`
          : `${amount} damage`
      )
      // RAW: temp HP cushions HP loss but doesn't change how much damage
      // you TOOK — the concentration DC (10 or half damage, whichever is
      // higher) is based on the full amount, not what got past temp HP.
      if (this.isConcentrating) {
        this.$emit('concentration-check', {
          name: this.character.name,
          damage: amount,
          mod: this.conSaveMod,
        })
      }
    },

    applyHeal() {
      const amount = Number(this.healInput)
      if (!amount || amount <= 0) return
      this.commit({
        hp_current: Math.min(
          this.effectiveMax,
          this.character.hp_current + amount
        ),
      })
      this.healInput = null
      this.$emit('hp-changed', `healed ${amount}`)
    },

    applyTemp() {
      const amount = Number(this.tempInput)
      if (!amount || amount <= 0) return
      // Temp HP doesn't stack — take the higher value, per RAW.
      this.commit({ hp_temp: Math.max(this.tempHp, amount) })
      this.tempInput = null
      this.$emit('hp-changed', `+${amount} temp HP`)
    },

    applyMaxMod() {
      if (this.maxModInput === null) return
      // A signed adjustment currently in effect (Aid, a max-HP drain, etc.)
      // — set directly rather than accumulated, since it represents the
      // active effect's value, not a running total of deltas.
      this.commit({ hp_max_modifier: Number(this.maxModInput) })
      this.$emit('hp-changed', `max HP ${dnd.signed(Number(this.maxModInput))}`)
      this.maxModInput = null
    },
  },
}
</script>

<style scoped>
.hp-tracker {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.hp-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.9rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: default;
  min-width: 4rem;
}

.hp-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  line-height: 1;
}

.hp-temp {
  color: var(--color-success);
  font-size: 0.8em;
}

.hp-max-mod {
  font-size: 0.75em;
  color: var(--color-text-muted);
  margin-left: 0.2em;
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
}

.chip-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  margin-top: 0.15rem;
}

.hp-controls {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.35rem;
}

.hp-input {
  width: 4.2rem;
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  /* Plain text fields, not number spinners. */
  -moz-appearance: textfield;
  appearance: textfield;
}

.hp-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.hp-input::-webkit-inner-spin-button,
.hp-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
