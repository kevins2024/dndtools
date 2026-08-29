<template>
  <div class="sheet-section">
    <div class="section-title">Ability Scores</div>
    <div class="stat-grid">
      <div v-for="key in statKeys" :key="key" class="stat-block">
        <div class="stat-label">{{ key.toUpperCase() }}</div>
        <div class="score-row">
          <button class="adj-btn" @click="adjust(key, -1)">−</button>
          <input
            class="stat-score-input"
            type="number"
            min="1"
            max="30"
            :value="stats[key]"
            @change="
              $emit('update-stat', {
                key,
                value: $event.target.valueAsNumber,
              })
            "
          />
          <button class="adj-btn" @click="adjust(key, 1)">+</button>
        </div>
        <div class="stat-check-row">
          <span class="stat-mod" :class="mod(stats[key]) >= 0 ? 'pos' : 'neg'">
            {{ modStr(stats[key]) }}
          </span>
          <button
            class="roll-btn"
            :title="`Roll ${key.toUpperCase()} check`"
            @click="rollCheck(key)"
          >
            <img :src="d20Icon" class="roll-btn-icon" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import d20Icon from '@/assets/dice/d20.svg'

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

// Visually matches AbilityScoreGrid.vue's stat-block cards, but every score
// is inline-editable (+/-, or type a value) — enemies have no character
// record to derive scores from, so hand-entry here is the only way to set
// them, unlike the read-only player-facing grid.
export default {
  name: 'EnemyAbilityScoreGrid',

  props: {
    name: { type: String, required: true },
    stats: { type: Object, required: true },
  },

  emits: ['update-stat'],

  data() {
    return { d20Icon, statKeys: STAT_KEYS }
  },

  methods: {
    mod(score) {
      return Math.floor(((score ?? 10) - 10) / 2)
    },
    modStr(score) {
      const m = this.mod(score)
      return m >= 0 ? `+${m}` : `${m}`
    },
    adjust(key, delta) {
      this.$emit('update-stat', { key, value: (this.stats[key] ?? 10) + delta })
    },
    rollCheck(key) {
      this.$store.commit('SET_PENDING_ROLL', {
        label: `${this.name} — ${key.toUpperCase()} check`,
        mod: this.mod(this.stats[key]),
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

.stat-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.6rem;
}

.stat-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-panel);
  padding: 0.4vh 0;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.adj-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  line-height: 1;
  padding: 0 0.2em;
  cursor: pointer;
}

.adj-btn:hover {
  color: var(--color-accent);
}

.stat-score-input {
  width: 2.2rem;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: none;
  text-align: center;
  line-height: 1.2;
  -moz-appearance: textfield;
  appearance: textfield;
}

.stat-score-input:focus {
  outline: none;
  color: var(--color-accent);
}

.stat-score-input::-webkit-inner-spin-button,
.stat-score-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stat-check-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.stat-mod {
  font-size: var(--font-size-md);
}

.stat-mod.pos {
  color: var(--color-accent);
}
.stat-mod.neg {
  color: var(--color-text-danger);
}

.roll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.12s ease;
}
.roll-btn:hover {
  opacity: 1;
}

.roll-btn-icon {
  width: 12px;
  height: 12px;
}
</style>
