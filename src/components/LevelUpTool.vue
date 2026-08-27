<template>
  <div class="lut-root">
    <div class="lut-select-row">
      <select v-model="selectedCharacterName" class="lut-select">
        <option :value="null" disabled>Choose a character…</option>
        <option v-for="c in characters" :key="c.name" :value="c.name">
          {{ c.name }}
        </option>
      </select>

      <select
        v-if="classOptions.length > 1"
        v-model="selectedClassName"
        class="lut-select"
      >
        <option v-for="c in classOptions" :key="c.name" :value="c.name">
          {{ c.name }} {{ c.level }}
        </option>
      </select>

      <div v-if="currentLevel != null" class="lut-level-badge">
        Level {{ currentLevel }} → {{ targetLevel }}
      </div>
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

    <div v-if="!selectedClassName" class="lut-empty">
      Pick a character (and class, if multiclassed) to begin a level-up.
    </div>

    <template v-else>
      <div class="lut-steps-row">
        <button
          v-for="(step, i) in steps"
          :key="step.id"
          class="lut-step"
          :class="{ active: activeStep === i }"
          @click="activeStep = i"
        >
          {{ step.label }}
        </button>
        <span
          class="lut-toggle-chip"
          :class="{ on: showOneTimeChoices }"
          @click="showOneTimeChoices = !showOneTimeChoices"
        >
          {{ showOneTimeChoices ? '◐' : '◌' }} show one-time choices
        </span>
      </div>

      <div class="lut-work">
        <div v-if="loading" class="lut-loading">Computing…</div>
        <div v-else-if="error" class="lut-error">{{ error }}</div>

        <template v-else-if="preview">
          <!-- ── Step 1: Hit Points ── -->
          <div v-if="activeStep === 0" class="lut-step-body">
            <div class="lut-step-title">
              Hit Die: d{{ preview.description.hitDie }}
            </div>
            <div class="lut-hp-controls">
              <button
                class="lut-btn"
                :class="{ active: hpMethod === 'roll' }"
                @click="rollHp"
              >
                🎲 Roll
              </button>
              <button
                class="lut-btn"
                :class="{ active: hpMethod === 'average' }"
                @click="setAverage"
              >
                Take Average
              </button>
              <label class="lut-manual-roll">
                or enter your own roll:
                <input
                  type="number"
                  min="1"
                  :max="preview.description.hitDie"
                  :value="hpRolls[0] ?? ''"
                  @change="setManualRoll($event.target.value)"
                />
              </label>
            </div>
            <div class="lut-hp-result">
              Hit-die gain: <strong>{{ hitDieGain }}</strong> ({{ hpMethod }}) +
              CON mod = extra HP this level, reflected below.
            </div>
          </div>

          <!-- ── Step 2: New Spells ── -->
          <div v-else-if="activeStep === 1" class="lut-step-body">
            <div v-if="!preview.description.spellcasting" class="lut-note">
              {{ selectedClassName }} doesn't grant spellcasting.
            </div>
            <template v-else>
              <div class="lut-spell-summary-row">
                <span
                  >Cantrips:
                  {{ preview.description.spellcasting.cantripsBefore }}→{{
                    preview.description.spellcasting.cantripsAfter
                  }}</span
                >
                <span v-if="preview.description.spellcasting.style === 'known'">
                  Known: {{ preview.description.spellcasting.knownBefore }}→{{
                    preview.description.spellcasting.knownAfter
                  }}
                </span>
                <span v-else>
                  Prepared:
                  {{ preview.description.spellcasting.preparedBefore }}→{{
                    preview.description.spellcasting.preparedAfter
                  }}
                </span>
              </div>
              <div v-if="pendingNewSpells" class="lut-note lut-note--action">
                {{ pendingNewSpells.count }} new spell{{
                  pendingNewSpells.count === 1 ? '' : 's'
                }}
                known — pick them on {{ selectedCharacterName }}'s spellbook
                once you're done here.
              </div>
            </template>
          </div>

          <!-- ── Step 3: Feature ── -->
          <div v-else class="lut-step-body">
            <div v-if="preview.newFeatures.length === 0" class="lut-note">
              No new features at this level.
            </div>
            <ul v-else class="lut-feature-list">
              <li v-for="f in preview.newFeatures" :key="f.name">
                {{ f.name }}
              </li>
            </ul>
          </div>

          <!-- ── One-time choices (ASI/feat, subclass) ── -->
          <div v-if="showOneTimeChoices" class="lut-onetime">
            <div v-if="pendingSubclassChoice" class="lut-choice-card">
              <div class="lut-choice-title">
                Level {{ pendingSubclassChoice.level }} — choose a subclass
              </div>
              <select v-model="subclassChoiceDraft" class="lut-select">
                <option :value="null" disabled>Choose…</option>
                <option
                  v-for="s in availableSubclasses"
                  :key="s.name"
                  :value="s.name"
                >
                  {{ s.name }}
                </option>
              </select>
            </div>

            <div v-if="pendingAsiChoice" class="lut-choice-card">
              <div class="lut-choice-title">
                Level {{ pendingAsiChoice.level }} — Ability Score Improvement
                or Feat
              </div>
              <div class="lut-choice-tabs">
                <button
                  class="lut-btn"
                  :class="{ active: asiFeatMode === 'asi' }"
                  @click="asiFeatMode = 'asi'"
                >
                  ASI
                </button>
                <button
                  class="lut-btn"
                  :class="{ active: asiFeatMode === 'feat' }"
                  @click="asiFeatMode = 'feat'"
                >
                  Feat
                </button>
              </div>

              <div v-if="asiFeatMode === 'asi'" class="lut-asi-form">
                <select v-model="asiSplit" class="lut-select">
                  <option value="one">+2 to one ability</option>
                  <option value="two">+1 to two abilities</option>
                </select>
                <select v-model="asiAbility1" class="lut-select">
                  <option v-for="a in abilities" :key="a" :value="a">
                    {{ a.toUpperCase() }}
                  </option>
                </select>
                <select
                  v-if="asiSplit === 'two'"
                  v-model="asiAbility2"
                  class="lut-select"
                >
                  <option v-for="a in abilities" :key="a" :value="a">
                    {{ a.toUpperCase() }}
                  </option>
                </select>
                <button class="lut-btn lut-btn--confirm" @click="submitAsi">
                  Apply
                </button>
              </div>

              <div v-else class="lut-feat-form">
                <select v-model="featChoiceName" class="lut-select">
                  <option :value="null" disabled>Choose a feat…</option>
                  <option
                    v-for="f in catalogFeats"
                    :key="f.name"
                    :value="f.name"
                  >
                    {{ f.name }}
                  </option>
                  <option value="__other">Other (not yet catalogued)</option>
                </select>
                <input
                  v-if="featChoiceName === '__other'"
                  v-model="customFeatName"
                  class="lut-text-input"
                  placeholder="Feat name"
                />
                <select
                  v-if="selectedFeatAbilityChoices.length > 1"
                  v-model="featAbilityChoice"
                  class="lut-select"
                >
                  <option :value="null" disabled>Which ability?</option>
                  <option
                    v-for="a in selectedFeatAbilityChoices"
                    :key="a"
                    :value="a"
                  >
                    {{ a.toUpperCase() }}
                  </option>
                </select>
                <button class="lut-btn lut-btn--confirm" @click="submitFeat">
                  Apply
                </button>
              </div>
            </div>

            <div
              v-if="!pendingSubclassChoice && !pendingAsiChoice"
              class="lut-note"
            >
              No one-time choices at this level.
            </div>
          </div>

          <div v-if="preview.warnings.length" class="lut-warnings">
            <div v-for="(w, i) in preview.warnings" :key="i">⚠ {{ w }}</div>
          </div>
        </template>
      </div>

      <!-- ── Reference panels ── -->
      <div v-if="preview" class="lut-ref-row">
        <div class="lut-ref-panel">
          <div class="lut-ref-title">Stats Block</div>
          <div class="lut-chip-row">
            <span class="lut-chip"
              >HP {{ draftCharacter.hp_max }}→{{ preview.patch.hp_max }}</span
            >
            <span class="lut-chip">Lvl {{ preview.patch.level }}</span>
            <span class="lut-chip"
              >PB +{{ preview.patch.proficiency_bonus }}</span
            >
          </div>
        </div>
        <div class="lut-ref-panel lut-ref-panel--linked">
          <div class="lut-ref-title">Spell Slots</div>
          <div v-if="slotRows.length" class="lut-slot-rows">
            <div
              v-for="row in slotRows"
              :key="row.level"
              class="lut-slot-line"
              :class="{ 'lut-slot-line--changed': row.before !== row.after }"
            >
              <span>Level {{ row.level }}</span>
              <span>{{ row.before }} → {{ row.after }}</span>
            </div>
          </div>
          <div v-else-if="pactSlotRow" class="lut-slot-rows">
            <div class="lut-slot-line lut-slot-line--changed">
              <span
                >Pact ({{ ordinal(pactSlotRow.slotLevelAfter) }}-level)</span
              >
              <span>{{ pactSlotRow.before }} → {{ pactSlotRow.after }}</span>
            </div>
          </div>
          <div v-else class="lut-note">No spell slots.</div>
        </div>
      </div>
      <div v-if="preview" class="lut-link-caption">
        ↑ this panel reflects whatever's selected above — pick a choice, watch
        it land
      </div>

      <div v-if="preview" class="lut-actions">
        <button
          class="lut-btn lut-btn--confirm lut-btn--large"
          :disabled="!canConfirm"
          @click="confirmLevelUp"
        >
          Confirm Level Up
        </button>
        <span v-if="!canConfirm" class="lut-note">
          Resolve the one-time choices above first.
        </span>
      </div>
    </template>
  </div>
