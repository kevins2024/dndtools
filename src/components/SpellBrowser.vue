<template>
  <div class="spell-browser">
    <!-- Filters sidebar -->
    <aside class="sb-filters scrollable">
      <div class="sb-filter-section">
        <input
          v-model="search"
          class="sb-search"
          placeholder="Search spells…"
          @input="resetPage"
        />
      </div>

      <div class="sb-filter-section">
        <div class="sb-filter-label">Level</div>
        <div class="sb-chip-row">
          <button
            class="sb-chip"
            :class="{ active: filterLevel === null }"
            @click="
              filterLevel = null
              resetPage()
            "
          >
            All
          </button>
          <button
            class="sb-chip"
            :class="{ active: filterLevel === 0 }"
            @click="
              filterLevel = 0
              resetPage()
            "
          >
            Cantrip
          </button>
          <button
            v-for="l in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
            :key="l"
            class="sb-chip"
            :class="{ active: filterLevel === l }"
            @click="
              filterLevel = l
              resetPage()
            "
          >
            {{ l }}
          </button>
        </div>
      </div>

      <div class="sb-filter-section">
        <div class="sb-filter-label">Class</div>
        <div class="sb-chip-row">
          <button
            class="sb-chip"
            :class="{ active: filterClass === null }"
            @click="
              filterClass = null
              resetPage()
            "
          >
            Any
          </button>
          <button
            v-for="c in CLASSES"
            :key="c"
            class="sb-chip"
            :class="{ active: filterClass === c }"
            @click="
              filterClass = c
              resetPage()
            "
          >
            {{ c }}
          </button>
        </div>
      </div>

      <div class="sb-filter-section">
        <div class="sb-filter-label">School</div>
        <div class="sb-chip-row">
          <button
            class="sb-chip"
            :class="{ active: filterSchool === null }"
            @click="
              filterSchool = null
              resetPage()
            "
          >
            Any
          </button>
          <button
            v-for="s in SCHOOLS"
            :key="s"
            class="sb-chip"
            :class="{ active: filterSchool === s }"
            @click="
              filterSchool = s
              resetPage()
            "
          >
            {{ s }}
          </button>
        </div>
      </div>

      <div class="sb-filter-section">
        <div class="sb-filter-label">Source</div>
        <div class="sb-chip-row">
          <button
            class="sb-chip"
            :class="{ active: filterSource === null }"
            @click="
              filterSource = null
              resetPage()
            "
          >
            All
          </button>
          <button
            v-for="src in SOURCES"
            :key="src.key"
            class="sb-chip"
            :class="{ active: filterSource === src.key }"
            @click="
              filterSource = src.key
              resetPage()
            "
          >
            {{ src.label }}
          </button>
        </div>
      </div>

      <div class="sb-result-count">
        {{ filteredSpells.length.toLocaleString() }} spells
      </div>
    </aside>

    <!-- Spell list -->
    <div class="sb-list-col">
      <div class="sb-list scrollable" ref="list">
        <div
          v-for="s in paginatedSpells"
          :key="s.source + '__' + s.name"
          class="sb-row"
          :class="{ selected: selected && selected.name === s.name }"
          @click="selectSpell(s)"
        >
          <span class="sb-row-level">{{ formatLevel(s.level) }}</span>
          <span class="sb-row-name">{{ s.name }}</span>
          <span class="sb-row-school">{{
            schoolCache[s.name] || s.school || '—'
          }}</span>
          <span
            class="sb-row-source"
            :class="'src-' + s.source"
            :title="s.source_book || s.source"
            >{{ s.source_book || s.source.toUpperCase() }}</span
          >
        </div>
      </div>
      <div class="sb-pagination" v-if="totalPages > 1">
        <button
          class="sb-page-btn"
          :disabled="page === 0"
          @click="
            page--
            scrollTop()
          "
        >
          ‹
        </button>
        <span class="sb-page-info">{{ page + 1 }} / {{ totalPages }}</span>
        <button
          class="sb-page-btn"
          :disabled="page >= totalPages - 1"
          @click="
            page++
            scrollTop()
          "
        >
          ›
        </button>
      </div>
    </div>

    <!-- Detail panel -->
    <div class="sb-detail scrollable" v-if="selected">
      <div v-if="loadingDetail" class="sb-loading">Loading…</div>
      <template v-else-if="detail">
        <div class="sb-detail-name">{{ detail.name }}</div>
        <div class="sb-detail-meta">
          <span>{{ formatLevelFull(detail.level) }}</span>
          <span v-if="detail.school"> · {{ detail.school }}</span>
          <span v-if="detail.concentration" class="sb-badge sb-badge--conc"
            >Concentration</span
          >
          <span v-if="selected.ritual" class="sb-badge sb-badge--ritual"
            >Ritual</span
          >
        </div>

        <div class="sb-detail-stats">
          <div class="sb-stat-line">
            <span class="sb-stat-key">Casting Time</span>
            <span class="sb-stat-val">{{ detail.casting_time ?? '—' }}</span>
          </div>
          <div class="sb-stat-line">
            <span class="sb-stat-key">Range</span>
            <span class="sb-stat-val">{{ detail.range ?? '—' }}</span>
          </div>
          <div class="sb-stat-line">
            <span class="sb-stat-key">Duration</span>
            <span class="sb-stat-val">{{ detail.duration ?? '—' }}</span>
          </div>
          <div class="sb-stat-line">
            <span class="sb-stat-key">Components</span>
            <span class="sb-stat-val">{{ detail.components ?? '—' }}</span>
          </div>
          <div
            class="sb-stat-line"
            v-if="selected._raw && selected._raw.material"
          >
            <span class="sb-stat-key">Material</span>
            <span class="sb-stat-val">{{ selected._raw.material }}</span>
          </div>
          <div class="sb-stat-line" v-if="detail.save">
            <span class="sb-stat-key">Save</span>
            <span class="sb-stat-val">{{ detail.save }}</span>
          </div>
          <div class="sb-stat-line" v-if="detail.damage_type">
            <span class="sb-stat-key">Damage</span>
            <span class="sb-stat-val">{{ detail.damage_type }}</span>
          </div>
        </div>

        <div
          class="sb-class-list"
          v-if="detail.spell_list && detail.spell_list.length"
        >
          <span v-for="c in detail.spell_list" :key="c" class="sb-class-chip">{{
            c
          }}</span>
        </div>

        <div class="sb-detail-desc">{{ detail.description }}</div>

        <div class="sb-detail-source">
          {{
            selected.source === 'srd'
              ? 'SRD'
              : selected.source_book || 'Published'
          }}
          <span v-if="selected.source === 'homebrew'"> — Homebrew</span>
        </div>
      </template>
      <div v-else class="sb-loading">Not found in any source.</div>
    </div>
    <div class="sb-detail sb-detail--empty" v-else>
      <span>Select a spell to view details</span>
    </div>
  </div>
