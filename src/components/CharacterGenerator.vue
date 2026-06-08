<template>
  <div class="char-gen">
    <div class="char-gen-options">
      <div v-for="cat in categories" :key="cat.key" class="cat-section">
        <div class="cat-header">
          <span class="cat-label">{{ cat.label }}</span>
          <button class="cat-all-btn" @click="toggleAll(cat)">
            {{ allEnabled(cat) ? 'none' : 'all' }}
          </button>
        </div>
        <label v-for="opt in cat.options" :key="opt" class="opt-label">
          <input type="checkbox" v-model="enabled[cat.key][opt]" />
          {{ opt }}
        </label>
      </div>
    </div>

    <div class="char-gen-result">
      <button class="generate-btn" @click="generate">Generate</button>

      <div v-if="error" class="gen-error">{{ error }}</div>

      <div v-if="result" class="result-card">
        <div class="result-row">
          <span class="result-key">Gender</span>
          <span class="result-val">{{ result.gender }}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Race</span>
          <span class="result-val">{{ result.race }}</span>
        </div>
        <div class="result-row">
          <span class="result-key">Class</span>
          <span class="result-val">{{ result.cls }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  pick,
  GENDERS,
  RACES,
  RACES_DEFAULT_OFF,
  CLASSES,
  generateCharacter,
} from '../utils/character_utils.js'

const CATEGORIES = [
  { key: 'gender', label: 'Gender', options: GENDERS },
  { key: 'race', label: 'Race', options: RACES },
  { key: 'class', label: 'Class', options: CLASSES },
]

function buildEnabled() {
  const out = {}
  for (const cat of CATEGORIES) {
    out[cat.key] = {}
    for (const opt of cat.options) {
      out[cat.key][opt] =
        cat.key === 'race' ? !RACES_DEFAULT_OFF.has(opt) : true
    }
  }
  return out
}

export default {
  name: 'CharacterGenerator',

  data() {
    return {
      categories: CATEGORIES,
      enabled: buildEnabled(),
      result: null,
      error: '',
    }
  },

  methods: {
    enabledOptions(key) {
      const cat = CATEGORIES.find((c) => c.key === key)
      return cat.options.filter((o) => this.enabled[key][o])
    },

    allEnabled(cat) {
      return cat.options.every((o) => this.enabled[cat.key][o])
    },

    toggleAll(cat) {
      const next = !this.allEnabled(cat)
      cat.options.forEach((o) => {
        this.enabled[cat.key][o] = next
      })
    },

    generate() {
      this.error = ''
      this.result = null

      const genderPool = this.enabledOptions('gender')
      const racePool = this.enabledOptions('race')
      const classPool = this.enabledOptions('class')

      if (!genderPool.length || !racePool.length || !classPool.length) {
        this.error = 'Enable at least one option in every category.'
        return
      }

      const { gender, race, cls } = generateCharacter(
        genderPool,
        racePool,
        classPool
      )
      if (cls === null) {
        this.error = 'Hybrid needs at least two other classes enabled.'
        return
      }

      this.result = { gender, race, cls }
    },
  },
}
</script>

<style scoped>
.char-gen {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
  gap: 0;
}

/* ── Options panel ── */
.char-gen-options {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
}

.cat-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 110px;
}

.cat-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.35rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.25rem;
}

.cat-label {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
}

.cat-all-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  cursor: pointer;
  padding: 0;
}
.cat-all-btn:hover {
  color: var(--color-accent);
}

.opt-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  padding: 0.1rem 0;
}
.opt-label input {
  cursor: pointer;
  accent-color: var(--color-accent);
}
.opt-label:hover {
  color: var(--color-text);
}

/* ── Result panel ── */
.char-gen-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem;
}

.generate-btn {
  padding: 0.6rem 2.5rem;
  background: var(--color-accent);
  border: none;
  border-radius: 6px;
  color: white;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s;
}
.generate-btn:hover {
  background: var(--color-accent-strong);
}

.gen-error {
  color: var(--color-danger);
  font-size: var(--font-size-md);
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem 2.5rem;
  min-width: 240px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 2rem;
}

.result-key {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.result-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
}
</style>
