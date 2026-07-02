<template>
  <div class="asset-browser">
    <!-- List -->
    <aside class="ab-list scrollable">
      <div class="ab-filter-row">
        <button
          v-for="t in typeFilters"
          :key="t"
          class="ab-type-chip"
          :class="{ active: typeFilter === t }"
          @click="typeFilter = typeFilter === t ? null : t"
        >
          {{ t }}
        </button>
      </div>
      <div
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="ab-item"
        :class="{ selected: selected && selected.id === asset.id }"
        @click="selected = asset"
      >
        <div class="ab-item-name">{{ asset.name }}</div>
        <div class="ab-item-meta">
          <span class="ab-type-badge" :class="'ab-type--' + asset.type">{{
            asset.type
          }}</span>
          <span v-if="asset.subtype" class="ab-item-sub">{{
            asset.subtype
          }}</span>
        </div>
      </div>
    </aside>

    <!-- Detail -->
    <main class="ab-detail" v-if="selected">
      <div class="ab-detail-header">
        <div class="ab-detail-identity">
          <h2 class="ab-detail-name">{{ selected.name }}</h2>
          <div class="ab-detail-sub">
            <span class="ab-type-badge" :class="'ab-type--' + selected.type">{{
              selected.type
            }}</span>
            <span v-if="selected.subtype" class="ab-detail-subtype">{{
              selected.subtype
            }}</span>
          </div>
        </div>
        <div class="ab-portrait" v-if="selected.image">
          <img
            :src="selected.image"
            :alt="selected.name"
            class="ab-portrait-img"
          />
        </div>
        <div class="ab-portrait ab-portrait--empty" v-else></div>
      </div>

      <!-- Loadout tab toggle (ships only) -->
      <div v-if="selected.type === 'ship'" class="ab-detail-tabs">
        <button
          class="ab-tab-btn"
          :class="{ 'ab-tab-btn--active': detailTab === 'overview' }"
          @click="detailTab = 'overview'"
        >
          Overview
        </button>
        <button
          class="ab-tab-btn"
          :class="{ 'ab-tab-btn--active': detailTab === 'loadout' }"
          @click="detailTab = 'loadout'"
        >
          Combat Loadout
        </button>
      </div>

      <!-- Loadout panel (ships only) -->
      <ship-loadout
        v-if="selected.type === 'ship' && detailTab === 'loadout'"
        :ship="selected"
        @update="PATCH_ASSET"
        class="ab-loadout-panel"
      />

      <div class="ab-detail-body scrollable" v-if="detailTab === 'overview'">
        <!-- Ship fields -->
        <template v-if="selected.type === 'ship'">
          <div class="ab-fields">
            <div v-if="selected.captain" class="ab-field">
              <span class="ab-field-label">Captain</span>
              <span class="ab-field-val">{{ selected.captain }}</span>
            </div>
            <div class="ab-field">
              <span class="ab-field-label">Crew</span>
              <span class="ab-field-val"
                >{{ selected.crew_current }} / {{ selected.crew_full }}</span
              >
            </div>
            <div v-if="selected.passengers" class="ab-field">
              <span class="ab-field-label">Passengers</span>
              <span class="ab-field-val">{{ selected.passengers }}</span>
            </div>
            <div v-if="selected.cargo" class="ab-field">
              <span class="ab-field-label">Cargo</span>
              <span class="ab-field-val">{{ selected.cargo }}</span>
            </div>
            <div v-if="selected.armament" class="ab-field">
              <span class="ab-field-label">Armament</span>
              <span class="ab-field-val">{{ selected.armament }}</span>
            </div>
            <div v-if="selected.condition" class="ab-field">
              <span class="ab-field-label">Condition</span>
              <span class="ab-field-val">{{ selected.condition }}</span>
            </div>
            <div v-if="selected.home_port" class="ab-field">
              <span class="ab-field-label">Home Port</span>
              <span class="ab-field-val">{{ selected.home_port }}</span>
            </div>
            <div v-if="selected.current_location" class="ab-field">
              <span class="ab-field-label">Location</span>
              <span class="ab-field-val">{{ selected.current_location }}</span>
            </div>
          </div>
        </template>

        <!-- Real estate / business fields -->
        <template v-else>
          <div class="ab-fields">
            <div v-if="selected.location" class="ab-field">
              <span class="ab-field-label">Location</span>
              <span class="ab-field-val">{{ selected.location }}</span>
            </div>
            <div v-if="selected.owner || selected.operator" class="ab-field">
              <span class="ab-field-label">{{
                selected.owner ? 'Owner' : 'Operator'
              }}</span>
              <span class="ab-field-val">{{
                selected.owner || selected.operator
              }}</span>
            </div>
            <div v-if="selected.income" class="ab-field">
              <span class="ab-field-label">Income</span>
              <span class="ab-field-val">{{ selected.income }}</span>
            </div>
            <div v-if="selected.status" class="ab-field">
              <span class="ab-field-label">Status</span>
              <span class="ab-field-val">{{ selected.status }}</span>
            </div>
          </div>
        </template>

        <!-- Shared: any remaining fields not specifically handled -->
        <div
          v-for="(val, key) in extraFields"
          :key="key"
          class="ab-field ab-field--extra"
        >
          <span class="ab-field-label">{{ formatKey(key) }}</span>
          <span class="ab-field-val">{{ val }}</span>
        </div>

        <div v-if="selected.notes" class="ab-block">
          <div class="section-label">Notes</div>
          <p class="ab-text">{{ selected.notes }}</p>
        </div>
      </div>
    </main>

    <div v-else class="ab-detail empty-state">
      Select an asset to view details.
    </div>
  </div>
