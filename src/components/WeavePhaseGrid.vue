<template>
  <div class="wpg">
    <!-- Header row -->
    <div class="wpg-header">
      <span class="wpg-title">Weave Phases</span>
      <div v-if="embodimentFeature" class="wpg-free-casts">
        <span class="wpg-free-label">Free L1 casts</span>
        <button
          v-for="i in embodimentFeature.uses_max"
          :key="i"
          class="wpg-pip"
          :class="{ spent: i > embodimentFeature.uses_current }"
          :title="pipTitle(i)"
          @click="toggleFreeCast(i)"
        ></button>
      </div>
    </div>

    <!-- 3-column phase grid -->
    <div class="wpg-grid">
      <div
        v-for="phase in phases"
        :key="phase.key"
        class="wpg-phase"
        :class="{ 'wpg-phase--active': activePhase === phase.key }"
      >
        <!-- Phase header — click to make active -->
        <button class="wpg-phase-header" @click="setPhase(phase.key)">
          <span class="wpg-phase-name">{{ phase.label }}</span>
          <span class="wpg-phase-schools">{{ phase.schools }}</span>
        </button>

        <!-- Spell slots -->
        <div class="wpg-spell-list">
          <div
            v-for="(spell, idx) in phase.spells"
            :key="phase.key + idx"
            class="wpg-spell-row"
            :class="{
              'wpg-spell-row--selected':
                selectedSlot &&
                selectedSlot.phaseKey === phase.key &&
                selectedSlot.levelIdx === idx,
            }"
          >
            <span class="wpg-spell-level">{{ idx + 1 }}</span>
            <span
              class="wpg-spell-name"
              :title="spell + ' — click to view, ✎ to swap'"
              @click="$emit('open-spell', { name: spell })"
              >{{ spell }}</span
            >
            <button
              class="wpg-swap-btn"
              title="Swap this spell"
              @click.stop="openPicker(phase.key, idx)"
            >
              ✎
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Spell picker panel — shown below grid when a slot is selected -->
    <div v-if="selectedSlot" class="wpg-picker">
      <div class="wpg-picker-header">
        <span class="wpg-picker-label">
          Replacing
          <strong
            >{{ selectedPhase.label }} L{{ selectedSlot.levelIdx + 1 }}</strong
          >
          · {{ selectedPhase.schools }}
          · Sorcerer / Warlock / Wizard
        </span>
        <button class="wpg-picker-close" @click="selectedSlot = null">✕</button>
      </div>
      <input
        v-model="pickerSearch"
        class="wpg-picker-search"
        placeholder="Search spells…"
        ref="pickerSearch"
        @keydown.escape="selectedSlot = null"
      />
      <div class="wpg-picker-list">
        <div
          v-for="s in pickerSpells"
          :key="s.name"
          class="wpg-picker-row"
          :class="{ 'wpg-picker-row--current': s.name === currentSlotSpell }"
          @click="confirmSwap(s.name)"
        >
          <span class="wpg-picker-spell-name">{{ s.name }}</span>
          <span class="wpg-picker-school">{{ s.school }}</span>
          <span
            v-if="s.name === currentSlotSpell"
            class="wpg-picker-current-badge"
            >current</span
          >
        </div>
        <div v-if="!pickerSpells.length" class="wpg-picker-empty">
          No spells found for these filters.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import srdSpells from '@/data/api_data_cache/srd_spells_full.json'
import publishedSpells from '@/data/published_spells.json'

const PHASE_DEFS = [
  {
    key: 'leno',
    label: 'Leno',
    schools: 'Abjuration · Divination',
    schoolList: ['Abjuration', 'Divination'],
  },
  {
    key: 'twill',
    label: 'Twill',
    schools: 'Enchantment · Necromancy',
    schoolList: ['Enchantment', 'Necromancy'],
  },
  {
    key: 'satin',
    label: 'Satin',
    schools: 'Illusion · Transmutation',
    schoolList: ['Illusion', 'Transmutation'],
  },
]

const PHASE_CLASSES = ['Sorcerer', 'Warlock', 'Wizard']

// Merge spell sources, deduplicate by name (published wins over SRD)
const publishedNames = new Set(publishedSpells.map((s) => s.name.toLowerCase()))
const ALL_SPELLS = [
  ...publishedSpells,
  ...srdSpells.filter((s) => !publishedNames.has(s.name.toLowerCase())),
]

