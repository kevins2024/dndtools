<template>
  <div class="npc-gen-page scrollable">
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
            <span class="result-key">Genus</span>
            <span class="result-val">{{ result.genus }}</span>
          </div>
          <div class="result-row">
            <span class="result-key">Class</span>
            <span class="result-val">{{ result.cls }}</span>
          </div>
          <button
            v-if="canBuildResult"
            class="build-btn"
            title="Open the New Character tool with this species and class pre-selected"
            @click="buildAsCharacter"
          >
            Build as Full Character →
          </button>
        </div>
      </div>
    </div>

    <!-- Quick-Build Combat Enemy — deliberately separate from the roller
         above: real class-built combatants only cover 5 curated role/class
         combos, a totally different vocabulary than the roller's 27
         races/14 classes, so chaining off a roll would mean most rolls
         couldn't build anything. Species/gender are randomized on build,
         not picked — same "roll it" spirit as the roller above. -->
    <div class="quick-build-panel">
      <div class="qb-header">
        <span class="qb-title">Quick-Build a Combat Enemy</span>
        <span class="qb-hint"
          >Real class features and spells via the level-up engine — for when an
          enemy needs actual teeth.</span
        >
      </div>

      <div class="qb-controls">
        <select v-model="buildRole" class="qb-select">
          <option v-for="r in roles" :key="r.id" :value="r.id">
            {{ r.label }} — {{ r.className }} ({{ r.subclassName }})
          </option>
        </select>
        <label class="qb-level-label">
          Level
          <input
            v-model.number="buildLevel"
            type="number"
            min="1"
            max="20"
            class="qb-level-input"
          />
        </label>
        <label class="qb-boss-label">
          <input type="checkbox" v-model="buildIsBoss" />
          Boss
        </label>
        <button
          class="generate-btn qb-build-btn"
          :disabled="building || !buildRole"
          @click="quickBuild"
        >
          {{ building ? 'Building…' : 'Build' }}
        </button>
      </div>

      <div v-if="buildError" class="gen-error">{{ buildError }}</div>

      <div v-if="buildResult" class="result-card qb-result-card">
        <div class="result-row">
          <span class="result-key">Combatant</span>
          <span class="result-val"
            >{{ buildResult.gender }} {{ buildResult.character.genus }} —
            {{ buildResult.encounterData.roleLabel }}</span
          >
        </div>
        <div class="result-row">
          <span class="result-key">Level</span>
          <span class="result-val">{{ buildResult.character.level }}</span>
        </div>
        <div class="result-row">
          <span class="result-key">AC / HP</span>
          <span class="result-val"
            >{{ buildResult.encounterData.ac }} /
            {{ buildResult.encounterData.maxHp }}</span
          >
        </div>
        <div
          class="result-row"
          v-if="buildResult.encounterData.attackBonus != null"
        >
          <span class="result-key">Attack</span>
          <span class="result-val"
            >+{{ buildResult.encounterData.attackBonus }} ·
            {{ buildResult.encounterData.weapon?.displayName }}</span
          >
        </div>
        <div
          class="result-row"
          v-if="buildResult.encounterData.spellSaveDC != null"
        >
          <span class="result-key">Spell Save DC</span>
          <span class="result-val">{{
            buildResult.encounterData.spellSaveDC
          }}</span>
        </div>
        <div
          class="qb-feature-list"
          v-if="buildResult.character.features.length"
        >
          <span class="result-key">Features</span>
          <span class="qb-feature-names">{{
            buildResult.character.features.map((f) => f.name).join(', ')
          }}</span>
        </div>
        <div class="qb-feature-list" v-if="buildResult.character.spells.length">
          <span class="result-key">Spells</span>
          <span class="qb-feature-names">{{
            buildResult.character.spells.map((s) => s.name).join(', ')
          }}</span>
        </div>

        <div class="qb-actions">
          <button
            v-if="combatPhase === 'battle'"
            class="build-btn"
            title="Drop this enemy into the fight currently in progress"
            @click="addToCombat"
          >
            Add to Combat
          </button>
          <button
            v-else
            class="build-btn"
            title="Queue this enemy onto the next encounter (Load Encounter in Combat's setup)"
            @click="enqueueForEncounter"
          >
            Enqueue for Next Encounter
          </button>
          <button
            class="build-btn"
            :class="{ copied: buildCopyConfirm }"
            :title="
              buildCopyConfirm
                ? 'Copied!'
                : 'Copy the full built character record'
            "
            @click="copyBuiltNpcJson"
          >
            {{ buildCopyConfirm ? '✓ Copied' : 'Copy NPC JSON' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  pick,
  GENDERS,
  GENERA,
  GENERA_DEFAULT_OFF,
  CLASSES,
  generateCharacter,
} from '../utils/character_utils.js'

const CATEGORIES = [
  { key: 'gender', label: 'Gender', options: GENDERS },
  { key: 'genus', label: 'Genus', options: GENERA },
  { key: 'class', label: 'Class', options: CLASSES },
]

function buildEnabled() {
  const out = {}
  for (const cat of CATEGORIES) {
    out[cat.key] = {}
    for (const opt of cat.options) {
      out[cat.key][opt] =
        cat.key === 'genus' ? !GENERA_DEFAULT_OFF.has(opt) : true
    }
  }
  return out
}

export default {
  name: 'NpcGenerator',

  data() {
    return {
      categories: CATEGORIES,
      enabled: buildEnabled(),
      result: null,
      error: '',
      // Fetched once so "Build as Full Character" only appears when the
      // roll landed on something the New Character tool can actually build.
      // This generator's genus list deliberately includes NPC/monster-flavor
      // species (Orc, Duergar, Goliath, Genasi, etc.) that aren't playable
      // PC options there, and "Hybrid" isn't a real single class it
      // understands — offering a jump that would silently land on nothing
      // selected is worse than not offering it.
      playableSpecies: null,
      playableClasses: null,

      // Quick-Build Combat Enemy
      roles: [],
      buildRole: null,
      buildLevel: 5,
      buildIsBoss: false,
      building: false,
      buildResult: null,
      buildError: '',
      buildCopyConfirm: false,
    }
  },

  computed: {
    canBuildResult() {
      if (!this.result || !this.playableSpecies || !this.playableClasses)
        return false
      return (
        this.result.cls !== 'Hybrid' &&
        this.playableSpecies.has(this.result.genus) &&
        this.playableClasses.has(this.result.cls)
      )
    },
    combatPhase() {
      return this.$store.state.combatPhase
    },
    activeParty() {
      return this.$store.getters.activeParty
    },
    averagePartyLevel() {
      const members = this.activeParty?.members ?? []
      const characters = this.$store.state.characters ?? []
      const levels = members
        .map((name) => characters.find((c) => c.name === name)?.level)
        .filter((lvl) => typeof lvl === 'number')
      if (!levels.length) return 5
      return Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
    },
  },

  async created() {
    try {
      const [species, classes, roles] = await Promise.all([
        fetch('/api/engine/species').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/engine/classes').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/engine/roles').then((r) => (r.ok ? r.json() : [])),
      ])
      this.playableSpecies = new Set(species.map((s) => s.name))
      this.playableClasses = new Set(classes.map((c) => c.name))
      this.roles = roles
      this.buildRole = roles[0]?.id ?? null
    } catch {
      // "Build as Full Character" just won't offer itself if this fails —
      // the random-roll flow above works fine without it.
      this.playableSpecies = new Set()
      this.playableClasses = new Set()
    }
    this.buildLevel = this.averagePartyLevel
  },

  methods: {
    buildAsCharacter() {
      this.$store.commit('NAV_TO_NEW_CHARACTER', {
        species: this.result.genus,
        className: this.result.cls,
      })
    },

    async quickBuild() {
      this.building = true
      this.buildError = ''
      this.buildResult = null
      try {
        const res = await fetch('/api/engine/build-npc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: this.buildRole,
            targetLevel: this.buildLevel,
            isBoss: this.buildIsBoss,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Build failed')
        this.buildResult = data
      } catch (e) {
        this.buildError = e.message || 'Could not build this enemy.'
      } finally {
        this.building = false
      }
    },

    addToCombat() {
      const { encounterData } = this.buildResult
      this.$store.commit('QUEUE_REINFORCEMENT', {
        name: encounterData.roleLabel,
        mod: Math.floor((encounterData.stats.dex - 10) / 2),
        encounterData,
      })
      this.$store.commit('REQUEST_COMBAT_NAV')
    },

    enqueueForEncounter() {
      const { encounterData } = this.buildResult
      this.$store.commit('ENQUEUE_ENCOUNTER_ENEMY', {
        ...encounterData,
        name: encounterData.roleLabel,
      })
    },

    copyBuiltNpcJson() {
      navigator.clipboard.writeText(
        JSON.stringify(this.buildResult.character, null, 2)
      )
      this.buildCopyConfirm = true
      setTimeout(() => {
        this.buildCopyConfirm = false
      }, 1800)
    },

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
      const genusPool = this.enabledOptions('genus')
      const classPool = this.enabledOptions('class')

      if (!genderPool.length || !genusPool.length || !classPool.length) {
        this.error = 'Enable at least one option in every category.'
        return
      }

      const { gender, genus, cls } = generateCharacter(
        genderPool,
        genusPool,
        classPool
      )
      if (cls === null) {
        this.error = 'Hybrid needs at least two other classes enabled.'
        return
      }

      this.result = { gender, genus, cls }
    },
  },
}
</script>

<style scoped>
.npc-gen-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.char-gen {
  display: flex;
  flex-direction: row;
  height: 280px;
  flex-shrink: 0;
  overflow: hidden;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
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

.build-btn {
  margin-top: 0.5rem;
  padding: 0.4rem 1rem;
  background: none;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: all 0.15s ease;
}
.build-btn:hover {
  color: white;
  background: var(--color-accent);
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

/* ── Quick-Build Combat Enemy ── */
.quick-build-panel {
  flex-shrink: 0;
  padding: 1.25rem 1.5rem 2rem;
}

.qb-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 1rem;
}

.qb-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
}

.qb-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}

.qb-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.qb-select {
  padding: 0.4rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: var(--font-size-md);
  min-width: 260px;
}

.qb-level-label,
.qb-boss-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

.qb-level-input {
  width: 3.5rem;
  padding: 0.3rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
}

.qb-build-btn {
  padding: 0.5rem 1.5rem;
  font-size: var(--font-size-md);
}
.qb-build-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qb-result-card {
  margin-top: 1.25rem;
  min-width: 0;
  max-width: 640px;
}

.qb-feature-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.qb-feature-names {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.qb-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.qb-actions .build-btn {
  margin-top: 0;
}

.qb-actions .build-btn.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}
</style>
