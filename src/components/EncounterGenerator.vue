﻿
<template>
  <div class="enc-gen">
    <!-- â"€â"€ Options panel â"€â"€ -->
    <div class="enc-options">
      <!-- Party source -->
      <section class="opt-section">
        <div class="opt-header">Party</div>

        <!-- Combat roster mode: locked to active combatants -->
        <template v-if="combatRoster">
          <div class="opt-hint opt-hint--roster">From combat panel</div>
          <div class="party-pills">
            <span v-for="c in partyCharacters" :key="c.name" class="party-pill">
              {{ c.name }} <span class="pill-level">Lv{{ c.level }}</span>
            </span>
          </div>
        </template>

        <!-- Normal mode: party picker + manual -->
        <template v-else>
          <div class="source-pills">
            <span
              v-for="p in allParties"
              :key="p.id"
              class="source-pill"
              :class="{ active: selectedPartyId === p.id }"
              @click="selectStoreParty(p.id)"
              >{{ p.name
              }}<span v-if="p.active" class="pill-active-dot">●</span></span
            >
            <span
              class="source-pill"
              :class="{ active: partyMode === 'manual' }"
              @click="partyMode = 'manual'"
              >Manual</span
            >
          </div>

          <div
            v-if="partyMode === 'party' && partyCharacters.length"
            class="party-pills"
          >
            <span v-for="c in partyCharacters" :key="c.name" class="party-pill">
              {{ c.name }} <span class="pill-level">Lv{{ c.level }}</span>
            </span>
          </div>
          <div
            v-if="partyMode === 'party' && !partyCharacters.length"
            class="opt-hint"
          >
            No members found.
          </div>

          <template v-if="partyMode === 'manual'">
            <label class="opt-label nudge">
              Level
              <input
                type="number"
                v-model.number="manualLevel"
                min="1"
                max="20"
                class="num-input"
              />
            </label>
            <label class="opt-label nudge">
              Characters
              <input
                type="number"
                v-model.number="manualCount"
                min="1"
                max="12"
                class="num-input"
              />
            </label>
          </template>
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

    <!-- â"€â"€ Result panel â"€â"€ -->
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
          <span class="enc-badge count"
            >{{ encounter.enemies.length }} enemies</span
          >
        </div>
        <div v-if="encounter.typeConfig" class="enc-type-notes">
          {{ encounter.typeConfig }}
        </div>

        <div class="enc-export-bar">
          <button class="enc-export-all-btn" @click="exportAll">
            Export All
          </button>
        </div>

        <div class="enemy-list">
          <div
            v-for="enemy in encounter.enemies"
            :key="enemy.id"
            class="enemy-row"
            :class="{ 'is-boss': enemy.isBoss }"
          >
            <div class="enemy-header">
              <div class="enemy-name">{{ enemy.name }}</div>
              <div class="enemy-controls">
                <span
                  class="source-badge"
                  :class="'src-' + sourceClass(enemy.source)"
                >
                  {{ enemy.source === 'humanoid' ? 'Humanoid' : enemy.source }}
                  <span v-if="enemy.monsterCR"> CR{{ enemy.monsterCR }}</span>
                </span>
                <!-- Override: change source type -->
                <select
                  v-if="showOverride === enemy.id"
                  class="source-select"
                  :value="enemy.source"
                  @change="overrideSource(enemy, $event.target.value)"
                >
                  <option value="humanoid">Humanoid</option>
                  <option v-for="t in overridePool" :key="t" :value="t">
                    {{ t }}
                  </option>
                </select>
                <button
                  class="override-btn"
                  :title="showOverride === enemy.id ? 'Close' : 'Change source'"
                  @click="toggleOverride(enemy.id)"
                >
                  Change
                </button>
                <button
                  class="reroll-btn"
                  title="Reroll this enemy"
                  @click="rerollEnemy(enemy)"
                >
                  Reroll
                </button>
                <button
                  class="hide-abilities-btn"
                  :title="
                    revealedAbilities[enemy.id]
                      ? 'Hide abilities from players'
                      : 'Reveal abilities'
                  "
                  :class="{ 'is-hidden': !revealedAbilities[enemy.id] }"
                  @click="toggleHideAbilities(enemy.id)"
                >
                  {{ revealedAbilities[enemy.id] ? 'Hide' : 'Show' }}
                </button>
                <button
                  class="export-enemy-btn"
                  title="Copy to clipboard"
                  @click="exportEnemy(enemy)"
                >
                  Copy
                </button>
              </div>
            </div>
            <div class="enemy-stats">
              <span class="estat">HP {{ enemy.hp }}</span>
              <span class="estat">AC {{ enemy.ac }}</span>
              <span class="estat">Atk {{ enemy.attackBonus }}</span>
              <span class="estat">{{ enemy.weapon.displayName }}</span>
              <span v-if="enemy.gender" class="estat gender-race"
                >{{ enemy.gender }} {{ enemy.race }}</span
              >
              <span v-if="enemy.monsterSize" class="estat">{{
                enemy.monsterSize
              }}</span>
            </div>
            <div class="enemy-scores">
              <span v-for="s in statKeys" :key="s" class="score-chip">
                <span class="score-label">{{ s }}</span>
                <span class="score-val">{{ enemy.stats[s] }}</span>
                <span class="score-mod">{{ modStr(enemy.stats[s]) }}</span>
              </span>
            </div>
            <div v-if="revealedAbilities[enemy.id]" class="enemy-abilities">
              <div
                v-if="enemy.features && enemy.features.length"
                class="ability-section"
              >
                <div class="ability-section-label">Features</div>
                <div
                  v-for="f in enemy.features"
                  :key="f.name"
                  class="ability-entry"
                >
                  <span class="ability-name">{{ f.name }}.</span>
                  <span class="ability-desc">{{ f.description }}</span>
                </div>
              </div>
              <div
                v-if="enemy.spells && enemy.spells.length"
                class="ability-section"
              >
                <div class="ability-section-label">Spells</div>
                <div
                  v-for="s in enemy.spells"
                  :key="s.name"
                  class="ability-entry"
                >
                  <span class="ability-name">{{ s.name }}.</span>
                  <span class="ability-desc">{{ s.description }}</span>
                </div>
              </div>
            </div>
            <div
              v-if="!revealedAbilities[enemy.id]"
              class="abilities-hidden-note"
            >
              Abilities hidden — click Show to reveal
            </div>
          </div>
        </div>

        <div v-if="exportOutput" class="export-output">
          <div class="export-output-header">
            <span>Copied to clipboard failed — copy manually:</span>
            <button class="export-close-btn" @click="exportOutput = ''">
              ✕
            </button>
          </div>
          <textarea
            class="export-textarea"
            :value="exportOutput"
            readonly
            @focus="$event.target.select()"
          ></textarea>
        </div>
      </div>

      <div v-if="lastEncounter && !encounter" class="last-enc-hint">
        Last encounter archived.
      </div>
    </div>

    <!-- ── Encounter config wizard ── -->
    <div
      v-if="showWizard"
      class="wizard-overlay"
      @click.self="showWizard = false"
    >
      <div class="wizard-panel">
        <div class="wizard-header">
          <span class="wizard-title">
            {{ currentSlot.isBoss ? '★ Boss' : 'Enemy' }}
            {{ wizardStep + 1 }} of {{ wizardSlots.length }}
            <span v-if="wizardType !== 'random'" class="wiz-type-hint"
              >— {{ wizardType }}</span
            >
          </span>
          <span class="wizard-diff-badge">{{ wizardDifficulty }}</span>
          <button class="wizard-close" @click="showWizard = false">✕</button>
        </div>

        <div class="wizard-body">
          <!-- ── LEFT: configuration ── -->
          <div class="wizard-left">
            <!-- Source -->
            <div class="wiz-section">
              <div class="wiz-label">Source</div>
              <div class="wiz-chips">
                <span
                  class="wiz-chip"
                  :class="{ active: currentSlot.source === 'humanoid' }"
                  @click="setSlotProp('source', 'humanoid')"
                  >Humanoid</span
                >
                <span
                  v-for="t in wizardPoolTypes"
                  :key="t"
                  class="wiz-chip"
                  :class="{ active: currentSlot.source === t }"
                  @click="setSlotProp('source', t)"
                  >{{ t }}</span
                >
              </div>
            </div>

            <!-- Humanoid: role / race / gender -->
            <template v-if="currentSlot.source === 'humanoid'">
              <div class="wiz-section">
                <div class="wiz-label">Role</div>
                <div class="wiz-chips">
                  <span
                    class="wiz-chip"
                    :class="{ active: currentSlot.role === null }"
                    @click="setSlotProp('role', null)"
                    >Random</span
                  >
                  <span
                    v-for="key in roleKeys"
                    :key="key"
                    class="wiz-chip"
                    :class="{ active: currentSlot.role === key }"
                    @click="setSlotProp('role', key)"
                    >{{ roleProfiles[key].label }}</span
                  >
                </div>
              </div>
              <div class="wiz-section">
                <div class="wiz-label">Race</div>
                <div class="wiz-chips">
                  <span
                    class="wiz-chip"
                    :class="{ active: currentSlot.race === null }"
                    @click="setSlotProp('race', null)"
                    >Random</span
                  >
                  <span
                    v-for="r in races"
                    :key="r"
                    class="wiz-chip"
                    :class="{ active: currentSlot.race === r }"
                    @click="setSlotProp('race', r)"
                    >{{ r }}</span
                  >
                </div>
              </div>
              <div class="wiz-section">
                <div class="wiz-label">Gender</div>
                <div class="wiz-chips">
                  <span
                    class="wiz-chip"
                    :class="{ active: currentSlot.gender === null }"
                    @click="setSlotProp('gender', null)"
                    >Random</span
                  >
                  <span
                    v-for="g in genders"
                    :key="g"
                    class="wiz-chip"
                    :class="{ active: currentSlot.gender === g }"
                    @click="setSlotProp('gender', g)"
                    >{{ g }}</span
                  >
                </div>
              </div>
            </template>

            <!-- Bestiary: optional specific monster picker -->
            <template v-else-if="currentSlot.source">
              <div class="wiz-section">
                <div class="wiz-label">
                  Specific Creature
                  <span class="wiz-optional"
                    >optional — leave blank for random</span
                  >
                </div>

                <!-- Selected monster pill -->
                <div
                  v-if="currentSlot.specificMonster"
                  class="selected-monster"
                >
                  <span class="sm-name">{{
                    currentSlot.specificMonster.name
                  }}</span>
                  <span class="sm-cr"
                    >CR{{ currentSlot.specificMonster.cr }}</span
                  >
                  <span class="sm-size">{{
                    currentSlot.specificMonster.size
                  }}</span>
                  <button class="sm-clear" @click="clearSpecificMonster">
                    ✕
                  </button>
                </div>

                <!-- Search + list -->
                <template v-else>
                  <input
                    v-model="monsterSearch"
                    class="field monster-search"
                    :placeholder="`Search ${currentSlot.source} creatures…`"
                  />
                  <div class="monster-list">
                    <div
                      v-for="m in filteredBestiaryPool"
                      :key="m.name"
                      class="monster-option"
                      @click="selectSpecificMonster(m)"
                    >
                      <span class="mon-name">{{ m.name }}</span>
                      <span class="mon-cr">CR {{ m.cr }}</span>
                      <span class="mon-size">{{ m.size }}</span>
                    </div>
                    <div v-if="!filteredBestiaryPool.length" class="mon-empty">
                      No matches
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- ── RIGHT: live preview ── -->
          <div class="wizard-right">
            <div class="preview-header">
              <span class="preview-label">Generated Preview</span>
              <button class="preview-reroll" @click="rerollPreview">
                ↺ Reroll
              </button>
            </div>

            <div v-if="previewEnemy" class="preview-card">
              <div class="preview-name">
                {{ previewEnemy.name }}
                <span v-if="previewEnemy.isBoss" class="preview-boss-tag"
                  >Boss</span
                >
              </div>
              <div class="preview-badges">
                <span
                  class="source-badge"
                  :class="'src-' + sourceClass(previewEnemy.source)"
                >
                  {{
                    previewEnemy.source === 'humanoid'
                      ? 'Humanoid'
                      : previewEnemy.source
                  }}
                  <span v-if="previewEnemy.monsterCR">
                    CR{{ previewEnemy.monsterCR }}</span
                  >
                </span>
                <span v-if="previewEnemy.monsterSize" class="preview-size">{{
                  previewEnemy.monsterSize
                }}</span>
              </div>
              <div class="preview-stats">
                <span class="preview-stat">HP {{ previewEnemy.hp }}</span>
                <span class="preview-stat">AC {{ previewEnemy.ac }}</span>
                <span class="preview-stat"
                  >Atk {{ previewEnemy.attackBonus }}</span
                >
                <span class="preview-stat">{{
                  previewEnemy.weapon.displayName
                }}</span>
              </div>
              <div v-if="previewEnemy.gender" class="preview-flavor">
                {{ previewEnemy.gender }} {{ previewEnemy.race }}
              </div>
              <div class="preview-scores">
                <span v-for="s in statKeys" :key="s" class="preview-score">
                  <span class="ps-label">{{ s }}</span>
                  <span class="ps-val">{{ previewEnemy.stats[s] }}</span>
                  <span class="ps-mod">{{
                    modStr(previewEnemy.stats[s])
                  }}</span>
                </span>
              </div>
            </div>

            <div v-else class="preview-empty">
              Select a source above to see a preview
            </div>
          </div>
        </div>

        <div class="wizard-actions">
          <button
            class="wiz-btn secondary"
            :disabled="wizardStep === 0"
            @click="wizardPrev"
          >
            ← Back
          </button>
          <div class="wiz-actions-right">
            <button class="wiz-btn ghost" @click="wizardRandomizeRemaining">
              Randomize Remaining
            </button>
            <button class="wiz-btn primary" @click="wizardNext">
              {{
                wizardStep === wizardSlots.length - 1 ? 'Generate' : 'Next →'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  ENCOUNTER_TYPES,
  ENCOUNTER_TYPE_CONFIG,
  DIFFICULTY_SELECTABLE,
  ROLE_PROFILES,
  ROLE_KEYS,
  planEncounter,
  generateEncounter,
  regenerateEnemy,
  getBestiaryPool,
  estimatePartyHP,
  analyzeParty,
} from '../utils/encounter_utils.js'
import { GENDERS, RACES } from '../utils/character_utils.js'
import { STAT_KEYS } from '../utils/dnd_utils.js'

const ENC_TYPES = Object.freeze(ENCOUNTER_TYPES)
const ENC_CONFIG = Object.freeze(ENCOUNTER_TYPE_CONFIG)
const DIFFICULTIES = Object.freeze(DIFFICULTY_SELECTABLE)
const STAT_KEY_LIST = Object.freeze(STAT_KEYS.map((s) => s.key))
const ROLE_PROF_LIST = Object.freeze(ROLE_PROFILES)
const ROLE_KEY_LIST = Object.freeze(ROLE_KEYS)
const RACE_LIST = Object.freeze(RACES)
const GENDER_LIST = Object.freeze(GENDERS)

// All unique bestiary types that appear in any type config pool
const ALL_BESTIARY_TYPES = [
  ...new Set(
    Object.values(ENCOUNTER_TYPE_CONFIG).flatMap((c) =>
      c.pool.filter((p) => p !== 'humanoid')
    )
  ),
].sort()

export default {
  name: 'EncounterGenerator',

  props: {
    combatRoster: { type: Array, default: null },
  },

  data() {
    return {
      partyMode: 'party',
      selectedPartyId: null, // id of selected store party (null = active)
      manualLevel: 5,
      manualCount: 4,
      difficulty: 'medium',
      encounterType: 'random',
      encounterTypes: ENC_TYPES,
      difficulties: DIFFICULTIES,
      error: '',
      statKeys: STAT_KEY_LIST,
      roleProfiles: ROLE_PROF_LIST,
      roleKeys: ROLE_KEY_LIST,
      races: RACE_LIST,
      genders: GENDER_LIST,
      allBestiaryTypes: ALL_BESTIARY_TYPES,
      // wizard state
      showWizard: false,
      wizardSlots: [],
      wizardStep: 0,
      wizardDifficulty: '',
      wizardType: '',
      // encounter card override state
      showOverride: null,
      // wizard preview state
      previewEnemy: null,
      monsterSearch: '',
      // ability visibility — false by default (hidden); true when DM reveals
      revealedAbilities: {},
      // export output fallback when clipboard is unavailable
      exportOutput: '',
    }
  },

  computed: {
    allParties() {
      return this.$store.state.parties
    },

    selectedParty() {
      if (this.partyMode !== 'party') return null
      if (this.selectedPartyId)
        return (
          this.allParties.find((p) => p.id === this.selectedPartyId) ?? null
        )
      return this.allParties.find((p) => p.active) ?? null
    },

    activePartyNames() {
      if (this.combatRoster?.length) return this.combatRoster
      return this.selectedParty?.members ?? []
    },

    partyCharacters() {
      const chars = this.$store.state.characters
      return this.activePartyNames
        .map((name) => chars.find((c) => c.name === name))
        .filter(Boolean)
        .map((c) => ({
          name: c.name,
          level: c.level ?? 1,
          hp_max: c.hp_max ?? 10,
          classes: c.classes ?? [],
        }))
    },

    partyProfile() {
      return analyzeParty(this.partyCharacters)
    },

    effectiveParty() {
      if (this.partyMode === 'manual' || !this.partyCharacters.length) {
        const { minHP, maxHP } = estimatePartyHP(this.manualLevel)
        return { size: this.manualCount, level: this.manualLevel, minHP, maxHP }
      }
      const levels = this.partyCharacters.map((c) => c.level)
      const hps = this.partyCharacters.map((c) => c.hp_max)
      return {
        size: this.partyCharacters.length,
        level: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
        minHP: Math.min(...hps),
        maxHP: Math.max(...hps),
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

    // Pool of bestiary types available for the wizard's source selector
    wizardPoolTypes() {
      const cfg = ENC_CONFIG[this.wizardType]
      if (!cfg) return this.allBestiaryTypes
      return cfg.pool.filter((p) => p !== 'humanoid')
    },

    wizardBestiaryPool() {
      const slot = this.currentSlot
      if (!slot.source || slot.source === 'humanoid') return []
      const typeConfig = ENC_CONFIG[this.wizardType]
      return getBestiaryPool(
        slot.source,
        this.effectiveParty.level,
        slot.isBoss,
        typeConfig?.sizeMax ?? null
      )
    },

    filteredBestiaryPool() {
      const q = this.monsterSearch.toLowerCase().trim()
      const pool = this.wizardBestiaryPool
      if (!q) return pool.slice(0, 60)
      return pool.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 60)
    },

    // Pool for per-enemy override selector in the encounter card
    overridePool() {
      const cfg = this.encounter ? ENC_CONFIG[this.encounter.type] : null
      if (!cfg) return this.allBestiaryTypes
      return cfg.pool.filter((p) => p !== 'humanoid').length
        ? cfg.pool.filter((p) => p !== 'humanoid')
        : this.allBestiaryTypes
    },
  },

  methods: {
    selectStoreParty(id) {
      this.partyMode = 'party'
      this.selectedPartyId = id
    },

    modStr(score) {
      const m = Math.floor((score - 10) / 2)
      return m >= 0 ? `+${m}` : `${m}`
    },

    sourceClass(source) {
      if (!source || source === 'humanoid') return 'humanoid'
      const map = {
        Beast: 'beast',
        Monstrosity: 'beast',
        Fiend: 'fiend',
        Undead: 'undead',
        Aberration: 'aberration',
        Construct: 'construct',
        Ooze: 'ooze',
        Dragon: 'dragon',
        Giant: 'giant',
        Fey: 'fey',
        Elemental: 'elemental',
      }
      return map[source] ?? 'other'
    },

    // ── Preview helpers ──

    _hpRange() {
      const { minHP, maxHP } = this.effectiveParty
      const offsets = {
        trivial: [-10, -5],
        easy: [-2, 5],
        medium: [5, 20],
        hard: [15, 40],
        deadly: [25, 60],
      }
      const [minOff, maxOff] = offsets[this.wizardDifficulty] ?? offsets.medium
      const hpMin = Math.max(1, minHP + minOff)
      const hpMax = Math.max(hpMin + 5, maxHP + maxOff)
      return { hpMin, hpMax }
    },

    generatePreview() {
      const slot = this.currentSlot
      if (!slot || !slot.source) {
        this.previewEnemy = null
        return
      }
      const { level } = this.effectiveParty
      const { hpMin, hpMax } = this._hpRange()
      const typeConfig = ENC_CONFIG[this.wizardType] ?? null
      this.previewEnemy = regenerateEnemy({
        source: slot.source,
        partyLevel: level,
        hpMin,
        hpMax,
        isBoss: slot.isBoss,
        typeConfig,
        specificMonster: slot.specificMonster ?? null,
        role: slot.role,
        race: slot.race,
        gender: slot.gender,
        difficulty: this.wizardDifficulty || this.difficulty,
        partyProfile: this.partyProfile,
      })
    },

    rerollPreview() {
      // Clear specific monster then regenerate
      const slot = this.wizardSlots[this.wizardStep]
      if (slot.specificMonster) {
        this.$set(this.wizardSlots, this.wizardStep, {
          ...slot,
          specificMonster: null,
        })
      }
      this.generatePreview()
    },

    selectSpecificMonster(monster) {
      const slot = this.wizardSlots[this.wizardStep]
      this.$set(this.wizardSlots, this.wizardStep, {
        ...slot,
        specificMonster: monster,
      })
      this.monsterSearch = ''
      this.generatePreview()
    },

    clearSpecificMonster() {
      const slot = this.wizardSlots[this.wizardStep]
      this.$set(this.wizardSlots, this.wizardStep, {
        ...slot,
        specificMonster: null,
      })
      this.generatePreview()
    },

    generate() {
      this.error = ''
      const { size, level, minHP, maxHP } = this.effectiveParty
      if (size < 1 || level < 1) {
        this.error = 'Invalid party configuration.'
        return
      }

      const { resolvedDifficulty, resolvedType, slots } = planEncounter({
        difficulty: this.difficulty,
        partySize: size,
        type: this.encounterType,
      })
      this.wizardSlots = slots
      this.wizardStep = 0
      this.wizardDifficulty = resolvedDifficulty
      this.wizardType = resolvedType
      this.monsterSearch = ''
      this.previewEnemy = null
      this.showWizard = true
      this.$nextTick(() => this.generatePreview())
    },

    finishWizard() {
      this.showWizard = false
      this.revealedAbilities = {}
      this.exportOutput = ''
      const { size, level, minHP, maxHP } = this.effectiveParty
      const encounter = generateEncounter({
        resolvedDifficulty: this.wizardDifficulty,
        resolvedType: this.wizardType,
        partySize: size,
        partyLevel: level,
        minPartyHP: minHP,
        maxPartyHP: maxHP,
        slots: this.wizardSlots,
        partyProfile: this.partyProfile,
      })
      this.$store.commit('SET_ENCOUNTER', encounter)
    },

    wizardNext() {
      if (this.wizardStep < this.wizardSlots.length - 1) {
        this.wizardStep++
        this.monsterSearch = ''
        this.generatePreview()
      } else {
        this.finishWizard()
      }
    },

    wizardPrev() {
      if (this.wizardStep > 0) {
        this.wizardStep--
        this.monsterSearch = ''
        this.generatePreview()
      }
    },

    wizardRandomizeRemaining() {
      for (let i = this.wizardStep; i < this.wizardSlots.length; i++) {
        this.$set(this.wizardSlots, i, {
          ...this.wizardSlots[i],
          role: null,
          race: null,
          gender: null,
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
        name: e.name,
        mod: Math.floor((e.stats.dex - 10) / 2),
        encounterData: e,
      }))
      this.$store.commit('SET_PENDING_COMBAT_ENEMIES', enemies)
      this.$store.commit('REQUEST_COMBAT_NAV')
    },

    setSlotProp(prop, value) {
      const slot = this.wizardSlots[this.wizardStep]
      const current = slot[prop]
      const newValue = current === value ? null : value

      this.$set(this.wizardSlots, this.wizardStep, {
        ...slot,
        [prop]: newValue,
      })

      // Source change needs full regeneration.
      // For role / race / gender, patch the existing preview in-place so the
      // other randomly-generated fields (HP, stats, AC) don't re-roll on every click.
      if (!this.previewEnemy || prop === 'source') {
        this.$nextTick(() => this.generatePreview())
        return
      }

      const p = this.previewEnemy
      if (prop === 'race') {
        const race = newValue ?? p.race
        this.previewEnemy = {
          ...p,
          race,
          name: `${p.isBoss ? 'Boss — ' : ''}${race} ${p.roleLabel}`,
        }
      } else if (prop === 'gender') {
        this.previewEnemy = { ...p, gender: newValue ?? p.gender }
      } else if (prop === 'role') {
        const roleKey = newValue ?? p.role
        const profile = ROLE_PROFILES[roleKey]
        const roleLabel = profile?.label ?? p.roleLabel
        this.previewEnemy = {
          ...p,
          role: roleKey,
          roleLabel,
          name: `${p.isBoss ? 'Boss — ' : ''}${
            p.race ?? ''
          } ${roleLabel}`.trim(),
        }
      } else {
        this.$nextTick(() => this.generatePreview())
      }
    },

    // ── Per-enemy override / reroll ──

    toggleOverride(enemyId) {
      this.showOverride = this.showOverride === enemyId ? null : enemyId
    },

    rerollEnemy(enemy) {
      this.showOverride = null
      const enc = this.encounter
      if (!enc) return
      const { level, minHP, maxHP } = this.effectiveParty
      const params = {
        trivial: { hpMinOffset: -10, hpMaxOffset: -5 },
        easy: { hpMinOffset: -2, hpMaxOffset: 5 },
        medium: { hpMinOffset: 5, hpMaxOffset: 20 },
        hard: { hpMinOffset: 15, hpMaxOffset: 40 },
        deadly: { hpMinOffset: 25, hpMaxOffset: 60 },
      }
      const p = params[enc.difficulty] ?? params.medium
      const hpMin = Math.max(1, minHP + p.hpMinOffset)
      const hpMax = Math.max(hpMin + 5, maxHP + p.hpMaxOffset)
      const typeConfig = ENC_CONFIG[enc.type] ?? null
      const newEnemy = regenerateEnemy({
        source: enemy.source,
        partyLevel: level,
        hpMin,
        hpMax,
        isBoss: enemy.isBoss,
        typeConfig,
        difficulty: enc.difficulty,
        partyProfile: this.partyProfile,
      })
      newEnemy.id = enemy.id // keep same id so the list doesn't re-order
      this.$store.commit('UPDATE_ENCOUNTER_ENEMY', {
        enemyId: enemy.id,
        newEnemy,
      })
    },

    overrideSource(enemy, newSource) {
      this.showOverride = null
      const enc = this.encounter
      if (!enc) return
      const { level, minHP, maxHP } = this.effectiveParty
      const params = {
        trivial: { hpMinOffset: -10, hpMaxOffset: -5 },
        easy: { hpMinOffset: -2, hpMaxOffset: 5 },
        medium: { hpMinOffset: 5, hpMaxOffset: 20 },
        hard: { hpMinOffset: 15, hpMaxOffset: 40 },
        deadly: { hpMinOffset: 25, hpMaxOffset: 60 },
      }
      const p = params[enc.difficulty] ?? params.medium
      const hpMin = Math.max(1, minHP + p.hpMinOffset)
      const hpMax = Math.max(hpMin + 5, maxHP + p.hpMaxOffset)
      const typeConfig = ENC_CONFIG[enc.type] ?? null
      const newEnemy = regenerateEnemy({
        source: newSource,
        partyLevel: level,
        hpMin,
        hpMax,
        isBoss: enemy.isBoss,
        typeConfig,
        difficulty: enc.difficulty,
        partyProfile: this.partyProfile,
      })
      newEnemy.id = enemy.id
      this.$store.commit('UPDATE_ENCOUNTER_ENEMY', {
        enemyId: enemy.id,
        newEnemy,
      })
    },

    toggleHideAbilities(enemyId) {
      this.$set(
        this.revealedAbilities,
        enemyId,
        !this.revealedAbilities[enemyId]
      )
    },

    formatEnemyText(e) {
      const lines = [
        `◆ ${e.name}`,
        `  HP ${e.hp}  |  AC ${e.ac}  |  ATK ${e.attackBonus}  |  ${e.weapon.displayName} (${e.weapon.damageDice} ${e.weapon.damageType})`,
        `  STR ${e.stats.str}  DEX ${e.stats.dex}  CON ${e.stats.con}  INT ${e.stats.int}  WIS ${e.stats.wis}  CHA ${e.stats.cha}`,
      ]
      if (e.features?.length) {
        lines.push('  ── Features')
        for (const f of e.features)
          lines.push(`  • ${f.name}: ${f.description}`)
      }
      if (e.spells?.length) {
        lines.push('  ── Spells')
        for (const s of e.spells) lines.push(`  • ${s.name}: ${s.description}`)
      }
      return lines.join('\n')
    },

    copyToClipboard(text) {
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            this.exportOutput = ''
          })
          .catch(() => {
            this.exportOutput = text
          })
      } else {
        this.exportOutput = text
      }
    },

    exportEnemy(enemy) {
      this.copyToClipboard(this.formatEnemyText(enemy))
    },

    exportAll() {
      const enc = this.encounter
      if (!enc) return
      const header = `[ ${enc.difficulty.toUpperCase()} ENCOUNTER  •  ${
        enc.type
      }  •  ${enc.enemies.length} enemies ]`
      const divider = '─'.repeat(50)
      const body = enc.enemies
        .map((e) => this.formatEnemyText(e))
        .join('\n' + divider + '\n')
      this.copyToClipboard(`${header}\n${divider}\n${body}`)
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

/* â"€â"€ Options â"€â"€ */
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

.types-section {
  min-width: 180px;
}

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
.opt-label input {
  cursor: pointer;
  accent-color: var(--color-accent);
}
.opt-label:hover {
  color: var(--color-text);
}
.opt-label.nudge {
  margin-top: 0.4rem;
}

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
.source-pill:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
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
.opt-hint--roster {
  font-style: normal;
  color: var(--color-text-muted);
  margin-bottom: 0.3rem;
}

/* â"€â"€ Result â"€â"€ */
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
.generate-btn:hover:not(:disabled) {
  background: var(--color-accent-strong);
}
.generate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.load-btn {
  padding: 0.5rem 1.25rem;
  background: none;
  border: 1px solid var(--color-info);
  border-radius: 6px;
  color: var(--color-info);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
}
.load-btn:hover {
  background: rgba(136, 136, 221, 0.12);
}

.enc-error {
  color: var(--color-danger);
  font-size: var(--font-size-md);
}

/* â"€â"€ Encounter card â"€â"€ */
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

.enc-badge.difficulty {
  background: rgba(74, 158, 107, 0.15);
  color: var(--color-success);
  border: 1px solid var(--color-success);
}
.enc-badge.type {
  background: rgba(136, 136, 221, 0.15);
  color: var(--color-info);
  border: 1px solid var(--color-info);
}
.enc-badge.count {
  background: rgba(200, 100, 100, 0.15);
  color: #cc7766;
  border: 1px solid #cc7766;
}

/* â"€â"€ Enemy rows â"€â"€ */
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
  border-color: var(--color-boss);
  background: rgba(192, 146, 42, 0.07);
}

.enemy-name {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.is-boss .enemy-name {
  color: var(--color-boss);
}

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

.gender-race {
  font-style: italic;
}

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

/* ── Abilities (features & spells) ── */
.enc-export-bar {
  display: flex;
  justify-content: flex-end;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.enc-export-all-btn {
  font-size: var(--font-size-xs);
  padding: 0.2rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.enc-export-all-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.hide-abilities-btn,
.export-enemy-btn {
  font-size: var(--font-size-xs);
  padding: 0.15rem 0.45rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.hide-abilities-btn:hover,
.export-enemy-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.hide-abilities-btn.is-hidden {
  border-color: var(--color-text-low);
  color: var(--color-text-low);
  font-style: italic;
}

.enemy-abilities {
  margin-top: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ability-section {
  font-size: var(--font-size-xs);
}

.ability-section-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: 0.15rem;
}

.ability-entry {
  padding: 0.18rem 0;
  line-height: 1.4;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
}

.ability-name {
  font-weight: 600;
  color: var(--color-text);
  margin-right: 0.25rem;
}

.ability-desc {
  color: var(--color-text-muted);
}

.abilities-hidden-note {
  margin-top: 0.3rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}

/* ── Export output fallback ── */
.export-output {
  margin-top: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.export-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.6rem;
  background: var(--color-bg-panel-dark);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.export-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: 0 0.2rem;
}

.export-textarea {
  display: block;
  width: 100%;
  min-height: 140px;
  padding: 0.5rem 0.6rem;
  background: var(--color-bg-input, var(--color-bg-surface));
  border: none;
  color: var(--color-text);
  font-family: monospace;
  font-size: var(--font-size-xs);
  resize: vertical;
  box-sizing: border-box;
}

.last-enc-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
}

.enc-type-notes {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  margin-bottom: 0.25rem;
}

/* ── Enemy row header (name + controls) ── */
.enemy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.enemy-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.source-badge {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  font-family: var(--font-display);
  letter-spacing: 0.05em;
  border: 1px solid transparent;
}
.src-humanoid {
  background: rgba(136, 136, 221, 0.12);
  color: var(--color-info);
  border-color: rgba(136, 136, 221, 0.3);
}
.src-beast {
  background: rgba(74, 158, 107, 0.12);
  color: var(--color-success);
  border-color: rgba(74, 158, 107, 0.3);
}
.src-fiend {
  background: rgba(192, 57, 43, 0.15);
  color: var(--color-danger);
  border-color: rgba(192, 57, 43, 0.3);
}
.src-undead {
  background: rgba(100, 80, 120, 0.18);
  color: #aa88cc;
  border-color: rgba(100, 80, 120, 0.4);
}
.src-aberration {
  background: rgba(80, 160, 200, 0.12);
  color: #66aacc;
  border-color: rgba(80, 160, 200, 0.3);
}
.src-construct {
  background: rgba(180, 130, 50, 0.15);
  color: var(--color-accent);
  border-color: rgba(180, 130, 50, 0.3);
}
.src-dragon {
  background: rgba(192, 146, 42, 0.18);
  color: var(--color-boss);
  border-color: rgba(192, 146, 42, 0.4);
}
.src-other {
  background: var(--color-bg-surface);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

.override-btn,
.reroll-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  letter-spacing: 0.03em;
  padding: 0.12rem 0.5rem;
  cursor: pointer;
  line-height: 1;
  transition: color 0.1s, border-color 0.1s, background 0.1s;
}
.override-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.08);
}
.reroll-btn:hover {
  color: var(--color-info);
  border-color: var(--color-info);
  background: rgba(136, 136, 221, 0.08);
}

.source-select {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.3rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-accent);
  border-radius: 3px;
  color: var(--color-text-muted);
}

.pill-active-dot {
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  margin-left: 3px;
  vertical-align: middle;
}

.wiz-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  line-height: 1.5;
  padding: 0.25rem 0;
}

