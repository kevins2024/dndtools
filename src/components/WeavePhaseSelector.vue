<template>
  <!-- Weave Phase selector (Weave Attunement Sorcerer only) -->
  <div v-if="character.weave_phase !== undefined">
    <div class="section-label woven-label">
      Weave Phase
      <span class="woven-hint">Metamagic -1 SP for active schools</span>
    </div>
    <div class="woven-phases">
      <button
        v-for="(ph, key) in weavePhases"
        :key="key"
        class="woven-phase-btn"
        :class="{ 'woven-phase-btn--active': character.weave_phase === key }"
        :style="
          character.weave_phase === key
            ? { borderColor: ph.color, backgroundColor: ph.color + '20' }
            : {}
        "
        :title="`${ph.schools.join(
          ' + '
        )}: Metamagic costs 1 fewer SP when applied to spells of these schools.\n\nGrid spells: ${ph.spells.join(
          ', '
        )}`"
        @click="setWeavePhase(key)"
      >
        <span
          class="woven-phase-name"
          :style="character.weave_phase === key ? { color: ph.color } : {}"
          >{{ ph.name }}</span
        >
        <span class="woven-phase-abbr">{{ ph.abbr }}</span>
      </button>
    </div>
  </div>
</template>

<script>
// Presentational-only per-phase display (color, abbreviation). Schools and
// granted spells are NOT hardcoded here — they're read live from the
// character's own "<Phase> Phase (<Schools>)" features, so this can never
// drift out of sync with what's actually on the sheet (see
// engine/data/subclasses/sorcerer-weave-attunement.json for the canonical
// mechanics).
const WEAVE_PHASE_DISPLAY = {
  leno: { name: 'Leno', abbr: 'Abj · Div', color: '#7ec8e3' },
  twill: { name: 'Twill', abbr: 'Enc · Nec', color: '#e8a860' },
  satin: { name: 'Satin', abbr: 'Ill · Trs', color: '#b88fe0' },
}

export default {
  name: 'WeavePhaseSelector',

  props: {
    character: { type: Object, required: true },
    table: { type: String, default: 'characters' },
  },

  computed: {
    weavePhases() {
      const result = {}
      for (const [key, display] of Object.entries(WEAVE_PHASE_DISPLAY)) {
        const feature = (this.character.features ?? []).find((f) =>
          f.name.toLowerCase().startsWith(`${display.name.toLowerCase()} phase`)
        )
        const schoolMatch = feature?.name.match(/\(([^)]+)\)/)
        result[key] = {
          name: display.name,
          abbr: display.abbr,
          color: display.color,
          schools: schoolMatch
            ? schoolMatch[1].split('/').map((s) => s.trim())
            : [],
          spells: feature?.spells_granted ?? [],
        }
      }
      return result
    },
  },

  methods: {
    setWeavePhase(key) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: { ...this.character, weave_phase: key },
      })
    },
  },
}
</script>

<style scoped>
.woven-label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.woven-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-weight: normal;
  font-style: italic;
}

.woven-phases {
  display: flex;
  gap: 0.4rem;
}

.woven-phase-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.45rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  color: var(--color-text-muted);
}

.woven-phase-btn:hover {
  border-color: var(--color-text-muted);
}

.woven-phase-name {
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: color 0.12s;
}

.woven-phase-abbr {
  font-size: 0.62rem;
  color: var(--color-text-low);
  letter-spacing: 0.05em;
}
</style>
