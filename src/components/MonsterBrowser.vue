﻿﻿<template>
  <div class="monster-browser">
    <!-- Filters sidebar -->
    <aside class="mb-filters">
      <div class="mb-filter-section">
        <input
          v-model="search"
          class="mb-search"
          placeholder="Search monsters…"
          @input="resetPage"
        />
      </div>

      <div class="mb-filter-section">
        <div class="mb-filter-label">CR</div>
        <div class="mb-chip-row">
          <button
            v-for="b in CR_BRACKETS"
            :key="b.label"
            class="mb-chip"
            :class="{ active: crBracket === b.label }"
            @click="setCR(b)"
          >{{ b.label }}</button>
        </div>
      </div>

      <div class="mb-filter-section">
        <div class="mb-filter-label">Type</div>
        <div class="mb-chip-row">
          <button
            class="mb-chip"
            :class="{ active: filterType === null }"
            @click="filterType = null; resetPage()"
          >Any</button>
          <button
            v-for="t in TYPES"
            :key="t"
            class="mb-chip"
            :class="{ active: filterType === t }"
            @click="filterType = t; resetPage()"
          >{{ t }}</button>
        </div>
      </div>

      <div class="mb-filter-section">
        <div class="mb-filter-label">Size</div>
        <div class="mb-chip-row">
          <button
            class="mb-chip"
            :class="{ active: filterSize === null }"
            @click="filterSize = null; resetPage()"
          >Any</button>
          <button
            v-for="s in SIZES"
            :key="s"
            class="mb-chip"
            :class="{ active: filterSize === s }"
            @click="filterSize = s; resetPage()"
          >{{ s }}</button>
        </div>
      </div>

      <div class="mb-filter-section">
        <div class="mb-filter-label">Source</div>
        <div class="mb-chip-row">
          <button
            v-for="src in SOURCES"
            :key="src.label"
            class="mb-chip"
            :class="{ active: filterSource === src.key }"
            @click="filterSource = src.key; resetPage()"
          >{{ src.label }}</button>
        </div>
      </div>

      <div class="mb-result-count">{{ filteredMonsters.length.toLocaleString() }} monsters</div>
    </aside>

    <!-- Monster list -->
    <div class="mb-list-col">
      <div class="mb-list" ref="list">
        <div
          v-for="(m, i) in paginatedMonsters"
          :key="page + '_' + i"
          class="mb-row"
          :class="{ selected: selected && selected.name === m.name }"
          @click="selectMonster(m)"
        >
          <span class="mb-row-name">{{ m.name }}</span>
          <span class="mb-row-cr">{{ m.cr != null ? 'CR ' + formatCR(m.cr) : '—' }}</span>
          <span class="mb-row-type">{{ m.type ?? '—' }}</span>
          <span class="mb-row-size">{{ m.size ? m.size[0] : '—' }}</span>
        </div>
      </div>
      <div class="mb-pagination" v-if="totalPages > 1">
        <button class="mb-page-btn" :disabled="page === 0" @click="page--; scrollTop()">‹</button>
        <span class="mb-page-info">{{ page + 1 }} / {{ totalPages }}</span>
        <button class="mb-page-btn" :disabled="page >= totalPages - 1" @click="page++; scrollTop()">›</button>
      </div>
    </div>

    <!-- Detail panel -->
    <div class="mb-detail" v-if="selected">
      <div class="mb-detail-header">
        <div class="mb-detail-name">{{ selected.name }}</div>
        <div class="mb-detail-subtitle">
          {{ selected.size }} {{ selected.type }}{{ selected.alignment ? ' · ' + selected.alignment : '' }}
        </div>
        <div class="mb-detail-source">{{ selected.book }}{{ selected.publisher ? ' — ' + selected.publisher : '' }}</div>
      </div>

      <div v-if="loadingStats" class="mb-loading">Loading stats…</div>

      <!-- Full stat block from API -->
      <template v-if="statBlock">
        <div class="mb-stat-row">
          <div class="mb-stat-chip">
            <span class="mb-stat-val">{{ statBlock.ac }}<span v-if="statBlock.ac_note" class="mb-stat-note"> ({{ statBlock.ac_note }})</span></span>
            <span class="mb-stat-label">AC</span>
          </div>
          <div class="mb-stat-chip">
            <span class="mb-stat-val">{{ statBlock.hp }}<span v-if="statBlock.hit_dice" class="mb-stat-note"> ({{ statBlock.hit_dice }})</span></span>
            <span class="mb-stat-label">HP</span>
          </div>
          <div class="mb-stat-chip">
            <span class="mb-stat-val">{{ formatSpeed(statBlock.speed) }}</span>
            <span class="mb-stat-label">Speed</span>
          </div>
          <div class="mb-stat-chip">
            <span class="mb-stat-val">CR {{ formatCR(statBlock.cr) }}</span>
            <span class="mb-stat-label">{{ statBlock.xp != null ? statBlock.xp.toLocaleString() + ' XP' : '' }}</span>
          </div>
        </div>

        <div class="mb-ability-grid">
          <div v-for="ab in ABILITIES" :key="ab.key" class="mb-ability">
            <span class="mb-ability-label">{{ ab.label }}</span>
            <span class="mb-ability-score">{{ statBlock[ab.key] }}</span>
            <span class="mb-ability-mod">{{ signedMod(statBlock[ab.key]) }}</span>
          </div>
        </div>

        <div v-if="statBlock.saving_throws.length" class="mb-detail-line">
          <span class="mb-detail-key">Saves</span>
          {{ statBlock.saving_throws.map(s => s.stat + ' ' + signed(s.bonus)).join(', ') }}
        </div>
        <div v-if="statBlock.skills.length" class="mb-detail-line">
          <span class="mb-detail-key">Skills</span>
          {{ statBlock.skills.map(s => s.name + ' ' + signed(s.bonus)).join(', ') }}
        </div>
        <div v-if="statBlock.damage_vulnerabilities.length" class="mb-detail-line">
          <span class="mb-detail-key">Vulnerabilities</span>{{ statBlock.damage_vulnerabilities.join(', ') }}
        </div>
        <div v-if="statBlock.damage_resistances.length" class="mb-detail-line">
          <span class="mb-detail-key">Resistances</span>{{ statBlock.damage_resistances.join(', ') }}
        </div>
        <div v-if="statBlock.damage_immunities.length" class="mb-detail-line">
          <span class="mb-detail-key">Immunities</span>{{ statBlock.damage_immunities.join(', ') }}
        </div>
        <div v-if="statBlock.condition_immunities.length" class="mb-detail-line">
          <span class="mb-detail-key">Cond. Immune</span>{{ statBlock.condition_immunities.join(', ') }}
        </div>
        <div v-if="statBlock.senses" class="mb-detail-line">
          <span class="mb-detail-key">Senses</span>{{ formatSenses(statBlock.senses) }}
        </div>
        <div v-if="statBlock.languages" class="mb-detail-line">
          <span class="mb-detail-key">Languages</span>{{ statBlock.languages }}
        </div>

        <template v-if="statBlock.special_abilities.length">
          <div class="mb-section-label">Traits</div>
          <div v-for="t in statBlock.special_abilities" :key="t.name" class="mb-ability-block">
            <span class="mb-ability-name">{{ t.name }}.</span> {{ t.desc }}
          </div>
        </template>

        <template v-if="statBlock.actions.length">
          <div class="mb-section-label">Actions</div>
          <div v-for="a in statBlock.actions" :key="a.name" class="mb-ability-block">
            <span class="mb-ability-name">{{ a.name }}.</span> {{ a.desc }}
          </div>
        </template>

        <template v-if="statBlock.reactions && statBlock.reactions.length">
          <div class="mb-section-label">Reactions</div>
          <div v-for="r in statBlock.reactions" :key="r.name" class="mb-ability-block">
            <span class="mb-ability-name">{{ r.name }}.</span> {{ r.desc }}
          </div>
        </template>

        <template v-if="statBlock.legendary_actions.length">
          <div class="mb-section-label">Legendary Actions</div>
          <div v-for="la in statBlock.legendary_actions" :key="la.name" class="mb-ability-block">
            <span class="mb-ability-name">{{ la.name }}.</span> {{ la.desc }}
          </div>
        </template>
      </template>

      <!-- Index-only info when no API data -->
      <template v-else-if="!loadingStats">
        <div class="mb-stat-row">
          <div class="mb-stat-chip">
            <span class="mb-stat-val">{{ selected.cr != null ? formatCR(selected.cr) : '—' }}</span>
            <span class="mb-stat-label">CR</span>
          </div>
          <div v-if="selected.size" class="mb-stat-chip">
            <span class="mb-stat-val">{{ selected.size }}</span>
            <span class="mb-stat-label">Size</span>
          </div>
        </div>
        <p class="mb-no-stats">Full stat block not in SRD — only basic info available.</p>
      </template>
    </div>

    <div v-else class="mb-detail mb-detail--empty">
      <span>Select a monster to view its stat block</span>
    </div>
  </div>
