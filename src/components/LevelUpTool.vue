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

      <select
        v-if="addableClasses.length"
        v-model="selectedClassName"
        class="lut-select"
      >
        <option :value="null" disabled>+ Multiclass into…</option>
        <option v-for="c in addableClasses" :key="c.name" :value="c.name">
          + {{ c.name }}
        </option>
      </select>

      <div v-if="currentLevel != null" class="lut-level-badge">
        <template v-if="currentLevel === 0"
          >New class — Level {{ targetLevel }}</template
        >
        <template v-else>Level {{ currentLevel }} → {{ targetLevel }}</template>
      </div>
    </div>

    <div
      v-if="effectiveLevelCap != null && targetLevel > effectiveLevelCap"
      class="lut-cap-warning"
    >
      <span>
        Party level cap is {{ effectiveLevelCap }} — level {{ targetLevel }} is
        above it.
      </span>
      <label class="lut-cap-toggle">
        <input type="checkbox" v-model="ignoreLevelCap" />
        Ignore cap and allow confirming this level-up anyway
      </label>
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
      </div>

      <div class="lut-work">
        <div v-if="loading" class="lut-loading">Computing…</div>
        <div v-else-if="error" class="lut-error">
          <div>{{ error }}</div>
          <button class="lut-btn" @click="dismissError">
            Dismiss — undo the last choice and go back
          </button>
        </div>

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
                <span
                  :class="{ 'has-tip': featureDescriptions[f.name] }"
                  :title="featureDescriptions[f.name] || ''"
                >
                  {{ f.name }}
                </span>
              </li>
            </ul>
          </div>

          <!-- ── One-time choices (ASI/feat, subclass) — always visible,
               never behind a toggle: these are required, not optional
               detail, and hiding them made it look like Confirm Level Up
               was broken. ── -->
          <div class="lut-onetime">
            <div
              v-if="pendingSubclassChoice || subclassChoiceDraft"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level
                  {{ pendingSubclassChoice?.level ?? subclassChoiceLevel }} —
                  choose a subclass
                </div>
                <select
                  v-model="subclassChoiceDraft"
                  class="lut-select"
                  @change="applySubclassChoice"
                >
                  <option :value="null" disabled>Choose…</option>
                  <option
                    v-for="s in availableSubclasses"
                    :key="s.name"
                    :value="s.name"
                    :title="s.description"
                  >
                    {{ s.name }}
                  </option>
                </select>
              </div>
              <div v-if="subclassChoiceDraft" class="lut-subclass-summary">
                <p v-if="subclassChoiceDescription" class="lut-subclass-desc">
                  {{ subclassChoiceDescription }}
                  <span v-if="isSubclassChoiceStub" class="lut-stub-flag">
                    (early preview — only this subclass's first tier is built so
                    far, not the full progression)</span
                  >
                </p>
                <div
                  v-if="subclassFeaturesForChoice.length === 0"
                  class="lut-note"
                >
                  Computing…
                </div>
                <ul v-else class="lut-feature-list">
                  <li v-for="f in subclassFeaturesForChoice" :key="f">
                    <strong>{{ f }}</strong>
                    <span v-if="featureDescriptions[f]">
                      — {{ featureDescriptions[f] }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>

            <div
              v-if="pendingAsiChoice || asiChoiceLevel"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level {{ pendingAsiChoice?.level ?? asiChoiceLevel }} —
                  Ability Score Improvement or Feat
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
                  <select
                    v-model="asiSplit"
                    class="lut-select"
                    @change="submitAsi"
                  >
                    <option value="one">+2 to one ability</option>
                    <option value="two">+1 to two abilities</option>
                  </select>
                  <select
                    v-model="asiAbility1"
                    class="lut-select"
                    @change="submitAsi"
                  >
                    <option v-for="a in abilities" :key="a" :value="a">
                      {{ a.toUpperCase() }}
                    </option>
                  </select>
                  <select
                    v-if="asiSplit === 'two'"
                    v-model="asiAbility2"
                    class="lut-select"
                    @change="submitAsi"
                  >
                    <option v-for="a in abilities" :key="a" :value="a">
                      {{ a.toUpperCase() }}
                    </option>
                  </select>
                </div>

                <div v-else class="lut-feat-form">
                  <label class="lut-checkbox-row">
                    <input type="checkbox" v-model="showAllFeats" />
                    Show all feats (ignore prerequisites)
                  </label>
                  <select
                    v-model="featChoiceName"
                    class="lut-select"
                    @change="onFeatChoiceNameChange"
                  >
                    <option :value="null" disabled>Choose a feat…</option>
                    <option
                      v-for="f in visibleCatalogFeats"
                      :key="f.name"
                      :value="f.name"
                      :disabled="
                        !showAllFeats &&
                        featEligibility[f.name] &&
                        featEligibility[f.name].met === false
                      "
                    >
                      {{ f.name }}
                      <template
                        v-if="
                          featEligibility[f.name] &&
                          featEligibility[f.name].met === false
                        "
                      >
                        (prereq not met)
                      </template>
                    </option>
                    <option value="__other">Other (not yet catalogued)</option>
                  </select>
                  <div
                    v-if="selectedFeat && selectedFeat.prerequisite"
                    class="lut-note"
                  >
                    Prerequisite:
                    {{ prerequisiteLabel(selectedFeat.prerequisite) }}
                    <span
                      v-if="
                        featEligibility[featChoiceName] &&
                        featEligibility[featChoiceName].met === false
                      "
                      class="lut-error-text"
                    >
                      — not met on this character{{ ' ' }} ({{
                        featEligibility[featChoiceName].reason
                      }})
                    </span>
                    <span
                      v-else-if="
                        featEligibility[featChoiceName] &&
                        featEligibility[featChoiceName].unknown
                      "
                    >
                      — {{ featEligibility[featChoiceName].reason }}
                    </span>
                  </div>
                  <input
                    v-if="featChoiceName === '__other'"
                    v-model="customFeatName"
                    class="lut-text-input"
                    placeholder="Feat name"
                    @change="submitFeat"
                  />
                  <select
                    v-if="selectedFeatAbilityChoices.length > 1"
                    v-model="featAbilityChoice"
                    class="lut-select"
                    @change="submitFeat"
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

                  <div
                    v-for="choice in selectedFeatChoices"
                    :key="choice.id"
                    class="lut-feat-choice"
                  >
                    <div class="lut-choice-label">{{ choice.label }}</div>
                    <template
                      v-if="
                        choice.type === 'spell_text' || choice.type === 'text'
                      "
                    >
                      <input
                        v-for="i in choice.count"
                        :key="choice.id + '-' + i"
                        v-model="featChoiceValues[choice.id][i - 1]"
                        class="lut-text-input"
                        :placeholder="
                          choice.count > 1 ? 'Pick ' + i : 'Name it'
                        "
                        @change="submitFeat"
                      />
                    </template>
                    <template v-else>
                      <select
                        v-for="i in choice.count"
                        :key="choice.id + '-' + i"
                        v-model="featChoiceValues[choice.id][i - 1]"
                        class="lut-select"
                        @change="submitFeat"
                      >
                        <option :value="null" disabled>
                          {{ choice.count > 1 ? 'Pick ' + i : 'Choose…' }}
                        </option>
                        <option v-for="o in choice.options" :key="o" :value="o">
                          {{ o }}
                        </option>
                      </select>
                    </template>
                  </div>
                </div>
              </div>

              <div class="lut-subclass-summary">
                <ul v-if="asiFeatMode === 'asi'" class="lut-feature-list">
                  <li v-for="d in liveAsiDeltas" :key="d.ability">
                    <strong>{{ d.ability.toUpperCase() }}</strong>
                    {{ d.before }} → {{ d.after }}
                  </li>
                </ul>
                <div v-else>
                  <div v-if="!liveFeatName" class="lut-note">
                    Pick a feat to see what it does.
                  </div>
                  <template v-else>
                    <strong>{{ liveFeatName }}</strong>
                    <span v-if="featureDescriptions[liveFeatName]">
                      — {{ featureDescriptions[liveFeatName] }}</span
                    >
                  </template>
                </div>
              </div>
            </div>

            <div
              v-if="
                !pendingSubclassChoice &&
                !subclassChoiceDraft &&
                !pendingAsiChoice &&
                !asiChoiceLevel
              "
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
        <span v-if="levelCapExceeded" class="lut-note">
          Above the party level cap — check "ignore cap" above to confirm
          anyway.
        </span>
        <span v-else-if="!canConfirm" class="lut-note">
          Resolve the one-time choices above first.
        </span>
      </div>
    </template>
  </div>
</template>

<script>
import PendingCharacterSaveBar from './PendingCharacterSaveBar.vue'
import pendingCharacterSaves from '@/mixins/pendingCharacterSaves'
import { lookupFeature } from '@/utils/lookupService.js'

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
      hpMethod: 'roll',
      hpRolls: [],
      asiOrFeatResolutions: {},
      preview: null,
      loading: false,
      error: null,
      abilities: ABILITIES,

      // Local-only bypass for the party level cap — lets a level-up be
      // previewed past the cap for experimentation/lookahead without
      // touching the character record or campaign-wide DM Settings. Never
      // persisted; resets on reload same as everything else in this tool
      // before a Save.
      ignoreLevelCap: false,

      // All class names the engine knows about, fetched once — used to
      // offer "multiclass into a class this character doesn't have yet",
      // distinct from classOptions (which only lists classes already on
      // the character).
      allClasses: [],

      // name -> description string, populated as newFeatures resolve via
      // lookupFeature (async: local SRD/homebrew catalogs first, then the
      // traits API) — never cleared between previews, purely additive, so
      // re-visiting a level already looked up doesn't re-fetch.
      featureDescriptions: {},

      subclassChoiceDraft: null,
      availableSubclasses: [],
      // Sticky copy of pendingSubclassChoice.level — applying a choice makes
      // the real pendingSubclassChoice go null (diffLevelUp no longer sees
      // it as unresolved), which would otherwise make the choice card (and
      // the title on it) disappear the instant you pick something.
      subclassChoiceLevel: null,

      asiFeatMode: 'asi',
      asiSplit: 'one',
      asiAbility1: 'str',
      asiAbility2: 'dex',
      // Sticky copy of pendingAsiChoice.level — same reason as
      // subclassChoiceLevel above: resolving it makes pendingAsiChoice go
      // null, which would otherwise hide the card (and its outcome) right
      // when it becomes useful to actually look at.
      asiChoiceLevel: null,

      catalogFeats: [],
      featChoiceName: null,
      customFeatName: '',
      featAbilityChoice: null,
      // featName -> {met, reason, unknown} from POST /api/engine/feat-eligibility,
      // recomputed against draftCharacter whenever the preview runs.
      featEligibility: {},
      // DM override — prerequisites are enforced (the dropdown disables
      // infeasible feats) by default, but a real table sometimes has a
      // legitimate exception; this checkbox shows everything anyway.
      showAllFeats: false,
      // choice.id -> array of picked values, length === choice.count. Reset
      // whenever featChoiceName changes. The reserved key
      // __grantedSpellChoice holds the free-text pick for a feat's
      // grants_spells.choice (Fey Touched/Shadow Touched-style) — always a
      // single-element array, same shape as any other count:1 choice.
      featChoiceValues: {},

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
    // Classes the selected character does NOT already have — offered as
    // "multiclass into…" options. Empty (hiding that selector entirely)
    // until no character is picked or allClasses hasn't loaded yet.
    addableClasses() {
      if (!this.selectedCharacter) return []
      const existing = new Set(this.classOptions.map((c) => c.name))
      return this.allClasses.filter((c) => !existing.has(c.name))
    },
    currentLevel() {
      if (!this.selectedClassName) return null
      const c = this.classOptions.find(
        (cl) => cl.name === this.selectedClassName
      )
      // 0, not null, for a class not yet on the character — a genuine
      // multiclass pickup in progress, still worth showing the badge for.
      return c?.level ?? 0
    },
    targetLevel() {
      return this.currentLevel != null ? this.currentLevel + 1 : null
    },
    // A character's own level_cap_override (a rare, deliberate, saved
    // exception — e.g. a pair of characters held back to learn a new class)
    // wins over the campaign-wide DM Settings cap. Either can be absent
    // (null/undefined), meaning "no cap."
    effectiveLevelCap() {
      return (
        this.selectedCharacter?.level_cap_override ??
        this.$store.state.level_cap
      )
    },
    levelCapExceeded() {
      return (
        this.effectiveLevelCap != null &&
        this.targetLevel != null &&
        this.targetLevel > this.effectiveLevelCap &&
        !this.ignoreLevelCap
      )
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
    // Feature names the currently-selected subclass draft actually grants at
    // this level, straight from diffLevelUp's own subclassFeaturesGained
    // (already computed against draftCharacter.classes[].subclass by
    // applySubclassChoice below) — not just the whole newFeatures list, so a
    // base-class feature that happens to land on the same level doesn't get
    // shown here as if the subclass granted it.
    subclassFeaturesForChoice() {
      const groups = this.preview?.description?.subclassFeaturesGained ?? []
      return groups.flatMap((g) => g.names)
    },
    // The flavor blurb for whichever subclass is currently picked in the
    // dropdown (or highlighted before picking, via subclassChoiceDraft) —
    // available subclasses come straight from GET /api/engine/subclasses/
    // :className, which already includes each one's `description` field.
    subclassChoiceDescription() {
      const picked = this.availableSubclasses.find(
        (s) => s.name === this.subclassChoiceDraft
      )
      return picked?.description ?? null
    },
    // True for the 2026-09-02 stub-pass subclasses (engine/CHECKLIST.md
    // Phase 7) — only their first real subclass tier is built, so the
    // level-up preview shouldn't be presented as the complete picture.
    isSubclassChoiceStub() {
      const picked = this.availableSubclasses.find(
        (s) => s.name === this.subclassChoiceDraft
      )
      return !!picked?.stub
    },
    pendingAsiChoice() {
      return (
        this.preview?.pendingChoices?.find((p) => p.type === 'asiOrFeat') ??
        null
      )
    },
    // Live "what this gives you" for the ASI form — computed straight off
    // the current form selection, not waiting for Apply, so picking an
    // ability shows its effect immediately (matches the subclass card's
    // pick-and-see behavior). Reads off draftCharacter's current scores, so
    // it's this level's contribution specifically, not the cumulative
    // multi-level total.
    liveAsiDeltas() {
      if (!this.draftCharacter) return []
      const picks =
        this.asiSplit === 'one'
          ? [{ ability: this.asiAbility1, amount: 2 }]
          : [
              { ability: this.asiAbility1, amount: 1 },
              { ability: this.asiAbility2, amount: 1 },
            ]
      return picks
        .filter((p) => p.ability)
        .map((p) => {
          const before = this.draftCharacter[`stat_${p.ability}`] ?? 10
          return { ability: p.ability, before, after: before + p.amount }
        })
    },
    // Same idea for the Feat form: the name currently selected/typed,
    // whether or not Apply has been clicked yet.
    liveFeatName() {
      return this.featChoiceName === '__other'
        ? this.customFeatName.trim()
        : this.featChoiceName
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
        !this.pendingAsiChoice &&
        !this.levelCapExceeded
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
    selectedFeat() {
      return (
        this.catalogFeats.find((f) => f.name === this.featChoiceName) ?? null
      )
    },
    // The feat's own `choices` array, plus a synthesized entry for
    // grants_spells.choice (Fey Touched/Shadow Touched-style — "one 1st
    // level Divination or Enchantment spell") since that's a catalog-level
    // concept (feats.json), not itself one of the generic choice entries.
    selectedFeatChoices() {
      const feat = this.selectedFeat
      if (!feat) return []
      const choices = [...(feat.choices ?? [])]
      const grantChoice = feat.grants_spells?.choice
      if (grantChoice) {
        const schools = (grantChoice.schools ?? []).join(' or ')
        choices.push({
          id: '__grantedSpellChoice',
          label: `Level ${grantChoice.level} ${schools} spell (of your choice)`,
          type: 'spell_text',
          count: grantChoice.count ?? 1,
        })
      }
      return choices
    },
    // Every choice's every slot has a non-empty value.
    featChoicesComplete() {
      return this.selectedFeatChoices.every((c) => {
        const vals = this.featChoiceValues[c.id]
        return (
          Array.isArray(vals) &&
          vals.length >= c.count &&
          vals
            .slice(0, c.count)
            .every((v) => v != null && String(v).trim() !== '')
        )
      })
    },
    // Feats whose prerequisite is explicitly unmet get hidden unless
    // showAllFeats is on; anything with unknown/no eligibility data yet
    // stays visible (fails open, not closed, while the eligibility POST is
    // in flight).
    visibleCatalogFeats() {
      if (this.showAllFeats) return this.catalogFeats
      return this.catalogFeats.filter(
        (f) => this.featEligibility[f.name]?.met !== false
      )
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
    liveFeatName(name) {
      if (name) this.loadFeatureDescriptions([{ name }])
    },
    draftCharacter: {
      handler() {
        this.loadFeatEligibility()
      },
      deep: false,
    },
  },

  async created() {
    try {
      const res = await fetch('/api/engine/feats')
      if (res.ok) this.catalogFeats = await res.json()
    } catch {
      // Feat catalog is a nice-to-have for the picker — free text still works.
    }
    try {
      const res = await fetch('/api/engine/classes')
      if (res.ok) this.allClasses = await res.json()
    } catch {
      // Multiclass picker just won't offer anything if this fails — the
      // normal level-up flow still works fine without it.
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
      this.hpMethod = 'roll'
      this.hpRolls = []
      this.asiOrFeatResolutions = {}
      this.asiChoiceLevel = null
      this.subclassChoiceDraft = null
      this.subclassChoiceLevel = null
      this.availableSubclasses = []
      this.preview = null
      this.error = null
      this.featChoiceName = null
      this.customFeatName = ''
      this.featAbilityChoice = null
      this.featChoiceValues = {}
      // Deliberately NOT resetting saveError/justSaved here — pending saves
      // are tracked by comparing the store against `originals`, which
      // outlives switching to a different character/class in the picker
      // above.
    },

    // features: array of {name, id} (id optional) — id, when present, skips
    // straight to an exact catalog match instead of risking a same-named
    // collision (e.g. two subclasses both having a "Spellcasting" feature).
    async loadFeatureDescriptions(features) {
      for (const { name, id } of features ?? []) {
        if (name in this.featureDescriptions) continue
        // Placeholder so a second preview tick (e.g. re-rolling HP) doesn't
        // kick off a duplicate lookup while the first is still in flight.
        this.$set(this.featureDescriptions, name, null)
        const result = await lookupFeature(name, id)
        this.$set(this.featureDescriptions, name, result?.description ?? null)
      }
    },

    // POST draftCharacter to /api/engine/feat-eligibility — mirrors
    // preview-level-up's own "send the client's in-memory character, get a
    // pure computation back" pattern. Silently gives up (leaves
    // featEligibility as-is) on any failure, same fallback style as the
    // catalogFeats/allClasses fetches in created() — the picker still works
    // unfiltered if this fails, it just won't enforce prerequisites.
    async loadFeatEligibility() {
      if (!this.draftCharacter) return
      try {
        const res = await fetch('/api/engine/feat-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: this.draftCharacter }),
        })
        if (res.ok) this.featEligibility = await res.json()
      } catch {
        // Prerequisite filtering is a nice-to-have — free selection still works.
      }
    },

    prerequisiteLabel(prerequisite) {
      if (!prerequisite) return ''
      switch (prerequisite.type) {
        case 'ability_score':
          return `${prerequisite.ability.toUpperCase()} ${prerequisite.min}+`
        case 'any_of':
          return prerequisite.options
            .map((o) => `${o.ability.toUpperCase()} ${o.min}+`)
            .join(' or ')
        case 'race':
          return prerequisite.races.join(' or ')
        case 'spellcasting':
          return 'the ability to cast at least one spell'
        case 'proficiency':
          return `proficiency with ${prerequisite.proficiency.replace(
            '_',
            ' '
          )}`
        default:
          return ''
      }
    },

    // Reset the per-feat choice inputs to `count`-length empty arrays
    // whenever the picked feat changes — Vue 2 needs array indices to exist
    // before v-model can bind to them via [i].
    onFeatChoiceNameChange() {
      const values = {}
      for (const choice of this.selectedFeatChoices) {
        values[choice.id] = new Array(choice.count).fill(null)
      }
      this.featChoiceValues = values
      this.featAbilityChoice = null
      this.submitFeat()
    },

    // The subclass <select> only updates subclassChoiceDraft by itself —
    // diffLevelUp reads the choice off draftCharacter.classes[].subclass
    // (same field a saved character carries), not a separate request param,
    // so picking from the dropdown has to write it there and re-preview.
    // Without this, newFeatures/subclassFeaturesGained never reflect the
    // pick at all — the picker looks like it does nothing.
    applySubclassChoice() {
      if (!this.draftCharacter) return
      const exists = this.draftCharacter.classes.some(
        (c) => c.name === this.selectedClassName
      )
      // A multiclass pickup (className not yet on the character) has no
      // entry to write the subclass draft onto — add a level-0 placeholder
      // one. diffLevelUp.js still treats a level-0 entry as a fresh pickup
      // (see its isMulticlassPickup comment); this is the only way to hand
      // it a subclass choice made at level 1 (Cleric/Sorcerer/Warlock all
      // pick a subclass on their very first level).
      this.draftCharacter.classes = exists
        ? this.draftCharacter.classes.map((c) =>
            c.name === this.selectedClassName
              ? { ...c, subclass: this.subclassChoiceDraft }
              : c
          )
        : [
            ...this.draftCharacter.classes,
            {
              name: this.selectedClassName,
              level: 0,
              subclass: this.subclassChoiceDraft,
            },
          ]
      this.runPreview()
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
        const subclassChoice = data.pendingChoices?.find(
          (p) => p.type === 'subclassChoice'
        )
        if (subclassChoice) {
          this.subclassChoiceLevel = subclassChoice.level
          this.fetchSubclasses()
        }
        const asiChoice = data.pendingChoices?.find(
          (p) => p.type === 'asiOrFeat'
        )
        if (asiChoice) this.asiChoiceLevel = asiChoice.level
        this.loadFeatureDescriptions(
          data.newFeatures?.map((f) => ({ name: f.name, id: f.id }))
        )
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

    // Safety net for any error during ASI/feat resolution, not just the
    // known feat-ability-choice case above (already prevented at the
    // source) — clears whatever resolution just caused the error and
    // re-previews, so a bad or unexpected input never leaves the picker UI
    // permanently hidden behind a bare error message with no way back.
    dismissError() {
      this.error = null
      this.$delete(this.asiOrFeatResolutions, this.asiChoiceLevel)
      this.featChoiceName = null
      this.featAbilityChoice = null
      this.featChoiceValues = {}
      this.runPreview()
    },

    submitAsi() {
      // Use the sticky asiChoiceLevel, not pendingAsiChoice.level — once a
      // field auto-applies once, pendingAsiChoice goes null (diffLevelUp no
      // longer sees it as unresolved), so a SECOND field edit (e.g.
      // changing your mind on which ability) would read null.level and
      // throw if this read pendingAsiChoice directly.
      const increases =
        this.asiSplit === 'one'
          ? { [this.asiAbility1]: 2 }
          : { [this.asiAbility1]: 1, [this.asiAbility2]: 1 }
      this.$set(this.asiOrFeatResolutions, this.asiChoiceLevel, {
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
      // A feat needing a choice among multiple abilities (e.g. Fey Touched:
      // int/wis/cha) isn't resolved yet just by picking the feat name —
      // wait for that second pick before sending anything to the engine.
      // Submitting early used to send a guaranteed-incomplete resolution,
      // which the engine rejects — and that error used to hide the entire
      // level-up UI (including the ability picker needed to fix it) behind
      // a bare error message, a real dead end.
      if (
        this.selectedFeatAbilityChoices.length > 1 &&
        !this.featAbilityChoice
      ) {
        return
      }
      // Same deal for a feat with its own extra choices (Skilled's 3
      // skills/tools, Fey Touched's spell pick, Weapon Master's 4 weapons,
      // etc.) — don't submit a half-filled-in resolution.
      if (this.selectedFeatChoices.length && !this.featChoicesComplete) {
        return
      }
      const choices = {}
      for (const choice of this.selectedFeatChoices) {
        const vals = (this.featChoiceValues[choice.id] ?? []).slice(
          0,
          choice.count
        )
        choices[choice.id] = choice.count === 1 ? vals[0] : vals
      }
      this.$set(this.asiOrFeatResolutions, this.asiChoiceLevel, {
        type: 'feat',
        featName,
        abilityChoice: this.featAbilityChoice,
        choices: Object.keys(choices).length ? choices : null,
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

/* .lut-root is a fixed-height flex column with overflow-y: auto — without
   flex-shrink: 0 below, .lut-work's explicit min-height (5rem) overrides the
   browser's automatic "don't shrink below content" floor, so once content
   here gets taller than the space left in .lut-root (e.g. the subclass
   choice card once it actually has content — see .lut-choice-card--subclass)
   it gets squashed and overflows into the next sibling instead of making
   .lut-root scroll like it should. */
.lut-work {
  min-height: 5rem;
  flex-shrink: 0;
}

.lut-loading {
  color: var(--color-text-muted);
}

.lut-error {
  color: var(--color-text-danger);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
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

.lut-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--color-text-low);
  border-color: var(--color-border);
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

.lut-cap-warning {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  border: 1px solid var(--color-warning);
  border-radius: 4px;
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}

.lut-cap-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-low);
  cursor: pointer;
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

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: help;
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

.lut-choice-card--subclass {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.lut-subclass-picker {
  flex: 0 0 auto;
  min-width: 12rem;
}

.lut-subclass-summary {
  flex: 1 1 auto;
  min-width: 0;
  padding-left: 1.25rem;
  border-left: 1px dashed var(--color-border);
}

.lut-subclass-summary .lut-feature-list {
  margin: 0;
  padding-left: 1.1rem;
}

.lut-subclass-summary .lut-feature-list li {
  margin-bottom: 0.35rem;
  color: var(--color-text);
}

.lut-subclass-desc {
  margin: 0 0 0.6rem;
  font-style: italic;
  color: var(--color-text-secondary, var(--color-text));
}

.lut-stub-flag {
  font-style: normal;
  opacity: 0.75;
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

.lut-feat-choice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  width: 100%;
}

.lut-choice-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-right: 0.25rem;
}

.lut-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.lut-error-text {
  color: var(--color-text-warning);
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
