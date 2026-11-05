<!-- Original File built by qwen -->
<template>
  <div class="dungeon-map">
    <aside class="dm-panel">
      <h1>⚔ DUNGEON FORGE ⚔</h1>
      <div class="subtitle">Procedural map generator</div>

      <section>
        <h2>Seed</h2>
        <div class="seed-row">
          <input v-model="seed" type="text" placeholder="random" />
          <button @click="randomSeed" title="New random seed">🎲</button>
        </div>
      </section>

      <section>
        <h2>Generator</h2>
        <div class="row">
          <label>Type</label>
          <select v-model="generatorType" @change="applyPreset">
            <option value="classic">Classic</option>
            <option value="cavern">Cavern</option>
            <option value="temple">Temple</option>
            <option value="sewer">Sewer</option>
            <option value="tomb">Tomb</option>
          </select>
        </div>
        <div class="row">
          <label>Theme</label>
          <select v-model="theme">
            <option value="stone">Stone</option>
            <option value="ice">Ice</option>
            <option value="sandstone">Sandstone</option>
            <option value="sewer">Sewer</option>
            <option value="obsidian">Obsidian</option>
            <option value="marble">Marble</option>
          </select>
        </div>
      </section>

      <section>
        <h2>Map Size</h2>
        <div class="row">
          <label>Width (tiles · 5ft)</label
          ><input v-model.number="mapW" type="number" min="20" max="200" />
        </div>
        <div class="row">
          <label>Height (tiles · 5ft)</label
          ><input v-model.number="mapH" type="number" min="20" max="200" />
        </div>
      </section>

      <section>
        <h2>Rooms</h2>
        <div class="row">
          <label>Count</label>
          <div class="range-row">
            <input v-model.number="roomMin" type="number" min="1" max="50" />
            <span>-</span>
            <input v-model.number="roomMax" type="number" min="1" max="50" />
          </div>
        </div>
        <div class="row">
          <label>Width</label>
          <div class="range-row">
            <input v-model.number="rwMin" type="number" min="3" max="20" />
            <span>-</span>
            <input v-model.number="rwMax" type="number" min="3" max="25" />
          </div>
        </div>
        <div class="row">
          <label>Height</label>
          <div class="range-row">
            <input v-model.number="rhMin" type="number" min="3" max="20" />
            <span>-</span>
            <input v-model.number="rhMax" type="number" min="3" max="25" />
          </div>
        </div>
        <div class="row">
          <label>Padding</label
          ><input v-model.number="pad" type="number" min="1" max="6" />
        </div>
      </section>

      <section>
        <h2>Corridors</h2>
        <div class="row">
          <label>Width</label
          ><input v-model.number="corrW" type="number" min="1" max="5" />
        </div>
        <div class="row">
          <label>Style</label>
          <select v-model="corrStyle">
            <option value="l">L-shaped</option>
            <option value="straight">Straight</option>
            <option value="winding">Winding</option>
          </select>
        </div>
      </section>

      <section>
        <h2>Features (%)</h2>
        <div class="row">
          <label>Traps</label
          ><input
            v-model.number="trapChance"
            type="range"
            min="0"
            max="100"
          /><span>{{ trapChance }}</span>
        </div>
        <div class="row">
          <label>Chests</label
          ><input
            v-model.number="chestChance"
            type="range"
            min="0"
            max="100"
          /><span>{{ chestChance }}</span>
        </div>
        <div class="row">
          <label>Locked doors</label
          ><input
            v-model.number="lockChance"
            type="range"
            min="0"
            max="100"
          /><span>{{ lockChance }}</span>
        </div>
        <div class="row">
          <label>Secret doors</label
          ><input
            v-model.number="secretChance"
            type="range"
            min="0"
            max="100"
          /><span>{{ secretChance }}</span>
        </div>
        <div class="row">
          <label>Decorations</label
          ><input
            v-model.number="decorChance"
            type="range"
            min="0"
            max="100"
          /><span>{{ decorChance }}</span>
        </div>
        <div class="row">
          <label>Pools</label
          ><input
            v-model.number="poolChance"
            type="range"
            min="0"
            max="100"
          /><span>{{ poolChance }}</span>
        </div>
      </section>

      <section>
        <h2>View Mode</h2>
        <div class="btn-row">
          <button
            :class="{ active: viewMode === 'dm' }"
            @click="viewMode = 'dm'"
          >
            👁 DM
          </button>
          <button
            :class="{ active: viewMode === 'player' }"
            @click="viewMode = 'player'"
          >
            🗡 Player
          </button>
        </div>
        <div class="btn-row" style="margin-top: 6px">
          <button :class="{ active: tagMode }" @click="toggleTagMode">
            🏷 Tag Mode {{ tagMode ? 'ON' : 'OFF' }}
          </button>
          <button
            :class="{ active: showHidden }"
            @click="showHidden = !showHidden"
          >
            👻 Hidden {{ showHidden ? 'ON' : 'OFF' }}
          </button>
        </div>
      </section>

      <section>
        <h2>Actions</h2>
        <button class="primary" @click="generateFull">
          ⚒ Generate Full Dungeon
        </button>
        <button @click="addRoom">➕ Add One Room</button>
        <button @click="populateOnly">✨ Reroll Features</button>
        <button @click="revealAllRooms">🔆 Reveal All Rooms</button>
        <button @click="revealAllHidden">🔍 Reveal All Hidden</button>
        <button class="danger" @click="clearMap">✕ Clear Map</button>
        <div class="btn-row" style="margin-top: 8px">
          <button @click="zoom(-1)">− Zoom</button>
          <button @click="zoom(1)">+ Zoom</button>
        </div>
        <button @click="zoom(0)">Fit</button>
      </section>

      <section>
        <h2>Levels</h2>
        <div class="btn-row">
          <button @click="addLevel">+ Add Level</button>
          <button
            class="danger"
            @click="removeLevel"
            :disabled="levels.length <= 1"
          >
            − Remove
          </button>
        </div>
        <div class="btn-row" style="margin-top: 6px">
          <button @click="exportLevelJSON">💾 Export Level</button>
          <button @click="triggerImportLevel">📂 Import Level</button>
        </div>
        <button @click="exportGlobalJSON" style="margin-top: 6px">
          💾 Export All (JSON)
        </button>
        <button @click="exportPNG">📷 Export PNG</button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleImport"
        />
      </section>

      <section>
        <h2>Statistics</h2>
        <div class="stat">
          <span>Rooms</span><span>{{ stats.rooms }}</span>
        </div>
        <div class="stat">
          <span>Tagged</span><span>{{ stats.tagged }}</span>
        </div>
        <div class="stat">
          <span>Corridors</span><span>{{ stats.corridors }}</span>
        </div>
        <div class="stat">
          <span>Doors</span><span>{{ stats.doors }}</span>
        </div>
        <div class="stat">
          <span>Secret doors</span><span>{{ stats.secret }}</span>
        </div>
        <div class="stat">
          <span>Traps</span><span>{{ stats.traps }}</span>
        </div>
        <div class="stat">
          <span>Chests</span><span>{{ stats.chests }}</span>
        </div>
        <div class="stat">
          <span>Hidden</span><span>{{ stats.hidden }}</span>
        </div>
        <div class="stat">
          <span>Revealed rooms</span
          ><span
            >{{ stats.revealedRooms }} /
            {{ levels[currentLevel].rooms.length }}</span
          >
        </div>
      </section>
    </aside>

    <main
      class="map-area"
      @click.self="closeTagMenu"
      @keydown.esc="closeTagMenu"
      tabindex="-1"
    >
      <div class="toolbar">
        <div class="level-tabs">
          <button
            v-for="(lvl, idx) in levels"
            :key="idx"
            :class="{ active: idx === currentLevel }"
            @click="currentLevel = idx"
          >
            Level {{ idx + 1 }}
          </button>
        </div>
        <div class="info">{{ info }}</div>
      </div>

      <div v-if="tagMode" class="mode-banner tag-banner">
        🏷 Tag Mode — click a room to tag it
      </div>

      <div class="canvas-wrap">
        <canvas
          ref="map"
          @mousemove="onMouseMove"
          @mouseleave="tooltip.visible = false"
          @click="onCanvasClick"
        ></canvas>
      </div>

      <!-- Tag menu -->
      <div
        v-if="tagMenu.visible"
        class="tag-menu"
        :style="{ left: tagMenu.x + 'px', top: tagMenu.y + 'px' }"
        @click.stop
      >
        <div class="tag-menu-title">Tag room #{{ tagMenu.roomId }}</div>
        <div class="tag-menu-row">
          <label
            ><input type="checkbox" v-model="tagMenu.addFeatures" /> Add
            tag-appropriate features</label
          >
        </div>
        <div class="tag-list">
          <button
            v-for="(tmpl, key) in allTags"
            :key="key"
            class="tag-btn"
            :style="{ borderLeftColor: tmpl.color }"
            @click="applyTag(key)"
          >
            {{ tmpl.label }}
          </button>
          <button class="tag-btn custom" @click="promptCustomTag">
            ✎ Custom…
          </button>
          <button class="tag-btn clear" @click="applyTag(null)">
            ✕ Clear tag
          </button>
        </div>
      </div>

      <div class="legend">
        <div class="legend-item">
          <div
            class="legend-swatch"
            :style="{ background: palette.wall }"
          ></div>
          Wall (smoothed)
        </div>
        <div class="legend-item">
          <div
            class="legend-swatch"
            :style="{ background: palette.floor }"
          ></div>
          Floor
        </div>
        <div class="legend-item">
          <div
            class="legend-swatch"
            :style="{ background: palette.water }"
          ></div>
          Water
        </div>
        <div class="legend-item">
          <div
            class="legend-swatch"
            :style="{ background: palette.lava }"
          ></div>
          Lava
        </div>
        <div class="legend-item">🚪 Door · 🔒 Locked · 🧱 Secret</div>
        <div class="legend-item">📦 Chest · 💀 Trap · 🗿 Statue</div>
        <div class="legend-item">
          🪜 Stairs (click to travel between levels)
        </div>
        <div
          class="legend-item"
          style="grid-column: 1 / -1; color: #9a8670; font-style: italic"
        >
          Tiles are 5 ft squares. Click unrevealed rooms to reveal. Click stairs
          to travel. Use Tag Mode to label rooms.
        </div>
      </div>
    </main>

    <div
      v-if="tooltip.visible"
      class="tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      v-html="tooltip.text"
    ></div>
  </div>
