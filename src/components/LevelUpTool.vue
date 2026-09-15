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
        :value="multiclassDropdownValue"
        class="lut-select"
        @change="selectedClassName = $event.target.value || null"
      >
        <option value="">+ Multiclass into…</option>
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
          v-for="step in visibleSteps"
          :key="step.id"
          class="lut-step"
          :class="{ active: activeStep === step.index }"
          @click="activeStep = step.index"
        >
          {{ step.label }}
        </button>
      </div>

      <div class="lut-work">
        <!-- Only shows on the very first computation (no preview to keep
             displayed yet). Once a preview exists, re-runs (every spell/
             cantrip/invocation checkbox toggle calls runPreview) keep the
             existing tree mounted instead of tearing it down to this
             placeholder and back — that swap was destroying scroll position
             and any open picker state on every single click (real bug found
             2026-09-11, reported as "the view jumps around a lot" while
             picking spells). See the small "Updating…" badge below instead. -->
        <div v-if="loading && !preview" class="lut-loading">Computing…</div>
        <div v-else-if="error" class="lut-error">
          <div>{{ error }}</div>
          <button class="lut-btn" @click="dismissError">
            Dismiss — undo the last choice and go back
          </button>
        </div>

        <template v-else-if="preview">
          <div v-if="loading" class="lut-updating-badge">Updating…</div>
          <!-- ── Step 1: Hit Points ── -->
          <div v-if="activeStep === 0" class="lut-step-body">
            <div class="lut-step-title">
              Hit Die: d{{ preview.description.hitDie }}
            </div>
            <div class="lut-hp-controls">
              <button
                class="lut-btn"
                :class="{ active: hpMethod === 'roll' }"
                :disabled="isForcedMaxHp"
                @click="rollHp"
              >
                🎲 Roll
              </button>
              <button
                class="lut-btn"
                :class="{ active: hpMethod === 'average' }"
                :disabled="isForcedMaxHp"
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
                  :disabled="isForcedMaxHp"
                  @change="setManualRoll($event.target.value)"
                />
              </label>
            </div>
            <div v-if="isForcedMaxHp" class="lut-note">
              Level 1 always gets max hit die per RAW — these controls don't
              apply yet.
            </div>
            <div class="lut-hp-result">
              Hit-die gain: <strong>{{ hitDieGain }}</strong> ({{ hpMethod }}) +
              <strong>{{ conModPart }}</strong> CON mod =
              <strong>{{ hpGainTotal }}</strong> extra HP this level.
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
              <div
                v-if="pendingNewCantrips || pendingNewKnownSpells"
                class="lut-note lut-note--action"
              >
                Pick
                <span v-if="pendingNewCantrips"
                  >{{ pendingNewCantrips.count }} new cantrip{{
                    pendingNewCantrips.count === 1 ? '' : 's'
                  }}</span
                >
                <span v-if="pendingNewCantrips && pendingNewKnownSpells">
                  and</span
                >
                <span v-if="pendingNewKnownSpells"
                  >{{ pendingNewKnownSpells.count }} new spell{{
                    pendingNewKnownSpells.count === 1 ? '' : 's'
                  }}
                  known</span
                >
                — below.
              </div>
            </template>
          </div>

          <!-- ── Step 3: Feature ── -->
          <div v-else class="lut-step-body">
            <div
              v-if="
                preview.newFeatures.length === 0 &&
                newBonusSpellsThisLevel.length === 0 &&
                !destroyUndeadCrIncreaseThisLevel
              "
              class="lut-note"
            >
              No new features at this level.
            </div>
            <ul v-else class="lut-feature-list">
              <li v-for="f in preview.newFeatures" :key="f.name">
                <strong>{{ f.name }}</strong>
                <span v-if="featureDescriptions[f.name]">
                  — {{ featureDescriptions[f.name] }}</span
                >
              </li>
              <li v-if="newBonusSpellsThisLevel.length">
                Bonus spells gained: {{ newBonusSpellsThisLevel.join(', ') }}
              </li>
              <li v-if="destroyUndeadCrIncreaseThisLevel">
                Destroy Undead threshold rises to CR
                {{ destroyUndeadCrIncreaseThisLevel }}
              </li>
            </ul>
          </div>

          <!-- ── One-time choices (ASI/feat, subclass) — always visible on
               the Feature tab specifically, never behind a further toggle
               within it: these are required, not optional detail, and
               hiding them made it look like Confirm Level Up was broken.
               Scoped to activeStep===2 as of 2026-09-09 — previously this
               whole block (spell pickers included) rendered under every
               tab unconditionally, which is what put a subclass/feat picker
               under Hit Points and New Spells too. ── -->
          <div v-if="activeStep === 2" class="lut-onetime">
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
                <!-- The feature-name list used to be repeated here too
                     (subclassFeaturesForChoice), but it's a strict subset of
                     what the Feature tab's own newFeatures list already
                     shows once a subclass is picked — removed 2026-09-09
                     rather than shown twice. -->
              </div>
            </div>

            <!-- ── Multiclass skill proficiency (Bard/Ranger/Rogue pickup,
                 PHB "Multiclassing Proficiencies" table) ── -->
            <div
              v-if="pendingMulticlassSkillChoice || multiclassSkillDraft"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">Multiclass Skill Proficiency</div>
                <select
                  v-model="multiclassSkillDraft"
                  class="lut-select"
                  @change="runPreview"
                >
                  <option :value="null" disabled>Choose…</option>
                  <option
                    v-for="s in multiclassSkillOptions"
                    :key="s.id"
                    :value="s.id"
                  >
                    {{ s.name }} ({{ s.ability.toUpperCase() }})
                  </option>
                </select>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!multiclassSkillDraft" class="lut-note">
                  {{ selectedClassName }} grants proficiency in one skill of
                  your choice from its class list.
                </div>
                <div v-else>
                  Proficient in
                  <strong>{{
                    multiclassSkillOptions.find(
                      (s) => s.id === multiclassSkillDraft
                    )?.name
                  }}</strong>
                </div>
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
                <div class="lut-current-scores">
                  <span
                    v-for="a in currentAbilityScores"
                    :key="a.ability"
                    class="lut-current-score"
                    :title="abilityDescriptions[a.ability]"
                  >
                    {{ a.ability.toUpperCase() }} {{ a.score }} ({{
                      a.modLabel
                    }})
                  </span>
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
                  <div v-if="priorityAbilities.length" class="lut-note">
                    {{ selectedClassName }}'s most important abilities are
                    usually
                    <strong>{{
                      priorityAbilities
                        .map((a) => a.toUpperCase())
                        .join(' and ')
                    }}</strong>
                    — hover any ability below for what it governs.
                  </div>
                  <div class="lut-asi-pick-row">
                    <span class="lut-note-inline">+1</span>
                    <select
                      v-model="asiAbility1"
                      class="lut-select"
                      :title="abilityDescriptions[asiAbility1]"
                      @change="submitAsi"
                    >
                      <option
                        v-for="a in abilities"
                        :key="a"
                        :value="a"
                        :title="abilityDescriptions[a]"
                      >
                        {{ a.toUpperCase() }}
                      </option>
                    </select>
                  </div>
                  <div class="lut-asi-pick-row">
                    <span class="lut-note-inline">+1</span>
                    <select
                      v-model="asiAbility2"
                      class="lut-select"
                      :title="abilityDescriptions[asiAbility2]"
                      @change="submitAsi"
                    >
                      <option
                        v-for="a in abilities"
                        :key="a"
                        :value="a"
                        :title="abilityDescriptions[a]"
                      >
                        {{ a.toUpperCase() }}
                      </option>
                    </select>
                  </div>
                  <div class="lut-note-inline">
                    Pick the same ability twice for +2 to one ability, or two
                    different abilities for +1 each.
                  </div>
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

            <!-- ── Eldritch Invocations (Warlock) ── -->
            <div
              v-if="pendingInvocationChoice || invocationDraftPicks.length"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level
                  {{ pendingInvocationChoice?.level ?? invocationChoiceLevel }}
                  — Eldritch Invocations
                  <template v-if="pendingInvocationChoice">
                    (pick {{ pendingInvocationChoice.count }} more)</template
                  >
                </div>
                <label class="lut-checkbox-row">
                  <input type="checkbox" v-model="showAllInvocations" />
                  Show all invocations (ignore prerequisites)
                </label>
                <ul class="lut-pick-list">
                  <li v-for="inv in visibleInvocations" :key="inv.name">
                    <label
                      :class="{
                        'lut-pick-disabled':
                          !showAllInvocations &&
                          invocationEligibility[inv.name] &&
                          invocationEligibility[inv.name].met === false,
                      }"
                    >
                      <input
                        type="checkbox"
                        :checked="invocationDraftPicks.includes(inv.name)"
                        :disabled="
                          !invocationDraftPicks.includes(inv.name) &&
                          invocationDraftPicks.length >= invocationPickLimit
                        "
                        @change="
                          togglePick(
                            'invocationDraftPicks',
                            inv.name,
                            invocationPickLimit
                          )
                        "
                      />
                      {{ inv.name }}
                      <span
                        v-if="
                          invocationEligibility[inv.name] &&
                          invocationEligibility[inv.name].met === false
                        "
                        class="lut-error-text"
                      >
                        (prereq not met{{
                          invocationEligibility[inv.name].reason
                            ? ': ' + invocationEligibility[inv.name].reason
                            : ''
                        }})
                      </span>
                    </label>
                  </li>
                </ul>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!invocationDraftPicks.length" class="lut-note">
                  Pick invocations to see what they do.
                </div>
                <ul v-else class="lut-feature-list">
                  <li v-for="name in invocationDraftPicks" :key="name">
                    <strong>{{ name }}</strong>
                    <span v-if="featureDescriptions[name]">
                      — {{ featureDescriptions[name] }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>

            <!-- ── Pact Boon (Warlock, level 3, one-time) ── -->
            <div
              v-if="pendingPactBoonChoice || pactBoonDraft"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level
                  {{ pendingPactBoonChoice?.level ?? pactBoonChoiceLevel ?? 3 }}
                  — Pact Boon
                </div>
                <select
                  v-model="pactBoonDraft"
                  class="lut-select"
                  @change="runPreview"
                >
                  <option :value="null" disabled>Choose…</option>
                  <option
                    v-for="b in pactBoonCatalog"
                    :key="b.name"
                    :value="b.name"
                  >
                    {{ b.name }}
                  </option>
                </select>
              </div>
              <div v-if="pactBoonDraft" class="lut-subclass-summary">
                <strong>{{ pactBoonDraft }}</strong>
                <span v-if="featureDescriptions[pactBoonDraft]">
                  — {{ featureDescriptions[pactBoonDraft] }}</span
                >
              </div>
            </div>

            <!-- ── Fighting Style (Fighter 1st/Paladin 2nd/Ranger 2nd, one-time) ── -->
            <div
              v-if="pendingFightingStyleChoice || fightingStyleDraft"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level
                  {{
                    pendingFightingStyleChoice?.level ??
                    fightingStyleChoiceLevel
                  }}
                  — Fighting Style
                </div>
                <select
                  v-model="fightingStyleDraft"
                  class="lut-select"
                  @change="runPreview"
                >
                  <option :value="null" disabled>Choose…</option>
                  <option
                    v-for="o in fightingStyleOptions"
                    :key="o"
                    :value="o"
                    :title="featureDescriptions[`Fighting Style: ${o}`]"
                  >
                    {{ o }}
                  </option>
                </select>
              </div>
              <div v-if="fightingStyleDraft" class="lut-subclass-summary">
                <strong>{{ fightingStyleDraft }}</strong>
                <span
                  v-if="
                    featureDescriptions[`Fighting Style: ${fightingStyleDraft}`]
                  "
                >
                  —
                  {{
                    featureDescriptions[`Fighting Style: ${fightingStyleDraft}`]
                  }}</span
                >
              </div>
            </div>

            <div
              v-if="
                !pendingSubclassChoice &&
                !subclassChoiceDraft &&
                !pendingMulticlassSkillChoice &&
                !multiclassSkillDraft &&
                !pendingAsiChoice &&
                !asiChoiceLevel &&
                !pendingInvocationChoice &&
                !invocationDraftPicks.length &&
                !pendingPactBoonChoice &&
                !pactBoonDraft &&
                !pendingFightingStyleChoice &&
                !fightingStyleDraft
              "
              class="lut-note"
            >
              No one-time choices at this level.
            </div>
          </div>

          <!-- ── Spell-related one-time choices — always visible on the New
               Spells tab specifically (moved out of the old always-visible-
               under-every-tab layout 2026-09-09, which is what put a
               subclass/feat picker under Hit Points and New Spells and made
               Feature's own feature list look duplicated against these
               cards' own summaries). ── -->
          <div v-if="activeStep === 1" class="lut-onetime">
            <!-- ── Pact of the Tome's bonus cantrips ── -->
            <div
              v-if="pendingBonusSpellChoice || bonusCantripDraftPicks.length"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Pact of the Tome — 3 cantrips from ANY class's list
                  <template v-if="pendingBonusSpellChoice">
                    (pick {{ pendingBonusSpellChoice.count }} more)</template
                  >
                </div>
                <input
                  v-model="bonusCantripSearch"
                  class="lut-text-input"
                  placeholder="Search cantrips…"
                />
                <ul class="lut-pick-list">
                  <li v-for="o in filteredBonusCantripOptions" :key="o.name">
                    <label>
                      <input
                        type="checkbox"
                        :checked="bonusCantripDraftPicks.includes(o.name)"
                        :disabled="
                          !bonusCantripDraftPicks.includes(o.name) &&
                          bonusCantripDraftPicks.length >= bonusCantripPickLimit
                        "
                        @change="
                          togglePick(
                            'bonusCantripDraftPicks',
                            o.name,
                            bonusCantripPickLimit
                          )
                        "
                      />
                      {{ o.name }}
                      <span class="lut-note">({{ o.school }})</span>
                    </label>
                  </li>
                </ul>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!bonusCantripDraftPicks.length" class="lut-note">
                  Pick 3 cantrips from any class's spell list.
                </div>
                <ul v-else class="lut-feature-list">
                  <li v-for="n in bonusCantripDraftPicks" :key="n">
                    <strong>{{ n }}</strong>
                    <span v-if="spellDescriptions[n]">
                      — {{ spellDescriptions[n] }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>

            <!-- ── Generic new-cantrip picker (any spellcasting class) ── -->
            <div
              v-if="pendingNewCantrips || cantripDraftPicks.length"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level {{ pendingNewCantrips?.level ?? newCantripsLevel }} —
                  New Cantrips
                  <template v-if="pendingNewCantrips">
                    (pick {{ pendingNewCantrips.count }} more)</template
                  >
                </div>
                <input
                  v-model="cantripSearch"
                  class="lut-text-input"
                  placeholder="Search cantrips…"
                />
                <ul class="lut-pick-list">
                  <li v-for="o in filteredCantripOptions" :key="o.name">
                    <label>
                      <input
                        type="checkbox"
                        :checked="cantripDraftPicks.includes(o.name)"
                        :disabled="
                          !cantripDraftPicks.includes(o.name) &&
                          cantripDraftPicks.length >= cantripPickLimit
                        "
                        @change="
                          togglePick(
                            'cantripDraftPicks',
                            o.name,
                            cantripPickLimit
                          )
                        "
                      />
                      {{ o.name }}
                    </label>
                  </li>
                </ul>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!cantripDraftPicks.length" class="lut-note">
                  Pick cantrips to see the list.
                </div>
                <ul v-else class="lut-feature-list">
                  <li v-for="n in cantripDraftPicks" :key="n">
                    <strong>{{ n }}</strong>
                    <span v-if="spellDescriptions[n]">
                      — {{ spellDescriptions[n] }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>

            <!-- ── Generic new-known-spell picker (Bard/Sorcerer/Warlock/
                 Ranger/Eldritch Knight/Arcane Trickster) ── -->
            <div
              v-if="pendingNewKnownSpells || spellDraftPicks.length"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level
                  {{ pendingNewKnownSpells?.level ?? newKnownSpellsLevel }} —
                  New Spells Known
                  <template v-if="pendingNewKnownSpells">
                    (pick {{ pendingNewKnownSpells.count }} more)</template
                  >
                </div>
                <input
                  v-model="spellSearch"
                  class="lut-text-input"
                  placeholder="Search spells…"
                />
                <ul class="lut-pick-list">
                  <li v-for="o in filteredSpellOptions" :key="o.name">
                    <label>
                      <input
                        type="checkbox"
                        :checked="spellDraftPicks.includes(o.name)"
                        :disabled="
                          !spellDraftPicks.includes(o.name) &&
                          spellDraftPicks.length >= spellPickLimit
                        "
                        @change="
                          togglePick('spellDraftPicks', o.name, spellPickLimit)
                        "
                      />
                      {{ o.name }}
                      <span class="lut-note"
                        >(lvl {{ o.level
                        }}{{ o.school ? ', ' + o.school : '' }})</span
                      >
                    </label>
                  </li>
                </ul>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!spellDraftPicks.length" class="lut-note">
                  Pick spells to see the list.
                </div>
                <ul v-else class="lut-feature-list">
                  <li v-for="n in spellDraftPicks" :key="n">
                    <strong>{{ n }}</strong>
                    <span v-if="spellDescriptions[n]">
                      — {{ spellDescriptions[n] }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>

            <!-- ── Wizard spellbook growth (+2 spells/level, PHB) ── -->
            <div
              v-if="pendingSpellbookChoice || spellbookDraftPicks.length"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Level
                  {{ pendingSpellbookChoice?.level ?? spellbookChoiceLevel }} —
                  Add to Spellbook
                  <template v-if="pendingSpellbookChoice">
                    (pick {{ pendingSpellbookChoice.count }} more)</template
                  >
                </div>
                <input
                  v-model="spellbookSearch"
                  class="lut-text-input"
                  placeholder="Search spells…"
                />
                <ul class="lut-pick-list">
                  <li v-for="o in filteredSpellbookOptions" :key="o.name">
                    <label>
                      <input
                        type="checkbox"
                        :checked="spellbookDraftPicks.includes(o.name)"
                        :disabled="
                          !spellbookDraftPicks.includes(o.name) &&
                          spellbookDraftPicks.length >= spellbookPickLimit
                        "
                        @change="
                          togglePick(
                            'spellbookDraftPicks',
                            o.name,
                            spellbookPickLimit
                          )
                        "
                      />
                      {{ o.name }}
                      <span class="lut-note"
                        >(lvl {{ o.level
                        }}{{ o.school ? ', ' + o.school : '' }})</span
                      >
                    </label>
                  </li>
                </ul>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!spellbookDraftPicks.length" class="lut-note">
                  These go straight into your spellbook — you'll still need to
                  prepare them like any other Wizard spell before casting.
                </div>
                <ul v-else class="lut-feature-list">
                  <li v-for="n in spellbookDraftPicks" :key="n">
                    <strong>{{ n }}</strong>
                    <span v-if="spellDescriptions[n]">
                      — {{ spellDescriptions[n] }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>

            <!-- ── Optional known-spell swap (Bard/Sorcerer/Warlock/Ranger/
                 Eldritch Knight/Arcane Trickster) — never required, so it's
                 shown independent of the pendingChoices machinery above and
                 never blocks Confirm Level Up. ── -->
            <div
              v-if="canSwapKnownSpell && knownLeveledSpellNames.length"
              class="lut-choice-card lut-choice-card--subclass"
            >
              <div class="lut-subclass-picker">
                <div class="lut-choice-title">
                  Optional — Swap a Known Spell
                </div>
                <div class="lut-note">
                  You may replace one spell you know with another from the class
                  list, of a level you have slots for. Entirely optional — leave
                  this blank to skip it.
                </div>
                <select
                  class="lut-select"
                  :value="spellSwapFrom || ''"
                  @change="setSpellSwapFrom($event.target.value)"
                >
                  <option value="">— don't swap —</option>
                  <option
                    v-for="n in knownLeveledSpellNames"
                    :key="n"
                    :value="n"
                  >
                    Give up: {{ n }}
                  </option>
                </select>
                <template v-if="spellSwapFrom">
                  <input
                    v-model="spellSwapSearch"
                    class="lut-text-input"
                    placeholder="Search spells…"
                  />
                  <ul class="lut-pick-list">
                    <li v-for="o in filteredSpellSwapToOptions" :key="o.name">
                      <label>
                        <input
                          type="radio"
                          name="spellSwapTo"
                          :checked="spellSwapTo === o.name"
                          @change="setSpellSwapTo(o.name)"
                        />
                        {{ o.name }}
                        <span class="lut-note"
                          >(lvl {{ o.level
                          }}{{ o.school ? ', ' + o.school : '' }})</span
                        >
                      </label>
                    </li>
                  </ul>
                </template>
              </div>
              <div class="lut-subclass-summary">
                <div v-if="!spellSwapFrom" class="lut-note">
                  Not swapping anything this level.
                </div>
                <div v-else-if="!spellSwapTo" class="lut-note">
                  Giving up <strong>{{ spellSwapFrom }}</strong> — pick a
                  replacement.
                </div>
                <div v-else>
                  <strong>{{ spellSwapFrom }}</strong> →
                  <strong>{{ spellSwapTo }}</strong>
                  <span v-if="spellDescriptions[spellSwapTo]">
                    — {{ spellDescriptions[spellSwapTo] }}</span
                  >
                </div>
              </div>
            </div>

            <div
              v-if="
                !pendingBonusSpellChoice &&
                !bonusCantripDraftPicks.length &&
                !pendingNewCantrips &&
                !cantripDraftPicks.length &&
                !pendingNewKnownSpells &&
                !spellDraftPicks.length &&
                !pendingSpellbookChoice &&
                !spellbookDraftPicks.length &&
                !(canSwapKnownSpell && knownLeveledSpellNames.length)
              "
              class="lut-note"
            >
              No new spell choices at this level.
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
import { lookupFeature, lookupSpell } from '@/utils/lookupService.js'
import { getBonusSpellsAtLevel } from '@/utils/spellUtils.js'
import { dnd, ABILITY_DESCRIPTIONS } from '@/utils/dnd_utils.js'

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

// Client-side search-as-you-type over an already-fetched option list — the
// real eligibility filtering (class-list membership, max spell level,
// already-known exclusion) all happened server-side in
// POST /api/engine/spell-choices; this is just a convenience narrow-down for
// a long list (Sorcerer/Cleric-sized spell lists), not enforcement.
function filterSpellOptions(options, search) {
  const q = search.trim().toLowerCase()
  if (!q) return options
  return options.filter((o) => o.name.toLowerCase().includes(q))
}

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
      // Same idea, for spells — every picker that lets you choose a spell
      // (cantrips, known spells, Pact of the Tome's bonus cantrips,
      // spellbook additions, the swap's "to" pick) shares this one cache
      // instead of each re-fetching. Populated via loadSpellDescriptions,
      // which calls lookupSpell (same local-cache-then-API resolution
      // lookupFeature uses, just for spells).
      spellDescriptions: {},

      subclassChoiceDraft: null,
      availableSubclasses: [],
      // Sticky copy of pendingSubclassChoice.level — applying a choice makes
      // the real pendingSubclassChoice go null (diffLevelUp no longer sees
      // it as unresolved), which would otherwise make the choice card (and
      // the title on it) disappear the instant you pick something.
      subclassChoiceLevel: null,

      asiFeatMode: 'asi',
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

      // ── Eldritch Invocations (Warlock) ──
      invocationCatalog: [], // GET /api/engine/invocations, fetched once
      // invocationName -> {met, reason, unknown} from POST
      // /api/engine/invocation-eligibility, recomputed against
      // draftCharacter whenever the preview runs — same pattern as
      // featEligibility above.
      invocationEligibility: {},
      showAllInvocations: false, // same DM-override spirit as showAllFeats
      invocationDraftPicks: [], // names picked THIS level-up, capped at the pendingChoice's count
      invocationChoiceLevel: null, // sticky copy, same reason asiChoiceLevel/subclassChoiceLevel are sticky

      // ── Pact Boon (Warlock, level 3, one-time) ──
      pactBoonCatalog: [], // GET /api/engine/pact-boons, fetched once (only 3, no prerequisites to filter)
      pactBoonDraft: null,
      pactBoonChoiceLevel: null,

      // ── Fighting Style (Fighter 1st/Paladin 2nd/Ranger 2nd, one-time) ──
      // Options come straight off the pendingChoice itself (diffLevelUp
      // already resolves the right per-class list), no separate catalog
      // fetch needed the way Pact Boon's does — but they DO need caching
      // into their own sticky array the same way pactBoonCatalog is, since
      // pendingFightingStyleChoice itself goes null the instant a choice is
      // made (the whole point of it being a pendingChoice), which would
      // otherwise empty the <select>'s own option list out from under the
      // just-picked value.
      fightingStyleOptions: [],
      fightingStyleDraft: null,
      fightingStyleChoiceLevel: null,

      // ── Pact of the Tome's bonus cantrips (3, any class list) ──
      bonusCantripOptions: [], // fetched from POST /api/engine/spell-choices with pool:'any'
      bonusCantripSearch: '',
      bonusCantripDraftPicks: [],
      bonusSpellChoiceLevel: null,

      // ── Generic known-cantrip picker (any spellcasting class) ──
      cantripOptions: [], // fetched from POST /api/engine/spell-choices
      cantripSearch: '',
      cantripDraftPicks: [],
      newCantripsLevel: null,

      // ── Generic known-spell picker (Bard/Sorcerer/Warlock/Ranger/EK/AT) ──
      spellOptions: [], // fetched from POST /api/engine/spell-choices
      spellSearch: '',
      spellDraftPicks: [],
      newKnownSpellsLevel: null,

      // ── Optional known-spell swap (Bard/Sorcerer/Warlock/Ranger/EK/AT) ──
      // PHB: "you can choose one of the spells you know and replace it with
      // another" — every level, fully optional, never a pendingChoice (see
      // diffLevelUp.js). spellSwapFrom stays null until the player opts in.
      spellSwapFrom: null,
      spellSwapTo: null,
      spellSwapToOptions: [], // fetched from POST /api/engine/spell-choices
      spellSwapSearch: '',

      // ── Wizard spellbook growth (+2 spells/level, PHB) ──
      spellbookOptions: [], // fetched from POST /api/engine/spell-choices
      spellbookSearch: '',
      spellbookDraftPicks: [],
      spellbookChoiceLevel: null,

      // ── Multiclass skill proficiency (Bard/Ranger/Rogue pickup) ──
      skillsCatalog: [], // GET /api/engine/skills, fetched once
      multiclassSkillDraft: null,
      multiclassSkillChoiceLevel: null,

      // savingName/saveError/justSaved come from the pendingCharacterSaves mixin.
      // Tab row itself now renders from the `visibleSteps` computed (filters
      // out an empty New Spells/Feature tab) — see that computed's comment.
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
    // The "+ Multiclass into…" dropdown shares selectedClassName with the
    // existing-classes dropdown above it (both write to the same field —
    // whichever was used last wins), but the two aren't always in sync: a
    // freshly-selected character defaults selectedClassName to their FIRST
    // existing class, which is never one of THIS dropdown's own options
    // (addableClasses only lists classes the character doesn't have yet).
    // A plain v-model there left a real, confirmed bug — a native <select>
    // whose bound value matches none of its <option>s renders fully blank,
    // no placeholder text either, not just "unselected" — so this computed
    // only shows selectedClassName here when it's ACTUALLY one of this
    // dropdown's own choices, falling back to '' (the placeholder) the
    // rest of the time.
    multiclassDropdownValue() {
      return this.addableClasses.some((c) => c.name === this.selectedClassName)
        ? this.selectedClassName
        : ''
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
    // True when this level's HP is forced to the max hit die regardless of
    // hpMethod — the "1st level ever" RAW rule (see levelUp.js's forceMax).
    // The Roll/Average controls are real but inert at that level: clicking
    // them re-previews with a different hpMethod, but hpGainForLevel ignores
    // it entirely and returns max anyway.
    isForcedMaxHp() {
      return this.preview?.description?.hp?.[0]?.method === 'max'
    },
    // The real total HP gained this level, reading straight off the actual
    // before/after patch rather than re-deriving it — automatically correct
    // even when this same level's ASI bumped CON (diffLevelUp.js applies
    // ability increases before computing the CON modifier HP uses, so
    // reading draftCharacter.stat_con directly here could be stale).
    hpGainTotal() {
      if (!this.preview?.patch || !this.draftCharacter) return null
      return this.preview.patch.hp_max - (this.draftCharacter.hp_max || 0)
    },
    // The CON-modifier's actual contribution, backed out of the real total
    // above rather than shown as a bare unlabeled "+ CON mod" phrase.
    conModPart() {
      if (this.hpGainTotal == null || this.hitDieGain == null) return null
      return this.hpGainTotal - this.hitDieGain
    },
    pendingSubclassChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'subclassChoice'
        ) ?? null
      )
    },
    // The subclass currently in effect for the class being leveled — a
    // draft pick just made this level, or whatever's already on the
    // character. Backs both the bonus-spells description override below and
    // the "gained at this level" section for levels (5th/9th/13th/17th)
    // where expanded_spell_list unlocks more spells WITHOUT a matching
    // feature being re-granted.
    abilityDescriptions() {
      return ABILITY_DESCRIPTIONS
    },
    // Current scores, shown alongside the ASI/feat picker so a player isn't
    // guessing from memory which abilities are already high vs. worth
    // raising (or which feat prerequisites they clear) — requested
    // 2026-09-11.
    currentAbilityScores() {
      if (!this.draftCharacter) return []
      return this.abilities.map((a) => {
        const score = this.draftCharacter[`stat_${a}`] ?? 10
        return { ability: a, score, modLabel: dnd.signed(dnd.mod(score)) }
      })
    },
    priorityAbilities() {
      const classData = this.allClasses.find(
        (c) => c.name === this.selectedClassName
      )
      return dnd.priorityAbilitiesForClass(classData)
    },
    currentSubclassData() {
      const subclassName =
        this.subclassChoiceDraft ||
        this.draftCharacter?.classes?.find(
          (c) => c.name === this.selectedClassName
        )?.subclass
      if (!subclassName) return null
      return (
        (this.$store.state.subclasses || []).find(
          (s) =>
            s.class?.toLowerCase() === this.selectedClassName?.toLowerCase() &&
            s.name?.toLowerCase() === subclassName.toLowerCase()
        ) ?? null
      )
    },
    // Spells a subclass's bonus-spell field (expanded_spell_list,
    // domain_spells_by_level, oath_spells_by_level, circle_spells_by_level,
    // psionic_spells_by_level, clockwork_spells_by_level — see
    // spellUtils.js's BONUS_SPELL_FIELDS) unlocks at the level being
    // previewed, e.g. Scorching Ray/Shatter at Artillerist's 5th level, or
    // Beacon of Hope/Revivify at a Life Domain Cleric's 5th level — none of
    // these levels re-grant a named feature (Artificer's "Bonus Spells" is
    // only ever granted once, at whichever level the subclass first gets
    // it; the other 5 fields never grant a named feature for this AT ALL,
    // every breakpoint included), so without this the tool would show
    // nothing at all about them. Suppressed specifically for Artificer when
    // its "Bonus Spells" feature IS newly granted this level (its own
    // description in featureDescriptions already covers the same spells —
    // see bonusSpellsDescriptionAtLevel — so this would just duplicate it);
    // no other class has a matching named feature to duplicate.
    newBonusSpellsThisLevel() {
      if (this.targetLevel == null || !this.currentSubclassData) return []
      if (
        this.selectedClassName?.toLowerCase() === 'artificer' &&
        this.preview?.newFeatures?.some((f) => /bonus spells/i.test(f.name))
      )
        return []
      return getBonusSpellsAtLevel(
        this.currentSubclassData,
        this.selectedClassName,
        this.targetLevel
      )
    },
    // Same "later breakpoints get no display at all" gap as
    // newBonusSpellsThisLevel above, for Cleric's Destroy Undead (CR
    // threshold rises at 8th/11th/14th/17th with no feature re-granted).
    // Suppressed on the level Destroy Undead is first granted (5th) since
    // destroyUndeadDescriptionAtLevel already covers that in the tooltip.
    destroyUndeadCrIncreaseThisLevel() {
      if (this.targetLevel == null) return null
      if (
        this.preview?.newFeatures?.some((f) => /destroy undead/i.test(f.name))
      )
        return null
      const table = this.allClasses.find(
        (c) => c.name === this.selectedClassName
      )?.destroy_undead_cr_by_level
      const cr = table?.[String(this.targetLevel)]
      return cr == null ? null : this.formatCr(cr)
    },
    // TODO.md polish pass (2026-09-10): whether the New Spells / Feature tabs
    // have anything to show at the current class/level, so an empty one can
    // be hidden from the tab row entirely rather than showing a bare "no
    // changes" note. Hit Points is never hidden — every level grants HP.
    // Both default to true while `preview` hasn't loaded yet, so tabs don't
    // flicker in and out during a fetch.
    newSpellsTabHasContent() {
      if (!this.preview) return true
      return !!this.preview.description?.spellcasting
    },
    featureTabHasContent() {
      if (!this.preview) return true
      const hasListedContent =
        this.preview.newFeatures.length > 0 ||
        this.newBonusSpellsThisLevel.length > 0 ||
        !!this.destroyUndeadCrIncreaseThisLevel
      // Every one-time choice card that renders under the Feature tab's own
      // `lut-onetime` block (activeStep === 2) — see that block's own
      // comment for why it's scoped here and not shared with New Spells.
      const hasPendingChoice =
        !!this.pendingSubclassChoice ||
        !!this.subclassChoiceDraft ||
        !!this.pendingMulticlassSkillChoice ||
        !!this.multiclassSkillDraft ||
        !!this.pendingAsiChoice ||
        !!this.asiChoiceLevel ||
        !!this.pendingInvocationChoice ||
        this.invocationDraftPicks.length > 0 ||
        !!this.pendingPactBoonChoice ||
        !!this.pactBoonDraft ||
        !!this.pendingFightingStyleChoice ||
        !!this.fightingStyleDraft
      return hasListedContent || hasPendingChoice
    },
    // Replaces the old fixed `steps` data array as the tab row's actual
    // render source — filters out an empty New Spells/Feature tab and
    // renumbers the circled digits so they stay sequential (①② instead of
    // ①③ with a gap). Each entry keeps its real `index` (0/1/2, matching
    // activeStep's fixed meaning throughout the rest of this component) so
    // hiding a tab never touches the body's own activeStep === N branches.
    visibleSteps() {
      const CIRCLED = ['①', '②', '③']
      const base = [
        { id: 'hp', label: 'Hit Points', index: 0, visible: true },
        {
          id: 'spells',
          label: 'New Spells',
          index: 1,
          visible: this.newSpellsTabHasContent,
        },
        {
          id: 'feature',
          label: 'Feature',
          index: 2,
          visible: this.featureTabHasContent,
        },
      ]
      return base
        .filter((s) => s.visible)
        .map((s, i) => ({ ...s, label: `${CIRCLED[i]} ${s.label}` }))
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
      // Two independent +1 picks, merged by ability so picking the same one
      // twice correctly shows as a single +2 entry rather than two
      // conflicting +1 entries both computed off the same "before" value —
      // real bug found 2026-09-09, see submitAsi's own note for the
      // matching engine-side half of this fix.
      const amounts = {}
      for (const ability of [this.asiAbility1, this.asiAbility2]) {
        if (!ability) continue
        amounts[ability] = (amounts[ability] ?? 0) + 1
      }
      return Object.entries(amounts).map(([ability, amount]) => {
        const before = this.draftCharacter[`stat_${ability}`] ?? 10
        // Capped at 20 to match asiFeat.js's real SCORE_CAP — otherwise
        // this live preview could show an impossible "19 → 21" while the
        // actual submitted resolution (computed server-side) already caps
        // correctly and explains the cap via a warning after the fact.
        return { ability, before, after: Math.min(20, before + amount) }
      })
    },
    // Same idea for the Feat form: the name currently selected/typed,
    // whether or not Apply has been clicked yet.
    liveFeatName() {
      return this.featChoiceName === '__other'
        ? this.customFeatName.trim()
        : this.featChoiceName
    },
    pendingNewKnownSpells() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'newKnownSpells'
        ) ?? null
      )
    },
    pendingNewCantrips() {
      return (
        this.preview?.pendingChoices?.find((p) => p.type === 'newCantrips') ??
        null
      )
    },
    pendingInvocationChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'invocationChoice'
        ) ?? null
      )
    },
    pendingPactBoonChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'pactBoonChoice'
        ) ?? null
      )
    },
    pendingFightingStyleChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'fightingStyleChoice'
        ) ?? null
      )
    },
    pendingBonusSpellChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'bonusSpellChoice'
        ) ?? null
      )
    },
    pendingSpellbookChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'spellbookAdditions'
        ) ?? null
      )
    },
    pendingMulticlassSkillChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'multiclassSkillChoice'
        ) ?? null
      )
    },
    // This class's real skill options for the multiclass grant (Bard/
    // Ranger/Rogue) — same skill_choices.options data
    // (engine/data/classes/<class>.json, via allClasses) the New Character
    // tool's own class-skill picker reads, filtered down to actual
    // {id, name, ability} records from the skills catalog. 'any' (Bard)
    // means every real skill is a valid pick.
    multiclassSkillOptions() {
      const classData = this.allClasses.find(
        (c) => c.name === this.selectedClassName
      )
      const options = classData?.skill_choices?.options
      if (!options) return []
      return options === 'any'
        ? this.skillsCatalog
        : this.skillsCatalog.filter((s) => options.includes(s.id))
    },
    // The optional PHB spell-swap clause is only real for known-style
    // casters (spellsKnownForClass covers Bard/Sorcerer/Warlock/Ranger/
    // Eldritch Knight/Arcane Trickster) — a prepared caster like Wizard or
    // Cleric doesn't get it at all, so the card shouldn't even offer it.
    canSwapKnownSpell() {
      return this.preview?.description?.spellcasting?.style === 'known'
    },
    // The "give up" side of the swap — this class's currently known leveled
    // spells (cantrips aren't swappable under this clause). Reads off
    // draftCharacter so it reflects any pick already made this level (e.g. a
    // just-chosen new known spell isn't swappable away the same level, but
    // that's an edge case not worth special-casing).
    knownLeveledSpellNames() {
      return (this.draftCharacter?.spells ?? [])
        .filter((s) => s.level > 0)
        .map((s) => s.name)
    },
    // The subclass of whichever class is currently being leveled — third
    // casters (Eldritch Knight/Arcane Trickster) need this to resolve which
    // spell LIST to draw from (Wizard's, not their own), and the spell-
    // choices endpoint needs it to compute the right slot progression too.
    currentSubclassName() {
      const c = this.draftCharacter?.classes?.find(
        (cl) => cl.name === this.selectedClassName
      )
      return c?.subclass ?? null
    },
    // Invocations already known from a PRIOR level — excluded unconditionally,
    // even under showAllInvocations: unlike feats, no cataloged invocation can
    // be taken twice (real bug found 2026-09-11, the picker let you select
    // the same invocation again). Doesn't touch invocationDraftPicks (this
    // level-up's own in-progress picks) — those must stay visible/checked so
    // a pick can still be unchecked.
    knownInvocationNames() {
      return new Set(
        (this.draftCharacter?.features ?? [])
          .filter((f) => f.type === 'invocation')
          .map((f) => f.name)
      )
    },
    // Invocations whose prerequisite is explicitly unmet get hidden unless
    // showAllInvocations is on — same "fail open while eligibility data is
    // still loading" behavior as visibleCatalogFeats.
    visibleInvocations() {
      const notAlreadyKnown = (i) => !this.knownInvocationNames.has(i.name)
      if (this.showAllInvocations)
        return this.invocationCatalog.filter(notAlreadyKnown)
      return this.invocationCatalog.filter(
        (i) =>
          notAlreadyKnown(i) &&
          this.invocationEligibility[i.name]?.met !== false
      )
    },
    filteredCantripOptions() {
      return filterSpellOptions(this.cantripOptions, this.cantripSearch)
    },
    filteredSpellOptions() {
      return filterSpellOptions(this.spellOptions, this.spellSearch)
    },
    filteredBonusCantripOptions() {
      return filterSpellOptions(
        this.bonusCantripOptions,
        this.bonusCantripSearch
      )
    },
    filteredSpellbookOptions() {
      return filterSpellOptions(this.spellbookOptions, this.spellbookSearch)
    },
    filteredSpellSwapToOptions() {
      return filterSpellOptions(this.spellSwapToOptions, this.spellSwapSearch)
    },
    // Total picks allowed THIS level-up = however many are still owed
    // (server-computed, accounts for the character's existing count) plus
    // however many are already sitting in the draft array — self-consistent
    // whether the pendingChoice is still open or has just resolved to null
    // because the draft already covers it (same reasoning as the sticky
    // *ChoiceLevel fields elsewhere in this component).
    invocationPickLimit() {
      return (
        (this.pendingInvocationChoice?.count ?? 0) +
        this.invocationDraftPicks.length
      )
    },
    cantripPickLimit() {
      return (
        (this.pendingNewCantrips?.count ?? 0) + this.cantripDraftPicks.length
      )
    },
    spellPickLimit() {
      return (
        (this.pendingNewKnownSpells?.count ?? 0) + this.spellDraftPicks.length
      )
    },
    bonusCantripPickLimit() {
      return (
        (this.pendingBonusSpellChoice?.count ?? 0) +
        this.bonusCantripDraftPicks.length
      )
    },
    spellbookPickLimit() {
      return (
        (this.pendingSpellbookChoice?.count ?? 0) +
        this.spellbookDraftPicks.length
      )
    },
    canConfirm() {
      return (
        Boolean(this.preview?.patch) &&
        !this.pendingSubclassChoice &&
        !this.pendingAsiChoice &&
        !this.pendingInvocationChoice &&
        !this.pendingPactBoonChoice &&
        !this.pendingBonusSpellChoice &&
        !this.pendingNewCantrips &&
        !this.pendingNewKnownSpells &&
        !this.pendingSpellbookChoice &&
        !this.pendingMulticlassSkillChoice &&
        !this.pendingFightingStyleChoice &&
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
    '$store.state.levelUpNavRequest': {
      immediate: true,
      handler(req) {
        if (!req) return
        this.selectedCharacterName = req.name
        this.$store.commit('CLEAR_LEVEL_UP_NAV')
      },
    },
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
    invocationDraftPicks(names) {
      this.loadFeatureDescriptions(
        names.map((n) => ({
          name: n,
          id: this.invocationCatalog.find((i) => i.name === n)?.id,
        }))
      )
    },
    pactBoonDraft(name) {
      if (!name) return
      const boon = this.pactBoonCatalog.find((b) => b.name === name)
      this.loadFeatureDescriptions([{ name, id: boon?.id }])
    },
    fightingStyleDraft(name) {
      if (!name) return
      // No id available client-side (options come straight off the
      // pendingChoice, no separate catalog fetch) — safe to fuzzy-match on
      // name alone since every class's version of a given style shares
      // identical real mechanical text.
      this.loadFeatureDescriptions([{ name: `Fighting Style: ${name}` }])
    },
    // Every spell-picking draft array shares loadSpellDescriptions (its own
    // cache, spellDescriptions — see the data() comment) so each picker's
    // summary panel can show what a pick actually does instead of a bare
    // name, matching the feat/invocation/pact-boon cards' existing
    // pick-and-see behavior.
    cantripDraftPicks(names) {
      this.loadSpellDescriptions(names)
    },
    spellDraftPicks(names) {
      this.loadSpellDescriptions(names)
    },
    bonusCantripDraftPicks(names) {
      this.loadSpellDescriptions(names)
    },
    spellbookDraftPicks(names) {
      this.loadSpellDescriptions(names)
    },
    spellSwapTo(name) {
      if (name) this.loadSpellDescriptions([name])
    },
    draftCharacter: {
      handler() {
        this.loadFeatEligibility()
        this.loadInvocationEligibility()
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
    try {
      const res = await fetch('/api/engine/invocations')
      if (res.ok) this.invocationCatalog = await res.json()
    } catch {
      // Invocation picker just won't offer anything if this fails.
    }
    try {
      const res = await fetch('/api/engine/pact-boons')
      if (res.ok) this.pactBoonCatalog = await res.json()
    } catch {
      // Pact Boon picker just won't offer anything if this fails.
    }
    try {
      const res = await fetch('/api/engine/skills')
      if (res.ok) this.skillsCatalog = await res.json()
    } catch {
      // Multiclass skill picker just won't offer anything if this fails.
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
      this.invocationDraftPicks = []
      this.invocationChoiceLevel = null
      this.showAllInvocations = false
      this.pactBoonDraft = null
      this.pactBoonChoiceLevel = null
      this.fightingStyleOptions = []
      this.fightingStyleDraft = null
      this.fightingStyleChoiceLevel = null
      this.bonusCantripOptions = []
      this.bonusCantripSearch = ''
      this.bonusCantripDraftPicks = []
      this.bonusSpellChoiceLevel = null
      this.cantripOptions = []
      this.cantripSearch = ''
      this.cantripDraftPicks = []
      this.newCantripsLevel = null
      this.spellOptions = []
      this.spellSearch = ''
      this.spellDraftPicks = []
      this.newKnownSpellsLevel = null
      this.spellSwapFrom = null
      this.spellSwapTo = null
      this.spellSwapToOptions = []
      this.spellSwapSearch = ''
      this.spellbookOptions = []
      this.spellbookSearch = ''
      this.spellbookDraftPicks = []
      this.spellbookChoiceLevel = null
      this.multiclassSkillDraft = null
      this.multiclassSkillChoiceLevel = null
      // Deliberately NOT resetting saveError/justSaved here — pending saves
      // are tracked by comparing the store against `originals`, which
      // outlives switching to a different character/class in the picker
      // above.
    },

    // A "Bonus Spells"-style subclass feature (Artillerist Bonus Spells,
    // Arbalist Bonus Spells, etc.) bakes its ENTIRE multi-level table into
    // one static catalog description (e.g. "3rd level: Shield, Thunderwave.
    // 5th level: Scorching Ray, Shatter. 9th level: ..."), so showing it
    // verbatim at the level it's granted spoils/confuses with breakpoints
    // the character hasn't reached yet. The subclass's own
    // expanded_spell_list (engine/rules/subclasses.js, loaded app-wide into
    // store.state.subclasses — same source spellUtils.js's getBonusSpells
    // uses) already has this broken out by exact grant level, so synthesize
    // "what's new at THIS level" from that instead of the static blob.
    // Returns null for any feature that isn't this pattern, falling through
    // to the normal catalog lookup.
    bonusSpellsDescriptionAtLevel(name, level) {
      if (!/bonus spells/i.test(name)) return null
      const spells =
        this.currentSubclassData?.expanded_spell_list?.[String(level)]
      if (!spells?.length) return null
      return `New at level ${level}: ${spells.join(
        ', '
      )} — always prepared, doesn't count against your spells-prepared limit. (Bonus spells from earlier levels remain prepared too.)`
    },

    // "1/2" reads right for a CR; anything else is already a plain integer.
    formatCr(cr) {
      return cr === 0.5 ? '1/2' : String(cr)
    },

    // Destroy Undead (Cleric) has the exact same flat-blob problem as Bonus
    // Spells — one static description listing every CR breakpoint (5th/8th/
    // 11th/14th/17th) — but it's a CR threshold, not a spell list, so it
    // reads off cleric.json's own destroy_undead_cr_by_level (already
    // present in the class data, just never consumed by anything until now)
    // instead of a subclass's expanded_spell_list.
    destroyUndeadDescriptionAtLevel(name, level) {
      if (!/destroy undead/i.test(name)) return null
      const table = this.allClasses.find(
        (c) => c.name === this.selectedClassName
      )?.destroy_undead_cr_by_level
      const cr = table?.[String(level)]
      if (cr == null) return null
      return `Undead that fail their save against your Turn Undead are destroyed if their challenge rating is CR ${this.formatCr(
        cr
      )} or lower.`
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
        const override =
          this.bonusSpellsDescriptionAtLevel(name, this.targetLevel) ||
          this.destroyUndeadDescriptionAtLevel(name, this.targetLevel)
        if (override) {
          this.$set(this.featureDescriptions, name, override)
          continue
        }
        const result = await lookupFeature(name, id)
        this.$set(this.featureDescriptions, name, result?.description ?? null)
      }
    },

    // Same shape as loadFeatureDescriptions above, for the shared
    // spellDescriptions cache every spell-picking card reads from.
    async loadSpellDescriptions(names) {
      for (const name of names ?? []) {
        if (name in this.spellDescriptions) continue
        this.$set(this.spellDescriptions, name, null)
        const result = await lookupSpell(name)
        this.$set(this.spellDescriptions, name, result?.description ?? null)
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

    // Same pattern as loadFeatEligibility above, just against the
    // invocation catalog instead.
    async loadInvocationEligibility() {
      if (!this.draftCharacter || !this.selectedClassName) return
      try {
        // Eligibility has to be evaluated as though THIS level-up has
        // already happened, not against the character's currently-saved
        // level — a level-gated invocation (Mire the Mind: "5th level")
        // needs to show as available WHILE picking level 5's invocations,
        // not only after Confirm Level Up has already been clicked and
        // reloaded the draft. draftCharacter itself isn't mutated until
        // Confirm (see confirmLevelUp), so this builds a one-off projected
        // copy just for the eligibility check — patch.classes from the real
        // preview does the equivalent thing permanently once confirmed.
        const projected = {
          ...this.draftCharacter,
          classes: (this.draftCharacter.classes || []).map((c) =>
            c.name === this.selectedClassName
              ? { ...c, level: this.targetLevel }
              : c
          ),
        }
        const res = await fetch('/api/engine/invocation-eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: projected }),
        })
        if (res.ok) this.invocationEligibility = await res.json()
      } catch {
        // Prerequisite filtering is a nice-to-have — free selection still works.
      }
    },

    // Shared toggle for every checkbox-list picker in this component
    // (invocations, cantrips, known spells, Pact of the Tome's bonus
    // cantrips) — `listName` is the data property holding the draft array.
    // Capped at `limit`; re-previews immediately so the reference panels
    // (and the running "still needed" counts) reflect the pick right away,
    // same pick-and-see behavior as the subclass/ASI pickers.
    togglePick(listName, name, limit) {
      const list = this[listName]
      const i = list.indexOf(name)
      if (i !== -1) {
        list.splice(i, 1)
      } else if (list.length < limit) {
        list.push(name)
      }
      this.runPreview()
    },

    // Powers the 3 spell-eligible pickers (cantrips, known spells, Pact of
    // the Tome bonus cantrips) — all POST the same /api/engine/spell-choices
    // route, just with different cantripsOnly/pool flags. The real
    // eligibility computation (class-list membership, max selectable spell
    // level, already-known exclusion) happens engine-side; this just wires
    // the response into whichever *Options data property the caller names.
    async fetchSpellOptions(optionsProp, { cantripsOnly, pool } = {}) {
      if (!this.draftCharacter || !this.selectedClassName) {
        this[optionsProp] = []
        return
      }
      try {
        const res = await fetch('/api/engine/spell-choices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: this.draftCharacter,
            className: this.selectedClassName,
            subclassName: this.currentSubclassName,
            toLevel: this.targetLevel,
            cantripsOnly: Boolean(cantripsOnly),
            pool: pool || 'class',
          }),
        })
        this[optionsProp] = res.ok ? (await res.json()).options : []
      } catch {
        this[optionsProp] = []
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
            invocationChoices: this.invocationDraftPicks,
            pactBoonChoice: this.pactBoonDraft,
            pactBoonBonusSpells: this.bonusCantripDraftPicks,
            spellChoices: {
              cantrips: this.cantripDraftPicks,
              spells: this.spellDraftPicks,
            },
            spellSwap:
              this.spellSwapFrom && this.spellSwapTo
                ? { from: this.spellSwapFrom, to: this.spellSwapTo }
                : null,
            spellbookChoices: this.spellbookDraftPicks,
            multiclassSkillChoice: this.multiclassSkillDraft,
            fightingStyleChoice: this.fightingStyleDraft,
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

        const invocationChoice = data.pendingChoices?.find(
          (p) => p.type === 'invocationChoice'
        )
        if (invocationChoice)
          this.invocationChoiceLevel = invocationChoice.level

        const pactBoonChoice = data.pendingChoices?.find(
          (p) => p.type === 'pactBoonChoice'
        )
        if (pactBoonChoice) this.pactBoonChoiceLevel = pactBoonChoice.level

        const fightingStyleChoice = data.pendingChoices?.find(
          (p) => p.type === 'fightingStyleChoice'
        )
        if (fightingStyleChoice) {
          this.fightingStyleChoiceLevel = fightingStyleChoice.level
          this.fightingStyleOptions = fightingStyleChoice.options
          this.loadFeatureDescriptions(
            fightingStyleChoice.options.map((o) => ({
              name: `Fighting Style: ${o}`,
            }))
          )
        }

        const bonusSpellChoice = data.pendingChoices?.find(
          (p) => p.type === 'bonusSpellChoice'
        )
        if (bonusSpellChoice) {
          this.bonusSpellChoiceLevel = bonusSpellChoice.level
          if (!this.bonusCantripOptions.length) {
            this.fetchSpellOptions('bonusCantripOptions', {
              cantripsOnly: true,
              pool: 'any',
            })
          }
        }

        const newCantrips = data.pendingChoices?.find(
          (p) => p.type === 'newCantrips'
        )
        if (newCantrips) {
          this.newCantripsLevel = newCantrips.level
          if (!this.cantripOptions.length) {
            this.fetchSpellOptions('cantripOptions', { cantripsOnly: true })
          }
        }

        const newKnownSpells = data.pendingChoices?.find(
          (p) => p.type === 'newKnownSpells'
        )
        if (newKnownSpells) {
          this.newKnownSpellsLevel = newKnownSpells.level
          if (!this.spellOptions.length) {
            this.fetchSpellOptions('spellOptions', { cantripsOnly: false })
          }
        }

        const spellbookChoice = data.pendingChoices?.find(
          (p) => p.type === 'spellbookAdditions'
        )
        if (spellbookChoice) {
          this.spellbookChoiceLevel = spellbookChoice.level
          if (!this.spellbookOptions.length) {
            this.fetchSpellOptions('spellbookOptions', { cantripsOnly: false })
          }
        }

        // No fetch needed for the multiclass skill card — skillsCatalog is
        // loaded once in created() and multiclassSkillOptions derives its
        // real options live from allClasses (already loaded too).

        // The optional spell-swap "to" list is fetched once a "from" spell
        // is picked (not gated behind a pendingChoice — this is never
        // required) — same eligible-spell computation as every other spell
        // picker, just keyed off its own option list so picking a swap
        // target doesn't fight over state with the mandatory known-spell
        // picker above.
        if (
          this.canSwapKnownSpell &&
          this.spellSwapFrom &&
          !this.spellSwapToOptions.length
        ) {
          this.fetchSpellOptions('spellSwapToOptions', { cantripsOnly: false })
        }

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

    // Picking (or clearing) the "give up" side of an optional spell swap.
    // Clearing it also clears the "to" pick and its option list — a
    // half-finished swap should never linger and accidentally submit.
    setSpellSwapFrom(name) {
      this.spellSwapFrom = name || null
      this.spellSwapTo = null
      this.spellSwapToOptions = []
      this.spellSwapSearch = ''
      this.runPreview()
    },

    setSpellSwapTo(name) {
      this.spellSwapTo = name || null
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
      //
      // Two independent +1 picks, summed by ability — NOT built as
      // `{ [asiAbility1]: 1, [asiAbility2]: 1 }`. Real bug found 2026-09-09:
      // when both dropdowns pick the SAME ability, that object-literal form
      // silently collides on the duplicate key (JS keeps only the last
      // write), producing `{str: 1}` instead of `{str: 2}` — a total of 1,
      // which the engine correctly rejects ("must total +2"), surfacing as
      // a confusing error for an otherwise-legal +2-to-one-ability pick.
      // Summing explicitly makes "pick the same ability twice" a valid,
      // intentional way to reach +2 to one ability, matching the UI's own
      // two-dropdowns-both-labeled-+1 design (no separate "+2 to one /
      // +1 to two" mode toggle needed).
      const increases = {}
      for (const ability of [this.asiAbility1, this.asiAbility2]) {
        if (!ability) continue
        increases[ability] = (increases[ability] ?? 0) + 1
      }
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

.lut-updating-badge {
  position: sticky;
  top: 0;
  z-index: 1;
  align-self: flex-start;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.1rem 0.5rem;
  margin-bottom: 0.4rem;
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

/* Checkbox-list pickers — invocations, cantrips, known spells, Pact of the
   Tome's bonus cantrips. Scrolls internally rather than growing the whole
   tool taller for a long class spell list (Sorcerer/Cleric-sized). */
.lut-pick-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: 12rem;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.lut-pick-list li {
  padding: 0.2rem 0.5rem;
}

.lut-pick-list li:hover {
  background: var(--color-bg-surface-alt);
}

.lut-pick-list label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.lut-pick-disabled {
  opacity: 0.5;
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

.lut-current-scores {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.lut-current-score {
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  color: var(--color-text-muted);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
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

.lut-asi-pick-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.lut-note-inline {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
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
