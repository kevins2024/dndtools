<template>
  <div class="nct-root">
    <div class="nct-name-row">
      <input
        v-model="name"
        class="nct-text-input nct-name-input"
        placeholder="Character name"
      />
    </div>

    <PendingCharacterSaveBar
      :pending-names="pendingCharacterNames"
      :saving-name="savingName"
      :save-error="saveError"
      :just-saved="justSaved"
      @save-only="saveOnlyCharacter"
      @revert="revertCharacter"
      @save-all="saveChanges"
    />

    <div class="nct-tabs-row">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="nct-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="nct-work">
      <!-- ── Species ── -->
      <div v-if="activeTab === 'species'" class="nct-tab-body">
        <select v-model="speciesName" class="nct-select">
          <option :value="null" disabled>Choose a species…</option>
          <optgroup label="Standard">
            <option
              v-for="s in standardSpeciesList"
              :key="s.name"
              :value="s.name"
            >
              {{ s.name }}
            </option>
          </optgroup>
          <optgroup label="Homebrew" v-if="homebrewSpeciesList.length">
            <option
              v-for="s in homebrewSpeciesList"
              :key="s.name"
              :value="s.name"
            >
              {{ s.name }}
            </option>
          </optgroup>
        </select>

        <label class="nct-toggle-row">
          <input type="checkbox" v-model="useSpeciesBonus" />
          Apply this species' ability score bonus
        </label>
        <div v-if="!useSpeciesBonus" class="nct-note nct-note--action">
          Off — assign a free +2/+1 to any abilities instead, on the Abilities
          tab.
        </div>

        <div v-if="selectedSpecies" class="nct-species-summary">
          <div>Speed {{ selectedSpecies.speed ?? '—' }} ft.</div>
          <div v-if="selectedSpecies.darkvision">
            Darkvision {{ selectedSpecies.darkvision }} ft.
          </div>
          <template v-if="useSpeciesBonus">
            <div v-if="fixedBonusText">Ability bonus: {{ fixedBonusText }}</div>
            <div v-if="selectedSpecies.choice">
              Choose {{ selectedSpecies.choice.count }} more abilities for +{{
                selectedSpecies.choice.amount
              }}
              each:
              <select
                v-for="(_, i) in Array(selectedSpecies.choice.count)"
                :key="i"
                v-model="speciesChoiceAbilities[i]"
                class="nct-select"
              >
                <option :value="null" disabled>Choose…</option>
                <option
                  v-for="a in abilitiesExcluding(
                    selectedSpecies.choice.exclude
                  )"
                  :key="a"
                  :value="a"
                >
                  {{ a.toUpperCase() }}
                </option>
              </select>
            </div>
          </template>
          <div v-if="selectedSpecies.traits && selectedSpecies.traits.length">
            <div class="nct-note">Traits (flavor/reference only):</div>
            <ul class="nct-trait-list">
              <li v-for="t in selectedSpecies.traits" :key="t.name">
                <strong>{{ t.name }}</strong> — {{ t.description }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ── Background ── -->
      <div v-else-if="activeTab === 'background'" class="nct-tab-body">
        <select v-model="backgroundChoice" class="nct-select">
          <option :value="null" disabled>Choose a background…</option>
          <option
            v-for="b in curatedBackgroundList"
            :key="b.name"
            :value="b.name"
          >
            {{ b.name }}
          </option>
          <option value="__custom">
            Other (custom name, pick skills manually)
          </option>
        </select>

        <input
          v-if="backgroundChoice === '__custom'"
          v-model="customBackgroundName"
          class="nct-text-input"
          placeholder="Background name"
        />
        <div v-if="pickedBackground" class="nct-note">
          <template v-if="pickedBackground.homebrew">Homebrew — </template
          >{{ pickedBackground.source }}
        </div>

        <div class="nct-skill-picker">
          <div class="nct-note">Skill proficiencies:</div>
          <select
            v-for="(_, i) in [0, 1]"
            :key="i"
            v-model="selectedSkills[i]"
            class="nct-select"
          >
            <option :value="null" disabled>Choose a skill…</option>
            <option
              v-for="s in skillsList"
              :key="s.id"
              :value="s.id"
              :disabled="s.id === selectedSkills[1 - i]"
            >
              {{ s.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- ── Class ── -->
      <div v-else-if="activeTab === 'class'" class="nct-tab-body">
        <select v-model="className" class="nct-select">
          <option :value="null" disabled>Choose a class…</option>
          <option v-for="c in classList" :key="c.name" :value="c.name">
            {{ c.name }}
          </option>
        </select>
        <div v-if="selectedClass" class="nct-note">
          Hit die: d{{ selectedClass.hitDie }} · Saving throws:
          {{
            selectedClass.saving_throw_proficiencies?.join(', ').toUpperCase()
          }}
        </div>
        <div class="nct-note nct-note--action">
          No subclass pick here — choose one later via the Level Up tool when
          this class actually offers it.
        </div>
      </div>

      <!-- ── Abilities ── -->
      <div v-else-if="activeTab === 'abilities'" class="nct-tab-body">
        <div class="nct-abilities-grid">
          <div v-for="a in abilities" :key="a" class="nct-ability-row">
            <span class="nct-ability-label">{{ a.toUpperCase() }}</span>
            <button class="nct-btn" @click="adjustScore(a, -1)">−</button>
            <span class="nct-ability-score">{{ baseScores[a] }}</span>
            <button class="nct-btn" @click="adjustScore(a, 1)">+</button>
            <span class="nct-ability-cost"
              >{{ scoreCost(baseScores[a]) }} pt{{
                scoreCost(baseScores[a]) === 1 ? '' : 's'
              }}</span
            >
            <span
              v-if="finalScores[a] !== baseScores[a]"
              class="nct-ability-bonus"
            >
              → {{ finalScores[a] }}
            </span>
          </div>
        </div>
        <div
          class="nct-note"
          :class="{ 'nct-note--danger': pointsRemaining < 0 }"
        >
          {{ pointsSpent }} / {{ pointBuyBudget }} points spent ({{
            pointsRemaining
          }}
          remaining)
        </div>

        <div v-if="!useSpeciesBonus" class="nct-manual-bonus">
          <div class="nct-note">
            No species bonus — assign a free +2 and +1 to two different
            abilities instead:
          </div>
          <div class="nct-radio-group">
            <span class="nct-radio-group-label">+2 to:</span>
            <label
              v-for="a in abilities"
              :key="'plus2-' + a"
              class="nct-radio-label"
            >
              <input
                type="radio"
                name="nct-plus-two"
                :value="a"
                v-model="manualPlusTwoAbility"
                :disabled="a === manualPlusOneAbility"
              />
              {{ a.toUpperCase() }}
            </label>
          </div>
          <div class="nct-radio-group">
            <span class="nct-radio-group-label">+1 to:</span>
            <label
              v-for="a in abilities"
              :key="'plus1-' + a"
              class="nct-radio-label"
            >
              <input
                type="radio"
                name="nct-plus-one"
                :value="a"
                v-model="manualPlusOneAbility"
                :disabled="a === manualPlusTwoAbility"
              />
              {{ a.toUpperCase() }}
            </label>
          </div>
        </div>
      </div>

      <!-- ── Spells & Features ── -->
      <div v-else class="nct-tab-body">
        <div v-if="loading" class="nct-loading">Computing…</div>
        <div v-else-if="error" class="nct-error">{{ error }}</div>
        <template v-else-if="preview">
          <div class="nct-hp-controls">
            <button
              class="nct-btn"
              :class="{ active: hpMethod === 'roll' }"
              @click="rollHp"
            >
              🎲 Roll
            </button>
            <button
              class="nct-btn"
              :class="{ active: hpMethod === 'average' }"
              @click="setAverage"
            >
              Take Average
            </button>
            <span class="nct-note"
              >HP at level 1 is always max hit die by RAW.</span
            >
          </div>
          <div class="nct-note">
            HP: <strong>{{ preview.patch.hp_max }}</strong>
          </div>
          <div v-if="preview.description.spellcasting" class="nct-note">
            Cantrips: {{ preview.description.spellcasting.cantripsAfter }}
            <span v-if="preview.description.spellcasting.style === 'known'">
              · Spells known: {{ preview.description.spellcasting.knownAfter }}
            </span>
            <span v-else>
              · Spells prepared:
              {{ preview.description.spellcasting.preparedAfter }}
            </span>
          </div>
          <ul v-if="preview.newFeatures.length" class="nct-feature-list">
            <li v-for="f in preview.newFeatures" :key="f.name">{{ f.name }}</li>
          </ul>
          <div v-if="pendingSubclassChoice" class="nct-note nct-note--action">
            Subclass choice deferred — pick one later via Level Up.
          </div>
        </template>
        <div v-else class="nct-note">Pick a species and class first.</div>
      </div>
    </div>

    <div class="nct-actions">
      <button
        class="nct-btn nct-btn--confirm nct-btn--large"
        :disabled="!canCreate"
        @click="createCharacter"
      >
        Create Character
      </button>
      <span v-if="!canCreate" class="nct-note">
        Needs a name, species, class, and a legal point-buy spend.
      </span>
    </div>
  </div>
</template>

<script>
import PendingCharacterSaveBar from './PendingCharacterSaveBar.vue'
import pendingCharacterSaves from '@/mixins/pendingCharacterSaves'

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
// Mirrors engine/rules/pointBuy.js's table — kept local for instant UI
// feedback as the player adjusts scores; the server is still the source of
// truth for the actual level-1 computation.
const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
const POINT_BUY_BUDGET = 27

export default {
  name: 'NewCharacterTool',

  components: { PendingCharacterSaveBar },
  mixins: [pendingCharacterSaves],

  data() {
    return {
      name: '',
      speciesName: null,
      speciesChoiceAbilities: [],
      // When off, the species' fixed/flexible ability bonus is skipped
      // entirely in favor of a free +2/+1 the player assigns to any two
      // abilities — added because tying ability bonuses to species pushes
      // players toward the same species/class pairings over and over.
      useSpeciesBonus: true,
      manualPlusTwoAbility: null,
      manualPlusOneAbility: null,
      // backgroundChoice is either a curated background's name, or the
      // sentinel '__custom' for a freeform name with manually-picked skills.
      backgroundChoice: null,
      customBackgroundName: '',
      selectedSkills: [null, null],
      className: null,
      baseScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      abilities: ABILITIES,
      pointBuyBudget: POINT_BUY_BUDGET,

      activeTab: 'species',
      tabs: [
        { id: 'species', label: 'Species' },
        { id: 'background', label: 'Background' },
        { id: 'class', label: 'Class' },
        { id: 'abilities', label: 'Abilities' },
        { id: 'spells', label: 'Spells & Features' },
      ],

      speciesList: [],
      curatedBackgroundList: [],
      skillsList: [],
      classList: [],

      hpMethod: 'roll',
      hpRolls: [],
      preview: null,
      loading: false,
      error: null,
    }
  },

  computed: {
    standardSpeciesList() {
      return this.speciesList.filter((s) => !s.homebrew)
    },
    homebrewSpeciesList() {
      return this.speciesList.filter((s) => s.homebrew)
    },
    selectedSpecies() {
      return this.speciesList.find((s) => s.name === this.speciesName) ?? null
    },
    fixedBonusText() {
      const bonus = this.selectedSpecies?.ability_score_bonus
      if (!bonus || typeof bonus !== 'object') return null
      return Object.entries(bonus)
        .map(([a, n]) => `+${n} ${a.toUpperCase()}`)
        .join(', ')
    },
    selectedClass() {
      return this.classList.find((c) => c.name === this.className) ?? null
    },
    pickedBackground() {
      if (!this.backgroundChoice || this.backgroundChoice === '__custom')
        return null
      return (
        this.curatedBackgroundList.find(
          (b) => b.name === this.backgroundChoice
        ) ?? null
      )
    },
    effectiveBackgroundName() {
      return this.backgroundChoice === '__custom'
        ? this.customBackgroundName.trim()
        : this.backgroundChoice
    },
    pointsSpent() {
      return this.abilities.reduce(
        (sum, a) => sum + (POINT_BUY_COSTS[this.baseScores[a]] ?? 0),
        0
      )
    },
    pointsRemaining() {
      return this.pointBuyBudget - this.pointsSpent
    },
    finalScores() {
      const scores = { ...this.baseScores }
      if (this.useSpeciesBonus) {
        const sp = this.selectedSpecies
        if (sp) {
          for (const [a, n] of Object.entries(sp.ability_score_bonus || {})) {
            scores[a] = (scores[a] ?? 10) + n
          }
          if (sp.choice) {
            this.speciesChoiceAbilities.forEach((a) => {
              if (a) scores[a] = (scores[a] ?? 10) + sp.choice.amount
            })
          }
        }
      } else {
        if (this.manualPlusTwoAbility) scores[this.manualPlusTwoAbility] += 2
        if (this.manualPlusOneAbility) scores[this.manualPlusOneAbility] += 1
      }
      return scores
    },
    // True once whichever ability-bonus mode is active has everything it
    // needs: the species' own flexible choice when using species bonuses, or
    // both radio picks (on two different abilities) when using the manual
    // free +2/+1 instead.
    abilityBonusAssignmentComplete() {
      if (this.useSpeciesBonus) {
        const sp = this.selectedSpecies
        if (!sp?.choice) return true
        return (
          this.speciesChoiceAbilities.filter(Boolean).length === sp.choice.count
        )
      }
      return Boolean(
        this.manualPlusTwoAbility &&
          this.manualPlusOneAbility &&
          this.manualPlusTwoAbility !== this.manualPlusOneAbility
      )
    },
    pendingSubclassChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'subclassChoice'
        ) ?? null
      )
    },
    canCreate() {
      return Boolean(
        this.name.trim() &&
          this.speciesName &&
          this.abilityBonusAssignmentComplete &&
          this.className &&
          this.pointsRemaining >= 0 &&
          this.preview?.patch
      )
    },
  },

  watch: {
    speciesName() {
      this.speciesChoiceAbilities = []
      this.runPreview()
    },
    className() {
      this.runPreview()
    },
    backgroundChoice() {
      // Pre-fill from the curated background's real skills — still editable
      // afterward via the two selects. Left blank (not `[]`, so v-model on
      // both selects has a real index to bind to) for a custom name or a
      // free-choice background like Born Adventurer.
      this.selectedSkills = this.pickedBackground?.skill_proficiencies.length
        ? [...this.pickedBackground.skill_proficiencies]
        : [null, null]
    },
    finalScores: {
      deep: true,
      handler() {
        this.runPreview()
      },
    },
  },

  async created() {
    try {
      const [species, backgrounds, skills, classes] = await Promise.all([
        fetch('/api/engine/species').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/engine/backgrounds').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/engine/skills').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/engine/classes').then((r) => (r.ok ? r.json() : [])),
      ])
      this.speciesList = species
      this.curatedBackgroundList = backgrounds
      this.skillsList = skills
      this.classList = classes
    } catch {
      this.error =
        'Could not load species/background/class data from the server.'
    }
  },

  methods: {
    abilitiesExcluding(exclude) {
      return this.abilities.filter((a) => !(exclude || []).includes(a))
    },
    scoreCost(score) {
      return POINT_BUY_COSTS[score] ?? 0
    },
    adjustScore(ability, delta) {
      const next = this.baseScores[ability] + delta
      if (next < 8 || next > 15) return
      this.$set(this.baseScores, ability, next)
    },

    skillNameFor(id) {
      return this.skillsList.find((s) => s.id === id)?.name ?? null
    },

    characterShell() {
      return {
        name: this.name.trim(),
        full_name: this.name.trim(),
        race: this.speciesName,
        background: this.effectiveBackgroundName || null,
        level: 0,
        stat_str: this.finalScores.str,
        stat_dex: this.finalScores.dex,
        stat_con: this.finalScores.con,
        stat_int: this.finalScores.int,
        stat_wis: this.finalScores.wis,
        stat_cha: this.finalScores.cha,
        spellcasting_ability: this.selectedClass?.spellcasting?.ability ?? null,
        hp_max: 0,
        hp_current: 0,
        saving_throws: [],
        skill_proficiencies: this.selectedSkills
          .filter(Boolean)
          .map((id) => this.skillNameFor(id))
          .filter(Boolean),
        skill_expertise: [],
        languages: [],
        features: [],
        spells: [],
        active_effects: [],
        conditions: [],
        exhaustion_level: 0,
        classes: [{ name: this.className, level: 0, subclass: null }],
      }
    },

    async runPreview() {
      if (
        !this.speciesName ||
        !this.abilityBonusAssignmentComplete ||
        !this.className
      ) {
        this.preview = null
        return
      }
      this.loading = true
      this.error = null
      try {
        const res = await fetch('/api/engine/preview-level-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: this.characterShell(),
            className: this.className,
            toLevel: 1,
            hpMethod: this.hpMethod,
            hpRolls: this.hpRolls,
          }),
        })
        const data = await res.json()
        if (!res.ok)
          throw new Error(data.error || `Server returned ${res.status}`)
        this.preview = data
      } catch (err) {
        this.error = err.message
        this.preview = null
      } finally {
        this.loading = false
      }
    },

    async rollHp() {
      this.hpMethod = 'roll'
      this.hpRolls = []
      await this.runPreview()
    },
    setAverage() {
      this.hpMethod = 'average'
      this.hpRolls = []
      this.runPreview()
    },

    createCharacter() {
      if (!this.canCreate) return
      const shell = this.characterShell()
      const character = { ...shell, ...this.preview.patch }
      this.$store.commit('ADD_CHARACTER', character)

      this.name = ''
      this.speciesName = null
      this.speciesChoiceAbilities = []
      this.useSpeciesBonus = true
      this.manualPlusTwoAbility = null
      this.manualPlusOneAbility = null
      this.backgroundChoice = null
      this.customBackgroundName = ''
      this.selectedSkills = [null, null]
      this.className = null
      this.baseScores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
      this.preview = null
      this.activeTab = 'species'
    },
  },
}
</script>