</template>

<script>
import srdSpellsRaw from '@/data/api_data_cache/srd_spells_full.json'
import publishedSpellsRaw from '@/data/published_spells.json'
import homebrewDataRaw from '@/data/homebrew.json'
import { lookupSpell } from '@/utils/lookupService'

const CLASSES = [
  'Bard',
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Sorcerer',
  'Warlock',
  'Wizard',
]
const SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
]
const SOURCES = [
  { key: 'srd', label: 'SRD' },
  { key: 'published', label: 'Published' },
  { key: 'homebrew', label: 'Homebrew' },
]
const ORDINALS = [
  'Cantrip',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
]
const PAGE_SIZE = 60

function buildAllSpells() {
  const published = publishedSpellsRaw.map((s) => ({
    name: s.name,
    level: s.level,
    school: s.school ?? null,
    classes: Array.isArray(s.classes) ? s.classes : [],
    concentration: s.concentration ?? false,
    ritual: s.ritual ?? false,
    source: 'published',
    source_book: s.source ?? 'Published',
    _raw: s,
  }))

  const homebrew = (homebrewDataRaw.spells ?? []).map((s) => ({
    name: s.name,
    level: s.level,
    school: s.school ?? null,
    classes: Array.isArray(s.classes) ? s.classes : [],
    concentration: s.concentration ?? false,
    ritual: s.ritual ?? false,
    source: 'homebrew',
    source_book: 'Homebrew',
    _raw: s,
  }))

  // SRD: full pre-fetched data, skip names already covered by published/homebrew
  const localNames = new Set(
    [...published, ...homebrew].map((s) => s.name.toLowerCase())
  )
  const srd = srdSpellsRaw
    .filter((s) => !localNames.has(s.name.toLowerCase()))
    .map((s) => ({
      name: s.name,
      level: s.level,
      school: s.school ?? null,
      classes: Array.isArray(s.classes) ? s.classes : [],
      concentration: s.concentration ?? false,
      ritual: s.ritual ?? false,
      source: 'srd',
      source_book: 'SRD',
      _raw: s,
    }))

  return [...published, ...homebrew, ...srd].sort((a, b) =>
    a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name)
  )
}

const ALL_SPELLS = buildAllSpells()

