<template>
  <div class="chip-row">
    <div class="chip">
      <input
        class="chip-input"
        type="number"
        min="1"
        max="40"
        :value="meta.ac ?? ''"
        placeholder="—"
        @change="update('ac', $event.target.valueAsNumber || null)"
      />
      <span class="chip-label">AC</span>
    </div>
    <div class="chip">
      <input
        class="chip-input"
        type="text"
        :value="meta.attackBonus ?? ''"
        placeholder="—"
        @change="update('attackBonus', $event.target.value || null)"
      />
      <span class="chip-label">Attack</span>
    </div>
    <div class="chip">
      <input
        class="chip-input"
        type="text"
        :value="meta.damage ?? ''"
        placeholder="—"
        @change="update('damage', $event.target.value || null)"
      />
      <span class="chip-label">{{ meta.damageLabel || 'Damage' }}</span>
    </div>
    <div class="chip">
      <input
        class="chip-input"
        type="number"
        min="1"
        max="10"
        :value="meta.numAttacks ?? ''"
        placeholder="—"
        @change="update('numAttacks', $event.target.valueAsNumber || null)"
      />
      <span class="chip-label">Attacks</span>
    </div>
    <div class="chip">
      <input
        class="chip-input"
        type="number"
        min="0"
        max="120"
        :value="meta.speed ?? ''"
        placeholder="30"
        @change="update('speed', $event.target.valueAsNumber || null)"
      />
      <span class="chip-label">Speed</span>
    </div>
    <div class="chip">
      <input
        class="chip-input"
        type="number"
        min="1"
        max="30"
        :value="meta.spellSaveDC ?? ''"
        placeholder="—"
        @change="update('spellSaveDC', $event.target.valueAsNumber || null)"
      />
      <span class="chip-label">Save DC</span>
    </div>
    <div class="chip chip--wide">
      <input
        class="chip-input"
        type="text"
        :value="meta.savingThrows ?? ''"
        placeholder="—"
        @change="update('savingThrows', $event.target.value || null)"
      />
      <span class="chip-label">Saves</span>
    </div>
    <div
      class="chip"
      title="Crowd (house rule): merge up to 5 weak creatures into one tracked unit. Leave blank/1 for a normal enemy."
    >
      <input
        class="chip-input"
        type="number"
        min="1"
        max="5"
        :value="meta.crowdSize ?? ''"
        placeholder="—"
        @change="update('crowdSize', $event.target.valueAsNumber || null)"
      />
      <span class="chip-label">Crowd</span>
    </div>
  </div>
</template>

<script>
// Same chip visual language as VitalsChipRow.vue, but every value is a
// plain editable input instead of a computed read-out — an enemy has no
// underlying character record to derive AC/attack/etc. from, everything is
// typed in by hand. Emits field-level updates; Battle.vue's existing
// setEnemyMeta(field, value) owns applying them (no Vuex table involved,
// enemies are pure combat-session state).
export default {
  name: 'EnemyStatsChipRow',

  props: {
    meta: { type: Object, required: true },
  },

  emits: ['update-field'],

  methods: {
    update(field, value) {
      this.$emit('update-field', { field, value })
    },
  },
}
</script>

<style scoped>
.chip-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
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

.chip--wide {
  min-width: 6rem;
}

.chip-input {
  width: 100%;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  line-height: 1;
  background: transparent;
  border: none;
  text-align: center;
  padding: 0;
  -moz-appearance: textfield;
  appearance: textfield;
}

.chip-input:focus {
  outline: none;
  color: var(--color-accent);
}

.chip-input::-webkit-inner-spin-button,
.chip-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.chip-input::placeholder {
  color: var(--color-text-low);
}

.chip-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  margin-top: 0.15rem;
}
</style>
