<template>
  <div class="item-gen">
    <div class="ig-filters">
      <!-- Source selector -->
      <div class="ig-filter-group">
        <label class="ig-label">Source</label>
        <div class="ig-pills">
          <span
            v-for="s in sources"
            :key="s.key"
            class="ig-pill"
            :class="{ active: selectedSources.includes(s.key) }"
            @click="toggleSource(s.key)"
            >{{ s.label }}</span
          >
        </div>
      </div>

      <!-- D&D 5e filters -->
      <template v-if="selectedSources.includes('dnd5e')">
        <div class="ig-filter-group">
          <label class="ig-label">Rarity</label>
          <div class="ig-pills">
            <span
              v-for="r in rarities"
              :key="r.key"
              class="ig-pill"
              :class="[`rarity-${r.key}`, { active: selectedRarity === r.key }]"
              @click="toggleRarity(r.key)"
              >{{ r.label }}</span
            >
          </div>
        </div>
        <div class="ig-filter-group">
          <label class="ig-label">Category</label>
          <div class="ig-pills">
            <span
              v-for="c in dnd5eCategories"
              :key="c.key"
              class="ig-pill"
              :class="{ active: selectedCategory === c.key }"
              @click="toggleCategory(c.key)"
              >{{ c.label }}</span
            >
          </div>
        </div>
      </template>

      <!-- Custom D&D 5e filters -->
      <template v-if="selectedSources.includes('custom')">
        <div class="ig-filter-group">
          <label class="ig-label">Type</label>
          <div class="ig-pills">
            <span
              v-for="t in customTypes"
              :key="t.key"
              class="ig-pill"
              :class="{ active: selectedCustomType === t.key }"
              @click="toggleCustomType(t.key)"
              >{{ t.label }}</span
            >
          </div>
        </div>
      </template>

      <!-- Pathfinder filters -->
      <template v-if="selectedSources.includes('pathfinder')">
        <div class="ig-filter-group">
          <label class="ig-label">Group</label>
          <div class="ig-pills">
            <span
              v-for="g in pfGroups"
              :key="g.key"
              class="ig-pill"
              :class="{ active: selectedPfGroup === g.key }"
              @click="togglePfGroup(g.key)"
              >{{ g.label }}</span
            >
          </div>
        </div>
      </template>

      <!-- BG3 filters -->
      <template v-if="selectedSources.includes('bg3')">
        <div class="ig-filter-group">
          <label class="ig-label">Rarity</label>
          <div class="ig-pills">
            <span
              v-for="r in bg3Rarities"
              :key="r.key"
              class="ig-pill"
              :class="[
                `rarity-${r.key.replace(' ', '_')}`,
                { active: selectedBg3Rarity === r.key },
              ]"
              @click="toggleBg3Rarity(r.key)"
              >{{ r.label }}</span
            >
          </div>
        </div>
      </template>

      <!-- Actions row -->
      <div class="ig-actions">
        <div class="ig-mode-tabs">
          <span
            class="ig-mode-tab"
            :class="{ active: mode === 'roll' }"
            @click="setMode('roll')"
            >Random</span
          >
          <span
            class="ig-mode-tab"
            :class="{ active: mode === 'browse' }"
            @click="setMode('browse')"
            >Browse</span
          >
        </div>

        <template v-if="mode === 'roll'">
          <button class="ig-roll-btn" :disabled="loading" @click="rollItem">
            <span v-if="loading" class="ig-spinner">⟳</span>
            <span v-else>Roll Item</span>
          </button>
          <span v-if="poolSize !== null" class="ig-pool-size"
            >{{ poolSize.toLocaleString() }} in pool</span
          >
        </template>

        <template v-if="mode === 'browse'">
          <button
            class="ig-page-btn"
            :disabled="browsePage === 0 || browsing"
            @click="loadBrowsePage(browsePage - 1)"
          >
            ◀
          </button>
          <span class="ig-page-info">
            <span v-if="browseTotalCount"
              >{{ browsePage + 1 }}&thinsp;/&thinsp;{{ browseTotalPages }}</span
            >
            <span v-else>—</span>
          </span>
          <button
            class="ig-page-btn"
            :disabled="
              browsePage >= browseTotalPages - 1 ||
              browsing ||
              !browseTotalPages
            "
            @click="loadBrowsePage(browsePage + 1)"
          >
            ▶
          </button>
          <span v-if="browseTotalCount" class="ig-pool-size"
            >{{ browseTotalCount.toLocaleString() }} items</span
          >
        </template>

        <span v-if="error" class="ig-error">{{ error }}</span>
      </div>
    </div>

    <!-- Roll mode: result cards -->
    <template v-if="mode === 'roll'">
      <div v-if="item" class="ig-result">
        <div class="ig-result-header">
          <div class="ig-result-name">{{ item.name }}</div>
          <div class="ig-result-meta">
            <span
              class="ig-rarity-badge"
              :class="`rarity-${item.rarity.key}`"
              >{{ item.rarity.name }}</span
            >
            <span v-if="item.category" class="ig-meta-tag">{{
              item.category.name
            }}</span>
            <span v-if="item.requires_attunement" class="ig-attunement"
              >requires attunement<span v-if="item.attunement_detail">
                ({{ item.attunement_detail }})</span
              ></span
            >
          </div>
        </div>
        <div class="ig-result-desc" v-html="formatDesc(item.desc)"></div>
        <div class="ig-result-footer">
          <span class="ig-source">{{
            item.document.display_name || item.document.name
          }}</span>
          <button class="ig-reroll-btn" @click="rollItem">Roll Again</button>
        </div>
      </div>

      <div v-else-if="customItem" class="ig-result">
        <div class="ig-result-header">
          <div class="ig-result-name">{{ customItem.name }}</div>
          <div class="ig-result-meta">
            <span
              class="ig-rarity-badge"
              :class="`rarity-${customItem.rarity}`"
              >{{ customItem.rarity }}</span
            >
            <span v-if="customItem.type" class="ig-meta-tag">{{
              customItem.type
            }}</span>
            <span v-if="customItem.attunement" class="ig-attunement"
              >requires attunement</span
            >
          </div>
        </div>
        <div
          v-if="customItem.desc"
          class="ig-result-desc"
          v-html="formatDesc(customItem.desc)"
        ></div>
        <div v-else class="ig-result-desc pf-note">
          <em>No description — see Dungeon Master's Guide.</em>
        </div>
        <div class="ig-result-footer">
          <span class="ig-source">D&amp;D 5e (Custom)</span>
          <button class="ig-reroll-btn" @click="rollItem">Roll Again</button>
        </div>
      </div>

      <div v-else-if="pfItem" class="ig-result">
        <div class="ig-result-header">
          <div class="ig-result-name">{{ pfItem.name }}</div>
          <div class="ig-result-meta">
            <span v-if="pfItem.group" class="ig-meta-tag">{{
              pfItem.group
            }}</span>
            <span v-if="pfItem.slot" class="ig-meta-tag">{{
              pfItem.slot
            }}</span>
            <span v-if="pfItem.price" class="ig-meta-tag ig-price">{{
              pfItem.price
            }}</span>
            <span v-if="pfItem.cl" class="ig-meta-tag">CL {{ pfItem.cl }}</span>
          </div>
        </div>
        <div class="ig-result-desc pf-note">
          <em>Pathfinder — adapt for 5e use</em>
        </div>
        <div
          v-if="pfItem.desc"
          class="ig-result-desc"
          v-html="formatDesc(pfItem.desc)"
        ></div>
        <div class="ig-result-footer">
          <span class="ig-source">{{ pfItem.source || 'd20pfsrd' }}</span>
          <button class="ig-reroll-btn" @click="rollItem">Roll Again</button>
        </div>
      </div>

      <div v-else-if="bg3Item" class="ig-result">
        <div class="ig-result-header">
          <div class="ig-result-name">{{ bg3Item.name }}</div>
          <div class="ig-result-meta">
            <span
              class="ig-rarity-badge"
              :class="`rarity-${bg3Item.rarity.replace(' ', '_')}`"
              >{{ bg3Item.rarity }}</span
            >
          </div>
        </div>
        <div
          v-if="bg3Item.desc"
          class="ig-result-desc"
          v-html="formatDesc(bg3Item.desc)"
        ></div>
        <div class="ig-result-footer">
          <span class="ig-source">Baldur's Gate 3</span>
          <button class="ig-reroll-btn" @click="rollItem">Roll Again</button>
        </div>
      </div>

      <div v-else-if="!loading" class="ig-empty">
        <div class="ig-empty-text">
          Select filters and roll to discover an item.
        </div>
      </div>
    </template>

    <!-- Browse mode: table + detail -->
    <div v-if="mode === 'browse'" class="ig-browse">
      <!-- Source tabs (only when multiple sources active) -->
      <div v-if="selectedSources.length > 1" class="ig-browse-source-tabs">
        <span
          v-for="src in selectedSources"
          :key="src"
          class="ig-browse-source-tab"
          :class="{ active: browseSource === src }"
          @click="setBrowseSource(src)"
          >{{ sources.find((s) => s.key === src).label }}</span
        >
      </div>
      <div class="ig-browse-search">
        <input
          v-model="browseSearch"
          class="ig-search-input"
          type="text"
          placeholder="Filter by name..."
          @input="debouncedSearch"
          @keyup.enter="triggerSearch"
        />
        <button
          v-if="browseSearch"
          class="ig-search-clear"
          @click="clearSearch"
        >
          ✕
        </button>
      </div>
      <div class="ig-table-wrap">
        <div v-if="browsing && !browseItems.length" class="ig-browse-loading">
          Loading...
        </div>
        <table v-else-if="browseItems.length" class="ig-table">
          <thead>
            <tr>
              <th class="col-name">Name</th>
              <th class="col-rarity">Rarity / Group</th>
              <th class="col-type">Type / Slot</th>
              <th class="col-att" title="Requires attunement">~</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(bi, i) in browseItems"
              :key="i"
              :class="{ 'row-selected': browseSelected === bi }"
              @click="browseSelected = browseSelected === bi ? null : bi"
            >
              <td class="col-name">{{ bi.name }}</td>
              <td class="col-rarity">
                <span
                  v-if="bi.rarityLabel"
                  class="ig-rarity-badge"
                  :class="`rarity-${bi.rarityKey}`"
                  >{{ bi.rarityLabel }}</span
                >
              </td>
              <td class="col-type">{{ bi.typeLabel }}</td>
              <td class="col-att">{{ bi.attunement ? '✓' : '' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="!browsing" class="ig-empty">
          <div class="ig-empty-text">No items found.</div>
        </div>
      </div>

      <!-- Selected item detail -->
      <div v-if="browseSelected" class="ig-browse-detail">
        <div class="ig-browse-detail-name">{{ browseSelected.name }}</div>
        <div class="ig-result-meta">
          <span
            v-if="browseSelected.rarityLabel"
            class="ig-rarity-badge"
            :class="`rarity-${browseSelected.rarityKey}`"
            >{{ browseSelected.rarityLabel }}</span
          >
          <span v-if="browseSelected.typeLabel" class="ig-meta-tag">{{
            browseSelected.typeLabel
          }}</span>
          <span v-if="browseSelected.price" class="ig-meta-tag ig-price">{{
            browseSelected.price
          }}</span>
          <span v-if="browseSelected.attunement" class="ig-attunement"
            >requires attunement</span
          >
        </div>
        <div
          v-if="browseSelected.desc"
          class="ig-browse-detail-desc"
          v-html="formatDesc(browseSelected.desc)"
        ></div>
        <div v-else class="ig-browse-detail-desc pf-note">
          <em>No description available.</em>
        </div>
        <div v-if="browseSelected._isPf" class="pf-note">
          <em>Pathfinder — adapt for 5e use</em>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import customItemsData from '@/data/custom_items.json'
import bg3ItemsData from '@/data/bg3_items.json'

const OPEN5E_URL = 'https://api.open5e.com/v2/magicitems/'
const PF_SHEET_ID = '1NQhHjDXhvFZkMiu09epBXsVwCI6YENg-AUQhF-v5ntU'
const PF_BASE = `https://docs.google.com/spreadsheets/d/${PF_SHEET_ID}/gviz/tq?tqx=out:csv`

function pfQuery(tq) {
  return `${PF_BASE}&tq=${encodeURIComponent(tq)}`
}

function parsePfCsv(text) {
  const rows = []
  const lines = text.trim().split('\n')
  for (const line of lines) {
    const cols = []
    let inQuote = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"'
          i++
        } else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cols.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    cols.push(current)
    rows.push(cols)
  }
  return rows
}

export default {
  name: 'ItemGenerator',

  data() {
    return {
      sources: [
        { key: 'dnd5e', label: 'D&D 5e (Open5e)' },
        { key: 'custom', label: 'D&D 5e (Custom)' },
        { key: 'pathfinder', label: 'Pathfinder (d20pfsrd)' },
        { key: 'bg3', label: "Baldur's Gate 3" },
      ],
      bg3Rarities: [
        { key: 'uncommon', label: 'Uncommon' },
        { key: 'rare', label: 'Rare' },
        { key: 'very rare', label: 'Very Rare' },
        { key: 'legendary', label: 'Legendary' },
      ],
      rarities: [
        { key: 'common', label: 'Common' },
        { key: 'uncommon', label: 'Uncommon' },
        { key: 'rare', label: 'Rare' },
        { key: 'very_rare', label: 'Very Rare' },
        { key: 'legendary', label: 'Legendary' },
        { key: 'artifact', label: 'Artifact' },
      ],
      dnd5eCategories: [
        { key: 'wondrous-item', label: 'Wondrous' },
        { key: 'weapon', label: 'Weapon' },
        { key: 'armor', label: 'Armor' },
        { key: 'ring', label: 'Ring' },
        { key: 'wand', label: 'Wand' },
        { key: 'staff', label: 'Staff' },
        { key: 'rod', label: 'Rod' },
        { key: 'potion', label: 'Potion' },
        { key: 'scroll', label: 'Scroll' },
      ],
      customTypes: [
        { key: 'wondrous item', label: 'Wondrous' },
        { key: 'weapon', label: 'Weapon' },
        { key: 'armor', label: 'Armor' },
        { key: 'ring', label: 'Ring' },
        { key: 'wand', label: 'Wand' },
        { key: 'staff', label: 'Staff' },
        { key: 'rod', label: 'Rod' },
        { key: 'potion', label: 'Potion' },
        { key: 'scroll', label: 'Scroll' },
      ],
      pfGroups: [
        { key: 'Wondrous Item', label: 'Wondrous' },
        { key: 'Weapon', label: 'Weapon' },
        { key: 'Artifact', label: 'Artifact' },
        { key: 'Armor', label: 'Armor' },
        { key: 'Rod', label: 'Rod' },
        { key: 'Ring', label: 'Ring' },
        { key: 'Staff', label: 'Staff' },
        { key: 'Cursed', label: 'Cursed' },
      ],
      // Filters
      selectedSources: ['dnd5e'],
      browseSource: 'dnd5e',
      selectedRarity: null,
      selectedCategory: null,
      selectedCustomType: null,
      selectedPfGroup: null,
      selectedBg3Rarity: null,
      // Mode
      mode: 'roll',
      // Roll state
      item: null,
      pfItem: null,
      customItem: null,
      bg3Item: null,
      poolSize: null,
      loading: false,
      // Browse state
      browseItems: [],
      browsePage: 0,
      browsePageSize: 25,
      browseTotalCount: 0,
      browsing: false,
      browseSelected: null,
      browseSearch: '',
      // Shared
      error: null,
    }
  },

  computed: {
    browseTotalPages() {
      return Math.ceil(this.browseTotalCount / this.browsePageSize)
    },
  },

  methods: {
    formatDesc(desc) {
      if (!desc) return ''
      return desc
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
    },

    // ── Source / mode ──────────────────────────────────────

    toggleSource(key) {
      const idx = this.selectedSources.indexOf(key)
      if (idx >= 0) {
        if (this.selectedSources.length === 1) return
        this.selectedSources.splice(idx, 1)
        if (this.browseSource === key)
          this.browseSource = this.selectedSources[0]
      } else {
        this.selectedSources.push(key)
      }
      this.item = null
      this.pfItem = null
      this.customItem = null
      this.bg3Item = null
      this.poolSize = null
      this.browseItems = []
      this.browseTotalCount = 0
      this.browseSelected = null
      this.browsePage = 0
      this.browseSearch = ''
      this.error = null
      if (this.mode === 'browse') this.loadBrowsePage(0)
    },

    setBrowseSource(key) {
      this.browseSource = key
      this.browseItems = []
      this.browseTotalCount = 0
      this.browseSelected = null
      this.browsePage = 0
      this.loadBrowsePage(0)
    },

    setMode(m) {
      this.mode = m
      if (m === 'browse' && !this.browseItems.length) this.loadBrowsePage(0)
    },

    onFilterChange() {
      this.poolSize = null
      if (this.mode === 'browse') {
        this.browseItems = []
        this.browseTotalCount = 0
        this.browseSelected = null
        this.loadBrowsePage(0)
      }
    },

    // ── Filters ────────────────────────────────────────────

    toggleRarity(key) {
      this.selectedRarity = this.selectedRarity === key ? null : key
      this.onFilterChange()
    },
    toggleCategory(key) {
      this.selectedCategory = this.selectedCategory === key ? null : key
      this.onFilterChange()
    },
    toggleCustomType(key) {
      this.selectedCustomType = this.selectedCustomType === key ? null : key
      this.onFilterChange()
    },
    togglePfGroup(key) {
      this.selectedPfGroup = this.selectedPfGroup === key ? null : key
      this.onFilterChange()
    },
    toggleBg3Rarity(key) {
      this.selectedBg3Rarity = this.selectedBg3Rarity === key ? null : key
      this.onFilterChange()
    },

    // ── Roll mode ──────────────────────────────────────────

    async rollItem() {
      this.loading = true
      this.error = null
      this.item = null
      this.pfItem = null
      this.customItem = null
      this.bg3Item = null
      try {
        if (this.selectedSources.length === 1) {
          const src = this.selectedSources[0]
          if (src === 'dnd5e') await this.rollDnd5e()
          else if (src === 'custom') this.rollCustom()
          else if (src === 'bg3') this.rollBg3()
          else await this.rollPathfinder()
        } else {
          await this.rollMulti()
        }
      } catch (e) {
        this.error = e.message || 'Failed to fetch item.'
      } finally {
        this.loading = false
      }
    },

    async getPoolSize(src) {
      if (src === 'custom') {
        let pool = customItemsData
        if (this.selectedCustomType)
          pool = pool.filter((i) => i.type === this.selectedCustomType)
        return pool.length
      }
      if (src === 'bg3') {
        let pool = bg3ItemsData
        if (this.selectedBg3Rarity)
          pool = pool.filter((i) => i.rarity === this.selectedBg3Rarity)
        return pool.length
      }
      if (src === 'dnd5e') {
        const params = new URLSearchParams({ limit: 1 })
        if (this.selectedRarity) params.set('rarity', this.selectedRarity)
        if (this.selectedCategory) params.set('category', this.selectedCategory)
        const res = await fetch(`${OPEN5E_URL}?${params}`)
        if (!res.ok) return 0
        return (await res.json()).count ?? 0
      }
      if (src === 'pathfinder') {
        const groupClause = this.selectedPfGroup
          ? `J='${this.selectedPfGroup}'`
          : `J!='Ammunition'`
        const text = await fetch(
          pfQuery(`select count(A) where ${groupClause} label count(A) 'count'`)
        ).then((r) => r.text())
        return parseInt(parsePfCsv(text)[1]?.[0]) || 0
      }
      return 0
    },

    async rollMulti() {
      const pools = await Promise.all(
        this.selectedSources.map((src) => this.getPoolSize(src))
      )
      const entries = this.selectedSources
        .map((src, i) => ({ src, count: pools[i] }))
        .filter((e) => e.count > 0)
      const total = entries.reduce((sum, e) => sum + e.count, 0)
      this.poolSize = total
      if (total === 0) {
        this.error = 'No items match those filters.'
        return
      }
      let rand = Math.floor(Math.random() * total)
      let chosen = entries[entries.length - 1].src
      for (const entry of entries) {
        if (rand < entry.count) {
          chosen = entry.src
          break
        }
        rand -= entry.count
      }
      if (chosen === 'dnd5e') await this.rollDnd5e()
      else if (chosen === 'custom') this.rollCustom()
      else if (chosen === 'bg3') this.rollBg3()
      else await this.rollPathfinder()
      this.poolSize = total
    },

    async rollDnd5e() {
      const params = new URLSearchParams({ limit: 1 })
      if (this.selectedRarity) params.set('rarity', this.selectedRarity)
      if (this.selectedCategory) params.set('category', this.selectedCategory)
      const countRes = await fetch(`${OPEN5E_URL}?${params}`)
      if (!countRes.ok) throw new Error(`API error ${countRes.status}`)
      const countData = await countRes.json()
      const count = countData.count ?? 0
      this.poolSize = count
      if (count === 0) {
        this.item = null
        this.error = 'No items match those filters.'
        return
      }
      params.set('offset', Math.floor(Math.random() * count))
      const itemRes = await fetch(`${OPEN5E_URL}?${params}`)
      if (!itemRes.ok) throw new Error(`API error ${itemRes.status}`)
      this.item = (await itemRes.json()).results?.[0] ?? null
    },

    rollCustom() {
      let pool = customItemsData
      if (this.selectedCustomType)
        pool = pool.filter((i) => i.type === this.selectedCustomType)
      this.poolSize = pool.length
      if (!pool.length) {
        this.customItem = null
        this.error = 'No items match those filters.'
        return
      }
      this.customItem = pool[Math.floor(Math.random() * pool.length)]
    },

    async rollPathfinder() {
      const groupClause = this.selectedPfGroup
        ? `J='${this.selectedPfGroup}'`
        : `J!='Ammunition'`
      const where = `where ${groupClause}`
      const countText = await fetch(
        pfQuery(`select count(A) ${where} label count(A) 'count'`)
      ).then((r) => r.text())
      const count = parseInt(parsePfCsv(countText)[1]?.[0]) || 0
      this.poolSize = count
      if (!count) {
        this.pfItem = null
        this.error = 'No items match those filters.'
        return
      }
      const rowText = await fetch(
        pfQuery(
          `select A,B,C,D,E,G,J,K ${where} limit 1 offset ${Math.floor(
            Math.random() * count
          )}`
        )
      ).then((r) => r.text())
      const row = parsePfCsv(rowText)[1]
      if (!row) {
        this.pfItem = null
        return
      }
      this.pfItem = {
        name: row[0],
        aura: row[1],
        cl: row[2],
        slot: row[3],
        price: row[4],
        desc: row[5],
        group: row[6],
        source: row[7],
      }
    },

    rollBg3() {
      let pool = bg3ItemsData
      if (this.selectedBg3Rarity)
        pool = pool.filter((i) => i.rarity === this.selectedBg3Rarity)
      this.poolSize = pool.length
      if (!pool.length) {
        this.bg3Item = null
        this.error = 'No items match those filters.'
        return
      }
      this.bg3Item = pool[Math.floor(Math.random() * pool.length)]
    },

    // ── Browse mode ────────────────────────────────────────

    normalizeDnd5e(item) {
      return {
        name: item.name,
        rarityLabel: item.rarity?.name || '',
        rarityKey: item.rarity?.key || '',
        typeLabel: item.category?.name || '',
        attunement: item.requires_attunement,
        desc: item.desc || '',
        source: item.document?.display_name || item.document?.name || 'Open5e',
      }
    },

    normalizeCustom(item) {
      return {
        name: item.name,
        rarityLabel: item.rarity,
        rarityKey: item.rarity,
        typeLabel: item.type,
        attunement: item.attunement,
        desc: item.desc || '',
        source: 'D&D 5e (Custom)',
      }
    },

    normalizePf(row) {
      // select A,D,G,J,K → name, slot, desc, group, source
      return {
        name: row[0],
        rarityLabel: row[3],
        rarityKey: '',
        typeLabel: row[1] || '',
        attunement: false,
        desc: row[2] || '',
        source: row[4] || 'd20pfsrd',
        _isPf: true,
      }
    },

    normalizeBg3(item) {
      return {
        name: item.name,
        rarityLabel: item.rarity,
        rarityKey: item.rarity.replace(' ', '_'),
        typeLabel: '',
        attunement: false,
        desc: item.desc || '',
        source: "Baldur's Gate 3",
      }
    },

    browseBg3(page) {
      let pool = bg3ItemsData
      if (this.selectedBg3Rarity)
        pool = pool.filter((i) => i.rarity === this.selectedBg3Rarity)
      if (this.browseSearch) {
        const s = this.browseSearch.toLowerCase()
        pool = pool.filter((i) => i.name.toLowerCase().includes(s))
      }
      this.browseTotalCount = pool.length
      const start = page * this.browsePageSize
      this.browseItems = pool
        .slice(start, start + this.browsePageSize)
        .map(this.normalizeBg3)
    },

    async loadBrowsePage(page) {
      if (page < 0) return
      if (this.browseTotalPages > 0 && page >= this.browseTotalPages) return
      this.browsing = true
      this.browsePage = page
      this.browseSelected = null
      this.error = null
      try {
        if (this.browseSource === 'dnd5e') await this.browseDnd5e(page)
        else if (this.browseSource === 'custom') this.browseCustom(page)
        else if (this.browseSource === 'bg3') this.browseBg3(page)
        else await this.browsePf(page)
      } catch (e) {
        this.error = e.message || 'Failed to load items.'
      } finally {
        this.browsing = false
      }
    },

    async browseDnd5e(page) {
      const params = new URLSearchParams({
        limit: this.browsePageSize,
        offset: page * this.browsePageSize,
      })
      if (this.selectedRarity) params.set('rarity', this.selectedRarity)
      if (this.selectedCategory) params.set('category', this.selectedCategory)
      if (this.browseSearch) params.set('search', this.browseSearch)
      const res = await fetch(`${OPEN5E_URL}?${params}`)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      this.browseTotalCount = data.count ?? 0
      this.browseItems = (data.results ?? []).map(this.normalizeDnd5e)
    },

    browseCustom(page) {
      let pool = customItemsData
      if (this.selectedCustomType)
        pool = pool.filter((i) => i.type === this.selectedCustomType)
      if (this.browseSearch) {
        const s = this.browseSearch.toLowerCase()
        pool = pool.filter((i) => i.name.toLowerCase().includes(s))
      }
      this.browseTotalCount = pool.length
      const start = page * this.browsePageSize
      this.browseItems = pool
        .slice(start, start + this.browsePageSize)
        .map(this.normalizeCustom)
    },

    async browsePf(page) {
      const clauses = [
        this.selectedPfGroup
          ? `J='${this.selectedPfGroup}'`
          : `J!='Ammunition'`,
      ]
      if (this.browseSearch)
        clauses.push(
          `lower(A) like '%${this.browseSearch
            .toLowerCase()
            .replace(/'/g, "''")}%'`
        )
      const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
      if (page === 0 || !this.browseTotalCount) {
        const ct = await fetch(
          pfQuery(`select count(A) ${where} label count(A) 'count'`)
        ).then((r) => r.text())
        this.browseTotalCount = parseInt(parsePfCsv(ct)[1]?.[0]) || 0
      }
      const rowText = await fetch(
        pfQuery(
          `select A,D,G,J,K ${where} limit ${this.browsePageSize} offset ${
            page * this.browsePageSize
          }`
        )
      ).then((r) => r.text())
      this.browseItems = parsePfCsv(rowText).slice(1).map(this.normalizePf)
    },

    // ── Search ─────────────────────────────────────────────

    debouncedSearch() {
      clearTimeout(this._searchTimer)
      this._searchTimer = setTimeout(() => this.triggerSearch(), 400)
    },

    triggerSearch() {
      clearTimeout(this._searchTimer)
      this.browseItems = []
      this.browseTotalCount = 0
      this.browseSelected = null
      this.loadBrowsePage(0)
    },

    clearSearch() {
      this.browseSearch = ''
      this.triggerSearch()
    },
  },
}
</script>

<style scoped>
.item-gen {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0.75rem;
  gap: 0.75rem;
}

/* ── Filters ──────────────────────────────────────────── */

.ig-filters {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex-shrink: 0;
}

.ig-filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ig-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  min-width: 5rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ig-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.ig-pill {
  padding: 0.15rem 0.55rem;
  border-radius: 3px;
  font-size: var(--font-size-sm);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.12s ease;
  user-select: none;
}

.ig-pill:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}
.ig-pill.active {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border-color: var(--color-accent);
}