</template>

<script>
import PendingCharacterSaveBar from './PendingCharacterSaveBar.vue'
import pendingCharacterSaves from '@/mixins/pendingCharacterSaves'

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export default {
  name: 'LevelUpTool',

  components: { PendingCharacterSaveBar },
  mixins: [pendingCharacterSaves],

  data() {
    return {
      selectedCharacterName: null,
      selectedClassName: null,
      draftCharacter: null,
      activeStep: 0,
      showOneTimeChoices: false,
      hpMethod: 'roll',
      hpRolls: [],
      asiOrFeatResolutions: {},
      preview: null,
      loading: false,
      error: null,
      abilities: ABILITIES,

      subclassChoiceDraft: null,
      availableSubclasses: [],

      asiFeatMode: 'asi',
      asiSplit: 'one',
      asiAbility1: 'str',
      asiAbility2: 'dex',

      catalogFeats: [],
      featChoiceName: null,
      customFeatName: '',
      featAbilityChoice: null,

      // savingName/saveError/justSaved come from the pendingCharacterSaves mixin.
      steps: [
        { id: 'hp', label: '① Hit Points' },
        { id: 'spells', label: '② New Spells' },
        { id: 'feature', label: '③ Feature' },
      ],
    }
  },

  computed: {
    characters() {
      return this.$store.state.characters.filter((c) => c.classes?.length)
    },
    selectedCharacter() {
      return this.characters.find((c) => c.name === this.selectedCharacterName)
    },
    classOptions() {
      return this.selectedCharacter?.classes ?? []
    },
    currentLevel() {
      const c = this.classOptions.find(
        (cl) => cl.name === this.selectedClassName
      )
      return c?.level ?? null
    },
    targetLevel() {
      return this.currentLevel != null ? this.currentLevel + 1 : null
    },
    hitDieGain() {
      return this.preview?.description?.hp?.[0]?.gained ?? null
    },
    pendingSubclassChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'subclassChoice'
        ) ?? null
      )
    },
    pendingAsiChoice() {
      return (
        this.preview?.pendingChoices?.find((p) => p.type === 'asiOrFeat') ??
        null
      )
    },
    pendingNewSpells() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'newKnownSpells'
        ) ?? null
      )
    },
    canConfirm() {
      return (
        Boolean(this.preview?.patch) &&
        !this.pendingSubclassChoice &&
        !this.pendingAsiChoice
      )
    },
    slotRows() {
      const slots = this.preview?.patch?.spell_slots
      const before = this.preview?.description?.spellcasting?.slotsBefore
      if (!slots || !before) return []
      return Object.keys(slots).map((key, i) => ({
        level: i + 1,
        before: before[i] ?? 0,
        after: slots[key].max,
      }))
    },
    pactSlotRow() {
      const pact = this.preview?.patch?.pact_magic
      const desc = this.preview?.description?.spellcasting
      if (!pact || !desc) return null
      return {
        before: desc.pactSlotsBefore?.slots ?? 0,
        after: pact.max,
        slotLevelAfter: pact.slot_level,
      }
    },
    selectedFeatAbilityChoices() {
      const feat = this.catalogFeats.find((f) => f.name === this.featChoiceName)
      return feat?.ability_score_increase?.choice_of ?? []
    },
    // pendingCharacterNames comes from the pendingCharacterSaves mixin.
  },

  watch: {
    selectedCharacterName() {
      this.selectedClassName = this.classOptions[0]?.name ?? null
      this.resetChoices()
      this.initDraft()
      this.runPreview()
    },
    selectedClassName() {
      this.resetChoices()
      this.initDraft()
      this.runPreview()
    },
  },

  async created() {
    try {
      const res = await fetch('/api/engine/feats')
      if (res.ok) this.catalogFeats = await res.json()
    } catch {
      // Feat catalog is a nice-to-have for the picker — free text still works.
    }
  },

  methods: {
    initDraft() {
      this.draftCharacter = this.selectedCharacter
        ? JSON.parse(JSON.stringify(this.selectedCharacter))
        : null
    },

    resetChoices() {
      this.activeStep = 0
      this.showOneTimeChoices = false
      this.hpMethod = 'roll'
      this.hpRolls = []
      this.asiOrFeatResolutions = {}
      this.subclassChoiceDraft = null
      this.availableSubclasses = []
      this.preview = null
      this.error = null
      // Deliberately NOT resetting saveError/justSaved here — pending saves
      // are tracked by comparing the store against `originals`, which
      // outlives switching to a different character/class in the picker
      // above.
    },

    async fetchSubclasses() {
      if (!this.selectedClassName) return
      try {
        const res = await fetch(
          `/api/engine/subclasses/${encodeURIComponent(this.selectedClassName)}`
        )
        this.availableSubclasses = res.ok ? await res.json() : []
      } catch {
        this.availableSubclasses = []
      }
    },

    async runPreview() {
      if (!this.draftCharacter || !this.selectedClassName) {
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
            character: this.draftCharacter,
            className: this.selectedClassName,
            hpMethod: this.hpMethod,
            hpRolls: this.hpRolls,
            asiOrFeatResolutions: this.asiOrFeatResolutions,
          }),
        })
        const data = await res.json()
        if (!res.ok)
          throw new Error(data.error || `Server returned ${res.status}`)
        this.preview = data
        if (data.pendingChoices?.some((p) => p.type === 'subclassChoice')) {
          this.fetchSubclasses()
        }
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
      const gained = this.preview?.description?.hp?.[0]?.gained
      if (gained != null) this.hpRolls = [gained]
    },

    setAverage() {
      this.hpMethod = 'average'
      this.hpRolls = []
      this.runPreview()
    },

    setManualRoll(value) {
      const n = parseInt(value, 10)
      if (!Number.isInteger(n)) return
      this.hpMethod = 'roll'
      this.hpRolls = [n]
      this.runPreview()
    },

    submitAsi() {
      const increases =
        this.asiSplit === 'one'
          ? { [this.asiAbility1]: 2 }
          : { [this.asiAbility1]: 1, [this.asiAbility2]: 1 }
      this.$set(this.asiOrFeatResolutions, this.pendingAsiChoice.level, {
        type: 'asi',
        increases,
      })
      this.runPreview()
    },

    submitFeat() {
      const featName =
        this.featChoiceName === '__other'
          ? this.customFeatName.trim()
          : this.featChoiceName
      if (!featName) return
      this.$set(this.asiOrFeatResolutions, this.pendingAsiChoice.level, {
        type: 'feat',
        featName,
        abilityChoice: this.featAbilityChoice,
      })
      this.runPreview()
    },

    async confirmLevelUp() {
      if (!this.preview?.patch) return
      // Bake in a chosen subclass if one was picked on the draft — patch.classes
      // already reflects it since diffLevelUp built it from draftCharacter.
      // APPLY_LEVEL_UP deliberately does not mark 'characters' dirty, so this
      // won't get swept up by the app's ambient autosave — pendingCharacterNames
      // below (and the save/revert actions it drives) is the only path that
      // persists or discards it.
      this.$store.commit('APPLY_LEVEL_UP', {
        characterName: this.selectedCharacterName,
        patch: this.preview.patch,
      })
      this.justSaved = false
      this.saveError = null
      this.resetChoices()
      this.initDraft()
      await this.runPreview()
    },

    // revertCharacter/saveOnlyCharacter/saveChanges come from the
    // pendingCharacterSaves mixin. This hook is the mixin's extension point —
    // called after a revert so this tool's in-progress preview stays in sync
    // if the reverted character happens to be the one currently selected.
    onCharacterReverted(name) {
      if (name === this.selectedCharacterName) {
        this.initDraft()
        this.runPreview()
      }
    },

    ordinal(n) {
      const rem100 = n % 100
      if (rem100 >= 11 && rem100 <= 13) return `${n}th`
      const rem10 = n % 10
      if (rem10 === 1) return `${n}st`
      if (rem10 === 2) return `${n}nd`
      if (rem10 === 3) return `${n}rd`
      return `${n}th`
    },
  },
}
</script>