</template>

<script>
import { lookupMonster } from '@/utils/lookupService.js'

const PAGE_SIZE = 50

const CR_BRACKETS = [
  { label: 'Any',  min: null,  max: null  },
  { label: '0',    min: 0,     max: 0     },
  { label: '¼–½',  min: 0.125, max: 0.5  },
  { label: '1–4',  min: 1,     max: 4     },
  { label: '5–10', min: 5,     max: 10    },
  { label: '11–16',min: 11,    max: 16    },
  { label: '17–20',min: 17,    max: 20    },
  { label: '21+',  min: 21,    max: 30    },
]

const TYPES = [
  'Aberration','Beast','Celestial','Construct','Dragon','Elemental',
  'Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Swarm','Undead',
]

const SIZES = ['Tiny','Small','Medium','Large','Huge','Gargantuan']

const SOURCES = [
  { label: 'All',         key: null },
  { label: 'WotC',        key: 'Wizards of the Coast' },
  { label: 'Kobold',      key: 'Kobold Press' },
  { label: 'MCDM',        key: 'MCDM Productions' },
  { label: 'Other',       key: '__other__' },
]

const ABILITIES = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
]

const MAIN_PUBLISHERS = new Set(['Wizards of the Coast','Kobold Press','MCDM Productions'])

export default {
  name: 'MonsterBrowser',

  data() {
    return {
      monsters: [],
      search: '',
      crBracket: 'Any',
      crMin: null,
      crMax: null,
      filterType: null,
      filterSize: null,
      filterSource: null,
      page: 0,
      selected: null,
      statBlock: null,
      loadingStats: false,
      CR_BRACKETS,
      TYPES,
      SIZES,
      SOURCES,
      ABILITIES,
    }
  },

  computed: {
    filteredMonsters() {
      const q = this.search.trim().toLowerCase()
      return this.monsters.filter((m) => {
        if (q && !m.name.toLowerCase().includes(q)) return false
        if (this.crMin !== null && (m.cr == null || m.cr < this.crMin)) return false
        if (this.crMax !== null && (m.cr == null || m.cr > this.crMax)) return false
        if (this.filterType && m.type !== this.filterType) return false
        if (this.filterSize && m.size !== this.filterSize) return false
        if (this.filterSource) {
          if (this.filterSource === '__other__') {
            if (MAIN_PUBLISHERS.has(m.publisher)) return false
          } else {
            if (m.publisher !== this.filterSource) return false
          }
        }
        return true
      })
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredMonsters.length / PAGE_SIZE))
    },
    paginatedMonsters() {
      const start = this.page * PAGE_SIZE
      return this.filteredMonsters.slice(start, start + PAGE_SIZE)
    },
  },

  async created() {
    const data = await import('@/data/monsters_index.json')
    this.monsters = data.default ?? data
  },

  methods: {
    resetPage() {
      this.page = 0
    },
    scrollTop() {
      this.$refs.list?.scrollTo({ top: 0 })
    },
    setCR(bracket) {
      this.crBracket = bracket.label
      this.crMin = bracket.min
      this.crMax = bracket.max
      this.resetPage()
    },
    async selectMonster(m) {
      this.selected = m
      this.statBlock = null
      this.loadingStats = true
      this.statBlock = await lookupMonster(m.name)
      this.loadingStats = false
    },
    formatCR(cr) {
      if (cr === 0.125) return '1/8'
      if (cr === 0.25)  return '1/4'
      if (cr === 0.5)   return '1/2'
      return String(cr)
    },
    formatSpeed(speed) {
      if (!speed) return '—'
      if (typeof speed === 'string') return speed
      return Object.entries(speed)
        .filter(([, v]) => v)
        .map(([k, v]) => k === 'walk' ? `${v} ft` : `${k} ${v} ft`)
        .join(', ')
    },
    formatSenses(senses) {
      if (!senses) return '—'
      if (typeof senses === 'string') return senses
      return Object.entries(senses)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
        .join(', ')
    },
    signed(n) {
      return n >= 0 ? `+${n}` : String(n)
    },
    signedMod(score) {
      const mod = Math.floor((score - 10) / 2)
      return this.signed(mod)
    },
  },
}
</script>