</template>

<script>
// ============ Seeded RNG ============
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const T = {
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
  SECRET_DOOR: 3,
  WATER: 4,
  LAVA: 5,
  PIT: 6,
  LOCKED_DOOR: 7,
}

const TILE_NAMES = {
  [T.WALL]: 'Wall',
  [T.FLOOR]: 'Floor',
  [T.DOOR]: 'Door',
  [T.SECRET_DOOR]: 'Secret door',
  [T.WATER]: 'Water',
  [T.LAVA]: 'Lava',
  [T.PIT]: 'Pit',
  [T.LOCKED_DOOR]: 'Locked door',
}

// A blank level: solid wall, no rooms. `corridors` records, per corridor, which two
// rooms it joins and the tiles it covers outside any room (so it can be revealed
// together with the rooms it leads out of).
function makeLevel(id, w, h) {
  const grid = []
  for (let y = 0; y < h; y++) grid.push(new Array(w).fill(T.WALL))
  return {
    id,
    name: `Level ${id + 1}`,
    grid,
    rooms: [],
    corridors: [],
    features: [],
    corridorCount: 0,
    width: w,
    height: h,
  }
}

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}

function escapeHtml(s) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return String(s).replace(/[&<>"']/g, (c) => map[c])
}

const PALETTES = {
  stone: {
    wall: '#4a3a28',
    floor: '#7a6a52',
    floorAlt: '#5a4228',
    water: '#2a5a7a',
    lava: '#8a2a0a',
    door: '#6b4422',
    accent: '#c9a961',
  },
  ice: {
    wall: '#3a5a7a',
    floor: '#a8c8d8',
    floorAlt: '#88a8c0',
    water: '#4a8ab0',
    lava: '#8a2a0a',
    door: '#5a7a9a',
    accent: '#d8e8f0',
  },
  sandstone: {
    wall: '#8a6a3a',
    floor: '#c8a870',
    floorAlt: '#a88850',
    water: '#3a7a8a',
    lava: '#8a2a0a',
    door: '#6a4a22',
    accent: '#e8c878',
  },
  sewer: {
    wall: '#2a3a28',
    floor: '#4a5a3a',
    floorAlt: '#3a4a2a',
    water: '#3a6a3a',
    lava: '#8a2a0a',
    door: '#3a3020',
    accent: '#8a9a60',
  },
  obsidian: {
    wall: '#1a1020',
    floor: '#3a2840',
    floorAlt: '#2a1830',
    water: '#2a2a5a',
    lava: '#aa2a1a',
    door: '#2a1a2a',
    accent: '#a060c0',
  },
  marble: {
    wall: '#a8a8a8',
    floor: '#e0e0e0',
    floorAlt: '#c0c0c0',
    water: '#4a8ab0',
    lava: '#8a2a0a',
    door: '#8a7a62',
    accent: '#d8c878',
  },
}

const GENERATORS = {
  classic: {
    roomCount: [8, 14],
    roomW: [4, 9],
    roomH: [4, 9],
    traps: 25,
    chests: 30,
    decor: 40,
    pools: 15,
    locks: 20,
    secrets: 15,
    trapHidden: 0.6,
    chestTypes: ['normal', 'normal', 'locked', 'trapped'],
    decorPool: [
      'statue',
      'fountain',
      'altar',
      'bones',
      'barrel',
      'barrel',
      'pile',
      'brazier',
    ],
    poolTypes: ['water', 'water', 'lava'],
    stairsChance: 0.15,
  },
  cavern: {
    roomCount: [5, 9],
    roomW: [6, 14],
    roomH: [6, 14],
    traps: 15,
    chests: 20,
    decor: 25,
    pools: 50,
    locks: 5,
    secrets: 10,
    trapHidden: 0.7,
    chestTypes: ['normal', 'normal', 'hidden'],
    decorPool: [
      'stalagmite',
      'mushroom',
      'mushroom',
      'bones',
      'pile',
      'pool_edge',
    ],
    poolTypes: ['water', 'water', 'water', 'lava'],
    stairsChance: 0.1,
  },
  temple: {
    roomCount: [10, 16],
    roomW: [5, 10],
    roomH: [5, 10],
    traps: 20,
    chests: 25,
    decor: 60,
    pools: 10,
    locks: 40,
    secrets: 20,
    trapHidden: 0.5,
    chestTypes: ['normal', 'locked', 'locked', 'trapped'],
    decorPool: [
      'statue',
      'statue',
      'altar',
      'altar',
      'fountain',
      'brazier',
      'column',
    ],
    poolTypes: ['water'],
    stairsChance: 0.1,
  },
  sewer: {
    roomCount: [8, 12],
    roomW: [3, 7],
    roomH: [3, 7],
    traps: 30,
    chests: 15,
    decor: 35,
    pools: 60,
    locks: 10,
    secrets: 10,
    trapHidden: 0.7,
    chestTypes: ['normal', 'trapped', 'hidden'],
    decorPool: ['barrel', 'barrel', 'pile', 'grate', 'slime', 'bones'],
    poolTypes: ['water', 'water', 'water', 'water'],
    stairsChance: 0.08,
  },
  tomb: {
    roomCount: [10, 18],
    roomW: [3, 7],
    roomH: [3, 7],
    traps: 50,
    chests: 20,
    decor: 45,
    pools: 5,
    locks: 25,
    secrets: 40,
    trapHidden: 0.8,
    chestTypes: ['normal', 'locked', 'hidden', 'hidden'],
    decorPool: ['sarcophagus', 'bones', 'bones', 'urn', 'statue', 'brazier'],
    poolTypes: ['water'],
    stairsChance: 0.2,
  },
}

// Tag templates: label, color, and features to auto-add when "add features" is checked
const TAG_TEMPLATES = {
  entrance: {
    label: 'Entrance',
    color: '#4a8ab0',
    features: [{ type: 'decor', subtype: 'brazier' }],
  },
  treasure_vault: {
    label: 'Treasure Vault',
    color: '#c9a961',
    features: [
      { type: 'chest', subtype: 'locked' },
      { type: 'chest', subtype: 'normal' },
      { type: 'trap', subtype: 'spikes', hidden: true },
    ],
  },
  guard_post: {
    label: 'Guard Post',
    color: '#8a5a2b',
    features: [
      { type: 'decor', subtype: 'brazier' },
      { type: 'decor', subtype: 'barrel' },
      { type: 'decor', subtype: 'barrel' },
    ],
  },
  boss_chamber: {
    label: 'Boss Chamber',
    color: '#a83232',
    features: [
      { type: 'decor', subtype: 'altar' },
      { type: 'decor', subtype: 'brazier' },
      { type: 'decor', subtype: 'statue' },
      { type: 'trap', subtype: 'pit', hidden: true },
    ],
  },
  shrine: {
    label: 'Shrine',
    color: '#d8c878',
    features: [
      { type: 'decor', subtype: 'altar' },
      { type: 'decor', subtype: 'fountain' },
      { type: 'decor', subtype: 'brazier' },
    ],
  },
  prison: {
    label: 'Prison',
    color: '#6a5a48',
    features: [
      { type: 'decor', subtype: 'bones' },
      { type: 'decor', subtype: 'barrel' },
      { type: 'decor', subtype: 'grate' },
    ],
  },
  library: {
    label: 'Library',
    color: '#8a6a3a',
    features: [
      { type: 'decor', subtype: 'barrel' },
      { type: 'decor', subtype: 'barrel' },
      { type: 'decor', subtype: 'pile' },
    ],
  },
  throne_room: {
    label: 'Throne Room',
    color: '#a060c0',
    features: [
      { type: 'decor', subtype: 'altar' },
      { type: 'decor', subtype: 'statue' },
      { type: 'decor', subtype: 'statue' },
      { type: 'decor', subtype: 'brazier' },
    ],
  },
  empty: { label: 'Empty', color: '#6a6a6a', features: [] },
}

export default {
  name: 'DungeonMap',
  props: { initialConfig: { type: Object, default: () => ({}) } },
  data() {
    return {
      seed: '',
      generatorType: 'classic',
      theme: 'stone',
      mapW: 60,
      mapH: 45,
      roomMin: 8,
      roomMax: 14,
      rwMin: 4,
      rwMax: 9,
      rhMin: 4,
      rhMax: 9,
      pad: 2,
      corrW: 2,
      corrStyle: 'l',
      trapChance: 25,
      chestChance: 30,
      lockChance: 20,
      secretChance: 15,
      decorChance: 40,
      poolChance: 15,
      viewMode: 'dm',
      showHidden: false,
      tagMode: false,
      zoomLevel: 1,
      currentLevel: 0,
      info: 'Ready.',
      tooltip: { visible: false, x: 0, y: 0, text: '' },
      tagMenu: { visible: false, x: 0, y: 0, roomId: null, addFeatures: true },
      highlightedStair: null, // { level, roomId, featureIdx, until }
      levels: [makeLevel(0, 60, 45)],
      rng: Math.random,
      textures: {},
      animFrameId: null,
      TS: 20,
      customTags: {}, // user-made tags, saved with the export
      revision: 0, // bump after editing the grid by index (Vue 2 can't see that)
    }
  },
  computed: {
    palette() {
      return PALETTES[this.theme] || PALETTES.stone
    },
    preset() {
      return GENERATORS[this.generatorType] || GENERATORS.classic
    },
    allTags() {
      return Object.assign({}, TAG_TEMPLATES, this.customTags)
    },
    currentLevelData() {
      return this.levels[this.currentLevel]
    },
    stats() {
      void this.revision
      const lvl = this.currentLevelData
      const flat = lvl.grid.flat()
      return {
        rooms: lvl.rooms.length,
        tagged: lvl.rooms.filter((r) => r.tag).length,
        corridors: lvl.corridorCount,
        doors: flat.filter((t) => t === T.DOOR).length,
        secret: flat.filter((t) => t === T.SECRET_DOOR).length,
        traps: lvl.features.filter((f) => f.type === 'trap').length,
        chests: lvl.features.filter((f) => f.type === 'chest').length,
        hidden: lvl.features.filter((f) => f.hidden && !f.revealed).length,
        revealedRooms: lvl.rooms.filter((r) => r.revealed).length,
      }
    },
  },
  watch: {
    theme() {
      this.rebuildTextures()
      this.render()
    },
    currentLevel() {
      this.$nextTick(() => this.render())
    },
    showHidden() {
      this.render()
    },
    tagMode(v) {
      if (!v) this.closeTagMenu()
    },
  },
  created() {
    this.visCache = null // set by render(): which tiles the players can see
  },
  mounted() {
    if (this.initialConfig && Object.keys(this.initialConfig).length) {
      Object.assign(this.$data, this.initialConfig)
    }
    this.rebuildTextures()
    this.render()
    this.startAnimLoop()
    window.addEventListener('keydown', this.onKeyDown)
    // Open with a dungeon on screen rather than a blank map
    if (!this.currentLevelData.rooms.length) this.generateFull()
  },
  beforeDestroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
    window.removeEventListener('keydown', this.onKeyDown)
  },
  methods: {
    // ---------- Level management ----------
    makeEmptyLevel(id) {
      return makeLevel(
        id,
        clampInt(this.mapW, 20, 200, 60),
        clampInt(this.mapH, 20, 200, 45)
      )
    },
    addLevel() {
      this.levels.push(this.makeEmptyLevel(this.levels.length))
      this.currentLevel = this.levels.length - 1
      this.render()
    },
    removeLevel() {
      if (this.levels.length <= 1) return
      const removed = this.currentLevel
      this.levels.splice(removed, 1)
      // Level numbers shifted: drop stairs that led to the removed level, renumber
      // the rest, then pair up whichever levels are now neighbours.
      this.levels.forEach((l, i) => {
        l.id = i
        if (/^Level \d+$/.test(l.name)) l.name = `Level ${i + 1}`
        l.features = l.features.filter(
          (f) => !(f.type === 'stairs' && f.targetLevel === removed)
        )
        for (const f of l.features)
          if (f.type === 'stairs' && f.targetLevel > removed) f.targetLevel--
      })
      if (this.currentLevel >= this.levels.length)
        this.currentLevel = this.levels.length - 1
      this.highlightedStair = null
      this.linkStairs()
      this.render()
    },
    // Load the selected generator type's defaults into the controls
    applyPreset() {
      const p = this.preset
      this.roomMin = p.roomCount[0]
      this.roomMax = p.roomCount[1]
      this.rwMin = p.roomW[0]
      this.rwMax = p.roomW[1]
      this.rhMin = p.roomH[0]
      this.rhMax = p.roomH[1]
      this.trapChance = p.traps
      this.chestChance = p.chests
      this.lockChance = p.locks
      this.secretChance = p.secrets
      this.decorChance = p.decor
      this.poolChance = p.pools
    },

    // ---------- RNG ----------
    rand() {
      return this.rng()
    },
    randInt(a, b) {
      return Math.floor(this.rand() * (b - a + 1)) + a
    },
    chance(p) {
      return this.rand() < p
    },
    pick(arr) {
      return arr[Math.floor(this.rand() * arr.length)]
    },

    // ---------- Textures ----------
    rebuildTextures() {
      const canvas = this.$refs.map
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const p = this.palette
      // Textures use their own RNG so they never disturb (or depend on) the
      // dungeon's seeded stream.
      const savedRng = this.rng
      this.rng = mulberry32(hashStr('texture:' + this.theme))
      const mk = (w, h, fn) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const x = c.getContext('2d')
        fn(x, w, h)
        return ctx.createPattern(c, 'repeat')
      }
      this.textures.wall = mk(32, 32, (x, w, h) => {
        x.fillStyle = p.wall
        x.fillRect(0, 0, w, h)
        for (let y = 0; y < h; y += 8) {
          const off = (y / 8) % 2 === 0 ? 0 : 8
          for (let bx = -off; bx < w; bx += 16) {
            x.fillStyle = `rgba(255,255,255,${this.rand() * 0.08})`
            x.fillRect(bx + 1, y + 1, 14, 6)
            x.fillStyle = `rgba(0,0,0,${this.rand() * 0.2})`
            x.fillRect(bx + this.rand() * 14, y + this.rand() * 6, 1, 1)
          }
        }
        x.fillStyle = 'rgba(0,0,0,0.4)'
        for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 1)
      })
      this.textures.floor = mk(32, 32, (x, w, h) => {
        x.fillStyle = p.floor
        x.fillRect(0, 0, w, h)
        for (let y = 0; y < h; y += 16) {
          for (let bx = 0; bx < w; bx += 16) {
            x.fillStyle = `rgba(0,0,0,${this.rand() * 0.15})`
            x.fillRect(bx + 1, y + 1, 14, 14)
            for (let i = 0; i < 6; i++) {
              x.fillStyle = `rgba(0,0,0,${this.rand() * 0.2})`
              x.fillRect(bx + this.rand() * 14, y + this.rand() * 14, 1, 1)
            }
          }
        }
        x.fillStyle = 'rgba(0,0,0,0.45)'
        for (let i = 0; i <= h; i += 16) x.fillRect(0, i, w, 1)
        for (let i = 0; i <= w; i += 16) x.fillRect(i, 0, 1, h)
      })
      this.textures.floorAlt = mk(32, 32, (x, w, h) => {
        x.fillStyle = p.floorAlt
        x.fillRect(0, 0, w, h)
        for (let i = 0; i < 150; i++) {
          x.fillStyle = `rgba(0,0,0,${this.rand() * 0.25})`
          x.fillRect(
            this.rand() * w,
            this.rand() * h,
            1 + this.rand() * 2,
            1 + this.rand() * 2
          )
        }
      })
      this.textures.water = mk(32, 32, (x, w, h) => {
        x.fillStyle = p.water
        x.fillRect(0, 0, w, h)
        for (let i = 0; i < 60; i++) {
          x.fillStyle = `rgba(255,255,255,${0.1 + this.rand() * 0.3})`
          x.fillRect(this.rand() * w, this.rand() * h, 2 + this.rand() * 3, 1)
        }
      })
      this.textures.lava = mk(32, 32, (x, w, h) => {
        x.fillStyle = p.lava
        x.fillRect(0, 0, w, h)
        for (let i = 0; i < 100; i++) {
          x.fillStyle = `rgba(255,${150 + this.rand() * 100},0,${
            0.3 + this.rand() * 0.5
          })`
          x.fillRect(
            this.rand() * w,
            this.rand() * h,
            1 + this.rand() * 3,
            1 + this.rand() * 3
          )
        }
      })
      this.rng = savedRng
    },

    // ---------- Grid ops ----------
    initGrid() {
      const lvl = this.currentLevelData
      const w = clampInt(this.mapW, 20, 200, 60)
      const h = clampInt(this.mapH, 20, 200, 45)
      const grid = []
      for (let y = 0; y < h; y++) grid.push(new Array(w).fill(T.WALL))
      lvl.width = w
      lvl.height = h
      lvl.corridors = []
      lvl.grid = grid
    },
    inBounds(x, y) {
      const lvl = this.currentLevelData
      return x >= 0 && y >= 0 && x < lvl.width && y < lvl.height
    },
    isWalkable(t) {
      return (
        t === T.FLOOR ||
        t === T.DOOR ||
        t === T.SECRET_DOOR ||
        t === T.LOCKED_DOOR ||
        t === T.WATER ||
        t === T.LAVA ||
        t === T.PIT
      )
    },
    carveRoom(r) {
      const lvl = this.currentLevelData
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          if (this.inBounds(x, y)) lvl.grid[y][x] = T.FLOOR
    },
    carveCorridor(x1, y1, x2, y2, width, style, fromRoom, toRoom) {
      const lvl = this.currentLevelData
      width = clampInt(width, 1, 5, 2)
      lvl.corridorCount++
      const pts = []
      if (style === 'straight') {
        let x = x1,
          y = y1
        const dx = Math.abs(x2 - x1),
          dy = Math.abs(y2 - y1)
        const sx = x1 < x2 ? 1 : -1,
          sy = y1 < y2 ? 1 : -1
        let err = dx - dy
        while (true) {
          pts.push([x, y])
          if (x === x2 && y === y2) break
          const prevX = x,
            prevY = y
          const e2 = 2 * err
          if (e2 > -dy) {
            err -= dy
            x += sx
          }
          if (e2 < dx) {
            err += dx
            y += sy
          }
          // a diagonal step needs a corner tile, or a 1-wide corridor is cut in two
          if (x !== prevX && y !== prevY) pts.push([x, prevY])
        }
      } else if (style === 'l') {
        if (this.chance(0.5)) {
          for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
            pts.push([x, y1])
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
            pts.push([x2, y])
        } else {
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
            pts.push([x1, y])
          for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
            pts.push([x, y2])
        }
      } else {
        let x = x1,
          y = y1
        while (x !== x2 || y !== y2) {
          pts.push([x, y])
          if (x !== x2 && (y === y2 || this.chance(0.5))) x += x2 > x ? 1 : -1
          else if (y !== y2) y += y2 > y ? 1 : -1
        }
        pts.push([x2, y2])
      }
      // Carve, and remember every tile the corridor covers outside the rooms
      const seen = new Set()
      const tiles = []
      for (const [px, py] of pts) {
        for (let dy = 0; dy < width; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const tx = px + dx - Math.floor(width / 2)
            const ty = py + dy - Math.floor(width / 2)
            if (!this.inBounds(tx, ty)) continue
            if (lvl.grid[ty][tx] === T.WALL) lvl.grid[ty][tx] = T.FLOOR
            const key = ty * lvl.width + tx
            if (!seen.has(key) && !this.getRoomAt(tx, ty)) {
              seen.add(key)
              tiles.push([tx, ty])
            }
          }
        }
      }
      lvl.corridors.push({ from: fromRoom, to: toRoom, width, tiles })
    },

    // ---------- Room placement ----------
    roomsOverlap(a, b, pad) {
      return !(
        a.x + a.w + pad <= b.x ||
        b.x + b.w + pad <= a.x ||
        a.y + a.h + pad <= b.y ||
        b.y + b.h + pad <= a.y
      )
    },
    tryPlaceRoom() {
      const lvl = this.currentLevelData
      const pr = this.preset
      // Whatever was typed in: keep sizes inside the map and min <= max
      const rwMax = clampInt(this.rwMax || pr.roomW[1], 3, lvl.width - 4, 9)
      const rwMin = clampInt(this.rwMin || pr.roomW[0], 3, rwMax, 4)
      const rhMax = clampInt(this.rhMax || pr.roomH[1], 3, lvl.height - 4, 9)
      const rhMin = clampInt(this.rhMin || pr.roomH[0], 3, rhMax, 4)
      const pad = clampInt(this.pad, 1, 6, 2)
      for (let attempt = 0; attempt < 100; attempt++) {
        const w = this.randInt(rwMin, rwMax)
        const h = this.randInt(rhMin, rhMax)
        const x = this.randInt(1, lvl.width - w - 2)
        const y = this.randInt(1, lvl.height - h - 2)
        const r = {
          x,
          y,
          w,
          h,
          id: lvl.rooms.length,
          revealed: false,
          revealProgress: 0,
          tag: null,
        }
        let ok = true
        for (const other of lvl.rooms)
          if (this.roomsOverlap(r, other, pad)) {
            ok = false
            break
          }
        if (ok) return r
      }
      return null
    },

    // ---------- Features ----------
    featureAt(x, y, lvl = this.currentLevelData) {
      return lvl.features.find((f) => f.x === x && f.y === y)
    },
    getFloorTilesInRoom(r, lvl = this.currentLevelData) {
      const tiles = []
      for (let y = r.y + 1; y < r.y + r.h - 1; y++)
        for (let x = r.x + 1; x < r.x + r.w - 1; x++)
          if (lvl.grid[y][x] === T.FLOOR && !this.featureAt(x, y, lvl))
            tiles.push([x, y])
      return tiles
    },
    placeFeatureInRoom(
      r,
      type,
      subtype,
      hidden = false,
      lvl = this.currentLevelData
    ) {
      const tiles = this.getFloorTilesInRoom(r, lvl)
      if (tiles.length === 0) return null
      const [x, y] = this.pick(tiles)
      const f = { x, y, type, subtype, hidden, revealed: !hidden, room: r.id }
      lvl.features.push(f)
      return f
    },
    populateRoom(r) {
      const pr = this.preset
      const lvl = this.currentLevelData
      if (this.chance(this.poolChance / 100)) {
        const poolType = this.pick(pr.poolTypes) === 'lava' ? T.LAVA : T.WATER
        const pw = this.randInt(2, Math.min(4, r.w - 2))
        const ph = this.randInt(2, Math.min(4, r.h - 2))
        const px = this.randInt(r.x + 1, r.x + r.w - pw - 1)
        const py = this.randInt(r.y + 1, r.y + r.h - ph - 1)
        for (let y = py; y < py + ph; y++)
          for (let x = px; x < px + pw; x++)
            if (lvl.grid[y][x] === T.FLOOR) lvl.grid[y][x] = poolType
      }
      if (this.chance(this.trapChance / 100)) {
        const sub = this.pick(['spikes', 'spikes', 'poison_darts', 'pit'])
        this.placeFeatureInRoom(r, 'trap', sub, this.chance(pr.trapHidden))
      }
      if (this.chance(this.chestChance / 100)) {
        const sub = this.pick(pr.chestTypes)
        const hidden = sub === 'hidden'
        this.placeFeatureInRoom(r, 'chest', hidden ? 'normal' : sub, hidden)
      }
      if (this.chance(this.decorChance / 100)) {
        const count = this.randInt(1, 3)
        for (let i = 0; i < count; i++)
          this.placeFeatureInRoom(r, 'decor', this.pick(pr.decorPool), false)
      }
    },
    // Every pair of neighbouring levels gets matching stairs: a 'down' on the upper
    // level and an 'up' on the lower one, each pointing at the other.
    linkStairs() {
      const n = this.levels.length
      for (let i = 0; i < n; i++) {
        const lvl = this.levels[i]
        if (!lvl.rooms.length) continue
        if (i > 0 && this.levels[i - 1].rooms.length)
          this.ensureStair(lvl, 'up', i - 1)
        if (i < n - 1 && this.levels[i + 1].rooms.length)
          this.ensureStair(lvl, 'down', i + 1)
      }
    },
    ensureStair(lvl, subtype, targetLevel) {
      const already = lvl.features.some(
        (f) =>
          f.type === 'stairs' &&
          f.subtype === subtype &&
          f.targetLevel === targetLevel
      )
      if (already) return
      const n = lvl.rooms.length
      const start = this.randInt(0, n - 1)
      for (let k = 0; k < n; k++) {
        const room = lvl.rooms[(start + k) % n]
        const f = this.placeFeatureInRoom(room, 'stairs', subtype, false, lvl)
        if (f) {
          this.$set(f, 'targetLevel', targetLevel)
          return
        }
      }
    },
    // Doors go where a corridor meets a room: the tiles just outside a room's edge.
    // An opening is a run of such tiles; one as wide as a corridor gets a single
    // door type across all of it, and is sometimes left as a bare archway.
    placeDoors(rooms) {
      const lvl = this.currentLevelData
      const maxRun = clampInt(this.corrW, 1, 5, 2)
      const at = (x, y) => (this.inBounds(x, y) ? lvl.grid[y][x] : T.WALL)
      const open = (t) => t !== T.WALL && t !== T.SECRET_DOOR
      for (const r of rooms || lvl.rooms) {
        // each tile just outside the room, with the tile beyond it
        const sides = [[], [], [], []]
        for (let x = r.x; x < r.x + r.w; x++) {
          sides[0].push({ x, y: r.y - 1, ox: x, oy: r.y - 2 }) // north
          sides[1].push({ x, y: r.y + r.h, ox: x, oy: r.y + r.h + 1 }) // south
        }
        for (let y = r.y; y < r.y + r.h; y++) {
          sides[2].push({ x: r.x - 1, y, ox: r.x - 2, oy: y }) // west
          sides[3].push({ x: r.x + r.w, y, ox: r.x + r.w + 1, oy: y }) // east
        }
        for (const side of sides) {
          let run = []
          const flush = () => {
            if (run.length && run.length <= maxRun && this.chance(0.6)) {
              let t = T.DOOR
              if (this.chance(this.secretChance / 100)) t = T.SECRET_DOOR
              else if (this.chance(this.lockChance / 100)) t = T.LOCKED_DOOR
              for (const c of run) lvl.grid[c.y][c.x] = t
            }
            run = []
          }
          for (const c of side) {
            if (at(c.x, c.y) === T.FLOOR && open(at(c.ox, c.oy))) run.push(c)
            else flush()
          }
          flush()
        }
      }
    },

    // ---------- Generation ----------
    generateFull() {
      const seedStr = this.seed || String(Math.floor(Math.random() * 1e9))
      this.seed = seedStr
      // The level number is part of the seed, so each level of one seed differs
      this.rng = mulberry32(hashStr(`${seedStr}:L${this.currentLevel}`))

      const lvl = this.currentLevelData
      lvl.rooms = []
      lvl.features = []
      lvl.corridorCount = 0
      this.initGrid()

      const pr = this.preset
      const roomLo = clampInt(this.roomMin || pr.roomCount[0], 1, 50, 8)
      const roomHi = clampInt(this.roomMax || pr.roomCount[1], roomLo, 50, 14)
      const targetRooms = this.randInt(roomLo, roomHi)
      for (
        let i = 0;
        i < targetRooms * 5 && lvl.rooms.length < targetRooms;
        i++
      ) {
        const r = this.tryPlaceRoom()
        if (r) {
          lvl.rooms.push(r)
          this.carveRoom(r)
        }
      }
      if (lvl.rooms.length > 1) {
        const connected = [0]
        const unconnected = lvl.rooms.map((_, i) => i).slice(1)
        while (unconnected.length > 0) {
          let bestD = Infinity,
            bestC = -1,
            bestU = -1
          for (const c of connected) {
            for (const u of unconnected) {
              const cx = lvl.rooms[c].x + lvl.rooms[c].w / 2,
                cy = lvl.rooms[c].y + lvl.rooms[c].h / 2
              const ux = lvl.rooms[u].x + lvl.rooms[u].w / 2,
                uy = lvl.rooms[u].y + lvl.rooms[u].h / 2
              const d = Math.abs(cx - ux) + Math.abs(cy - uy)
              if (d < bestD) {
                bestD = d
                bestC = c
                bestU = u
              }
            }
          }
          const r1 = lvl.rooms[bestC],
            r2 = lvl.rooms[bestU]
          this.carveCorridor(
            Math.floor(r1.x + r1.w / 2),
            Math.floor(r1.y + r1.h / 2),
            Math.floor(r2.x + r2.w / 2),
            Math.floor(r2.y + r2.h / 2),
            this.corrW,
            this.corrStyle,
            bestC,
            bestU
          )
          connected.push(bestU)
          unconnected.splice(unconnected.indexOf(bestU), 1)
        }
      }
      this.placeDoors()
      for (const r of lvl.rooms) this.populateRoom(r)
      this.highlightedStair = null
      this.linkStairs()

      if (lvl.rooms.length > 0) {
        lvl.rooms[0].revealed = true
        lvl.rooms[0].revealProgress = 1
      }
      this.render()
      this.info = `Generated Level ${this.currentLevel + 1}: ${
        lvl.rooms.length
      } rooms, seed "${seedStr}"`
      this.$emit('generate', { level: this.currentLevel, seed: seedStr })
    },
    addRoom() {
      const lvl = this.currentLevelData
      if (lvl.rooms.length === 0) {
        const seedStr = this.seed || String(Math.floor(Math.random() * 1e9))
        this.seed = seedStr
        this.rng = mulberry32(hashStr(`${seedStr}:L${this.currentLevel}`))
        this.initGrid()
      }
      const r = this.tryPlaceRoom()
      if (!r) {
        this.info = 'Could not place another room.'
        return
      }
      lvl.rooms.push(r)
      this.carveRoom(r)
      const touched = [r] // rooms whose doors need (re)placing
      if (lvl.rooms.length === 1) {
        r.revealed = true
        r.revealProgress = 1
      }
      if (lvl.rooms.length > 1) {
        let best = -1,
          bestD = Infinity
        for (let i = 0; i < lvl.rooms.length - 1; i++) {
          const o = lvl.rooms[i]
          const d =
            Math.abs(r.x + r.w / 2 - (o.x + o.w / 2)) +
            Math.abs(r.y + r.h / 2 - (o.y + o.h / 2))
          if (d < bestD) {
            bestD = d
            best = i
          }
        }
        const o = lvl.rooms[best]
        touched.push(o)
        this.carveCorridor(
          Math.floor(r.x + r.w / 2),
          Math.floor(r.y + r.h / 2),
          Math.floor(o.x + o.w / 2),
          Math.floor(o.y + o.h / 2),
          this.corrW,
          this.corrStyle,
          r.id,
          o.id
        )
      }
      this.placeDoors(touched)
      this.populateRoom(r)
      this.linkStairs()
      this.render()
      this.info = `Added room #${lvl.rooms.length - 1}.`
    },
    populateOnly() {
      const lvl = this.currentLevelData
      const keepTags = lvl.rooms.map((r) => r.tag)
      lvl.features = lvl.features.filter((f) => f.type === 'stairs') // keep stairs
      for (let y = 0; y < lvl.height; y++)
        for (let x = 0; x < lvl.width; x++) {
          const t = lvl.grid[y][x]
          if (t === T.WATER || t === T.LAVA || t === T.PIT)
            lvl.grid[y][x] = T.FLOOR
          if (t === T.DOOR || t === T.LOCKED_DOOR) lvl.grid[y][x] = T.FLOOR
        }
      this.placeDoors()
      for (const r of lvl.rooms) this.populateRoom(r)
      lvl.rooms.forEach((r, i) => {
        r.tag = keepTags[i]
      })
      this.render()
      this.info = 'Features rerolled (tags preserved).'
    },
    clearMap() {
      const lvl = this.currentLevelData
      lvl.rooms = []
      lvl.features = []
      lvl.corridorCount = 0
      this.initGrid()
      this.render()
      this.info = 'Map cleared.'
    },

    // ---------- Reveal ----------
    revealRoom(roomId) {
      const lvl = this.currentLevelData
      const room = lvl.rooms[roomId]
      if (!room || room.revealed) return
      room.revealed = true
      room.revealProgress = 0
      this.$emit('room-revealed', { level: this.currentLevel, roomId })
    },
    revealAllRooms() {
      const lvl = this.currentLevelData
      for (const r of lvl.rooms) {
        r.revealed = true
        r.revealProgress = 1
      }
      this.render()
    },
    revealAllHidden() {
      const lvl = this.currentLevelData
      for (const f of lvl.features) {
        f.hidden = false
        f.revealed = true
      }
      for (let y = 0; y < lvl.height; y++)
        for (let x = 0; x < lvl.width; x++)
          if (lvl.grid[y][x] === T.SECRET_DOOR) lvl.grid[y][x] = T.DOOR
      this.revision++
      this.render()
    },
    // Which tiles the players can see: each revealed room plus its surrounding wall
    // ring, and every corridor that leads out of a revealed room (with its walls).
    computeVisibility(lvl) {
      const w = lvl.width,
        h = lvl.height
      const vis = new Uint8Array(w * h)
      const markRect = (x0, y0, x1, y1) => {
        for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++)
          for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++)
            vis[y * w + x] = 1
      }
      for (const r of lvl.rooms)
        if (r.revealed) markRect(r.x - 1, r.y - 1, r.x + r.w, r.y + r.h)
      for (const c of lvl.corridors || []) {
        const a = lvl.rooms[c.from],
          b = lvl.rooms[c.to]
        if (!((a && a.revealed) || (b && b.revealed))) continue
        for (const [x, y] of c.tiles) markRect(x - 1, y - 1, x + 1, y + 1)
      }
      return vis
    },
    isVisibleAt(x, y) {
      const c = this.visCache
      if (!c || c.level !== this.currentLevelData) return false
      return c.data[y * c.level.width + x] === 1
    },
    getRoomAt(x, y) {
      const lvl = this.currentLevelData
      for (const r of lvl.rooms) {
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r
      }
      return null
    },
    // In player view a room can be revealed once a corridor joins it to a room
    // that is already revealed. The DM can reveal anything.
    canPlayerReveal(room) {
      if (this.viewMode === 'dm') return true
      const lvl = this.currentLevelData
      return (lvl.corridors || []).some((c) => {
        const other = c.from === room.id ? c.to : c.to === room.id ? c.from : -1
        return other >= 0 && !!lvl.rooms[other] && lvl.rooms[other].revealed
      })
    },
    // Opening a secret door turns the whole doorway (a wide opening is several
    // tiles) into an ordinary door.
    discoverSecretDoor(x, y) {
      const lvl = this.currentLevelData
      const stack = [[x, y]]
      let n = 0
      while (stack.length) {
        const [cx, cy] = stack.pop()
        if (!this.inBounds(cx, cy) || lvl.grid[cy][cx] !== T.SECRET_DOOR)
          continue
        lvl.grid[cy][cx] = T.DOOR
        n++
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
      }
      this.revision++
      this.info = `Discovered a secret door at (${x},${y}).`
      this.$emit('secret-door-revealed', { level: this.currentLevel, x, y })
      this.render()
      return n
    },

    // ---------- Tag mode ----------
    toggleTagMode() {
      this.tagMode = !this.tagMode
      if (!this.tagMode) this.closeTagMenu()
    },
    openTagMenu(room, clientX, clientY) {
      const area = this.$el.querySelector('.map-area')
      const areaRect = area.getBoundingClientRect()
      this.tagMenu = {
        visible: true,
        x: clientX - areaRect.left + area.scrollLeft + 10,
        y: clientY - areaRect.top + area.scrollTop + 10,
        roomId: room.id,
        addFeatures: true,
      }
    },
    closeTagMenu() {
      this.tagMenu.visible = false
    },
    applyTag(tagKey) {
      const lvl = this.currentLevelData
      const room = lvl.rooms[this.tagMenu.roomId]
      if (!room) return
      room.tag = tagKey
      if (tagKey && this.tagMenu.addFeatures) {
        const tmpl = this.allTags[tagKey]
        if (tmpl) {
          for (const spec of tmpl.features) {
            const hidden = !!spec.hidden
            this.placeFeatureInRoom(room, spec.type, spec.subtype, hidden)
          }
        }
      }
      this.closeTagMenu()
      this.render()
      this.info = `Room ${room.id} tagged as "${
        tagKey ? this.allTags[tagKey].label : '(none)'
      }".`
      this.$emit('room-tagged', {
        level: this.currentLevel,
        roomId: room.id,
        tag: tagKey,
      })
    },
    promptCustomTag() {
      const label = prompt('Custom tag label:')
      if (!label) return
      const key = 'custom_' + Date.now()
      this.$set(this.customTags, key, {
        label,
        color: '#888888',
        features: [],
      })
      this.applyTag(key)
    },

    // ---------- Stairs linking ----------
    findMatchingStair(fromLevel, fromFeature) {
      const targetLvl = this.levels[fromFeature.targetLevel]
      if (!targetLvl) return null
      const wantedSubtype = fromFeature.subtype === 'down' ? 'up' : 'down'
      const wantedTarget = fromLevel
      for (let i = 0; i < targetLvl.features.length; i++) {
        const f = targetLvl.features[i]
        if (
          f.type === 'stairs' &&
          f.subtype === wantedSubtype &&
          f.targetLevel === wantedTarget
        ) {
          return { level: fromFeature.targetLevel, featureIdx: i, feature: f }
        }
      }
      // Fallback: any stair of the right subtype
      for (let i = 0; i < targetLvl.features.length; i++) {
        const f = targetLvl.features[i]
        if (f.type === 'stairs' && f.subtype === wantedSubtype) {
          return { level: fromFeature.targetLevel, featureIdx: i, feature: f }
        }
      }
      return null
    },
    travelStair(feature) {
      const fromLevel = this.currentLevel
      if (!this.levels[feature.targetLevel]) {
        this.info = 'That stair leads nowhere.'
        return
      }
      const match = this.findMatchingStair(fromLevel, feature)
      if (!match) {
        this.info = `No matching stair on Level ${
          feature.targetLevel + 1
        }. Switching anyway.`
        this.currentLevel = feature.targetLevel
        return
      }
      // Arriving by the stairs shows the room you arrive in
      const arrival = this.levels[match.level].rooms[match.feature.room]
      if (arrival && !arrival.revealed) {
        arrival.revealed = true
        arrival.revealProgress = 0
      }
      this.currentLevel = match.level
      this.highlightedStair = {
        level: match.level,
        roomId: match.feature.room,
        featureIdx: match.featureIdx,
        until: performance.now() + 2000,
      }
      this.$nextTick(() => {
        this.render()
        // Scroll the highlighted stair into view
        const ts = Math.floor(this.TS * this.zoomLevel)
        const px = match.feature.x * ts
        const py = match.feature.y * ts
        const wrap = this.$el.querySelector('.canvas-wrap')
        wrap.scrollLeft = Math.max(0, px - wrap.clientWidth / 2)
        wrap.scrollTop = Math.max(0, py - wrap.clientHeight / 2)
      })
      this.info = `Traveled to Level ${
        match.level + 1
      }. Destination stair highlighted.`
      this.$emit('stairs-traveled', {
        fromLevel,
        toLevel: match.level,
        fromFeature: feature,
        toFeature: match.feature,
      })
    },

    // ---------- Rendering ----------
    getWallMask(x, y) {
      const lvl = this.currentLevelData
      const isWall = (xx, yy) => {
        if (!this.inBounds(xx, yy)) return true
        const t = lvl.grid[yy][xx]
        return t === T.WALL || t === T.SECRET_DOOR
      }
      let mask = 0
      if (!isWall(x, y - 1)) mask |= 1 // N
      if (!isWall(x + 1, y)) mask |= 2 // E
      if (!isWall(x, y + 1)) mask |= 4 // S
      if (!isWall(x - 1, y)) mask |= 8 // W
      return mask
    },
    drawWallTile(ctx, px, py, ts, mask) {
      // Base brick fill
      ctx.fillStyle = this.textures.wall
      ctx.save()
      ctx.translate(px, py)
      ctx.fillRect(0, 0, ts, ts)
      ctx.restore()

      if (mask === 0) {
        // Interior wall — darken
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(px, py, ts, ts)
        return
      }

      const edgeW = Math.max(2, Math.floor(ts * 0.18))
      const highlight = 'rgba(255,230,180,0.28)'
      const shadow = 'rgba(0,0,0,0.55)'

      // Top edge (N open)
      if (mask & 1) {
        ctx.fillStyle = highlight
        ctx.fillRect(px, py, ts, edgeW)
        ctx.fillStyle = shadow
        ctx.fillRect(px, py + edgeW, ts, 1)
      }
      // Bottom edge (S open)
      if (mask & 4) {
        ctx.fillStyle = highlight
        ctx.fillRect(px, py + ts - edgeW, ts, edgeW)
        ctx.fillStyle = shadow
        ctx.fillRect(px, py + ts - edgeW - 1, ts, 1)
      }
      // Right edge (E open)
      if (mask & 2) {
        ctx.fillStyle = highlight
        ctx.fillRect(px + ts - edgeW, py, edgeW, ts)
        ctx.fillStyle = shadow
        ctx.fillRect(px + ts - edgeW - 1, py, 1, ts)
      }
      // Left edge (W open)
      if (mask & 8) {
        ctx.fillStyle = highlight
        ctx.fillRect(px, py, edgeW, ts)
        ctx.fillStyle = shadow
        ctx.fillRect(px + edgeW, py, 1, ts)
      }

      // Corner highlights where two adjacent sides are open
      const c = edgeW
      const cornerHL = 'rgba(255,230,180,0.45)'
      if (mask & 1 && mask & 2) {
        ctx.fillStyle = cornerHL
        ctx.fillRect(px + ts - c, py, c, c)
      }
      if (mask & 2 && mask & 4) {
        ctx.fillStyle = cornerHL
        ctx.fillRect(px + ts - c, py + ts - c, c, c)
      }
      if (mask & 4 && mask & 8) {
        ctx.fillStyle = cornerHL
        ctx.fillRect(px, py + ts - c, c, c)
      }
      if (mask & 8 && mask & 1) {
        ctx.fillStyle = cornerHL
        ctx.fillRect(px, py, c, c)
      }
    },
    render() {
      const canvas = this.$refs.map
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const ts = Math.floor(this.TS * this.zoomLevel)
      const lvl = this.currentLevelData
      canvas.width = lvl.width * ts
      canvas.height = lvl.height * ts
      ctx.fillStyle = '#0a0806'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // DM view shows everything, dimming what the players haven't seen yet;
      // player view shows only what has been revealed.
      const dm = this.viewMode === 'dm'
      const vis = this.computeVisibility(lvl)
      this.visCache = { level: lvl, data: vis }

      for (let y = 0; y < lvl.height; y++) {
        for (let x = 0; x < lvl.width; x++) {
          const t = lvl.grid[y][x]
          const px = x * ts,
            py = y * ts
          const revealed = vis[y * lvl.width + x] === 1
          if (!revealed && !dm) {
            ctx.fillStyle = '#050403'
            ctx.fillRect(px, py, ts, ts)
            continue
          }
          if (t === T.WALL) {
            const mask = this.getWallMask(x, y)
            this.drawWallTile(ctx, px, py, ts, mask)
          } else if (t === T.FLOOR) {
            // scatter the darker tiles: (x + y) % n would line them up in diagonals
            const hsh =
              (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0
            ctx.fillStyle =
              ((hsh ^ (hsh >>> 13)) >>> 0) % 20 === 0
                ? this.textures.floorAlt
                : this.textures.floor
            ctx.save()
            ctx.translate(px, py)
            ctx.fillRect(0, 0, ts, ts)
            ctx.restore()
          } else if (t === T.WATER) {
            ctx.fillStyle = this.textures.water
            ctx.save()
            ctx.translate(px, py)
            ctx.fillRect(0, 0, ts, ts)
            ctx.restore()
          } else if (t === T.LAVA) {
            ctx.fillStyle = this.textures.lava
            ctx.save()
            ctx.translate(px, py)
            ctx.fillRect(0, 0, ts, ts)
            ctx.restore()
          } else if (t === T.DOOR || t === T.LOCKED_DOOR) {
            ctx.fillStyle = this.textures.floor
            ctx.save()
            ctx.translate(px, py)
            ctx.fillRect(0, 0, ts, ts)
            ctx.restore()
            this.drawDoor(ctx, px, py, ts, t === T.LOCKED_DOOR, false)
          } else if (t === T.SECRET_DOOR) {
            const mask = this.getWallMask(x, y)
            this.drawWallTile(ctx, px, py, ts, mask)
            // only the DM sees the telltale mark on a secret door
            if (dm) this.drawDoor(ctx, px, py, ts, false, true)
          }
          if (!revealed) {
            ctx.fillStyle = 'rgba(5,4,3,0.4)'
            ctx.fillRect(px, py, ts, ts)
          }
        }
      }

      if (!lvl.rooms.length) {
        ctx.fillStyle = '#c9a961'
        ctx.font = 'bold 22px Georgia, serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          'Empty level — press "Generate Full Dungeon" or "Add One Room"',
          canvas.width / 2,
          canvas.height / 2
        )
      }

      // Features
      for (let i = 0; i < lvl.features.length; i++) {
        const f = lvl.features[i]
        const undiscovered = f.hidden && !f.revealed
        if (undiscovered && !(dm && this.showHidden)) continue
        const room = lvl.rooms[f.room]
        const unseenRoom = !!room && !room.revealed
        if (unseenRoom && !dm) continue
        const px = f.x * ts,
          py = f.y * ts
        if (undiscovered) ctx.globalAlpha = 0.4
        else if (unseenRoom) ctx.globalAlpha = 0.5
        this.drawFeature(ctx, f, px, py, ts)
        ctx.globalAlpha = 1

        // Highlighted stair pulse
        if (
          this.highlightedStair &&
          this.highlightedStair.level === this.currentLevel &&
          this.highlightedStair.featureIdx === i &&
          performance.now() < this.highlightedStair.until
        ) {
          const t = (performance.now() % 1000) / 1000
          const radius = ts * 0.5 + Math.sin(t * Math.PI * 2) * ts * 0.15
          ctx.strokeStyle = `rgba(255,220,100,${0.8 - t * 0.4})`
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(px + ts / 2, py + ts / 2, radius, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Reveal animation overlay
      for (const r of lvl.rooms) {
        if (r.revealed && r.revealProgress < 1) {
          ctx.fillStyle = `rgba(5,4,3,${1 - r.revealProgress})`
          ctx.fillRect(r.x * ts, r.y * ts, r.w * ts, r.h * ts)
        }
      }

      // Room tags
      for (const r of lvl.rooms) {
        if (!r.tag || (!r.revealed && !dm)) continue
        this.drawRoomTag(ctx, r, ts)
      }
    },
    drawRoomTag(ctx, room, ts) {
      const tmpl = this.allTags[room.tag]
      if (!tmpl) return
      const fontSize = Math.max(10, Math.floor(ts * 0.55))
      ctx.font = `bold ${fontSize}px Georgia, serif`
      const metrics = ctx.measureText(tmpl.label)
      const pad = 3
      const w = metrics.width + pad * 2
      const h = fontSize + pad * 2
      const x = room.x * ts + 3
      const y = room.y * ts + 3
      ctx.fillStyle = tmpl.color + 'dd'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#1a1410'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = '#1a1410'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(tmpl.label, x + pad, y + h / 2)
    },
    drawDoor(ctx, px, py, ts, locked, secret) {
      const p = this.palette
      const m = ts * 0.15
      if (secret) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px + ts / 2, py + m)
        ctx.lineTo(px + ts / 2, py + ts - m)
        ctx.stroke()
        ctx.fillStyle = `rgba(${parseInt(p.accent.slice(1, 3), 16)},${parseInt(
          p.accent.slice(3, 5),
          16
        )},${parseInt(p.accent.slice(5, 7), 16)},0.3)`
        ctx.fillRect(px + ts / 2 - 1, py + ts / 2 - 1, 2, 2)
        return
      }
      ctx.fillStyle = p.door
      ctx.fillRect(px + m, py + m, ts - m * 2, ts - m * 2)
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(px + m, py + m, ts - m * 2, ts - m * 2)
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath()
      ctx.moveTo(px + ts / 2, py + m)
      ctx.lineTo(px + ts / 2, py + ts - m)
      ctx.stroke()
      ctx.fillStyle = locked ? p.accent : '#8a7a62'
      ctx.beginPath()
      ctx.arc(px + ts * 0.7, py + ts / 2, ts * 0.08, 0, Math.PI * 2)
      ctx.fill()
      if (locked) {
        ctx.fillStyle = '#1a1410'
        ctx.fillRect(px + ts * 0.66, py + ts / 2, ts * 0.08, ts * 0.1)
      }
    },
    drawFeature(ctx, f, px, py, ts) {
      const cx = px + ts / 2,
        cy = py + ts / 2
      const p = this.palette
      ctx.save()
      if (f.type === 'trap') {
        if (f.subtype === 'pit') {
          ctx.fillStyle = '#0a0806'
          ctx.beginPath()
          ctx.arc(cx, cy, ts * 0.35, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#4a3828'
          ctx.lineWidth = 1
          ctx.stroke()
        } else {
          ctx.fillStyle = '#c0c0c0'
          const n = 5
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2
            const sx = cx + Math.cos(a) * ts * 0.25
            const sy = cy + Math.sin(a) * ts * 0.25
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.lineTo(cx, cy)
            ctx.lineTo(
              sx + Math.cos(a + 0.3) * ts * 0.1,
              sy + Math.sin(a + 0.3) * ts * 0.1
            )
            ctx.closePath()
            ctx.fill()
          }
          if (f.subtype === 'poison_darts') {
            ctx.fillStyle = 'rgba(80,180,80,0.6)'
            ctx.beginPath()
            ctx.arc(cx, cy, ts * 0.1, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      } else if (f.type === 'chest') {
        const isHidden = f.hidden && f.revealed
        ctx.fillStyle = isHidden
          ? p.accent
          : f.subtype === 'locked'
          ? p.accent
          : f.subtype === 'trapped'
          ? '#8a3232'
          : '#8b5a2b'
        ctx.fillRect(px + ts * 0.2, py + ts * 0.35, ts * 0.6, ts * 0.4)
        ctx.fillStyle = isHidden ? '#fff' : '#6b4422'
        ctx.fillRect(px + ts * 0.2, py + ts * 0.35, ts * 0.6, ts * 0.12)
        ctx.strokeStyle = '#1a1410'
        ctx.strokeRect(px + ts * 0.2, py + ts * 0.35, ts * 0.6, ts * 0.4)
        ctx.fillStyle = p.accent
        ctx.fillRect(px + ts * 0.45, py + ts * 0.45, ts * 0.1, ts * 0.1)
        if (isHidden) {
          ctx.fillStyle = '#fff'
          ctx.fillRect(px + ts * 0.15, py + ts * 0.2, 2, 2)
          ctx.fillRect(px + ts * 0.8, py + ts * 0.25, 2, 2)
          ctx.fillRect(px + ts * 0.5, py + ts * 0.15, 2, 2)
        }
      } else if (f.type === 'decor') {
        // per-tile RNG: scatter looks the same on every redraw and zoom level
        const rnd = mulberry32((f.x * 73856093) ^ (f.y * 19349663))
        this.drawDecor(ctx, f.subtype, px, py, ts, rnd)
      } else if (f.type === 'stairs') {
        ctx.fillStyle = '#3a3028'
        ctx.fillRect(px + ts * 0.15, py + ts * 0.15, ts * 0.7, ts * 0.7)
        ctx.strokeStyle = p.accent
        ctx.lineWidth = 1.5
        for (let i = 0; i < 4; i++) {
          const y = py + ts * 0.2 + i * ts * 0.15
          ctx.beginPath()
          ctx.moveTo(px + ts * 0.25, y)
          ctx.lineTo(px + ts * 0.75, y)
          ctx.stroke()
        }
        ctx.fillStyle = p.accent
        ctx.beginPath()
        if (f.subtype === 'up') {
          ctx.moveTo(cx, py + ts * 0.2)
          ctx.lineTo(px + ts * 0.3, py + ts * 0.4)
          ctx.lineTo(px + ts * 0.7, py + ts * 0.4)
        } else {
          ctx.moveTo(cx, py + ts * 0.8)
          ctx.lineTo(px + ts * 0.3, py + ts * 0.6)
          ctx.lineTo(px + ts * 0.7, py + ts * 0.6)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `${Math.max(8, ts * 0.28)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(`L${(f.targetLevel || 0) + 1}`, cx, py + ts * 0.95)
      }
      ctx.restore()
    },
    drawDecor(ctx, sub, px, py, ts, rnd) {
      const cx = px + ts / 2,
        cy = py + ts / 2
      const p = this.palette
      if (sub === 'statue' || sub === 'column') {
        ctx.fillStyle = '#8a8a8a'
        ctx.fillRect(cx - ts * 0.12, cy - ts * 0.25, ts * 0.24, ts * 0.5)
        ctx.beginPath()
        ctx.arc(cx, cy - ts * 0.3, ts * 0.12, 0, Math.PI * 2)
        ctx.fill()
      } else if (sub === 'fountain') {
        ctx.fillStyle = '#6a6a6a'
        ctx.beginPath()
        ctx.arc(cx, cy, ts * 0.32, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = p.water
        ctx.beginPath()
        ctx.arc(cx, cy, ts * 0.22, 0, Math.PI * 2)
        ctx.fill()
      } else if (sub === 'altar') {
        ctx.fillStyle = '#d8d0b8'
        ctx.fillRect(px + ts * 0.2, py + ts * 0.3, ts * 0.6, ts * 0.4)
        ctx.fillStyle = '#ffaa33'
        ctx.beginPath()
        ctx.arc(px + ts * 0.27, py + ts * 0.2, ts * 0.04, 0, Math.PI * 2)
        ctx.arc(px + ts * 0.73, py + ts * 0.2, ts * 0.04, 0, Math.PI * 2)
        ctx.fill()
      } else if (sub === 'bones') {
        ctx.fillStyle = '#e8e0c8'
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(
            px + ts * 0.2 + rnd() * ts * 0.5,
            py + ts * 0.3 + rnd() * ts * 0.4,
            ts * 0.15,
            ts * 0.04
          )
        }
      } else if (sub === 'barrel') {
        ctx.fillStyle = '#6b4422'
        ctx.beginPath()
        ctx.ellipse(cx, cy, ts * 0.25, ts * 0.3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#8a7a62'
        ctx.beginPath()
        ctx.ellipse(cx, cy - ts * 0.1, ts * 0.25, ts * 0.04, 0, 0, Math.PI * 2)
        ctx.ellipse(cx, cy + ts * 0.1, ts * 0.25, ts * 0.04, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (sub === 'pile' || sub === 'refuse') {
        ctx.fillStyle = '#5a4a38'
        for (let i = 0; i < 8; i++) {
          ctx.beginPath()
          ctx.arc(
            px + ts * 0.2 + rnd() * ts * 0.6,
            py + ts * 0.3 + rnd() * ts * 0.4,
            ts * 0.06 + rnd() * ts * 0.05,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
      } else if (sub === 'brazier') {
        ctx.fillStyle = '#3a2410'
        ctx.fillRect(cx - ts * 0.15, cy, ts * 0.3, ts * 0.2)
        ctx.fillStyle = '#ff6a1a'
        ctx.beginPath()
        ctx.arc(cx, cy - ts * 0.05, ts * 0.15, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffcc33'
        ctx.beginPath()
        ctx.arc(cx, cy - ts * 0.1, ts * 0.08, 0, Math.PI * 2)
        ctx.fill()
      } else if (sub === 'stalagmite' || sub === 'mushroom') {
        ctx.fillStyle = sub === 'mushroom' ? '#a06080' : '#6a5a48'
        ctx.beginPath()
        ctx.moveTo(cx - ts * 0.15, cy + ts * 0.2)
        ctx.lineTo(cx, cy - ts * 0.25)
        ctx.lineTo(cx + ts * 0.15, cy + ts * 0.2)
        ctx.closePath()
        ctx.fill()
      } else if (sub === 'sarcophagus') {
        ctx.fillStyle = '#8a7a62'
        ctx.fillRect(px + ts * 0.2, py + ts * 0.25, ts * 0.6, ts * 0.5)
        ctx.strokeStyle = p.accent
        ctx.strokeRect(px + ts * 0.2, py + ts * 0.25, ts * 0.6, ts * 0.5)
      } else if (sub === 'urn') {
        ctx.fillStyle = '#a8785a'
        ctx.beginPath()
        ctx.ellipse(cx, cy, ts * 0.18, ts * 0.25, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (sub === 'grate') {
        ctx.strokeStyle = '#4a4a4a'
        ctx.lineWidth = 1
        for (let i = 0; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(px + ts * 0.2 + i * ts * 0.2, py + ts * 0.2)
          ctx.lineTo(px + ts * 0.2 + i * ts * 0.2, py + ts * 0.8)
          ctx.stroke()
        }
      } else if (sub === 'slime') {
        ctx.fillStyle = 'rgba(80,180,80,0.6)'
        ctx.beginPath()
        ctx.ellipse(cx, cy, ts * 0.3, ts * 0.2, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (sub === 'pool_edge') {
        ctx.fillStyle = '#5a4a38'
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.arc(
            px + ts * 0.2 + rnd() * ts * 0.6,
            py + ts * 0.2 + rnd() * ts * 0.6,
            ts * 0.08,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
      }
    },

    // ---------- Animation loop ----------
    startAnimLoop() {
      const loop = () => {
        let needsRender = false
        const lvl = this.currentLevelData
        for (const r of lvl.rooms) {
          if (r.revealed && r.revealProgress < 1) {
            r.revealProgress = Math.min(1, r.revealProgress + 0.04)
            needsRender = true
          }
        }
        if (
          this.highlightedStair &&
          performance.now() < this.highlightedStair.until
        )
          needsRender = true
        else if (
          this.highlightedStair &&
          performance.now() >= this.highlightedStair.until
        ) {
          this.highlightedStair = null
          needsRender = true
        }
        if (needsRender) this.render()
        this.animFrameId = requestAnimationFrame(loop)
      }
      loop()
    },

    // ---------- Interaction ----------
    tileAtEvent(e) {
      const canvas = this.$refs.map
      const rect = canvas.getBoundingClientRect()
      const ts = Math.floor(this.TS * this.zoomLevel)
      return {
        x: Math.floor((e.clientX - rect.left) / ts),
        y: Math.floor((e.clientY - rect.top) / ts),
      }
    },
    tileLabel(t) {
      // players never learn that a wall is really a secret door
      if (t === T.SECRET_DOOR && this.viewMode !== 'dm')
        return TILE_NAMES[T.WALL]
      return TILE_NAMES[t] || '?'
    },
    onMouseMove(e) {
      const { x, y } = this.tileAtEvent(e)
      const lvl = this.currentLevelData
      const dm = this.viewMode === 'dm'
      if (!this.inBounds(x, y) || (!dm && !this.isVisibleAt(x, y))) {
        this.tooltip.visible = false
        return
      }
      const f = this.featureAt(x, y)
      let text = `(${x},${y}) · ${this.tileLabel(lvl.grid[y][x])}<br>`
      text += `<span style="color:#9a8670">${x * 5}-${x * 5 + 5} ft, ${y * 5}-${
        y * 5 + 5
      } ft</span>`
      const room = this.getRoomAt(x, y)
      if (room && room.tag && (dm || room.revealed)) {
        const tmpl = this.allTags[room.tag]
        if (tmpl)
          text += `<br><span style="color:${tmpl.color}">🏷 ${escapeHtml(
            tmpl.label
          )}</span>`
      }
      if (f && (f.revealed || (dm && this.showHidden))) {
        text += `<br>• ${f.type}: ${f.subtype}${
          f.hidden && !f.revealed ? ' <em>(hidden)</em>' : ''
        }`
        if (f.type === 'stairs') text += ` → Level ${(f.targetLevel || 0) + 1}`
      }
      this.tooltip.text = text
      this.tooltip.x = e.clientX + 12
      this.tooltip.y = e.clientY + 12
      this.tooltip.visible = true
    },
    onCanvasClick(e) {
      const { x, y } = this.tileAtEvent(e)
      const lvl = this.currentLevelData
      if (!this.inBounds(x, y)) return
      const dm = this.viewMode === 'dm'
      const room = this.getRoomAt(x, y)

      // Tag mode: open tag menu for the room
      if (this.tagMode) {
        if (room && (dm || room.revealed)) {
          this.openTagMenu(room, e.clientX, e.clientY)
          return
        }
        this.info = 'Click inside a room to tag it.'
        return
      }

      // Reveal an unrevealed room
      if (room && !room.revealed) {
        if (this.canPlayerReveal(room)) {
          this.revealRoom(room.id)
          this.info = `Revealed room ${room.id}.`
          return
        }
        this.info = 'Cannot reach that room yet.'
        return
      }

      // Past here, players can only act on what they can already see
      if (!dm && !this.isVisibleAt(x, y)) return

      // Secret door: find it
      if (lvl.grid[y][x] === T.SECRET_DOOR) {
        this.discoverSecretDoor(x, y)
        return
      }

      const f = this.featureAt(x, y)

      // Stair click → travel
      if (f && f.type === 'stairs' && f.revealed) {
        this.travelStair(f)
        return
      }

      // Investigate hidden feature
      if (f && f.hidden && !f.revealed) {
        f.revealed = true
        this.info = `Discovered: ${f.type} (${f.subtype}) at (${x},${y}).`
        this.$emit('feature-revealed', { level: this.currentLevel, feature: f })
        this.render()
        return
      }

      if (f) {
        this.info = `${f.type} (${f.subtype}) at (${x},${y}) in room ${f.room}`
      } else {
        this.info = `(${x},${y}): ${this.tileLabel(lvl.grid[y][x])}`
      }
    },
    onKeyDown(e) {
      if (e.key === 'Escape') this.closeTagMenu()
    },

    // ---------- Zoom / UI ----------
    zoom(dir) {
      if (dir === 0) {
        const wrap = this.$el.querySelector('.canvas-wrap')
        const availW = wrap.clientWidth - 24
        const availH = window.innerHeight - 240
        const lvl = this.currentLevelData
        const zW = availW / (lvl.width * this.TS)
        const zH = availH / (lvl.height * this.TS)
        this.zoomLevel = Math.max(0.3, Math.min(2, Math.min(zW, zH)))
      } else {
        this.zoomLevel = Math.max(0.3, Math.min(3, this.zoomLevel + dir * 0.2))
      }
      this.render()
    },
    randomSeed() {
      this.seed = Math.floor(Math.random() * 1e9).toString(36)
    },

    // ---------- Import / Export ----------
    serializeLevel(lvl) {
      return {
        id: lvl.id,
        name: lvl.name,
        width: lvl.width,
        height: lvl.height,
        grid: lvl.grid,
        rooms: lvl.rooms.map((r) => ({
          id: r.id,
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          revealed: r.revealed,
          tag: r.tag || null,
        })),
        corridors: lvl.corridors,
        features: lvl.features,
        corridorCount: lvl.corridorCount,
      }
    },
    exportLevelJSON() {
      const data = {
        version: 3,
        seed: this.seed,
        theme: this.theme,
        generatorType: this.generatorType,
        customTags: this.customTags,
        levelIndex: this.currentLevel,
        level: this.serializeLevel(this.currentLevelData),
      }
      this.downloadJSON(data, `dungeon_level_${this.currentLevel + 1}.json`)
    },
    exportGlobalJSON() {
      const data = {
        version: 3,
        seed: this.seed,
        theme: this.theme,
        generatorType: this.generatorType,
        customTags: this.customTags,
        levels: this.levels.map((lvl) => this.serializeLevel(lvl)),
      }
      this.downloadJSON(data, 'dungeon_all.json')
    },
    downloadJSON(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      this.$emit('export', { filename, data })
    },
    triggerImportLevel() {
      this.$refs.fileInput.click()
    },
    handleImport(e) {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          this.importJSON(JSON.parse(ev.target.result))
        } catch (err) {
          this.info = 'Import failed: ' + err.message
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    importJSON(data) {
      if (data.version !== 3) {
        this.info = 'Unknown JSON version (this tool reads version 3 exports).'
        return
      }
      const normalizeLevel = (l, idx) => {
        const okGrid =
          Array.isArray(l.grid) &&
          l.grid.length === l.height &&
          l.grid.every((row) => Array.isArray(row) && row.length === l.width)
        if (!okGrid) throw new Error('level grid does not match its size')
        return {
          id: idx,
          name: l.name || `Level ${idx + 1}`,
          width: l.width,
          height: l.height,
          grid: l.grid,
          rooms: (l.rooms || []).map((r) => ({
            ...r,
            tag: r.tag || null,
            revealProgress: r.revealed ? 1 : 0,
          })),
          corridors: l.corridors || [],
          features: l.features || [],
          corridorCount: l.corridorCount || 0,
        }
      }

      // Build everything first so a bad file changes nothing
      let levels
      let level
      if (data.levels && data.levels.length) {
        levels = data.levels.map(normalizeLevel)
      } else if (data.level) {
        level = normalizeLevel(data.level, this.currentLevel)
      } else {
        throw new Error('no levels in file')
      }

      this.seed = data.seed || ''
      this.theme = data.theme || 'stone'
      this.generatorType = data.generatorType || 'classic'
      this.customTags = data.customTags || {}
      this.rng = mulberry32(hashStr(`${this.seed}:L${this.currentLevel}`))
      this.highlightedStair = null

      if (levels) {
        this.levels = levels
        this.currentLevel = 0
      } else {
        this.$set(this.levels, this.currentLevel, level)
      }
      this.revision++
      this.render()
      this.info = 'Imported.'
    },
    exportPNG() {
      const a = document.createElement('a')
      a.download = `dungeon_${this.seed || 'map'}_L${this.currentLevel + 1}.png`
      a.href = this.$refs.map.toDataURL('image/png')
      a.click()
    },
  },
}
</script>

<style scoped>
.dungeon-map {
  display: grid;
  grid-template-columns: 320px 1fr;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  background: #1a1410;
  color: #e8d9b8;
  font-family: Georgia, serif;
}
.dm-panel {
  background: #241c16;
  border-right: 2px solid #4a3828;
  padding: 18px;
  overflow-y: auto;
  min-height: 0;
}
h1 {
  font-size: 22px;
  margin: 0 0 4px;
  color: #c9a961;
  letter-spacing: 1px;
}
.subtitle {
  font-size: 12px;
  color: #9a8670;
  margin-bottom: 18px;
  font-style: italic;
}
section {
  background: #2e241c;
  border: 1px solid #4a3828;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}
section h2 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #c9a961;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  border-bottom: 1px solid #4a3828;
  padding-bottom: 6px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 6px 0;
  font-size: 13px;
}
.range-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.seed-row {
  display: flex;
  gap: 6px;
}
.seed-row input {
  flex: 1;
}
input[type='number'],
input[type='text'],
select {
  background: #1a1410;
  border: 1px solid #4a3828;
  color: #e8d9b8;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
}
input[type='number'] {
  width: 70px;
  text-align: right;
}
input[type='text'] {
  width: 140px;
}
input[type='range'] {
  width: 100px;
  accent-color: #c9a961;
}
button {
  background: linear-gradient(180deg, #8b5a2b, #5c3a1c);
  border: 1px solid #4a3828;
  color: #e8d9b8;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  width: 100%;
  margin: 3px 0;
}
button:hover {
  background: linear-gradient(180deg, #a06a35, #6b4422);
}
button.primary {
  background: linear-gradient(180deg, #c9a961, #9a7d3e);
  color: #1a1410;
  font-weight: bold;
}
button.danger {
  background: linear-gradient(180deg, #7a2424, #4a1414);
}
button.active {
  background: linear-gradient(180deg, #c9a961, #9a7d3e);
  color: #1a1410;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.map-area {
  padding: 18px;
  overflow: auto;
  position: relative;
  outline: none;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.level-tabs {
  display: flex;
  gap: 4px;
}
.level-tabs button {
  width: auto;
  margin: 0;
  padding: 6px 14px;
}
.info {
  font-size: 12px;
  color: #9a8670;
  margin-left: auto;
}
.mode-banner {
  background: #c9a961;
  color: #1a1410;
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: bold;
  margin-bottom: 10px;
  text-align: center;
}
.canvas-wrap {
  background: #0a0806;
  border: 2px solid #4a3828;
  border-radius: 6px;
  padding: 10px;
  display: inline-block;
  max-width: 100%;
  overflow: auto;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 0, 0, 0.4);
}
canvas {
  display: block;
  image-rendering: pixelated;
  cursor: crosshair;
}
.legend {
  margin-top: 14px;
  background: #241c16;
  border: 1px solid #4a3828;
  border-radius: 6px;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
  font-size: 12px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend-swatch {
  width: 20px;
  height: 20px;
  border: 1px solid #4a3828;
  border-radius: 3px;
  flex-shrink: 0;
}
.stat {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #9a8670;
  padding: 2px 0;
}
.stat span:last-child {
  color: #c9a961;
}
.tooltip {
  position: fixed;
  background: rgba(26, 20, 16, 0.95);
  border: 1px solid #c9a961;
  color: #e8d9b8;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 100;
  max-width: 280px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}
.tag-menu {
  position: absolute;
  background: #241c16;
  border: 2px solid #c9a961;
  border-radius: 6px;
  padding: 10px;
  z-index: 50;
  min-width: 220px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
}
.tag-menu-title {
  color: #c9a961;
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 13px;
  border-bottom: 1px solid #4a3828;
  padding-bottom: 6px;
}
.tag-menu-row {
  font-size: 12px;
  margin-bottom: 8px;
  color: #e8d9b8;
}
.tag-menu-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.tag-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}
.tag-btn {
  width: 100%;
  margin: 0;
  padding: 6px 10px;
  text-align: left;
  border-left: 4px solid #888;
  font-size: 12px;
}
.tag-btn.custom {
  border-left-color: #888;
  font-style: italic;
}
.tag-btn.clear {
  border-left-color: #7a2424;
  color: #d8a8a8;
}
@media (max-width: 800px) {
  .dungeon-map {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    height: auto;
    overflow-y: auto;
  }
}
</style>
