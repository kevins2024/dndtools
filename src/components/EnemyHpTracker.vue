<template>
  <div class="hp-tracker">
    <div class="hp-chip">
      <span class="hp-val">
        <template v-if="hp.maxHp !== null"
          >{{ hp.maxHp - hp.damage }}/{{ hp.maxHp }}</template
        ><template v-else>{{ hp.damage }} dmg</template
        ><span v-if="hp.tempHp" class="hp-temp"> +{{ hp.tempHp }}tmp</span>
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
        @blur="emitDamage"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="damageInput = null"
      />
      <input
        v-model.number="healInput"
        class="hp-input"
        type="number"
        min="0"
        placeholder="Heal"
        @blur="emitHeal"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="healInput = null"
      />
      <input
        v-model.number="tempInput"
        class="hp-input"
        type="number"
        min="0"
        placeholder="Temp"
        @blur="emitTemp"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="tempInput = null"
      />
      <input
        v-model.number="maxHpInput"
        class="hp-input"
        type="number"
        min="1"
        placeholder="Max HP"
        @blur="emitMaxHp"
        @keyup.enter="$event.target.blur()"
        @keyup.esc="maxHpInput = null"
      />
    </div>
  </div>
</template>

<script>
// Same visual/interaction language as HpTracker.vue (2x2 text-field grid,
// apply on blur/enter, cancel on escape) but for an enemy — which has no
// Vuex record at all (purely local combat-session state in Battle.vue), and
// tracks raw damage taken against an OPTIONAL known max rather than a fixed
// hp_current/hp_max pair, since a DM doesn't always know a monster's exact
// remaining HP. Emits raw amounts rather than a computed hp object —
// Battle.vue already has damage/heal/temp/max-hp logic (including specific
// battle-log messages like "5 absorbed by temp HP"), so this stays purely
// presentational and lets that logic keep owning the actual math and log.
export default {
  name: 'EnemyHpTracker',

  props: {
    hp: {
      type: Object,
      required: true,
      // { damage: Number, maxHp: Number|null, tempHp: Number }
    },
  },

  emits: ['damage', 'heal', 'temp', 'set-max-hp'],

  data() {
    return {
      damageInput: null,
      healInput: null,
      tempInput: null,
      maxHpInput: null,
    }
  },

  methods: {
    emitDamage() {
      if (!this.damageInput || this.damageInput <= 0) return
      this.$emit('damage', this.damageInput)
      this.damageInput = null
    },
    emitHeal() {
      if (!this.healInput || this.healInput <= 0) return
      this.$emit('heal', this.healInput)
      this.healInput = null
    },
    emitTemp() {
      if (!this.tempInput || this.tempInput <= 0) return
      this.$emit('temp', this.tempInput)
      this.tempInput = null
    },
    emitMaxHp() {
      if (this.maxHpInput === null) return
      this.$emit('set-max-hp', this.maxHpInput)
      this.maxHpInput = null
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
