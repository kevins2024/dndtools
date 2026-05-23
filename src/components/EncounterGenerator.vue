<template>
  <div class="enc-gen">

    <!-- â”€â”€ Options panel â”€â”€ -->
    <div class="enc-options">

      <!-- Party source -->
      <section class="opt-section">
        <div class="opt-header">Party</div>

        <!-- Source pills -->
        <div class="source-pills">
          <span
            v-if="storePartyNames.length"
            class="source-pill"
            :class="{ active: partyMode === 'party' && selectedPartyName === null }"
            @click="selectCurrentParty"
          >Active</span>
          <span
            v-for="p in savedParties"
            :key="p.name"
            class="source-pill"
            :class="{ active: partyMode === 'party' && selectedPartyName === p.name }"
            @click="selectSavedParty(p.name)"
          >{{ p.name }}</span>
          <span
            class="source-pill"
            :class="{ active: partyMode === 'manual' }"
            @click="partyMode = 'manual'"
          >Manual</span>
        </div>

        <!-- Member list -->
        <div v-if="partyMode === 'party' && partyCharacters.length" class="party-pills">
          <span v-for="c in partyCharacters" :key="c.name" class="party-pill">
            {{ c.name }} <span class="pill-level">Lv{{ c.level }}</span>
          </span>
        </div>
        <div v-if="partyMode === 'party' && !partyCharacters.length" class="opt-hint">
          No members found.
        </div>

        <!-- Manual inputs -->
        <template v-if="partyMode === 'manual'">
          <label class="opt-label nudge">
            Level
            <input type="number" v-model.number="manualLevel" min="1" max="20" class="num-input" />
          </label>
          <label class="opt-label nudge">
            Characters
            <input type="number" v-model.number="manualCount" min="1" max="12" class="num-input" />
          </label>
        </template>
      </section>

      <!-- Difficulty -->
      <section class="opt-section">
        <div class="opt-header">Difficulty</div>
        <label v-for="d in difficulties" :key="d" class="opt-label">
          <input type="radio" v-model="difficulty" :value="d" />
          {{ d }}
        </label>
      </section>

      <!-- Encounter type -->
      <section class="opt-section types-section">
        <div class="opt-header">Type</div>
        <label class="opt-label">
          <input type="radio" v-model="encounterType" value="random" />
          Random
        </label>
        <label v-for="t in encounterTypes" :key="t" class="opt-label">
          <input type="radio" v-model="encounterType" :value="t" />
          {{ t }}
        </label>
      </section>

    </div>

    <!-- â”€â”€ Result panel â”€â”€ -->
    <div class="enc-result">
      <div class="result-controls">
        <button class="generate-btn" @click="generate" :disabled="!canGenerate">
          Generate Encounter
        </button>
        <button v-if="encounter" class="load-btn" @click="loadToCombat">
          Load into Combat
        </button>
        <div v-if="error" class="enc-error">{{ error }}</div>
      </div>

      <div v-if="encounter" class="encounter-card">
        <div class="enc-meta">
          <span class="enc-badge difficulty">{{ encounter.difficulty }}</span>
          <span class="enc-badge type">{{ encounter.type }}</span>
          <span class="enc-badge count">{{ encounter.enemies.length }} enemies</span>
        </div>

        <div class="enemy-list">
          <div
            v-for="enemy in encounter.enemies"
            :key="enemy.id"
            class="enemy-row"
            :class="{ 'is-boss': enemy.isBoss }"
          >
            <div class="enemy-name">{{ enemy.name }}</div>
            <div class="enemy-stats">
              <span class="estat">HP {{ enemy.hp }}</span>
              <span class="estat">AC {{ enemy.ac }}</span>
              <span class="estat">Atk {{ enemy.attackBonus }}</span>
              <span class="estat gender-race">{{ enemy.gender }} {{ enemy.race }}</span>
            </div>
            <div class="enemy-scores">
              <span v-for="s in statKeys" :key="s" class="score-chip">
                <span class="score-label">{{ s }}</span>
                <span class="score-val">{{ enemy.stats[s] }}</span>
                <span class="score-mod">{{ modStr(enemy.stats[s]) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="lastEncounter && !encounter" class="last-enc-hint">
        Last encounter archived.
      </div>
    </div>

    <!-- â”€â”€ Encounter config wizard â”€â”€ -->
    <div v-if="showWizard" class="wizard-overlay" @click.self="showWizard = false">
      <div class="wizard-panel">

        <div class="wizard-header">
          <span class="wizard-title">
            {{ currentSlot.isBoss ? 'Boss' : 'Enemy' }}
            {{ wizardStep + 1 }} of {{ wizardSlots.length }}
          </span>
          <span class="wizard-diff-badge">{{ wizardDifficulty }}</span>
          <button class="wizard-close" @click="showWizard = false">✕</button>
        </div>

        <div class="wizard-body">

          <!-- Role -->
          <div class="wiz-section">
            <div class="wiz-label">Role</div>
            <div class="wiz-chips">
              <span
                class="wiz-chip"
                :class="{ active: currentSlot.role === null }"
                @click="setSlotProp('role', null)"
              >Random</span>
              <span
                v-for="key in roleKeys"
                :key="key"
                class="wiz-chip"
                :class="{ active: currentSlot.role === key }"
                @click="setSlotProp('role', key)"
              >{{ roleProfiles[key].label }}</span>
            </div>
          </div>

          <!-- Race -->
          <div class="wiz-section">
            <div class="wiz-label">Race</div>
            <div class="wiz-chips">
              <span
                class="wiz-chip"
                :class="{ active: currentSlot.race === null }"
                @click="setSlotProp('race', null)"
              >Random</span>
              <span
                v-for="r in races"
                :key="r"
                class="wiz-chip"
                :class="{ active: currentSlot.race === r }"
                @click="setSlotProp('race', r)"
              >{{ r }}</span>
            </div>
          </div>

          <!-- Gender -->
          <div class="wiz-section">
            <div class="wiz-label">Gender</div>
            <div class="wiz-chips">
              <span
                class="wiz-chip"
                :class="{ active: currentSlot.gender === null }"
                @click="setSlotProp('gender', null)"
              >Random</span>
              <span
                v-for="g in genders"
                :key="g"
                class="wiz-chip"
                :class="{ active: currentSlot.gender === g }"
                @click="setSlotProp('gender', g)"
              >{{ g }}</span>
            </div>
          </div>

        </div>

        <div class="wizard-actions">
          <button class="wiz-btn secondary" :disabled="wizardStep === 0" @click="wizardPrev">â† Back</button>
          <div class="wiz-actions-right">
            <button class="wiz-btn ghost" @click="wizardRandomizeRemaining">Randomize Remaining</button>
            <button class="wiz-btn primary" @click="wizardNext">
              {{ wizardStep === wizardSlots.length - 1 ? 'Generate' : 'Next â†’' }}
            </button>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script>
import { ENCOUNTER_TYPES, DIFFICULTY_SELECTABLE, ROLE_PROFILES, ROLE_KEYS, planEncounter, generateEncounter, estimatePartyHP } from '../utils/encounter_utils.js'
import { GENDERS, RACES } from '../utils/character_utils.js'
import dataService from '../utils/dataService.js'

export default {
  name: 'EncounterGenerator',

  data() {
    return {
      partyMode:         'party',
      selectedPartyName: null,
      savedParties:      [],
      manualLevel:       5,
      manualCount:       4,
      difficulty:        'medium',
      encounterType:     'random',
      encounterTypes:    ENCOUNTER_TYPES,
      difficulties:      DIFFICULTY_SELECTABLE,
      error:             '',
      statKeys:          ['str', 'dex', 'con', 'int', 'wis', 'cha'],
      roleProfiles:      ROLE_PROFILES,
      roleKeys:          ROLE_KEYS,
      races:             RACES,
      genders:           GENDERS,
      // wizard state
      showWizard:        false,
      wizardSlots:       [],
      wizardStep:        0,
      wizardDifficulty:  '',
      wizardType:        '',
    }
  },

  async created() {
    const prefs = await dataService.getUserPrefs()
    this.savedParties = prefs.savedParties ?? []
  },

  computed: {
    storePartyNames() {
      return this.$store.state.selectedPlayers
    },

    activePartyNames() {
      if (this.partyMode !== 'party') return []
      if (this.selectedPartyName === null) return this.storePartyNames
      return this.savedParties.find((p) => p.name === this.selectedPartyName)?.members ?? []
    },

    partyCharacters() {
      const chars = this.$store.state.characters
      return this.activePartyNames
        .map((name) => chars.find((c) => c.name === name))
        .filter(Boolean)
        .map((c) => ({ name: c.name, level: c.level ?? 1, hp_max: c.hp_max ?? 10 }))
    },

    effectiveParty() {
      if (this.partyMode === 'manual' || !this.partyCharacters.length) {
        const { minHP, maxHP } = estimatePartyHP(this.manualLevel)
        return { size: this.manualCount, level: this.manualLevel, minHP, maxHP }
      }
      const levels = this.partyCharacters.map((c) => c.level)
      const hps    = this.partyCharacters.map((c) => c.hp_max)
      return {
        size:   this.partyCharacters.length,
        level:  Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
        minHP:  Math.min(...hps),
        maxHP:  Math.max(...hps),
      }
    },

    canGenerate() {
      return this.difficulty !== '' && this.encounterType !== ''
    },

    encounter() {
      return this.$store.state.currentEncounter
    },

    lastEncounter() {
      return this.$store.state.lastEncounter
    },

    currentSlot() {
      return this.wizardSlots[this.wizardStep] ?? {}
    },
  },

  methods: {
    selectCurrentParty() {
      this.partyMode        = 'party'
      this.selectedPartyName = null
    },

    selectSavedParty(name) {
      this.partyMode        = 'party'
      this.selectedPartyName = name
    },

    modStr(score) {
      const m = Math.floor((score - 10) / 2)
      return m >= 0 ? `+${m}` : `${m}`
    },

    generate() {
      this.error = ''
      const { size, level, minHP, maxHP } = this.effectiveParty
      if (size < 1 || level < 1) {
        this.error = 'Invalid party configuration.'
        return
      }
      const { resolvedDifficulty, slots } = planEncounter({
        difficulty: this.difficulty,
        partySize:  size,
      })
      this.wizardSlots      = slots
      this.wizardStep       = 0
      this.wizardDifficulty = resolvedDifficulty
      this.wizardType       = this.encounterType
      this.showWizard       = true
    },

    finishWizard() {
      this.showWizard = false
      const { size, level, minHP, maxHP } = this.effectiveParty
      const encounter = generateEncounter({
        resolvedDifficulty: this.wizardDifficulty,
        type:               this.wizardType,
        partySize:          size,
        partyLevel:         level,
        minPartyHP:         minHP,
        maxPartyHP:         maxHP,
        slots:              this.wizardSlots,
      })
      this.$store.commit('SET_ENCOUNTER', encounter)
    },

    wizardNext() {
      if (this.wizardStep < this.wizardSlots.length - 1) {
        this.wizardStep++
      } else {
        this.finishWizard()
      }
    },

    wizardPrev() {
      if (this.wizardStep > 0) this.wizardStep--
    },

    wizardRandomizeRemaining() {
      for (let i = this.wizardStep; i < this.wizardSlots.length; i++) {
        this.$set(this.wizardSlots, i, {
          ...this.wizardSlots[i],
          role: null, race: null, gender: null,
        })
      }
      this.finishWizard()
    },

    loadToCombat() {
      const enc = this.$store.state.currentEncounter
      if (!enc) return
      if (this.partyMode === 'party' && this.activePartyNames.length) {
        this.$store.commit('SET_SELECTED_PLAYERS', this.activePartyNames)
      }
      const enemies = enc.enemies.map((e) => ({
        name:          e.name,
        mod:           Math.floor((e.stats.dex - 10) / 2),
        encounterData: e,
      }))
      this.$store.commit('SET_PENDING_COMBAT_ENEMIES', enemies)
      this.$store.commit('REQUEST_COMBAT_NAV')
    },

    setSlotProp(prop, value) {
      const slot    = this.wizardSlots[this.wizardStep]
      const current = slot[prop]
      this.$set(this.wizardSlots, this.wizardStep, {
        ...slot,
        [prop]: current === value ? null : value,
      })
    },
  },
}
</script>

<style scoped>
.enc-gen {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
}

/* â”€â”€ Options â”€â”€ */
.enc-options {
  display: flex;
  flex-direction: row;
  gap: 0;
  overflow-y: auto;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
}

.opt-section {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1rem 1rem;
  border-right: 1px solid var(--color-border);
  min-width: 140px;
}

.types-section { min-width: 180px; }

.opt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.3rem;
  margin-bottom: 0.3rem;
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
.opt-label input { cursor: pointer; accent-color: var(--color-accent); }
.opt-label:hover { color: var(--color-text); }
.opt-label.nudge { margin-top: 0.4rem; }

.num-input {
  width: 52px;
  padding: 0.15rem 0.3rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-md);
  text-align: center;
}

.source-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
}