<style scoped>
.lut-root {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
  color: var(--color-text);
  font-family: var(--font-body);
}

.lut-select-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.lut-select {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
}

.lut-level-badge {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  font-size: var(--font-size-base);
}

.lut-empty {
  color: var(--color-text-muted);
  padding: 1rem 0;
}

.lut-steps-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.lut-step {
  padding: 0.3rem 0.8rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.lut-step.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.lut-toggle-chip {
  margin-left: auto;
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid transparent;
}

.lut-toggle-chip.on {
  color: var(--color-accent);
  border-color: var(--color-border);
}

.lut-work {
  min-height: 5rem;
}

.lut-loading {
  color: var(--color-text-muted);
}

.lut-error {
  color: var(--color-text-danger);
}

.lut-step-title {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  margin-bottom: 0.6rem;
}

.lut-hp-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.lut-btn {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.lut-btn.active,
.lut-btn--confirm {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
}

.lut-btn--large {
  padding: 0.5rem 1.2rem;
  font-size: var(--font-size-base);
}

.lut-manual-roll {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.lut-manual-roll input {
  width: 3.5rem;
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
}

.lut-hp-result {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.lut-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.lut-note--action {
  color: var(--color-accent);
  margin-top: 0.5rem;
}

.lut-spell-summary-row {
  display: flex;
  gap: 1.5rem;
  color: var(--color-text);
  margin-bottom: 0.4rem;
}

.lut-feature-list {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--color-text);
}

.lut-onetime {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lut-choice-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.75rem;
}

.lut-choice-title {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  font-size: var(--font-size-sm);
  margin-bottom: 0.5rem;
}

.lut-choice-tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.lut-asi-form,
.lut-feat-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lut-text-input {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-body);
}

.lut-warnings {
  margin-top: 0.75rem;
  color: var(--color-text-warning);
  font-size: var(--font-size-sm);
}

.lut-ref-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .lut-ref-row {
    grid-template-columns: 1fr;
  }
}

.lut-ref-panel {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.75rem;
}

.lut-ref-panel--linked {
  border-color: var(--color-accent);
}

.lut-ref-title {
  font-family: var(--font-display);
  color: var(--color-text-alt);
  font-size: var(--font-size-sm);
  margin-bottom: 0.5rem;
}

.lut-chip-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lut-chip {
  background: var(--color-bg-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.2rem 0.6rem;
  font-size: var(--font-size-sm);
  font-family: var(--font-display);
  color: var(--color-accent-strong);
}

.lut-slot-rows {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.lut-slot-line {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.lut-slot-line--changed {
  color: var(--color-accent);
  font-weight: 600;
}

.lut-link-caption {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  text-align: center;
}

.lut-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

/* Save/revert bar styling lives in PendingCharacterSaveBar.vue. */
</style>