.ig-pill.rarity-common.active {
  border-color: #aaa;
  color: #ccc;
}
.ig-pill.rarity-uncommon.active {
  border-color: #4caf7a;
  color: #4caf7a;
}
.ig-pill.rarity-rare.active {
  border-color: #4d9ee8;
  color: #4d9ee8;
}
.ig-pill.rarity-very_rare.active {
  border-color: #9b6fdb;
  color: #9b6fdb;
}
.ig-pill.rarity-legendary.active {
  border-color: #e0951a;
  color: #e0951a;
}
.ig-pill.rarity-artifact.active {
  border-color: #e04040;
  color: #e04040;
}

/* ── Actions row ──────────────────────────────────────── */

.ig-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.ig-mode-tabs {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.ig-mode-tab {
  padding: 0.2rem 0.7rem;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.12s;
  user-select: none;
}

.ig-mode-tab + .ig-mode-tab {
  border-left: 1px solid var(--color-border);
}
.ig-mode-tab:hover {
  color: var(--color-text);
}
.ig-mode-tab.active {
  background: var(--color-bg-surface);
  color: var(--color-accent);
}

.ig-roll-btn {
  padding: 0.25rem 1rem;
  background: var(--color-accent);
  color: var(--color-bg-panel-dark);
  border: none;
  border-radius: 4px;
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ig-roll-btn:hover:not(:disabled) {
  opacity: 0.85;
}
.ig-roll-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.ig-spinner {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.ig-page-btn {
  padding: 0.2rem 0.55rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.12s;
}

.ig-page-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.ig-page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.ig-page-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  min-width: 3.5rem;
  text-align: center;
}

.ig-pool-size {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.ig-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

/* ── Roll mode result card ────────────────────────────── */

.ig-result {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ig-result-header {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ig-result-name {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-accent-strong);
  font-weight: 600;
}

.ig-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.ig-rarity-badge {
  font-size: var(--font-size-sm);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid;
  text-transform: capitalize;
}

.ig-rarity-badge.rarity-common {
  border-color: #aaa;
  color: #aaa;
}
.ig-rarity-badge.rarity-uncommon {
  border-color: #4caf7a;
  color: #4caf7a;
}
.ig-rarity-badge.rarity-rare {
  border-color: #4d9ee8;
  color: #4d9ee8;
}
.ig-rarity-badge.rarity-very_rare {
  border-color: #9b6fdb;
  color: #9b6fdb;
}
.ig-rarity-badge.rarity-legendary {
  border-color: #e0951a;
  color: #e0951a;
}
.ig-rarity-badge.rarity-artifact {
  border-color: #e04040;
  color: #e04040;
}

.ig-meta-tag {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
}

.ig-attunement {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}
.ig-price {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.ig-result-desc {
  font-size: var(--font-size-base);
  color: var(--color-text);
  line-height: 1.6;
  flex: 1;
}
.ig-result-desc :deep(p) {
  margin: 0 0 0.6em;
}

.pf-note {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  flex: 0;
}

.ig-result-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.ig-source {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.ig-reroll-btn {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.12s;
}

.ig-reroll-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.ig-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ig-empty-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  font-style: italic;
}

/* ── Browse mode ──────────────────────────────────────── */

.ig-browse {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}

.ig-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-surface);
}

.ig-table {
  width: 100%;
  border-collapse: collapse;
}

.ig-table thead {
  position: sticky;
  top: 0;
  background: var(--color-bg-panel-dark);
  z-index: 1;
}

.ig-table th {
  padding: 0.3rem 0.5rem;
  text-align: left;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.ig-table td {
  padding: 0.3rem 0.5rem;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}

.ig-table tr:last-child td {
  border-bottom: none;
}
.ig-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}
.ig-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}
.ig-table tbody tr.row-selected {
  background: rgba(255, 255, 255, 0.07);
}

.col-name {
  width: 48%;
}
.col-rarity {
  width: 22%;
}
.col-type {
  width: 24%;
}
.col-att {
  width: 6%;
  text-align: center;
  color: var(--color-text-muted);
}

.ig-browse-loading {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Detail panel */
.ig-browse-detail {
  flex-shrink: 0;
  height: 170px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-surface);
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ig-browse-detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  font-weight: 600;
  flex-shrink: 0;
}

.ig-browse-detail-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.55;
}

.ig-browse-detail-desc :deep(p) {
  margin: 0 0 0.4em;
}

/* Search */
.ig-browse-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.ig-search-input {
  flex: 1;
  padding: 0.3rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-family: inherit;
  outline: none;
  transition: border-color 0.12s;
}

.ig-search-input:focus {
  border-color: var(--color-accent);
}

.ig-search-input::placeholder {
  color: var(--color-text-muted);
}

.ig-search-clear {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  line-height: 1;
  transition: all 0.12s;
  flex-shrink: 0;
}

.ig-search-clear:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* Browse source tabs */
.ig-browse-source-tabs {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.ig-browse-source-tab {
  padding: 0.2rem 0.65rem;
  font-size: var(--font-size-sm);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.12s;
  user-select: none;
}

.ig-browse-source-tab:hover {
  color: var(--color-text);
  border-color: var(--color-accent);
}

.ig-browse-source-tab.active {
  background: var(--color-bg-surface);
  color: var(--color-accent);
  border-color: var(--color-accent);
}
</style>