/* â"€â"€ Wizard â"€â"€ */
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
  width: min(96vw, 920px);
  height: min(640px, 88vh);
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
  background: rgba(74, 158, 107, 0.15);
  color: var(--color-success);
  border: 1px solid var(--color-success);
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
.wizard-close:hover {
  color: var(--color-text-danger);
}

.wizard-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  min-height: 0;
}

/* ── Left: config ── */
.wizard-left {
  flex: 0 0 380px;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-right: 1px solid var(--color-border);
}

/* ── Right: preview ── */
.wizard-right {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--color-bg-panel-dark);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.preview-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-low);
  font-family: var(--font-display);
}
.preview-reroll {
  padding: 0.15rem 0.65rem;
  background: none;
  border: 1px solid var(--color-info);
  border-radius: 3px;
  color: var(--color-info);
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  cursor: pointer;
  transition: background 0.1s;
}
.preview-reroll:hover {
  background: rgba(136, 136, 221, 0.1);
}

.preview-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.preview-name {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-text);
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.preview-boss-tag {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  background: rgba(192, 146, 42, 0.2);
  color: var(--color-boss);
  border: 1px solid var(--color-boss);
}
.preview-badges {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
}
.preview-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  border: 1px solid var(--color-border);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}
.preview-stats {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.preview-stat {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  background: var(--color-bg-surface);
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
}
.preview-flavor {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}
.preview-scores {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}
.preview-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  min-width: 38px;
}
.ps-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-low);
}
.ps-val {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.1;
}
.ps-mod {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
}