.source-pill {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  transition: all 0.12s ease;
}
.source-pill:hover { border-color: var(--color-accent); color: var(--color-accent); }
.source-pill.active {
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
  color: var(--color-accent-strong);
}

.party-pills {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.4rem;
}

.party-pill {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.pill-level {
  color: var(--color-accent);
  font-weight: 600;
}

.opt-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  margin-top: 0.3rem;
}

/* â”€â”€ Result â”€â”€ */
.enc-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.5rem;
  gap: 1rem;
  overflow-y: auto;
}

.result-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.generate-btn {
  padding: 0.5rem 2rem;
  background: var(--color-accent);
  border: none;
  border-radius: 6px;
  color: white;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s;
}
.generate-btn:hover:not(:disabled) { background: var(--color-accent-strong); }
.generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.load-btn {
  padding: 0.5rem 1.25rem;
  background: none;
  border: 1px solid #8888dd;
  border-radius: 6px;
  color: #8888dd;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
}
.load-btn:hover { background: rgba(136,136,221,0.12); }

.enc-error {
  color: #c0392b;
  font-size: var(--font-size-md);
}

/* â”€â”€ Encounter card â”€â”€ */
.encounter-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.enc-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.enc-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: var(--font-size-base);
  font-family: var(--font-display);
  letter-spacing: 0.05em;
  text-transform: capitalize;
}