export default {
  name: 'WeavePhaseGrid',

  props: {
    character: { type: Object, required: true },
  },

  emits: ['open-spell'],

  data() {
    return {
      selectedSlot: null, // { phaseKey, levelIdx }
      pickerSearch: '',
    }
  },

  computed: {
    activePhase() {
      return this.character.weave_phase ?? 'leno'
    },
    embodimentFeature() {
      return (
        this.character.features?.find((f) => f.name === 'Weave Embodiment') ??
        null
      )
    },
    phases() {
      return PHASE_DEFS.map((def) => {
        const feat = this.character.features?.find((f) =>
          f.name.toLowerCase().startsWith(def.key + ' phase')
        )
        return { ...def, spells: feat?.spells_granted ?? [] }
      })
    },
    selectedPhase() {
      if (!this.selectedSlot) return null
      return (
        PHASE_DEFS.find((p) => p.key === this.selectedSlot.phaseKey) ?? null
      )
    },
    currentSlotSpell() {
      if (!this.selectedSlot) return null
      const phase = this.phases.find(
        (p) => p.key === this.selectedSlot.phaseKey
      )
      return phase?.spells[this.selectedSlot.levelIdx] ?? null
    },
    pickerSpells() {
      if (!this.selectedSlot || !this.selectedPhase) return []
      const level = this.selectedSlot.levelIdx + 1
      const schools = this.selectedPhase.schoolList
      const q = this.pickerSearch.trim().toLowerCase()
      return ALL_SPELLS.filter((s) => {
        if (s.level !== level) return false
        if (!schools.includes(s.school)) return false
        const classes = Array.isArray(s.classes) ? s.classes : []
        if (!classes.some((c) => PHASE_CLASSES.includes(c))) return false
        if (q && !s.name.toLowerCase().includes(q)) return false
        return true
      }).sort((a, b) => a.name.localeCompare(b.name))
    },
  },

  methods: {
    setPhase(key) {
      if (key === this.activePhase) return
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, weave_phase: key },
      })
    },

    openPicker(phaseKey, levelIdx) {
      this.pickerSearch = ''
      this.selectedSlot = { phaseKey, levelIdx }
      this.$nextTick(() => this.$refs.pickerSearch?.focus())
    },

    confirmSwap(newSpellName) {
      if (!this.selectedSlot) return
      const { phaseKey, levelIdx } = this.selectedSlot
      const featureName = this.character.features?.find((f) =>
        f.name.toLowerCase().startsWith(phaseKey + ' phase')
      )?.name
      if (!featureName) return

      const newFeatures = this.character.features.map((f) => {
        if (f.name !== featureName) return f
        const newGranted = [...(f.spells_granted ?? [])]
        newGranted[levelIdx] = newSpellName
        return { ...f, spells_granted: newGranted }
      })

      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, features: newFeatures },
      })
      this.selectedSlot = null
    },

    toggleFreeCast(i) {
      const feat = this.embodimentFeature
      if (!feat) return
      const newCurrent = i <= feat.uses_current ? i - 1 : i
      const newFeatures = this.character.features.map((f) =>
        f.name === 'Weave Embodiment'
          ? {
              ...f,
              uses_current: Math.max(0, Math.min(feat.uses_max, newCurrent)),
            }
          : f
      )
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, features: newFeatures },
      })
    },

    pipTitle(i) {
      const feat = this.embodimentFeature
      if (!feat) return ''
      const label = this.phases[i - 1]?.label ?? `Phase ${i}`
      return i <= feat.uses_current
        ? `${label} free L1 cast available — click to mark used`
        : `${label} free L1 cast used — click to recover`
    },
  },
}
</script>

<style scoped>
.wpg {
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

/* ── Header ── */
.wpg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
}

.wpg-title {
  font-family: var(--font-display);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-muted);
}

.wpg-free-casts {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.wpg-free-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.wpg-pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--color-accent);
  background: var(--color-accent);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.wpg-pip.spent {
  background: transparent;
}

/* ── Phase grid ── */
.wpg-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.wpg-phase {
  border-right: 1px solid var(--color-border);
  transition: background 0.15s;
}

.wpg-phase:last-child {
  border-right: none;
}

.wpg-phase--active {
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}

.wpg-phase-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 0.4rem 0.6rem 0.35rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.wpg-phase--active .wpg-phase-header {
  border-bottom-color: var(--color-accent);
}

.wpg-phase-header:hover {
  background: var(--color-bg-hover, var(--color-bg-surface));
}

.wpg-phase-name {
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.wpg-phase--active .wpg-phase-name {
  color: var(--color-accent-strong);
}

.wpg-phase-schools {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* ── Spell rows ── */
.wpg-spell-list {
  padding: 0.2rem 0;
}

.wpg-spell-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.4rem 0.18rem 0.6rem;
  border-left: 2px solid transparent;
  transition: background 0.1s;
}

.wpg-spell-row:hover {
  background: var(--color-bg-hover, var(--color-bg-surface));
}

.wpg-spell-row--selected {
  border-left-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.wpg-spell-level {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  opacity: 0.6;
  flex-shrink: 0;
  width: 0.8rem;
  text-align: right;
}

.wpg-spell-name {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wpg-spell-name:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.wpg-swap-btn {
  flex-shrink: 0;
  padding: 0 0.2rem;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
  line-height: 1;
}

.wpg-spell-row:hover .wpg-swap-btn {
  opacity: 1;
}

.wpg-swap-btn:hover {
  color: var(--color-accent);
}

/* ── Picker panel ── */
.wpg-picker {
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel);
}

.wpg-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
}

.wpg-picker-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.wpg-picker-label strong {
  color: var(--color-text);
}

.wpg-picker-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: 0 0.2rem;
  line-height: 1;
}

.wpg-picker-close:hover {
  color: var(--color-text);
}

.wpg-picker-search {
  display: block;
  width: 100%;
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-input);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.wpg-picker-search:focus {
  outline: none;
  border-bottom-color: var(--color-accent);
}

.wpg-picker-list {
  max-height: 220px;
  overflow-y: auto;
}

.wpg-picker-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.28rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
  transition: background 0.1s;
}

.wpg-picker-row:hover {
  background: var(--color-bg-hover, var(--color-bg-surface));
}

.wpg-picker-row--current {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.wpg-picker-spell-name {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  flex: 1;
}

.wpg-picker-school {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.wpg-picker-current-badge {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-family: var(--font-display);
}

.wpg-picker-empty {
  padding: 0.5rem 0.75rem;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