<style scoped>
.monster-browser {
  display: grid;
  grid-template-columns: 200px 1fr 320px;
  height: 100%;
  overflow: hidden;
}

/* â”€â”€ Filters â”€â”€ */
.mb-filters {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 0.6rem;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  scrollbar-width: thin;
}

.mb-filter-section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.mb-filter-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-low);
}

.mb-search {
  width: 100%;
  box-sizing: border-box;
  font-size: var(--font-size-base);
  padding: 0.3rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
}

.mb-search:focus {
  outline: none;
  border-color: var(--color-accent);
}

.mb-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.mb-chip {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-low);
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s;
  white-space: nowrap;
}

.mb-chip:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.mb-chip.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.mb-result-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  margin-top: auto;
  padding-top: 0.5rem;
}

/* â”€â”€ List â”€â”€ */
.mb-list-col {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
}

.mb-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
}

.mb-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s;
}

.mb-row:hover {
  background: var(--color-bg-panel);
}

.mb-row.selected {
  background: var(--color-bg-surface-alt, var(--color-bg-panel));
  border-left: 2px solid var(--color-accent);
}

.mb-row-name {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-row-cr,
.mb-row-type,
.mb-row-size {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  white-space: nowrap;
  flex-shrink: 0;
}

.mb-row-cr {
  color: var(--color-accent);
  font-family: var(--font-display);
}

.mb-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.4rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.mb-page-btn {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: 3px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: var(--font-size-md);
}

.mb-page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.mb-page-info {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}

/* â”€â”€ Detail â”€â”€ */
.mb-detail {
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.mb-detail--empty {
  align-items: center;
  justify-content: center;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  font-style: italic;
}

.mb-detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-text-strong);
}

.mb-detail-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  font-style: italic;
}

.mb-detail-source {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  margin-bottom: 0.25rem;
}

.mb-stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.4rem 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.mb-stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.2rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  min-width: 3rem;
}

.mb-stat-val {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
}

.mb-stat-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-family: var(--font-body);
}

.mb-stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mb-ability-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.3rem;
  padding: 0.4rem 0;
}

.mb-ability {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.25rem 0;
}

.mb-ability-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  letter-spacing: 0.04em;
}

.mb-ability-score {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.mb-ability-mod {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
}

.mb-detail-line {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.mb-detail-key {
  font-family: var(--font-display);
  color: var(--color-text);
  margin-right: 0.3rem;
}

.mb-section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.15rem;
  margin-top: 0.4rem;
}

.mb-ability-block {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: 1.55;
}

.mb-ability-name {
  font-weight: bold;
  color: var(--color-text);
}

.mb-no-stats {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  margin: 0;
}

.mb-loading {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  padding: 0.5rem 0;
}
</style>
