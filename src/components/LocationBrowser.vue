<template>
  <div class="location-browser">
    <div class="lb-search-row">
      <input
        v-model="search"
        class="lb-search-input"
        placeholder="Search locations…"
      />
      <button
        v-if="selectedPlaceName"
        class="lb-back-btn"
        @click="selectedPlaceName = null"
      >
        ← Back to browse
      </button>
    </div>

    <!-- Focused single-place view (from search click or Ctrl+K nav) -->
    <div v-if="selectedPlaceName && selectedPlaceNode" class="lb-focused">
      <TreeNode :node="selectedPlaceNode" :default-open="true" />
    </div>
    <div v-else-if="selectedPlaceName" class="lb-empty">
      "{{ selectedPlaceName }}" not found.
    </div>

    <!-- Search results (flat list) -->
    <div v-else-if="search.trim()" class="lb-search-results">
      <div v-if="!searchResults.length" class="lb-empty">
        No locations match "{{ search }}"
      </div>
      <div
        v-for="entry in searchResults"
        :key="entry.name + '|' + entry.breadcrumb"
        class="lb-result-row"
        @click="selectPlace(entry.placeName)"
      >
        <span class="lb-result-name">{{ entry.name }}</span>
        <span v-if="entry.kind" class="lb-result-kind">{{ entry.kind }}</span>
        <span v-if="entry.breadcrumb" class="lb-result-breadcrumb">{{
          entry.breadcrumb
        }}</span>
      </div>
    </div>

    <!-- Default hierarchical browse -->
    <div v-else class="lb-tree">
      <TreeNode v-for="(node, i) in tree" :key="i" :node="node" />
    </div>
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue'
import { dnd } from '@/utils/dnd_utils.js'

// Fields already handled explicitly at each tier — everything else on a
// record gets rendered generically via valueToNodes() so nothing silently
// disappears just because this component doesn't know about it by name.
const PLACE_KNOWN_KEYS = new Set([
  'id',
  'name',
  'type',
  'region',
  'continent',
  'description',
  'climate',
  'faction_presence',
  'notes',
  'districts',
  'locations',
  'flair',
])
const DISTRICT_KNOWN_KEYS = new Set([
  'name',
  'description',
  'faction_presence',
  'controller',
])
const LOCATION_KNOWN_KEYS = new Set([
  'id',
  'name',
  'type',
  'district',
  'description',
  'npcs_present',
  'notes',
  'areas',
])
const REGION_KNOWN_KEYS = new Set([
  'name',
  'continent',
  'flair',
  'climate',
  'capital',
  'notes',
])

function prettyKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Generic JSON → TreeNode conversion for any field this component doesn't
// special-case. Handles the deeply-nested write-ups (Valdmere's
// power_structures.major_families, etc.) without needing bespoke code per
// field — a plain object becomes a group, an array of objects becomes a
// group of items (keyed by their own `name` if present), an array of
// strings/primitives becomes one joined leaf line.
function valueToNodes(value, keyLabel) {
  if (value == null) return []
  if (typeof value === 'string') {
    return value.trim()
      ? [{ label: keyLabel ? `${keyLabel}: ${value}` : value, type: 'text' }]
      : []
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [{ label: `${keyLabel}: ${value}`, type: 'leaf' }]
  }
  if (Array.isArray(value)) {
    if (!value.length) return []
    if (typeof value[0] !== 'object') {
      return [{ label: `${keyLabel}: ${value.join(', ')}`, type: 'leaf' }]
    }
    return [
      {
        label: keyLabel,
        type: 'group',
        children: value.map((item, i) =>
          objectToNode(item, item?.name ?? `#${i + 1}`)
        ),
      },
    ]
  }
  if (typeof value === 'object') {
    return [
      { label: keyLabel, type: 'group', children: objectToChildren(value) },
    ]
  }
  return []
}

function objectToChildren(obj, excludeKeys = new Set(['name'])) {
  const nodes = []
  for (const [k, v] of Object.entries(obj)) {
    if (excludeKeys.has(k)) continue
    nodes.push(...valueToNodes(v, prettyKey(k)))
  }
  return nodes
}

function objectToNode(obj, label) {
  return { label, type: 'item', children: objectToChildren(obj) }
}