.preview-empty {
  font-size: 0.8rem;
  color: var(--color-text-low);
  font-style: italic;
  margin-top: 1rem;
}

/* ── Monster picker ── */
.wiz-optional {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  margin-left: 0.4rem;
  font-family: var(--font-body);
  text-transform: none;
  letter-spacing: normal;
}
.wiz-type-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-family: var(--font-body);
  font-weight: normal;
  letter-spacing: 0;
}
.monster-search {
  width: 100%;
  padding: 0.3rem 0.6rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 0.8rem;
  margin-bottom: 0.3rem;
}
.monster-search::placeholder {
  color: var(--color-text-low);
}
.monster-search:focus {
  outline: none;
  border-color: var(--color-accent);
}

.monster-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-panel-dark);
}
.monster-option {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  font-size: 0.78rem;
  transition: background 0.08s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.monster-option:last-child {
  border-bottom: none;
}
.monster-option:hover {
  background: var(--color-bg-surface);
}
.mon-name {
  flex: 1;
  color: var(--color-text-muted);
}
.mon-cr {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  flex-shrink: 0;
}
.mon-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
}
.mon-empty {
  padding: 0.4rem 0.6rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}

.selected-monster {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: rgba(var(--color-accent-rgb), 0.1);
  border: 1px solid rgba(var(--color-accent-rgb), 0.35);
  border-radius: 4px;
  font-size: 0.78rem;
}
.sm-name {
  flex: 1;
  color: var(--color-accent);
  font-family: var(--font-display);
}
.sm-cr {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
}
.sm-size {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
}
.sm-clear {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-xs);
  padding: 0;
  line-height: 1;
}
.sm-clear:hover {
  color: var(--color-text-danger);
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
.wiz-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
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
.wiz-btn.primary:hover {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.wiz-btn.secondary {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.wiz-btn.secondary:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.wiz-btn.secondary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wiz-btn.ghost {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
}
.wiz-btn.ghost:hover {
  border-color: var(--color-info);
  color: var(--color-info);
}
</style>
