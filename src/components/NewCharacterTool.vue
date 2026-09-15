<template>
  <div class="nct-root">
    <div class="nct-name-row">
      <input
        v-model="name"
        class="nct-text-input nct-name-input"
        placeholder="Character name"
      />
      <input
        v-model="fullName"
        class="nct-text-input nct-name-input"
        placeholder="Full name (optional — defaults to short name)"
      />
      <input
        v-model="imagePath"
        class="nct-text-input nct-name-input"
        :placeholder="`Image path (optional — defaults to ${defaultImagePath})`"
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

        <select
          v-if="
            selectedSpecies &&
            selectedSpecies.subraces &&
            selectedSpecies.subraces.length
          "
          v-model="subraceName"
          class="nct-select"
        >
          <option :value="null" disabled>Choose a subrace…</option>
          <option
            v-for="sr in selectedSpecies.subraces"
            :key="sr.name"
            :value="sr.name"
          >
            {{ sr.name }}
          </option>
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
          <div>Speed {{ displaySpeed ?? '—' }} ft.</div>
          <div v-if="displayDarkvision">
            Darkvision {{ displayDarkvision }} ft.
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
          <div v-if="displayTraits.length">
            <div class="nct-note">
              Traits (mechanical grants below apply automatically to the
              character record; the rest are flavor/reference):
            </div>
            <ul class="nct-trait-list">
              <li v-for="t in displayTraits" :key="t.name">
                <strong>{{ t.name }}</strong> — {{ t.description }}
              </li>
            </ul>
          </div>

          <!-- ── Species/subrace trait choices (skill/tool proficiency,
               cantrip, dragon ancestry) — see resolvedSpeciesGrants ── -->
          <div
            v-if="
              skillChoiceTraits.length ||
              toolChoiceTraits.length ||
              spellChoiceTraits.length ||
              ancestryChoiceTrait
            "
            class="nct-skill-picker"
          >
            <template v-for="t in skillChoiceTraits">
              <div :key="'skill-label-' + t.name" class="nct-note">
                {{ t.name }} — choose
                {{ t.grants_skill_proficiency_choice.count }} skill{{
                  t.grants_skill_proficiency_choice.count === 1 ? '' : 's'
                }}:
              </div>
              <select
                v-for="(_, i) in Array(t.grants_skill_proficiency_choice.count)"
                :key="'skill-' + t.name + '-' + i"
                v-model="speciesSkillChoiceValues[t.name][i]"
                class="nct-select"
              >
                <option :value="null" disabled>Choose a skill…</option>
                <option
                  v-for="s in skillsList"
                  :key="s.id"
                  :value="s.id"
                  :disabled="speciesSkillChoiceDisabled(s.id, t.name, i)"
                >
                  {{ s.name }}
                </option>
              </select>
            </template>

            <template v-for="t in toolChoiceTraits">
              <div :key="'tool-label-' + t.name" class="nct-note">
                {{ t.name }} — choose
                {{ t.grants_tool_proficiency_choice.count }} tool proficienc{{
                  t.grants_tool_proficiency_choice.count === 1 ? 'y' : 'ies'
                }}:
              </div>
              <select
                v-for="(_, i) in Array(t.grants_tool_proficiency_choice.count)"
                :key="'tool-' + t.name + '-' + i"
                v-model="speciesToolChoiceValues[t.name][i]"
                class="nct-select"
              >
                <option :value="null" disabled>Choose…</option>
                <option
                  v-for="o in t.grants_tool_proficiency_choice.options"
                  :key="o"
                  :value="o"
                >
                  {{ o }}
                </option>
              </select>
            </template>

            <template v-for="t in spellChoiceTraits">
              <div :key="'spell-label-' + t.name" class="nct-note">
                {{ t.name }} — choose {{ t.grants_spells.choice.count }}
                {{ t.grants_spells.choice.cantrips_only ? 'cantrip' : 'spell'
                }}{{ t.grants_spells.choice.count === 1 ? '' : 's' }} from the
                {{ t.grants_spells.choice.class_list }} list:
              </div>
              <select
                v-for="(_, i) in Array(t.grants_spells.choice.count)"
                :key="'spell-' + t.name + '-' + i"
                v-model="speciesSpellChoiceValues[t.name][i]"
                class="nct-select"
              >
                <option :value="null" disabled>Choose…</option>
                <option
                  v-for="o in speciesSpellOptionsByTrait[t.name] || []"
                  :key="o.name"
                  :value="o.name"
                >
                  {{ o.name }}
                </option>
              </select>
            </template>

            <template v-if="ancestryChoiceTrait">
              <div class="nct-note">
                {{ ancestryChoiceTrait.name }} — choose a dragon type:
              </div>
              <select v-model="dragonbornAncestryChoice" class="nct-select">
                <option :value="null" disabled>Choose…</option>
                <option
                  v-for="a in ancestryOptions"
                  :key="a.type"
                  :value="a.type"
                >
                  {{ a.type }} ({{ a.damage_type }})
                </option>
              </select>
            </template>
          </div>

          <div v-if="speciesAutomaticLanguages.length" class="nct-note">
            Languages: {{ speciesAutomaticLanguages.join(', ')
            }}<template v-if="speciesLanguageChoiceTotal"
              >, plus {{ speciesLanguageChoiceTotal }} of your choice</template
            >
          </div>
          <div v-if="speciesLanguageChoiceTotal" class="nct-skill-picker">
            <select
              v-for="(_, i) in Array(speciesLanguageChoiceTotal)"
              :key="i"
              v-model="selectedSpeciesLanguages[i]"
              class="nct-select"
            >
              <option :value="null" disabled>Choose a language…</option>
              <option
                v-for="l in languagesList"
                :key="l.id"
                :value="l.name"
                :disabled="
                  languageDisabled(l.name, selectedSpeciesLanguages, i)
                "
              >
                {{ l.name }}
              </option>
            </select>
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
          <div class="nct-note">Skill proficiencies (from background):</div>
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
              :disabled="skillDisabled(s.id, selectedSkills, i)"
            >
              {{ s.name }}
            </option>
          </select>
        </div>

        <div v-if="backgroundLanguageChoiceCount" class="nct-skill-picker">
          <div class="nct-note">
            Languages ({{ backgroundLanguageChoiceCount }} of your choice):
          </div>
          <select
            v-for="(_, i) in Array(backgroundLanguageChoiceCount)"
            :key="i"
            v-model="selectedBackgroundLanguages[i]"
            class="nct-select"
          >
            <option :value="null" disabled>Choose a language…</option>
            <option
              v-for="l in languagesList"
              :key="l.id"
              :value="l.name"
              :disabled="
                languageDisabled(l.name, selectedBackgroundLanguages, i)
              "
            >
              {{ l.name }}
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

        <div v-if="classSkillChoiceCount" class="nct-skill-picker">
          <div class="nct-note">
            {{ selectedClass.name }} skill proficiencies (choose
            {{ classSkillChoiceCount }}, separate from your background's):
          </div>
          <select
            v-for="(_, i) in Array(classSkillChoiceCount)"
            :key="i"
            v-model="selectedClassSkills[i]"
            class="nct-select"
          >
            <option :value="null" disabled>Choose a skill…</option>
            <option
              v-for="s in classSkillOptions"
              :key="s.id"
              :value="s.id"
              :disabled="skillDisabled(s.id, selectedClassSkills, i)"
            >
              {{ s.name }}
            </option>
          </select>
          <div class="nct-note">
            Yes, this is a second, separate list of skills — your class grants
            its own skill picks on top of your background's. Any skill your
            background already gave you is greyed out in this list only because
            you can't pick the same skill twice: by RAW you'd pick a different
            skill here instead of gaining nothing from the repeat.
          </div>
        </div>
      </div>

      <!-- ── Equipment ── -->
      <div v-else-if="activeTab === 'equipment'" class="nct-tab-body">
        <div v-if="!selectedClass" class="nct-note">Choose a class first.</div>
        <template v-else-if="!selectedClass.starting_equipment">
          <div class="nct-note">
            No starting equipment table for {{ selectedClass.name }} yet — add
            gear through the Inventory tab after creating this character.
          </div>
        </template>
        <template v-else>
          <label class="nct-checkbox-row">
            <input type="checkbox" v-model="equipmentTakeGold" />
            Take {{ equipmentGoldAlternative }} gp instead of starting gear
            (added to the party purse)
          </label>

          <template v-if="!equipmentTakeGold">
            <div v-if="equipmentFixed.length" class="nct-note">
              You start with:
              {{
                equipmentFixed
                  .map((e) => (e.qty > 1 ? `${e.name} x${e.qty}` : e.name))
                  .join(', ')
              }}
            </div>

            <div
              v-for="(entry, i) in equipmentFixed"
              :key="'fixed-' + i"
              class="nct-skill-picker"
            >
              <template v-if="entry.filter">
                <div class="nct-note">{{ entry.name }}:</div>
                <select
                  v-model="equipmentWeaponPicks['fixed-' + i]"
                  class="nct-select"
                >
                  <option :value="null" disabled>Choose a weapon…</option>
                  <option
                    v-for="opt in weaponOptionsForFilter(entry.filter)"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </template>
            </div>

            <div
              v-for="(choice, ci) in equipmentChoices"
              :key="'choice-' + ci"
              class="nct-skill-picker"
            >
              <div class="nct-note">
                Choose one ({{ equipmentChoiceLabel(choice) }}):
              </div>
              <select
                v-model="equipmentChoiceSelections[ci]"
                class="nct-select"
              >
                <option :value="null" disabled>Choose…</option>
                <option
                  v-for="(opt, oi) in choice.options"
                  :key="oi"
                  :value="oi"
                >
                  {{ equipmentOptionLabel(opt) }}
                </option>
              </select>

              <template v-if="equipmentChoiceSelections[ci] != null">
                <template
                  v-for="(entry, ei) in choice.options[
                    equipmentChoiceSelections[ci]
                  ]"
                >
                  <div
                    v-if="entry.filter"
                    :key="ci + '-' + ei"
                    class="nct-skill-picker"
                  >
                    <div class="nct-note">
                      {{ entry.name
                      }}{{ entry.qty > 1 ? ` (pick ${entry.qty})` : '' }}:
                    </div>
                    <select
                      v-for="(_, wi) in Array(entry.qty || 1)"
                      :key="wi"
                      v-model="equipmentWeaponPicks[ci + '-' + ei + '-' + wi]"
                      class="nct-select"
                    >
                      <option :value="null" disabled>Choose a weapon…</option>
                      <option
                        v-for="opt in weaponOptionsForFilter(entry.filter)"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </template>
              </template>
            </div>
          </template>
        </template>
      </div>

      <!-- ── Abilities ── -->
      <div v-else-if="activeTab === 'abilities'" class="nct-tab-body">
        <div v-if="priorityAbilities.length" class="nct-note nct-note--action">
          {{ selectedClass.name }}'s most important abilities are usually
          <strong>{{
            priorityAbilities.map((a) => a.toUpperCase()).join(' and ')
          }}</strong>
          — consider putting more of your points there. (Hover any ability for
          what it governs.)
        </div>
        <div class="nct-abilities-grid">
          <div
            v-for="a in abilities"
            :key="a"
            class="nct-ability-row"
            :class="{
              'nct-ability-row--priority': priorityAbilities.includes(a),
            }"
          >
            <span class="nct-ability-label" :title="abilityDescriptions[a]">{{
              a.toUpperCase()
            }}</span>
            <button class="nct-btn" @click="adjustScore(a, -1)">−</button>
            <span class="nct-ability-score">{{ baseScores[a] }}</span>
            <button class="nct-btn" @click="adjustScore(a, 1)">+</button>
            <span
              v-if="nextPointCost(baseScores[a]) !== null"
              class="nct-ability-next-cost"
              :title="`Raising ${a.toUpperCase()} to ${
                baseScores[a] + 1
              } costs ${nextPointCost(baseScores[a])} point${
                nextPointCost(baseScores[a]) === 1 ? '' : 's'
              }`"
            >
              next: +{{ nextPointCost(baseScores[a]) }}
            </span>
            <span
              v-else
              class="nct-ability-next-cost nct-ability-next-cost--maxed"
            >
              maxed
            </span>
            <span class="nct-ability-cost"
              >total: {{ scoreCost(baseScores[a]) }} pt{{
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
          <!-- Every character starts at level 1, and level-1 HP is always
               forced to max hit die per RAW (see levelUp.js's forceMax) —
               unlike the Level Up tool, there's no LATER level where a
               roll/average choice would ever apply here, so there's nothing
               to offer; just show the resulting number with how it was
               reached. -->
          <div class="nct-note">
            HP:
            <strong :title="hpBreakdown">{{ preview.patch.hp_max }}</strong>
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

          <div v-if="cantripPickCount" class="nct-spell-picker">
            <div class="nct-note">
              Pick {{ cantripPickCount }} cantrip{{
                cantripPickCount === 1 ? '' : 's'
              }}
              ({{ cantripDraftPicks.length }}/{{ cantripPickCount }} chosen):
            </div>
            <input
              v-model="cantripSearch"
              class="nct-text-input"
              placeholder="Search cantrips…"
            />
            <ul class="nct-pick-list">
              <li v-for="o in filteredCantripOptions" :key="o.name">
                <label>
                  <input
                    type="checkbox"
                    :checked="cantripDraftPicks.includes(o.name)"
                    :disabled="
                      !cantripDraftPicks.includes(o.name) &&
                      cantripDraftPicks.length >= cantripPickCount
                    "
                    @change="
                      togglePick('cantripDraftPicks', o.name, cantripPickCount)
                    "
                  />
                  {{ o.name }}
                </label>
              </li>
            </ul>
          </div>

          <div v-if="spellPickCount" class="nct-spell-picker">
            <div class="nct-note">
              Pick {{ spellPickCount }} known spell{{
                spellPickCount === 1 ? '' : 's'
              }}
              ({{ spellDraftPicks.length }}/{{ spellPickCount }} chosen):
            </div>
            <input
              v-model="spellSearch"
              class="nct-text-input"
              placeholder="Search spells…"
            />
            <ul class="nct-pick-list">
              <li v-for="o in filteredSpellOptions" :key="o.name">
                <label>
                  <input
                    type="checkbox"
                    :checked="spellDraftPicks.includes(o.name)"
                    :disabled="
                      !spellDraftPicks.includes(o.name) &&
                      spellDraftPicks.length >= spellPickCount
                    "
                    @change="
                      togglePick('spellDraftPicks', o.name, spellPickCount)
                    "
                  />
                  {{ o.name }}
                  <span class="nct-note-inline"
                    >(lvl {{ o.level
                    }}{{ o.school ? ', ' + o.school : '' }})</span
                  >
                </label>
              </li>
            </ul>
          </div>

          <div
            v-if="pendingFightingStyleChoice || fightingStyleChoice"
            class="nct-spell-picker"
          >
            <div class="nct-note">Choose a Fighting Style:</div>
            <ul class="nct-pick-list">
              <li v-for="o in fightingStyleOptions" :key="o">
                <label
                  :title="featureDescriptions[`Fighting Style: ${o}`] || ''"
                >
                  <input
                    type="radio"
                    name="fighting-style"
                    :value="o"
                    v-model="fightingStyleChoice"
                  />
                  {{ o }}
                </label>
              </li>
            </ul>
            <p
              v-if="
                fightingStyleChoice &&
                featureDescriptions[`Fighting Style: ${fightingStyleChoice}`]
              "
              class="nct-note-inline"
            >
              {{
                featureDescriptions[`Fighting Style: ${fightingStyleChoice}`]
              }}
            </p>
          </div>

          <ul v-if="preview.newFeatures.length" class="nct-feature-list">
            <li v-for="f in preview.newFeatures" :key="f.name">
              <span
                :class="{ 'has-tip': featureDescriptions[f.name] }"
                :title="featureDescriptions[f.name] || ''"
              >
                {{ f.name }}
              </span>
            </li>
          </ul>
          <div v-if="pendingSubclassChoice" class="nct-note nct-note--action">
            Subclass choice deferred — pick one later via Level Up.
          </div>
        </template>
        <div v-else-if="!speciesName || !className" class="nct-note">
          Pick a species and class first.
        </div>
        <div v-else-if="!abilityBonusAssignmentComplete" class="nct-note">
          Finish assigning ability scores on the Abilities tab first —
          {{
            useSpeciesBonus
              ? "this species' flexible ability bonus still needs a choice."
              : 'both free +2/+1 abilities still need picking.'
          }}
        </div>
        <div v-else class="nct-note">Computing…</div>
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
import { lookupFeature } from '@/utils/lookupService.js'
import {
  resolveGearEntry,
  weaponOptionsForFilter,
  isEquippableType,
  rollGoldAlternative,
} from '@/utils/startingGearCatalog.js'
import { dnd, ABILITY_DESCRIPTIONS } from '@/utils/dnd_utils.js'
import weaponTypesAndLanguages from '@/data/weapon_types_and_languages.json'

// Homebrew languages (e.g. Solvalean) live alongside the homebrew weapon
// types in the same file — HOMEBREW_WEAPON_PROPS in dnd_utils.js already
// reads that file's weapon_types half; this is the languages half, merged
// into the real /api/engine/languages catalog below since the engine only
// knows the SRD's 16 standard/exotic languages. Given a synthetic id (the
// engine catalog's entries have real ids, but these only need one for the
// picker's :key) and tagged 'homebrew' for anything that wants to show
// that later, even though the current picker only renders the name.
const HOMEBREW_LANGUAGES = (weaponTypesAndLanguages.languages ?? []).map(
  (l) => ({
    id: `homebrew_${l.name.toLowerCase().replace(/\s+/g, '_')}`,
    name: l.name,
    type: 'homebrew',
    description: l.description,
  })
)

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
// Mirrors engine/rules/pointBuy.js's table — kept local for instant UI
// feedback as the player adjusts scores; the server is still the source of
// truth for the actual level-1 computation.
const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
const POINT_BUY_BUDGET = 27

function filterSpellOptions(options, search) {
  const q = search.trim().toLowerCase()
  if (!q) return options
  return options.filter((o) => o.name.toLowerCase().includes(q))
}

export default {
  name: 'NewCharacterTool',

  components: { PendingCharacterSaveBar },
  mixins: [pendingCharacterSaves],

  data() {
    return {
      name: '',
      // Optional — defaults to `name` on save if left blank. Most character
      // records have a distinct full_name (e.g. "Vaz" / "Vazseslaad
      // Thrazak"); `name` is the short form used everywhere else in the app
      // (combat tracker, item equipped_by, relationship notes).
      fullName: '',
      // Optional — defaults to defaultImagePath on save if left blank. No
      // upload here: portraits live as static files under `public/characters/`
      // and this tool doesn't have a way to write one there, just to point
      // at whatever filename the project owner drops in (existing roster is
      // 23 .jpg vs. 2 .png, hence the default guess's extension).
      imagePath: '',
      speciesName: null,
      // Only meaningful for the 4 standard species with real 2014-PHB
      // subraces (Dwarf, Elf, Halfling, Gnome) — null for every other
      // species, including all homebrew ones, which don't have any.
      subraceName: null,
      speciesChoiceAbilities: [],
      // ── Real mechanical wiring for species/subrace traits (2026-09-07) ──
      // Every trait with a grants_*_choice/grants_spells.choice/ancestry
      // choice field needs a picker — keyed by trait name so multiple
      // traits (rare, but Half-Elf + a future homebrew species could both
      // need one) never collide. Shape mirrors LevelUpTool.vue's
      // featChoiceValues: {traitName: [picks]}.
      speciesSkillChoiceValues: {},
      speciesToolChoiceValues: {},
      speciesSpellChoiceValues: {},
      speciesSpellOptionsByTrait: {}, // traitName -> fetched spell/cantrip options
      dragonbornAncestryChoice: null,
      // When off, the species' fixed/flexible ability bonus is skipped
      // entirely in favor of a free +2/+1 the player assigns to any two
      // abilities — added because tying ability bonuses to species pushes
      // players toward the same species/class pairings over and over.
      // Defaults to off (2026-09-09): the project owner confirmed this table
      // "almost never" uses the species-bonus option in practice, so the
      // common case shouldn't require a manual toggle every time.
      useSpeciesBonus: false,
      manualPlusTwoAbility: null,
      manualPlusOneAbility: null,
      // backgroundChoice is either a curated background's name, or the
      // sentinel '__custom' for a freeform name with manually-picked skills.
      backgroundChoice: null,
      customBackgroundName: '',
      selectedSkills: [null, null],
      // The class's OWN "choose N skills from this list" grant — separate
      // from the background's fixed 2-skill grant above. Real gap found
      // auditing Siv/Jaygar (see TODO.md/engine/CHECKLIST.md): nothing here
      // ever prompted for this, so every character built through this tool
      // was silently missing their class skill proficiencies. Sized to
      // selectedClass.skill_choices.count by the classSkillChoiceCount
      // watcher below.
      selectedClassSkills: [],
      // Species' own "N languages of your choice" beyond its automatic
      // grant (e.g. Human's free pick, High Elf's extra language) — sized
      // by the speciesLanguageChoiceTotal watcher.
      selectedSpeciesLanguages: [],
      // Background's own "N languages of your choice" (e.g. Sage grants 2)
      // — sized by the backgroundLanguageChoiceCount watcher.
      selectedBackgroundLanguages: [],
      className: null,
      baseScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      abilities: ABILITIES,
      pointBuyBudget: POINT_BUY_BUDGET,
      // name -> description string, populated as newFeatures resolve via
      // lookupFeature (async: local SRD/homebrew catalogs first, then the
      // traits API).
      featureDescriptions: {},

      activeTab: 'species',
      tabs: [
        { id: 'species', label: 'Species' },
        { id: 'background', label: 'Background' },
        { id: 'class', label: 'Class' },
        { id: 'equipment', label: 'Equipment' },
        { id: 'abilities', label: 'Abilities' },
        { id: 'spells', label: 'Spells & Features' },
      ],

      speciesList: [],
      curatedBackgroundList: [],
      skillsList: [],
      classList: [],
      languagesList: [],

      // Starting equipment (Class tab's starting_equipment table) —
      // equipmentChoiceSelections[i] holds the chosen option INDEX into
      // starting_equipment.choices[i].options; equipmentWeaponPicks holds
      // the resolved weapon_category for any "Any Simple/Martial Weapon"
      // symbolic entry, keyed 'fixed-<entryIdx>' or '<choiceIdx>-<entryIdx>-<pickIdx>'
      // (a qty>1 filter entry, e.g. "two martial weapons", needs one key per pick).
      equipmentTakeGold: false,
      equipmentChoiceSelections: [],
      equipmentWeaponPicks: {},

      hpMethod: 'roll',
      hpRolls: [],
      preview: null,
      loading: false,
      error: null,

      // ── Starting cantrip/known-spell picker (mirrors LevelUpTool.vue's
      // generic known-spell picker — same /api/engine/spell-choices route,
      // just for the 0→1 transition instead of a later level-up) ──
      cantripOptions: [],
      cantripDraftPicks: [],
      cantripSearch: '',
      spellOptions: [],
      spellDraftPicks: [],
      spellSearch: '',

      // Fighter's own 1st-level Fighting Style pick — the one pendingChoice
      // that can actually surface at level 1 (Pact Boon/Invocations only
      // matter at higher levels, never during creation). Real bug found
      // 2026-09-09: the tool listed "Fighting Style" as a feature with no
      // way to choose one at all — see engine/data/fighting-styles.json.
      // fightingStyleOptions is a sticky cache of the pendingChoice's own
      // options — needed because pendingFightingStyleChoice itself goes
      // null the instant a choice is resolved (the whole point of it being
      // a pendingChoice), which would otherwise yank the picker out from
      // under the just-made selection. Real bug found 2026-09-09 (again):
      // the picker used pendingFightingStyleChoice.options directly, so it
      // visibly disappeared right after picking.
      fightingStyleOptions: [],
      fightingStyleChoice: null,
    }
  },

  computed: {
    // Matches the existing roster's real convention: lowercase, spaces
    // stripped, .jpg (23 of 25 current portraits use .jpg, not .png).
    defaultImagePath() {
      const slug = this.name.trim().toLowerCase().replace(/\s+/g, '')
      return slug ? `./characters/${slug}.jpg` : ''
    },
    standardSpeciesList() {
      return this.speciesList.filter((s) => !s.homebrew)
    },
    homebrewSpeciesList() {
      return this.speciesList.filter((s) => s.homebrew)
    },
    selectedSpecies() {
      return this.speciesList.find((s) => s.name === this.speciesName) ?? null
    },
    selectedSubrace() {
      return (
        this.selectedSpecies?.subraces?.find(
          (sr) => sr.name === this.subraceName
        ) ?? null
      )
    },
    // Species' own ability_score_bonus plus the chosen subrace's, merged —
    // a subrace's bonus stacks on top of (never replaces) the base species
    // bonus per real RAW (e.g. Rock Gnome = Gnome's +2 INT + subrace's +1
    // CON).
    combinedFixedBonus() {
      const combined = { ...(this.selectedSpecies?.ability_score_bonus ?? {}) }
      for (const [a, n] of Object.entries(
        this.selectedSubrace?.ability_score_bonus ?? {}
      )) {
        combined[a] = (combined[a] ?? 0) + n
      }
      return combined
    },
    fixedBonusText() {
      if (!this.selectedSpecies) return null
      const entries = Object.entries(this.combinedFixedBonus)
      if (!entries.length) return null
      return entries.map(([a, n]) => `+${n} ${a.toUpperCase()}`).join(', ')
    },
    displaySpeed() {
      return this.selectedSubrace?.speed ?? this.selectedSpecies?.speed ?? null
    },
    displayDarkvision() {
      return (
        this.selectedSubrace?.darkvision ??
        this.selectedSpecies?.darkvision ??
        0
      )
    },
    displayTraits() {
      return [
        ...(this.selectedSpecies?.traits ?? []),
        ...(this.selectedSubrace?.traits ?? []),
      ]
    },
    // Same traits as displayTraits, reshaped for the character record —
    // tagged `type: 'speciesTrait'` (FeaturePillsPanel's marker/grouping)
    // and which tier each came from (species vs. subrace), carrying their
    // own `description` straight from species.json so the sheet's tooltip
    // never needs a name-based catalog lookup for these (deliberately
    // sidesteps the "Lucky" feat vs. "Lucky" Halfling racial trait collision
    // class of bug — see engine/CHECKLIST.md).
    speciesTraitRecords() {
      const fromSpecies = (this.selectedSpecies?.traits ?? []).map((t) => ({
        ...t,
        type: 'speciesTrait',
        source: 'species',
      }))
      const fromSubrace = (this.selectedSubrace?.traits ?? []).map((t) => ({
        ...t,
        type: 'speciesTrait',
        source: 'subrace',
      }))
      return [...fromSpecies, ...fromSubrace]
    },
    // ── Real mechanical wiring for species/subrace traits (2026-09-07) ──
    // Traits needing a player choice before their grant can be resolved —
    // checked generically off displayTraits so a future species/subrace
    // with the same shape gets a picker for free, no per-trait code.
    skillChoiceTraits() {
      return this.displayTraits.filter((t) => t.grants_skill_proficiency_choice)
    },
    toolChoiceTraits() {
      return this.displayTraits.filter((t) => t.grants_tool_proficiency_choice)
    },
    spellChoiceTraits() {
      return this.displayTraits.filter((t) => t.grants_spells?.choice)
    },
    // Dragonborn-shaped ancestry choice — a species-level table (not a
    // subrace one), which the Draconic Ancestry trait's own `choice.from`
    // points at.
    ancestryChoiceTrait() {
      return this.displayTraits.find((t) => t.choice?.from)
    },
    ancestryOptions() {
      const field = this.ancestryChoiceTrait?.choice?.from
      return field ? this.selectedSpecies?.[field] ?? [] : []
    },
    // A species skill choice can't double-dip into the background's or
    // class's own picks, or a different slot of its own picker.
    speciesSkillChoiceDisabled() {
      return (skillId, traitName, index) => {
        const own = this.speciesSkillChoiceValues[traitName] ?? []
        const takenInOwn = own.some((v, i) => i !== index && v === skillId)
        return (
          takenInOwn ||
          this.selectedSkills.includes(skillId) ||
          this.selectedClassSkills.includes(skillId)
        )
      }
    },
    // Every species/subrace trait resolved into real mechanical grants —
    // the one thing characterShell() reads for this. Choice-based grants
    // fall back to nothing if left unpicked (no error) — same tolerance
    // the rest of this tool has for an in-progress, not-yet-complete form.
    resolvedSpeciesGrants() {
      const weapons = new Set()
      const armor = new Set()
      const tools = new Set()
      const skills = new Set()
      const resistances = new Set()
      const savingThrowAdvantages = new Set()
      const spellFeatures = []
      for (const trait of this.displayTraits) {
        for (const w of trait.grants_weapon_proficiency ?? []) weapons.add(w)
        for (const a of trait.grants_armor_proficiency ?? []) armor.add(a)
        for (const tl of trait.grants_tool_proficiency ?? []) tools.add(tl)
        if (trait.grants_skill_proficiency)
          skills.add(trait.grants_skill_proficiency)
        for (const s of this.speciesSkillChoiceValues[trait.name] ?? [])
          if (s) skills.add(s)
        for (const tl of this.speciesToolChoiceValues[trait.name] ?? [])
          if (tl) tools.add(tl)
        if (trait.grants_resistance) {
          if (trait.grants_resistance === 'ancestry') {
            const chosen = this.ancestryOptions.find(
              (a) => a.type === this.dragonbornAncestryChoice
            )
            if (chosen) resistances.add(chosen.damage_type)
          } else {
            resistances.add(trait.grants_resistance)
          }
        }
        if (trait.grants_saving_throw_advantage) {
          savingThrowAdvantages.add(trait.grants_saving_throw_advantage)
        }
        if (trait.grants_spells) {
          const names = [
            ...(trait.grants_spells.fixed ?? []),
            ...(this.speciesSpellChoiceValues[trait.name] ?? []).filter(
              Boolean
            ),
          ]
          if (names.length) {
            spellFeatures.push({
              name: trait.name,
              id: null,
              type: 'speciesTrait',
              spells_granted: names,
              _source: trait.name,
            })
          }
        }
      }
      return {
        weapons: [...weapons],
        armor: [...armor],
        tools: [...tools],
        skills: [...skills],
        resistances: [...resistances],
        savingThrowAdvantages: [...savingThrowAdvantages],
        spellFeatures,
      }
    },
    // Attributes the STARTING ability-score bonus (species racial, or the
    // manual free +2/+1 when useSpeciesBonus is off) the same way
    // diffLevelUp.js attributes a later ASI/feat bump. Seeded here rather
    // than by the engine because a level-1 preview-level-up call never
    // touches ability scores at all (no class grants an ASI at level 1) —
    // this is the one ability_score_history entry point outside diffLevelUp.
    abilityScoreHistorySeed() {
      const entries = []
      if (this.useSpeciesBonus) {
        const sourceName = this.selectedSpecies?.name
          ? `${this.selectedSpecies.name} racial`
          : 'Species racial'
        for (const [ability, amount] of Object.entries(
          this.combinedFixedBonus
        )) {
          if (amount)
            entries.push({
              ability,
              amount,
              source: sourceName,
              level_gained: 1,
            })
        }
        if (this.selectedSpecies?.choice) {
          this.speciesChoiceAbilities.forEach((ability) => {
            if (ability) {
              entries.push({
                ability,
                amount: this.selectedSpecies.choice.amount,
                source: sourceName,
                level_gained: 1,
              })
            }
          })
        }
      } else {
        if (this.manualPlusTwoAbility) {
          entries.push({
            ability: this.manualPlusTwoAbility,
            amount: 2,
            source: 'Free ability bonus (manual)',
            level_gained: 1,
          })
        }
        if (this.manualPlusOneAbility) {
          entries.push({
            ability: this.manualPlusOneAbility,
            amount: 1,
            source: 'Free ability bonus (manual)',
            level_gained: 1,
          })
        }
      }
      return entries
    },
    selectedClass() {
      return this.classList.find((c) => c.name === this.className) ?? null
    },
    equipmentFixed() {
      return this.selectedClass?.starting_equipment?.fixed ?? []
    },
    equipmentChoices() {
      return this.selectedClass?.starting_equipment?.choices ?? []
    },
    equipmentGoldAlternative() {
      return this.selectedClass?.starting_equipment?.gold_alternative ?? null
    },
    // Every choice has picked an option, and every symbolic "Any Simple/
    // Martial Weapon" entry pulled in by that pick (fixed or chosen) has a
    // concrete weapon selected. Gold-alternative skips all of this.
    equipmentAssignmentComplete() {
      if (!this.selectedClass?.starting_equipment) return true
      if (this.equipmentTakeGold) return true
      const fixedOk = this.equipmentFixed.every((entry, i) =>
        entry.filter ? this.equipmentWeaponPicks[`fixed-${i}`] : true
      )
      if (!fixedOk) return false
      return this.equipmentChoices.every((choice, ci) => {
        const oi = this.equipmentChoiceSelections[ci]
        if (oi == null) return false
        return choice.options[oi].every((entry, ei) => {
          if (!entry.filter) return true
          const qty = entry.qty || 1
          for (let wi = 0; wi < qty; wi++) {
            if (!this.equipmentWeaponPicks[`${ci}-${ei}-${wi}`]) return false
          }
          return true
        })
      })
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
    // How many skills the CLASS itself grants a choice of (Rogue: 4, most
    // others: 2, Bard: 3 from any skill) — engine/data/classes/*.json's new
    // skill_choices field, verified RAW per class (see engine/CHECKLIST.md).
    // Wholly separate from the background's fixed 2-skill grant above.
    classSkillChoiceCount() {
      return this.selectedClass?.skill_choices?.count ?? 0
    },
    classSkillOptions() {
      const options = this.selectedClass?.skill_choices?.options
      if (!options) return []
      return options === 'any'
        ? this.skillsList
        : this.skillsList.filter((s) => options.includes(s.id))
    },
    classSkillAssignmentComplete() {
      const count = this.classSkillChoiceCount
      if (!count) return true
      const picked = this.selectedClassSkills.filter(Boolean)
      return picked.length === count && new Set(picked).size === count
    },
    // Normalizes the two real shapes languages can take in the species
    // catalog: the standard 9 PHB species use
    // {automatic:[...], choice:{count}} (engine/data/species.json); the 3
    // homebrew species (Catrin/Drevani/Hei'ugar, from api_data_cache/
    // species.json) predate this pass and already store a flat array of
    // fixed languages with no choice component — treated as fully
    // automatic, no picker needed.
    speciesAutomaticLanguages() {
      const spLang = this.selectedSpecies?.languages
      const automatic = Array.isArray(spLang) ? spLang : spLang?.automatic ?? []
      const subLang = this.selectedSubrace?.languages
      const subAutomatic = Array.isArray(subLang) ? subLang : []
      return [...automatic, ...subAutomatic]
    },
    // Species' own flexible language choice count, PLUS the chosen
    // subrace's (e.g. High Elf grants one extra on top of Elf's fixed
    // Common+Elvish — real RAW, matches how ability score bonuses stack).
    speciesLanguageChoiceTotal() {
      const spLang = this.selectedSpecies?.languages
      const speciesCount = Array.isArray(spLang)
        ? 0
        : spLang?.choice?.count ?? 0
      const subLang = this.selectedSubrace?.languages
      const subraceCount = Array.isArray(subLang)
        ? 0
        : subLang?.choice?.count ?? 0
      return speciesCount + subraceCount
    },
    speciesLanguageAssignmentComplete() {
      const count = this.speciesLanguageChoiceTotal
      if (!count) return true
      const picked = this.selectedSpeciesLanguages.filter(Boolean)
      return picked.length === count && new Set(picked).size === count
    },
    // The background's own "N languages of your choice" — e.g. Sage grants
    // 2 (engine/data/backgrounds.json's new language_choices field,
    // verified RAW per background). 0 for a custom/free-text background,
    // matching how its skill picker already has no curated data to pre-fill
    // from.
    backgroundLanguageChoiceCount() {
      return this.pickedBackground?.language_choices ?? 0
    },
    backgroundLanguageAssignmentComplete() {
      const count = this.backgroundLanguageChoiceCount
      if (!count) return true
      const picked = this.selectedBackgroundLanguages.filter(Boolean)
      return picked.length === count && new Set(picked).size === count
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
    abilityDescriptions() {
      return ABILITY_DESCRIPTIONS
    },
    priorityAbilities() {
      return dnd.priorityAbilitiesForClass(this.selectedClass)
    },
    // Level 1 HP is always max hit die + CON modifier, no rolling involved —
    // spelled out here just for the tooltip on the HP number, since the
    // roll/average controls that would normally show this math don't apply
    // at character creation.
    hpBreakdown() {
      const hitDie = this.selectedClass?.hitDie
      if (!hitDie) return ''
      const conMod = dnd.mod(this.finalScores.con)
      return `d${hitDie} (max) ${dnd.signed(conMod)} CON = ${
        hitDie + conMod
      } HP`
    },
    cantripPickCount() {
      return this.preview?.description?.spellcasting?.cantripsAfter ?? 0
    },
    spellPickCount() {
      return this.preview?.description?.spellcasting?.style === 'known'
        ? this.preview.description.spellcasting.knownAfter ?? 0
        : 0
    },
    filteredCantripOptions() {
      return filterSpellOptions(this.cantripOptions, this.cantripSearch)
    },
    filteredSpellOptions() {
      return filterSpellOptions(this.spellOptions, this.spellSearch)
    },
    finalScores() {
      const scores = { ...this.baseScores }
      if (this.useSpeciesBonus) {
        const sp = this.selectedSpecies
        if (sp) {
          for (const [a, n] of Object.entries(this.combinedFixedBonus)) {
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
    pendingFightingStyleChoice() {
      return (
        this.preview?.pendingChoices?.find(
          (p) => p.type === 'fightingStyleChoice'
        ) ?? null
      )
    },
    // A species with real subraces (Dwarf, Elf, Halfling, Gnome) requires
    // picking one — every other species (including all homebrew ones) has
    // none, so this is trivially true for them.
    subraceAssignmentComplete() {
      return (
        !this.selectedSpecies?.subraces?.length || Boolean(this.subraceName)
      )
    },
    canCreate() {
      return Boolean(
        this.name.trim() &&
          this.speciesName &&
          this.subraceAssignmentComplete &&
          this.abilityBonusAssignmentComplete &&
          this.className &&
          this.classSkillAssignmentComplete &&
          this.equipmentAssignmentComplete &&
          this.speciesLanguageAssignmentComplete &&
          this.backgroundLanguageAssignmentComplete &&
          this.pointsRemaining >= 0 &&
          this.cantripDraftPicks.length >= this.cantripPickCount &&
          this.spellDraftPicks.length >= this.spellPickCount &&
          !this.pendingFightingStyleChoice &&
          this.preview?.patch
      )
    },
  },

  watch: {
    '$store.state.newCharacterNavRequest': {
      immediate: true,
      handler(req) {
        if (!req) return
        if (req.species) this.speciesName = req.species
        if (req.className) this.className = req.className
        this.$store.commit('CLEAR_NEW_CHARACTER_NAV')
      },
    },
    fightingStyleChoice() {
      this.runPreview()
    },
    speciesName() {
      this.subraceName = null
      this.speciesChoiceAbilities = []
      this.speciesSkillChoiceValues = {}
      this.speciesToolChoiceValues = {}
      this.speciesSpellChoiceValues = {}
      this.speciesSpellOptionsByTrait = {}
      this.dragonbornAncestryChoice = null
      this.runPreview()
    },
    subraceName() {
      this.speciesSkillChoiceValues = {}
      this.speciesToolChoiceValues = {}
      this.speciesSpellChoiceValues = {}
      this.speciesSpellOptionsByTrait = {}
      this.runPreview()
    },
    // Sizes each choice-needing trait's value array to match its real
    // count, and kicks off the spell-options fetch for any spell-choice
    // trait — same "resize on whatever's owed changes" pattern
    // classSkillChoiceCount/speciesLanguageChoiceTotal already use below,
    // just per-trait instead of per-tab since more than one species/subrace
    // could theoretically need this at once.
    displayTraits: {
      immediate: true,
      handler(traits) {
        for (const t of traits) {
          if (t.grants_skill_proficiency_choice) {
            this.ensureChoiceArray(
              'speciesSkillChoiceValues',
              t.name,
              t.grants_skill_proficiency_choice.count
            )
          }
          if (t.grants_tool_proficiency_choice) {
            this.ensureChoiceArray(
              'speciesToolChoiceValues',
              t.name,
              t.grants_tool_proficiency_choice.count
            )
          }
          if (t.grants_spells?.choice) {
            this.ensureChoiceArray(
              'speciesSpellChoiceValues',
              t.name,
              t.grants_spells.choice.count
            )
            this.fetchSpeciesSpellOptions(t)
          }
        }
      },
    },
    className() {
      this.equipmentTakeGold = false
      this.equipmentChoiceSelections = Array(this.equipmentChoices.length).fill(
        null
      )
      this.equipmentWeaponPicks = {}
      this.cantripOptions = []
      this.cantripDraftPicks = []
      this.spellOptions = []
      this.spellDraftPicks = []
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
    // Resize the choice arrays whenever what's owed changes — covers a
    // class change (skill count), and a species OR subrace change for
    // languages (subrace can add to the species' own choice count, e.g.
    // High Elf). Existing picks beyond the new length are simply dropped;
    // Vue's v-model on each <select> re-binds to whatever null/value ends
    // up at that index.
    classSkillChoiceCount(count) {
      this.selectedClassSkills = Array(count).fill(null)
    },
    speciesLanguageChoiceTotal(count) {
      this.selectedSpeciesLanguages = Array(count).fill(null)
    },
    backgroundLanguageChoiceCount(count) {
      this.selectedBackgroundLanguages = Array(count).fill(null)
    },
  },

  async created() {
    try {
      const [species, backgrounds, skills, classes, languages] =
        await Promise.all([
          fetch('/api/engine/species').then((r) => (r.ok ? r.json() : [])),
          fetch('/api/engine/backgrounds').then((r) => (r.ok ? r.json() : [])),
          fetch('/api/engine/skills').then((r) => (r.ok ? r.json() : [])),
          fetch('/api/engine/classes').then((r) => (r.ok ? r.json() : [])),
          fetch('/api/engine/languages').then((r) => (r.ok ? r.json() : [])),
        ])
      this.speciesList = species
      this.curatedBackgroundList = backgrounds
      this.skillsList = skills
      this.classList = classes
      this.languagesList = [...languages, ...HOMEBREW_LANGUAGES]
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
    // Marginal cost of the NEXT point (e.g. 13->14 costs 2, not 1) — null
    // once already at the point-buy cap (15), since there's no next point.
    nextPointCost(score) {
      if (score >= 15) return null
      return (POINT_BUY_COSTS[score + 1] ?? 0) - (POINT_BUY_COSTS[score] ?? 0)
    },
    adjustScore(ability, delta) {
      const next = this.baseScores[ability] + delta
      if (next < 8 || next > 15) return
      this.$set(this.baseScores, ability, next)
    },

    skillNameFor(id) {
      return this.skillsList.find((s) => s.id === id)?.name ?? null
    },

    // Shared duplicate-prevention for BOTH skill pickers (background's
    // fixed-list selects and the class's own choice selects): a skill is
    // disabled if it's already taken elsewhere in the SAME array (own
    // index excluded) or anywhere in the OTHER array. Real RAW handles a
    // background/class skill overlap by letting the player choose a
    // replacement skill instead of double-dipping — this models that by
    // simply not offering the already-granted skill a second time, in
    // either direction, rather than tracking which side "wins."
    equipmentOptionLabel(option) {
      return option
        .map((e) => (e.qty > 1 ? `${e.name} x${e.qty}` : e.name))
        .join(', ')
    },
    // A class's starting_equipment.choices has no category name of its
    // own (engine/data/classes/*.json) — just a bare `options` array — so
    // every choice on this tab used to say the identical generic "Choose
    // one:", forcing a player to open both dropdowns just to see which one
    // was for a weapon vs. a pack. Derived here instead of adding a
    // `label` field to all 13 classes' data, since it's fully computable
    // from names already in that data (every real choice across the
    // roster is one of these 4 shapes — weapon, armor, focus, or pack).
    equipmentChoiceLabel(choice) {
      const names = choice.options.map((opt) => opt[0]?.name ?? '').join(' ')
      if (/pack/i.test(names)) return 'Equipment Pack'
      if (/armor|mail|shield/i.test(names)) return 'Armor'
      if (/pouch|focus/i.test(names)) return 'Spellcasting Focus'
      return 'Weapon'
    },
    weaponOptionsForFilter(filter) {
      return weaponOptionsForFilter(filter)
    },

    // Lazily sizes a trait's choice-value array to `count`, via $set so
    // Vue 2 tracks the new indices reactively — a plain assignment would
    // work too, but $set matches the pattern the rest of this file's
    // choice arrays use.
    ensureChoiceArray(stateKey, traitName, count) {
      if (this[stateKey][traitName]?.length === count) return
      this.$set(this[stateKey], traitName, Array(count).fill(null))
    },

    // Fetches the real eligible spell/cantrip list for a species trait's
    // grants_spells.choice (High Elf's "one wizard cantrip of your
    // choice") — same /api/engine/spell-choices endpoint the Level Up
    // tool's pickers use, just with an empty in-progress character since
    // this choice never depends on the character's own class.
    async fetchSpeciesSpellOptions(trait) {
      const key = trait.name
      if (this.speciesSpellOptionsByTrait[key]) return
      const choice = trait.grants_spells.choice
      try {
        const res = await fetch('/api/engine/spell-choices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: { classes: [], spells: [] },
            className: choice.class_list,
            cantripsOnly: Boolean(choice.cantrips_only),
          }),
        })
        this.$set(
          this.speciesSpellOptionsByTrait,
          key,
          res.ok ? (await res.json()).options : []
        )
      } catch {
        this.$set(this.speciesSpellOptionsByTrait, key, [])
      }
    },

    skillDisabled(skillId, sourceArray, currentIndex) {
      const takenInSameArray = sourceArray.some(
        (v, i) => i !== currentIndex && v === skillId
      )
      const otherArray =
        sourceArray === this.selectedSkills
          ? this.selectedClassSkills
          : this.selectedSkills
      return takenInSameArray || otherArray.includes(skillId)
    },

    // Same duplicate-prevention for languages, across all three sources at
    // once (species automatic, species choice, background choice) — you
    // can't gain anything by "choosing" a language you already know.
    languageDisabled(languageName, sourceArray, currentIndex) {
      if (this.speciesAutomaticLanguages.includes(languageName)) return true
      const takenInSameArray = sourceArray.some(
        (v, i) => i !== currentIndex && v === languageName
      )
      const otherArrays = [
        this.selectedSpeciesLanguages,
        this.selectedBackgroundLanguages,
      ].filter((arr) => arr !== sourceArray)
      return (
        takenInSameArray ||
        otherArrays.some((arr) => arr.includes(languageName))
      )
    },

    // Every other character record has an id ("characters_N") — ADD_CHARACTER
    // never assigned one, so New Character Tool builds were silently
    // shipping without it (caught 2026-09-02 on Siv and Jaygar). Compute the
    // next free number from what's already in the store rather than trusting
    // a counter, since ids aren't necessarily contiguous.
    nextCharacterId() {
      const nums = this.$store.state.characters
        .map((c) => /^characters_(\d+)$/.exec(c.id ?? '')?.[1])
        .filter(Boolean)
        .map(Number)
      return `characters_${nums.length ? Math.max(...nums) + 1 : 0}`
    },

    characterShell() {
      return {
        id: this.nextCharacterId(),
        name: this.name.trim(),
        full_name: this.fullName.trim() || this.name.trim(),
        image: this.imagePath.trim() || this.defaultImagePath,
        race: this.speciesName,
        subrace: this.subraceName,
        background: this.effectiveBackgroundName || null,
        level: 0,
        stat_str: this.finalScores.str,
        stat_dex: this.finalScores.dex,
        stat_con: this.finalScores.con,
        stat_int: this.finalScores.int,
        stat_wis: this.finalScores.wis,
        stat_cha: this.finalScores.cha,
        // Real attribution, not just the final numbers — see
        // engine/CHECKLIST.md's ability-score-history writeup.
        // species_bonus_applied records WHETHER the standard species bonus
        // was used at all (vs. the manual free +2/+1 toggle), independent of
        // ability_score_history (which records the actual amounts/sources).
        species_bonus_applied: this.useSpeciesBonus,
        species_traits: this.speciesTraitRecords,
        ability_score_history: this.abilityScoreHistorySeed,
        spellcasting_ability: this.selectedClass?.spellcasting?.ability ?? null,
        hp_max: 0,
        hp_current: 0,
        // Real bug found auditing Siv (Rogue 9): this was always [], even
        // though selectedClass.saving_throw_proficiencies is right there
        // and already shown as info text in the Class tab — it just never
        // got assigned into the actual character record.
        saving_throws: this.selectedClass?.saving_throw_proficiencies ?? [],
        // Background's fixed 2-skill grant, the class's own "choose N"
        // grant, and species/subrace traits that grant a skill (Keen
        // Senses, Menacing, Skill Versatility's choice) — deduped.
        skill_proficiencies: [
          ...new Set(
            [
              ...this.selectedSkills,
              ...this.selectedClassSkills,
              ...this.resolvedSpeciesGrants.skills,
            ]
              .filter(Boolean)
              .map((id) => this.skillNameFor(id))
              .filter(Boolean)
          ),
        ],
        skill_expertise: [],
        // Species' automatic grant (e.g. Dwarf: Common+Dwarvish) plus its
        // own flexible choice (Human, Half-Elf, High Elf) plus the
        // background's "N languages of your choice" (e.g. Sage), deduped.
        languages: [
          ...new Set([
            ...this.speciesAutomaticLanguages,
            ...this.selectedSpeciesLanguages.filter(Boolean),
            ...this.selectedBackgroundLanguages.filter(Boolean),
          ]),
        ],
        // Real mechanical wiring for species/subrace traits (2026-09-07,
        // see TODO.md) — previously these fields either didn't exist on
        // the shell at all (speed, darkvision, weapon/armor proficiencies —
        // a real pre-existing bug: the class's OWN starting proficiency
        // list was never written either) or had nowhere to record a
        // species-granted resistance/tool proficiency (both new fields).
        speed: this.displaySpeed,
        darkvision: this.displayDarkvision,
        weapon_proficiencies: [
          ...new Set([
            ...(this.selectedClass?.weapon_proficiencies ?? []),
            ...this.resolvedSpeciesGrants.weapons,
          ]),
        ],
        armor_proficiencies: [
          ...new Set([
            ...(this.selectedClass?.armor_proficiencies ?? []),
            ...this.resolvedSpeciesGrants.armor,
          ]),
        ],
        tool_proficiencies: this.resolvedSpeciesGrants.tools,
        resistances: this.resolvedSpeciesGrants.resistances,
        // Informational only, matching this app's DM-arbitrated design (see
        // CLAUDE.md) — this app doesn't roll dice or resolve advantage
        // itself anywhere, so this is a recorded fact for the sheet/DM to
        // apply at the table, not a mechanic the app enforces.
        saving_throw_advantages:
          this.resolvedSpeciesGrants.savingThrowAdvantages,
        // Species-granted cantrips/spells (High Elf's Cantrip, Forest
        // Gnome's Natural Illusionist, Drow Magic, Infernal Legacy) ride
        // in as ordinary features with spells_granted — spellUtils.js's
        // existing feature-granted-spells aggregation (step 3 of
        // getCharacterSpells) already picks these up with no engine
        // changes needed, the same path Fey Touched/Shadow Touched use.
        features: this.resolvedSpeciesGrants.spellFeatures,
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
            spellChoices: {
              cantrips: this.cantripDraftPicks,
              spells: this.spellDraftPicks,
            },
            fightingStyleChoice: this.fightingStyleChoice,
          }),
        })
        const data = await res.json()
        if (!res.ok)
          throw new Error(data.error || `Server returned ${res.status}`)
        this.preview = data
        this.loadFeatureDescriptions(
          data.newFeatures?.map((f) => ({ name: f.name, id: f.id }))
        )
        const fightingStyleChoice = data.pendingChoices?.find(
          (p) => p.type === 'fightingStyleChoice'
        )
        if (fightingStyleChoice) {
          this.fightingStyleOptions = fightingStyleChoice.options
          this.loadFeatureDescriptions(
            fightingStyleChoice.options.map((o) => ({
              name: `Fighting Style: ${o}`,
            }))
          )
        }
        if (data.description.spellcasting) {
          if (!this.cantripOptions.length) {
            this.fetchSpellOptions('cantripOptions', { cantripsOnly: true })
          }
          if (
            data.description.spellcasting.style === 'known' &&
            !this.spellOptions.length
          ) {
            this.fetchSpellOptions('spellOptions', { cantripsOnly: false })
          }
        }
      } catch (err) {
        this.error = err.message
        this.preview = null
      } finally {
        this.loading = false
      }
    },

    // Same route/shape LevelUpTool.vue's known-spell/cantrip picker uses —
    // toLevel: 1 and a level-0 classes[] entry (see characterShell()) makes
    // the engine treat this as the 0→1 transition, so cantripsBefore/
    // knownBefore are both 0 and the "gained" count is just the full count.
    async fetchSpellOptions(optionsProp, { cantripsOnly } = {}) {
      if (!this.className) {
        this[optionsProp] = []
        return
      }
      try {
        const res = await fetch('/api/engine/spell-choices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: this.characterShell(),
            className: this.className,
            toLevel: 1,
            cantripsOnly: Boolean(cantripsOnly),
          }),
        })
        const data = await res.json()
        this[optionsProp] = res.ok ? data.options ?? [] : []
      } catch {
        this[optionsProp] = []
      }
    },

    // Shared by the cantrip and known-spell pickers — capped at `limit`,
    // re-previews immediately so the "N more cantrips/spells" count and the
    // patch.spells summary reflect the pick right away.
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

    // features: array of {name, id} (id optional) — id, when present, skips
    // straight to an exact catalog match instead of risking a same-named
    // collision (e.g. two subclasses both having a "Spellcasting" feature).
    async loadFeatureDescriptions(features) {
      for (const { name, id } of features ?? []) {
        if (name in this.featureDescriptions) continue
        this.$set(this.featureDescriptions, name, null)
        const result = await lookupFeature(name, id)
        this.$set(this.featureDescriptions, name, result?.description ?? null)
      }
    },

    // Resolves the Equipment tab's picks into real party_items.json entries
    // (weapons/armor/foci carried-but-not-equipped, gear tools disallowed
    // from equipping — matches CharacterInventory.vue's own convention) plus
    // any gold-alternative roll. Returns { items, gold } — gold is only
    // nonzero when equipmentTakeGold was checked.
    resolveStartingEquipment(characterName) {
      if (!this.selectedClass?.starting_equipment) return { items: [], gold: 0 }
      if (this.equipmentTakeGold) {
        return {
          items: [],
          gold: rollGoldAlternative(this.equipmentGoldAlternative),
        }
      }
      const resolved = []
      const push = (entry, weaponCategory) => {
        const item = resolveGearEntry(entry, weaponCategory)
        if (!item) return
        resolved.push({
          ...item,
          carried_by: characterName,
          equipped_by: isEquippableType(item.type) ? null : 'disallowed',
          needs_attunement: false,
          attuned: false,
          notes: item.notes ?? '',
        })
      }
      this.equipmentFixed.forEach((entry, i) => {
        push(
          entry,
          entry.filter ? this.equipmentWeaponPicks[`fixed-${i}`] : undefined
        )
      })
      this.equipmentChoices.forEach((choice, ci) => {
        const oi = this.equipmentChoiceSelections[ci]
        if (oi == null) return
        choice.options[oi].forEach((entry, ei) => {
          if (!entry.filter) {
            push(entry)
            return
          }
          const qty = entry.qty || 1
          for (let wi = 0; wi < qty; wi++) {
            push(
              { ...entry, qty: 1 },
              this.equipmentWeaponPicks[`${ci}-${ei}-${wi}`]
            )
          }
        })
      })
      return { items: resolved, gold: 0 }
    },

    createCharacter() {
      if (!this.canCreate) return
      const shell = this.characterShell()
      const character = { ...shell, ...this.preview.patch }
      this.$store.commit('ADD_CHARACTER', character)

      const { items, gold } = this.resolveStartingEquipment(character.name)
      if (items.length) this.$store.commit('ADD_PARTY_ITEMS', items)
      if (gold > 0) this.$store.commit('ADJUST_PARTY_GOLD', gold)

      this.name = ''
      this.fullName = ''
      this.speciesName = null
      this.subraceName = null
      this.speciesChoiceAbilities = []
      this.useSpeciesBonus = false
      this.manualPlusTwoAbility = null
      this.manualPlusOneAbility = null
      this.backgroundChoice = null
      this.customBackgroundName = ''
      this.selectedSkills = [null, null]
      this.selectedClassSkills = []
      this.selectedSpeciesLanguages = []
      this.selectedBackgroundLanguages = []
      this.className = null
      this.baseScores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
      this.cantripOptions = []
      this.cantripDraftPicks = []
      this.spellOptions = []
      this.spellDraftPicks = []
      this.fightingStyleChoice = null
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

.nct-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
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

.nct-ability-row--priority .nct-ability-label {
  color: var(--accent, #b8860b);
  text-decoration: underline dotted;
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

.nct-ability-next-cost {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  width: 4rem;
}

.nct-ability-next-cost--maxed {
  font-style: italic;
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

.nct-spell-picker {
  margin: 0.6rem 0;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.nct-pick-list {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  max-height: 12rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nct-note-inline {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: help;
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