</template>

<script>
import { mapMutations } from 'vuex'
import ShipLoadout from './ShipLoadout.vue'

const SHIP_SHOWN = new Set([
  'name',
  'type',
  'subtype',
  'id',
  'image',
  'captain',
  'crew_full',
  'crew_current',
  'passengers',
  'cargo',
  'armament',
  'condition',
  'home_port',
  'current_location',
  'notes',
])
const ESTATE_SHOWN = new Set([
  'name',
  'type',
  'subtype',
  'id',
  'image',
  'location',
  'owner',
  'operator',
  'income',
  'status',
  'notes',
])

export default {
  name: 'AssetBrowser',

  components: { ShipLoadout },

  data() {
    return {
      typeFilter: null,
      selected: null,
      detailTab: 'overview',
    }
  },

  computed: {
    assets() {
      return this.$store.state.assets ?? []
    },
    typeFilters() {
      return [...new Set(this.assets.map((a) => a.type))].sort()
    },
    filteredAssets() {
      if (!this.typeFilter) return this.assets
      return this.assets.filter((a) => a.type === this.typeFilter)
    },
    extraFields() {
      if (!this.selected) return {}
      const shown = this.selected.type === 'ship' ? SHIP_SHOWN : ESTATE_SHOWN
      const out = {}
      for (const [k, v] of Object.entries(this.selected)) {
        if (!shown.has(k) && v != null && v !== '') out[k] = v
      }
      return out
    },
  },

  methods: {
    ...mapMutations(['PATCH_ASSET']),

    formatKey(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    },
  },

  watch: {
    selected(val) {
      if (!val || val.type !== 'ship') this.detailTab = 'overview'
    },
    filteredAssets(list) {
      if (this.selected && !list.find((a) => a.id === this.selected.id)) {
        this.selected = list[0] ?? null
      }
    },
  },
}
</script>

<style scoped>
.asset-browser {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── List ── */
.ab-list {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.ab-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.ab-type-chip {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  text-transform: capitalize;
}
.ab-type-chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.ab-item {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s;
}
.ab-item:hover {
  background: var(--color-bg-surface);
}
.ab-item.selected {
  background: var(--color-bg-surface-alt);
  border-left: 2px solid var(--color-accent);
}

.ab-item-name {
  font-size: var(--font-size-md);
  color: var(--color-text);
}
.ab-item-meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
}
.ab-item-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

/* ── Type badge ── */
.ab-type-badge {
  font-size: var(--font-size-xs);
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  text-transform: capitalize;
  color: var(--color-text-low);
}
.ab-type--ship {
  color: var(--color-info);
  border-color: var(--color-info);
}
.ab-type--real_estate {
  color: var(--color-success);
  border-color: var(--color-success);
}
.ab-type--business {
  color: var(--color-neutral-amber);
  border-color: var(--color-neutral-amber);
}

/* ── Detail ── */
.ab-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ab-detail-header {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
  align-items: flex-start;
}

.ab-detail-identity {
  flex: 1;
}

.ab-detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-accent-strong);
  margin: 0 0 0.4rem;
}

.ab-detail-sub {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.ab-detail-subtype {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}

.ab-portrait {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.ab-portrait--empty {
  background: var(--color-bg-surface);
  opacity: 0.4;
}
.ab-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ab-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Fields ── */
.ab-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem 1rem;
}

.ab-field {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.ab-field--extra {
  grid-column: span 2;
}

.ab-field-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ab-field-val {
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.ab-block {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.25rem;
}
.ab-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

/* ── Ship detail tabs ── */
.ab-detail-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-bg-surface);
}

.ab-tab-btn {
  padding: 0.4rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
  margin-bottom: -1px;
}
.ab-tab-btn:hover {
  color: var(--color-text-muted);
}
.ab-tab-btn--active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.ab-loadout-panel {
  flex: 1;
  overflow: hidden;
}
</style>