<style scoped>
.nct-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
  color: var(--color-text);
  font-family: var(--font-body);
}

.nct-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nct-name-input {
  flex: 1;
  max-width: 20rem;
}

.nct-text-input,
.nct-select {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
}

.nct-tabs-row {
  display: flex;
  gap: 0.4rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.nct-tab {
  padding: 0.3rem 0.8rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.nct-tab.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.nct-work {
  min-height: 8rem;
}

.nct-species-summary {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.nct-trait-list {
  margin: 0.3rem 0 0;
  padding-left: 1.2rem;
}

.nct-skill-picker {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.nct-abilities-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nct-ability-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.nct-ability-label {
  width: 3rem;
  font-family: var(--font-display);
  color: var(--color-accent-strong);
}

.nct-ability-score {
  width: 2rem;
  text-align: center;
  font-family: var(--font-display);
}

.nct-ability-bonus {
  color: var(--color-accent);
  font-size: var(--font-size-sm);
}

.nct-ability-cost {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  width: 3.5rem;
}

.nct-toggle-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  margin-top: 0.6rem;
  cursor: pointer;
}

.nct-manual-bonus {
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nct-radio-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.nct-radio-group-label {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  font-size: var(--font-size-sm);
  width: 3.5rem;
}

.nct-radio-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.nct-btn {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.nct-btn.active,
.nct-btn--confirm {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
}

.nct-btn--large {
  padding: 0.5rem 1.2rem;
  font-size: var(--font-size-base);
}

.nct-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nct-hp-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.nct-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.nct-note--action {
  color: var(--color-accent);
}

.nct-note--danger {
  color: var(--color-text-danger);
}

.nct-feature-list {
  margin: 0.4rem 0;
  padding-left: 1.2rem;
}

.nct-loading {
  color: var(--color-text-muted);
}

.nct-error {
  color: var(--color-text-danger);
}

.nct-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}
</style>