export default {
  name: 'LocationBrowser',
  components: { TreeNode },

  data() {
    return {
      search: '',
      selectedPlaceName: null,
    }
  },

  computed: {
    places() {
      return this.$store.state.places ?? []
    },
    world() {
      return this.$store.state.world ?? []
    },
    worldRoot() {
      return this.world.find((w) => w.continents) ?? null
    },
    continents() {
      return this.worldRoot?.continents ?? []
    },
    npcs() {
      return this.$store.state.npcs ?? []
    },

    tree() {
      return this.continents.map((c) => this.buildContinentNode(c))
    },

    searchIndex() {
      const idx = []
      for (const p of this.places) {
        idx.push({
          name: p.name,
          kind: p.type ?? 'place',
          breadcrumb: p.region ?? p.continent ?? '',
          placeName: p.name,
        })
        for (const loc of p.locations ?? []) {
          idx.push({
            name: loc.name,
            kind: loc.type ?? 'location',
            breadcrumb: p.name,
            placeName: p.name,
          })
        }
      }
      return idx
    },
    searchResults() {
      const q = this.search.trim().toLowerCase()
      if (!q) return []
      return this.searchIndex
        .filter((e) => e.name.toLowerCase().includes(q))
        .slice(0, 40)
    },

    selectedPlaceNode() {
      if (!this.selectedPlaceName) return null
      const place = this.places.find((p) => p.name === this.selectedPlaceName)
      return place ? this.buildPlaceNode(place) : null
    },
  },

  created() {
    this.consumeNavRequest()
  },

  watch: {
    '$store.state.placeNavRequest'() {
      this.consumeNavRequest()
    },
  },

  methods: {
    consumeNavRequest() {
      const req = this.$store.state.placeNavRequest
      if (!req) return
      this.search = ''
      this.selectedPlaceName = req
      this.$store.commit('CLEAR_PLACE_NAV')
    },

    selectPlace(name) {
      this.search = ''
      this.selectedPlaceName = name
    },

    jsonAction(label, data) {
      return { label: '📋 JSON', title: `Copy ${label} as JSON`, data }
    },

    // NPCs a settlement claims live in npcs.json's own `location` field now
    // (not a `npcs_present` array on the place/location side, which went
    // stale — e.g. Argentveil's locations only ever listed 5 npcs_present
    // names, of which only 1 actually matched an npcs.json record, while
    // npcs.json itself has 15 real NPCs tagged to Argentveil). Reuses the
    // same location-matching dnd.npcsAtLocation already powers elsewhere,
    // so a settlement's copy button and its NPC list stay in sync with one
    // real source instead of two.
    settlementNpcAction(place) {
      const matches = dnd.npcsAtLocation(this.npcs, place.name)
      if (!matches.length) return null
      return {
        label: '👤 NPCs',
        title: `Copy NPCs present in ${place.name} as JSON`,
        data: { settlement: place.name, npcs: matches },
      }
    },

    buildContinentNode(continent) {
      const regions = continent.regions ?? []
      const children = []
      if (regions.length) {
        children.push(...regions.map((r) => this.buildRegionNode(r)))
      }
      // Places whose continent is set directly (no defined regions yet for
      // that continent, e.g. Yetgrese) — grouped as unmapped rather than
      // silently dropped.
      const unmapped = this.places.filter(
        (p) =>
          p.continent === continent.name &&
          !regions.some((r) => r.name === p.region)
      )
      if (unmapped.length) {
        children.push({
          label: 'Unmapped',
          type: 'item',
          tags: ['no defined regions yet'],
          children: unmapped.map((p) => this.buildPlaceNode(p)),
        })
      }
      return {
        label: continent.name,
        type: 'section',
        children,
        copyActions: [
          this.jsonAction(continent.name, {
            ...continent,
            regions: regions.map((r) => this.rawRegionData(r)),
            ...(unmapped.length ? { unmapped } : {}),
          }),
        ],
      }
    },

    // The assembled subtree for a region: `world.json`'s own rich record for
    // it, plus every place from `places.json` whose `region` field matches
    // (settlements aren't nested under regions in the source data — this is
    // the same lookup buildRegionNode does for the tree, reused here so the
    // copy-JSON button gets an identical hierarchy). Each place already
    // carries its own nested districts/locations/areas as-is.
    rawRegionData(regionStub) {
      const rich = this.world.find((w) => w.name === regionStub.name) ?? {}
      const settlements = this.places.filter(
        (p) => p.region === regionStub.name
      )
      return { ...regionStub, ...rich, settlements }
    },

    buildRegionNode(regionStub) {
      const rich = this.world.find((w) => w.name === regionStub.name) ?? {}
      const placesHere = this.places.filter((p) => p.region === regionStub.name)
      const children = []
      if (rich.flair) children.push({ label: rich.flair, type: 'text' })
      if (rich.capital)
        children.push({ label: `Capital: ${rich.capital}`, type: 'leaf' })
      if (rich.climate)
        children.push({ label: `Climate: ${rich.climate}`, type: 'leaf' })
      if (rich.culture) children.push({ label: rich.culture, type: 'text' })
      children.push(...objectToChildren(rich, REGION_KNOWN_KEYS))
      if (rich.notes) children.push({ label: rich.notes, type: 'note' })
      if (placesHere.length) {
        children.push({
          label: 'Settlements',
          type: 'group',
          children: placesHere.map((p) => this.buildPlaceNode(p)),
        })
      }
      return {
        label: regionStub.name,
        type: 'item',
        tags: [
          regionStub.status,
          regionStub.player_knowledge
            ? `${regionStub.player_knowledge} knowledge`
            : null,
        ].filter(Boolean),
        children,
        copyActions: [
          this.jsonAction(regionStub.name, this.rawRegionData(regionStub)),
        ],
      }
    },

    buildPlaceNode(place) {
      const children = []
      if (place.description)
        children.push({ label: place.description, type: 'text' })
      if (place.climate)
        children.push({ label: `Climate: ${place.climate}`, type: 'leaf' })
      if (place.faction_presence?.length)
        children.push({
          label: `Factions: ${place.faction_presence.join(', ')}`,
          type: 'leaf',
        })
      children.push(...objectToChildren(place, PLACE_KNOWN_KEYS))
      if (place.districts?.length) {
        children.push({
          label: 'Districts',
          type: 'group',
          children: place.districts.map((d) => this.buildDistrictNode(d)),
        })
      }
      if (place.locations?.length) {
        children.push({
          label: 'Locations',
          type: 'group',
          children: place.locations.map((l) => this.buildLocationNode(l)),
        })
      }
      if (place.flair) children.push({ label: place.flair, type: 'note' })
      if (place.notes) children.push({ label: place.notes, type: 'note' })
      const npcAction = this.settlementNpcAction(place)
      return {
        label: place.name,
        type: 'item',
        tags: [place.type].filter(Boolean),
        children,
        copyActions: [
          this.jsonAction(place.name, place),
          ...(npcAction ? [npcAction] : []),
        ],
      }
    },

    buildDistrictNode(d) {
      const children = []
      if (d.description) children.push({ label: d.description, type: 'text' })
      if (d.faction_presence?.length)
        children.push({
          label: `Factions: ${d.faction_presence.join(', ')}`,
          type: 'leaf',
        })
      if (d.controller)
        children.push({ label: `Controller: ${d.controller}`, type: 'leaf' })
      children.push(...objectToChildren(d, DISTRICT_KNOWN_KEYS))
      return {
        label: d.name,
        type: 'item',
        children,
        copyActions: [this.jsonAction(d.name, d)],
      }
    },

    buildLocationNode(loc) {
      const children = []
      if (loc.description)
        children.push({ label: loc.description, type: 'text' })
      // Reads npcs.json directly by location match now, not the old
      // npcs_present array on the location itself — see TODO.md's
      // "NPC location should live only on the NPC record" entry. Same
      // dnd.npcsAtLocation helper the settlement-level copy button uses.
      const locNpcs = dnd.npcsAtLocation(this.npcs, loc.name)
      if (locNpcs.length)
        children.push({
          label: `NPCs: ${locNpcs.map((n) => n.name).join(', ')}`,
          type: 'leaf',
        })
      children.push(...objectToChildren(loc, LOCATION_KNOWN_KEYS))
      if (loc.areas?.length) {
        children.push({
          label: 'Areas',
          type: 'group',
          children: loc.areas.map((a) => this.buildDistrictNode(a)),
        })
      }
      if (loc.notes) children.push({ label: loc.notes, type: 'note' })
      return {
        label: loc.name,
        type: 'item',
        tags: [loc.type, loc.district].filter(Boolean),
        children,
        copyActions: [this.jsonAction(loc.name, loc)],
      }
    },
  },
}
</script>

<style scoped>
.location-browser {
  height: 100%;
  overflow-y: auto;
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.lb-search-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  position: sticky;
  top: 0;
  background: var(--color-bg);
  padding-bottom: 0.4rem;
  z-index: 1;
}

.lb-search-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  outline: none;
}
.lb-search-input:focus {
  border-color: var(--color-accent);
}

.lb-back-btn {
  flex-shrink: 0;
  padding: 0.4rem 0.7rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all 0.12s;
}
.lb-back-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.lb-tree,
.lb-focused {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.lb-search-results {
  display: flex;
  flex-direction: column;
}

.lb-result-row {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}
.lb-result-row:hover {
  background: var(--color-bg-panel);
}

.lb-result-name {
  color: var(--color-text);
  font-weight: 500;
}

.lb-result-kind {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lb-result-breadcrumb {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.lb-empty {
  padding: 0.8rem 0.5rem;
  color: var(--color-text-low);
  font-style: italic;
  font-size: var(--font-size-base);
}
</style>