export default {
  name: 'SpellBrowser',

  data() {
    return {
      CLASSES,
      SCHOOLS,
      SOURCES,
      search: '',
      filterLevel: null,
      filterClass: null,
      filterSchool: null,
      filterSource: null,
      page: 0,
      selected: null,
      detail: null,
      loadingDetail: false,
      schoolCache: {},
    }
  },

  computed: {
    filteredSpells() {
      const q = this.search.trim().toLowerCase()
      const {
        filterLevel,
        filterClass,
        filterSchool,
        filterSource,
        schoolCache,
      } = this
      return ALL_SPELLS.filter((s) => {
        if (q && !s.name.toLowerCase().includes(q)) return false
        if (filterLevel !== null && s.level !== filterLevel) return false
        if (filterClass) {
          const match = s.classes.some(
            (c) => c.toLowerCase() === filterClass.toLowerCase()
          )
          if (!match) return false
        }
        if (filterSchool) {
          const effectiveSchool = schoolCache[s.name] || s.school
          if (!effectiveSchool) return false
          if (effectiveSchool.toLowerCase() !== filterSchool.toLowerCase())
            return false
        }
        if (filterSource && s.source !== filterSource) return false
        return true
      })
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredSpells.length / PAGE_SIZE))
    },
    paginatedSpells() {
      const start = this.page * PAGE_SIZE
      return this.filteredSpells.slice(start, start + PAGE_SIZE)
    },
  },

  methods: {
    resetPage() {
      this.page = 0
      this.scrollTop()
    },
    scrollTop() {
      this.$nextTick(() => {
        if (this.$refs.list) this.$refs.list.scrollTop = 0
      })
    },
    async selectSpell(s) {
      this.selected = s
      this.detail = null
      this.loadingDetail = true
      try {
        if (s._raw?.description) {
          this.detail = {
            name: s._raw.name,
            level: s._raw.level,
            school: s._raw.school ?? null,
            casting_time: s._raw.casting_time ?? null,
            range: s._raw.range ?? null,
            duration: s._raw.duration ?? null,
            components: Array.isArray(s._raw.components)
              ? s._raw.components.join(', ')
              : s._raw.components ?? null,
            concentration: s._raw.concentration ?? false,
            description: s._raw.description,
            save: s._raw.save ?? null,
            damage_type: s._raw.damage_type ?? null,
            spell_list: s._raw.classes ?? [],
          }
        } else {
          this.detail = await lookupSpell(s.name)
          if (this.detail?.school) {
            this.$set(this.schoolCache, s.name, this.detail.school)
          }
        }
      } finally {
        this.loadingDetail = false
      }
    },
    formatLevel(level) {
      return level === 0 ? 'Cantrip' : String(level)
    },
    formatLevelFull(level) {
      return ORDINALS[level] ?? `${level}th`
    },
  },
}
</script>

<style scoped>
.spell-browser {
  display: grid;
  grid-template-columns: 190px 1fr 340px;
  height: 100%;
  overflow: hidden;
}

/* ── Filters ── */
.sb-filters {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 0.6rem;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}

.sb-filter-section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sb-filter-label {
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sb-filter-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-faint, var(--color-text-muted));
  font-style: italic;
}

.sb-search {
  width: 100%;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.sb-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.sb-chip {
  padding: 0.15rem 0.45rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: var(--font-display);
}

.sb-chip:hover {
  color: var(--color-accent);
  border-color: var(--color-border);
}

.sb-chip.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.sb-result-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding-top: 0.25rem;
}

/* ── List column ── */
.sb-list-col {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
}

.sb-list {
  flex: 1;
  overflow-y: auto;
}

.sb-row {
  display: grid;
  grid-template-columns: 56px 1fr 110px 60px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
  cursor: pointer;
  transition: background 0.1s ease;
}

.sb-row:hover {
  background: var(--color-bg-hover, var(--color-bg-surface));
}

.sb-row.selected {
  background: var(--color-bg-selected, var(--color-bg-surface));
  border-left: 2px solid var(--color-accent);
}

.sb-row-level {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-display);
}

.sb-row-name {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-row-school {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-row-source {
  font-size: var(--font-size-xs);
  color: var(--color-text-faint, var(--color-text-muted));
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.src-homebrew {
  color: var(--color-accent-alt, var(--color-accent));
}

/* ── Pagination ── */
.sb-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.4rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sb-page-btn {
  padding: 0.1rem 0.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-md);
}

.sb-page-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.sb-page-btn:not(:disabled):hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.sb-page-info {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-display);
}

/* ── Detail panel ── */
.sb-detail {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  overflow-y: auto;
}

.sb-detail--empty {
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.sb-loading {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  padding: 0.5rem 0;
}

.sb-detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-text-heading, var(--color-text));
}

.sb-detail-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.sb-badge {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sb-badge--conc {
  background: var(--color-bg-warn, #2a2000);
  color: var(--color-warn, #c8a000);
}
.sb-badge--ritual {
  background: var(--color-bg-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.sb-detail-stats {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem 0.6rem;
  background: var(--color-bg-panel);
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.sb-stat-line {
  display: flex;
  gap: 0.5rem;
  font-size: var(--font-size-sm);
}

.sb-stat-key {
  color: var(--color-text-muted);
  min-width: 90px;
  flex-shrink: 0;
  font-family: var(--font-display);
}

.sb-stat-val {
  color: var(--color-text);
}

.sb-class-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.sb-class-chip {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
}

.sb-detail-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.55;
  white-space: pre-wrap;
}

.sb-detail-source {
  font-size: var(--font-size-xs);
  color: var(--color-text-faint, var(--color-text-muted));
  border-top: 1px solid var(--color-border);
  padding-top: 0.5rem;
  margin-top: auto;
}
</style>