.enc-badge.difficulty { background: rgba(74,158,107,0.15); color: #4a9e6b; border: 1px solid #4a9e6b; }
.enc-badge.type       { background: rgba(100,100,200,0.15); color: #8888dd; border: 1px solid #8888dd; }
.enc-badge.count      { background: rgba(200,100,100,0.15); color: #cc7766; border: 1px solid #cc7766; }

/* â”€â”€ Enemy rows â”€â”€ */
.enemy-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.enemy-row {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.enemy-row.is-boss {
  border-color: #c0922a;
  background: rgba(192,146,42,0.07);
}

.enemy-name {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.is-boss .enemy-name { color: #c0922a; }

.enemy-stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.estat {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  background: var(--color-bg-surface);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.gender-race { font-style: italic; }

.enemy-scores {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.score-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  min-width: 36px;
}

.score-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-low);
  letter-spacing: 0.05em;
}

.score-val {
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.1;
}

.score-mod {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
}

.last-enc-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
}

/* â”€â”€ Wizard â”€â”€ */
.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 18, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.wizard-panel {
  display: flex;
  flex-direction: column;
  width: min(92vw, 660px);
  max-height: 85vh;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
}

.wizard-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.wizard-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
  flex: 1;
}

.wizard-diff-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: var(--font-size-base);
  font-family: var(--font-display);
  letter-spacing: 0.05em;
  text-transform: capitalize;
  background: rgba(74,158,107,0.15);
  color: #4a9e6b;
  border: 1px solid #4a9e6b;
}

.wizard-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.wizard-close:hover { color: var(--color-text-danger); }

.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wiz-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.wiz-label {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.wiz-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.wiz-chip {
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  transition: all 0.12s ease;
}
.wiz-chip:hover { border-color: var(--color-accent); color: var(--color-accent); }
.wiz-chip.active {
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
  color: var(--color-accent-strong);
}

.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
}

.wiz-actions-right {
  display: flex;
  gap: 0.5rem;
}

.wiz-btn {
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.wiz-btn.primary {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: white;
}
.wiz-btn.primary:hover { background: var(--color-accent-strong); border-color: var(--color-accent-strong); }

.wiz-btn.secondary {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.wiz-btn.secondary:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.wiz-btn.secondary:disabled { opacity: 0.35; cursor: not-allowed; }

.wiz-btn.ghost {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
}
.wiz-btn.ghost:hover { border-color: #8888dd; color: #8888dd; }
</style>
