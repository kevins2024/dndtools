<template>
  <div class="bm-overlay" ref="overlay" tabindex="-1" @keydown="handleKeyDown">
    <div class="bm-panel">
      <!-- Close button — pulled out of the toolbar flow entirely and
      pinned to the panel's top-right corner, where users expect a modal
      close control to live (2026-09-18 correction: the toolbar itself
      should stay flexible-width, not forced to a fixed size — the actual
      fix for "shrinking and jumping around" is letting each row WRAP its
      own controls onto another line as it runs out of width, growing the
      toolbar's height, rather than squeezing everything to fit one line). -->
      <button
        class="bm-btn bm-close-btn bm-close-corner"
        @click="$emit('close')"
      >
        ✕ Close
      </button>

      <!-- Toolbar — 2 rows, each wraps its own controls onto additional
      lines when it runs out of horizontal room instead of shrinking them
      illegibly or reflowing unpredictably. -->
      <div class="bm-toolbar">
        <div class="bm-toolbar-row">
          <span class="bm-title">Battle Map</span>
          <span v-if="levels.length > 1" class="bm-hint"
            >Floor: <strong>{{ levelTitle(activeZ) }}</strong></span
          >
          <span v-if="notice" class="bm-hint bm-notice">{{ notice }}</span>
          <template v-if="paintMode">
            <span class="bm-hint">
              Click or drag to paint
              <strong v-if="selectedPaint === null">— erasing</strong>
              <strong v-else-if="selectedPaint === 'x'">— obstacle</strong>
              <strong v-else>— {{ selectedPaintLabel }}</strong>
            </span>
          </template>
          <span v-else-if="zoneMode" class="bm-hint"
            >Click to place a shape — click the same spot again, or right-click
            it, to remove</span
          >
          <template v-else>
            <span class="bm-hint" v-if="selectedKey"
              >Moving: <strong>{{ selectedName }}</strong> — click a square to
              place</span
            >
            <span class="bm-hint" v-else
              >Click a token to select, then click a square to move</span
            >
          </template>

          <div class="bm-legend">
            <span class="bm-legend-dot" style="background: #c8a96e"></span
            >Player
            <span
              class="bm-legend-dot"
              style="background: var(--color-success)"
            ></span
            >Friendly
            <span
              class="bm-legend-dot"
              style="background: var(--color-neutral-amber)"
            ></span
            >Neutral
            <span class="bm-legend-dot" style="background: #a05030"></span>Enemy
            <span v-if="combatTurn" class="bm-legend-note"
              >· <span class="bm-legend-ring"></span> current turn ·
              <span class="bm-legend-check">✓</span> already acted this
              round</span
            >
          </div>
        </div>

        <!-- Ribbon: every control is always visible, sorted into small
        labelled groups (like Paint or PowerPoint), instead of a few buttons
        that swap what they say depending on the current "mode". The tools are
        one exclusive set; the rest are plain actions and settings. -->
        <div class="bm-ribbon">
          <div class="bm-group">
            <div class="bm-group-body">
              <button
                class="bm-tool"
                :class="{ active: !paintMode && !zoneMode }"
                title="Move tokens: click a token, then click a square"
                @click="setTool('move')"
              >
                <Hand class="bm-tool-icon" /><span>Move</span>
              </button>
              <button
                class="bm-tool"
                :class="{ active: paintMode }"
                title="Paint terrain, walls, doors, trees and stairs"
                @click="setTool('paint')"
              >
                <Paintbrush class="bm-tool-icon" /><span>Paint</span>
              </button>
              <button
                class="bm-tool"
                :class="{ active: zoneMode }"
                title="Place spell areas, trees, water and other shapes"
                @click="setTool('zones')"
              >
                <Shapes class="bm-tool-icon" /><span>Zones</span>
              </button>
            </div>
            <div class="bm-group-label">Tool</div>
          </div>

          <div class="bm-group">
            <div class="bm-group-body">
              <label class="bm-field" title="Grid line colour">
                <Grid2x2 class="bm-ico" />
                <select class="bm-size-select" v-model="gridStyle">
                  <option v-for="g in GRID_STYLES" :key="g.key" :value="g.key">
                    {{ g.label }}
                  </option>
                </select>
              </label>
              <!-- Background texture — sits under all painted terrain/objects. -->
              <label class="bm-field" title="Background texture">
                <Image class="bm-ico" />
                <select
                  class="bm-size-select"
                  :value="bgImage || ''"
                  @change="setBackground($event.target.value)"
                >
                  <option value="">No BG</option>
                  <option v-for="b in BACKGROUNDS" :key="b.key" :value="b.key">
                    {{ b.label }}
                  </option>
                </select>
              </label>
              <div class="bm-zoom-row">
                <button
                  class="bm-icon-btn"
                  title="Zoom out"
                  @click="adjustZoom(-2)"
                  :disabled="cellSize <= MIN_CELL"
                >
                  <ZoomOut class="bm-ico" />
                </button>
                <span class="bm-zoom-label">{{ cellSize }}px</span>
                <button
                  class="bm-icon-btn"
                  title="Zoom in"
                  @click="adjustZoom(2)"
                  :disabled="cellSize >= MAX_CELL"
                >
                  <ZoomIn class="bm-ico" />
                </button>
              </div>
            </div>
            <div class="bm-group-label">View</div>
          </div>

          <div class="bm-group">
            <div class="bm-group-body">
              <button
                v-if="canSaveMaps"
                class="bm-tool bm-tool--action"
                :class="{ active: mapsOpen }"
                title="Save this map setup, or load a saved one"
                @click="toggleMapsPanel"
              >
                <Save class="bm-tool-icon" /><span>Save / Load</span>
              </button>
              <button
                class="bm-tool bm-tool--action"
                title="Copy a text version of this floor to the clipboard"
                @click="exportMap"
              >
                <ClipboardCopy class="bm-tool-icon" /><span>{{
                  copyFlash ? 'Copied' : 'Export'
                }}</span>
              </button>
            </div>
            <div class="bm-group-label">Map</div>
          </div>

          <!-- Manual token size override — real gap found 2026-09-18:
          tokenSpan already renders a real footprint from
          entry.encounterData.size (Large=2x2, Huge=3x3, Gargantuan=4x4),
          but that's only ever auto-populated for a bestiary-added enemy;
          a manually-added one (or a homebrew size bump) had no way to set
          it. Only shown once a token is selected. -->
          <div v-if="selectedKey" class="bm-group">
            <div class="bm-group-body">
              <label class="bm-field" title="Size of the selected token">
                <Scaling class="bm-ico" />
                <select
                  class="bm-size-select"
                  :value="selectedSize"
                  @change="setSelectedSize($event.target.value)"
                >
                  <option v-for="s in sizeOptions" :key="s" :value="s">
                    {{ s }}
                  </option>
                </select>
              </label>
            </div>
            <div class="bm-group-label">{{ selectedName }}</div>
          </div>
        </div>
      </div>

      <!-- Saved maps -->
      <div v-if="mapsOpen" class="bm-palette-bar bm-maps-bar">
        <input
          v-model="mapName"
          class="bm-maps-name"
          type="text"
          placeholder="Map name"
          maxlength="60"
          @keydown.enter="saveCurrentMap"
        />
        <button
          class="bm-btn"
          :disabled="!mapName.trim()"
          @click="saveCurrentMap"
        >
          Save
        </button>

        <span class="bm-maps-divider" />

        <span v-if="!savedMaps.length" class="bm-hint">No saved maps yet</span>
        <template v-else>
          <span v-for="m in savedMaps" :key="m.id" class="zone-list-item">
            <button
              class="bm-map-load"
              :title="mapTitle(m)"
              @click="loadMap(m)"
            >
              {{ m.name }}
            </button>
            <button
              class="zone-remove-btn"
              title="Delete"
              @click="deleteMap(m)"
            >
              ✕
            </button>
          </span>
        </template>
      </div>

      <!-- Palette bar (paint mode only) -->
      <div v-if="paintMode" class="bm-palette-bar">
        <button
          class="bm-swatch bm-swatch-erase"
          :class="{ active: selectedPaint === null }"
          @click="selectedPaint = null"
          title="Erase"
        >
          Erase
        </button>

        <div
          v-for="(group, gi) in TERRAIN_GROUPS"
          :key="gi"
          class="bm-swatch-group"
        >
          <button
            v-for="t in group"
            :key="t.key"
            class="bm-swatch"
            :class="{
              active: selectedPaint === t.key,
              'bm-swatch-x': t.key === 'x',
              'bm-swatch-obj': t.object,
            }"
            :style="swatchStyle(t)"
            @click="selectedPaint = t.key"
            :title="t.label"
          >
            <span v-if="t.key === 'x'">✕</span>
            <span v-else-if="t.glyph" class="bm-swatch-glyph">{{
              t.glyph
            }}</span>
          </button>
        </div>

        <button
          class="bm-fill-bg-btn"
          @click="fillBackground"
          :title="
            selectedPaint === null
              ? 'Clear background fill'
              : 'Fill all unpainted cells with selected color'
          "
        >
          Fill Background
        </button>
      </div>

      <!-- Zone palette bar -->
      <div v-if="zoneMode" class="bm-palette-bar">
        <span class="bm-hint" style="flex-shrink: 0">Style:</span>
        <div class="bm-zoom-row">
          <button
            class="bm-btn"
            :class="{ 'bm-btn--active': zoneTexture === 'spell' }"
            @click="zoneTexture = 'spell'"
          >
            ✦ Spell
          </button>
          <button
            v-for="t in ZONE_TEXTURES"
            :key="t.key"
            class="bm-btn"
            :class="{ 'bm-btn--active': zoneTexture === t.key }"
            @click="zoneTexture = t.key"
          >
            {{ t.label }}
          </button>
        </div>

        <template v-if="!zoneTextureDef">
          <span class="bm-hint" style="flex-shrink: 0">Color:</span>
          <div class="bm-swatch-group">
            <button
              v-for="zc in ZONE_COLORS"
              :key="zc.key"
              class="bm-swatch"
              :class="{ active: selectedZoneColor === zc.key }"
              :style="{ background: zc.color }"
              :title="zc.label"
              @click="selectedZoneColor = zc.key"
            />
          </div>
        </template>

        <div
          v-if="!zoneTextureDef || !zoneTextureDef.circleOnly"
          class="bm-zoom-row"
          style="margin-left: 0.8rem"
        >
          <button
            class="bm-btn"
            :class="{ 'bm-btn--active': zoneShape === 'circle' }"
            @click="zoneShape = 'circle'"
          >
            ○ Circle
          </button>
          <button
            class="bm-btn"
            :class="{ 'bm-btn--active': zoneShape === 'square' }"
            @click="zoneShape = 'square'"
          >
            □ Square
          </button>
        </div>

        <template v-if="!zoneSizeIsRadius">
          <span class="bm-hint" style="flex-shrink: 0">{{
            effectiveZoneShape === 'circle' ? 'Diameter:' : 'Side:'
          }}</span>
          <div class="bm-zoom-row">
            <button
              class="bm-btn"
              @click="zoneSide = Math.max(1, zoneSide - 1)"
            >
              −
            </button>
            <span class="bm-zoom-label"
              >{{ zoneSide }} ({{ zoneSide * 5 }}ft)</span
            >
            <button
              class="bm-btn"
              @click="zoneSide = Math.min(40, zoneSide + 1)"
            >
              +
            </button>
          </div>
        </template>
        <template v-else>
          <span class="bm-hint" style="flex-shrink: 0">Radius:</span>
          <div class="bm-zoom-row">
            <button
              class="bm-btn"
              @click="zoneRadius = Math.max(1, zoneRadius - 1)"
            >
              −
            </button>
            <span class="bm-zoom-label"
              >{{ zoneRadius }} ({{ zoneRadius * 5 }}ft)</span
            >
            <button
              class="bm-btn"
              @click="zoneRadius = Math.min(20, zoneRadius + 1)"
            >
              +
            </button>
          </div>
        </template>

        <div v-if="spellZones.length" class="zone-list">
          <span
            v-for="zone in spellZones"
            :key="zone.id"
            class="zone-list-item"
            :title="zoneTitle(zone)"
          >
            <span
              class="zone-list-dot"
              :style="{ background: zoneColorHex(zone.color) }"
            />
            {{ zoneLabel(zone) }}
            <button class="zone-remove-btn" @click="removeZone(zone.id)">
              ✕
            </button>
          </span>
        </div>
        <button
          class="bm-fill-bg-btn"
          style="margin-left: auto"
          @click="clearZones"
        >
          Clear All
        </button>
      </div>

      <div class="bm-body">
        <!-- Floor selector — like a zoom control: "+" goes up a floor, "−"
        goes down one (creating it if it's new), and the 11 marks between show
        where you are, +5 down to −5 with 0 (ground) in the middle. The marks
        aren't clickable. Stairs painted on the top/bottom floor also create the
        floor they lead to. The badge is how many tokens stand on a floor. -->
        <div class="bm-level-rail">
          <button
            class="bm-level-step"
            :disabled="!canStepUp"
            :title="
              canStepUp
                ? 'Up one floor (adds it if new)'
                : `Top floor (${MAX_Z} above ground)`
            "
            @click="stepLevel(1)"
          >
            +
          </button>
          <div
            v-for="slot in levelSlots"
            :key="slot.z"
            class="bm-level-slot"
            :class="{ exists: slot.exists, active: slot.z === activeZ }"
            :title="slot.exists ? levelTitle(slot.z) : ''"
          >
            <template v-if="slot.z === 0 || slot.z === activeZ">{{
              slot.z
            }}</template>
            <span v-else class="bm-level-mark" />
            <span v-if="tokenCount(slot.z)" class="bm-level-count">{{
              tokenCount(slot.z)
            }}</span>
          </div>
          <button
            class="bm-level-step"
            :disabled="!canStepDown"
            :title="
              canStepDown
                ? 'Down one floor (adds it if new)'
                : `Bottom floor (${MAX_Z} below ground)`
            "
            @click="stepLevel(-1)"
          >
            −
          </button>
        </div>

        <!-- Canvas -->
        <div
          class="bm-canvas-wrap scrollable"
          ref="wrap"
          @wheel.prevent="handleWheel"
          @scroll.passive="saveView"
          :class="{ 'bm-cursor-paint': paintMode, 'bm-cursor-zone': zoneMode }"
        >
          <canvas
            ref="canvas"
            @click="handleClick"
            @mousedown="handleMouseDown"
            @mouseup="handleMouseUp"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave"
            @contextmenu="handleContextMenu"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { combatTurn as combatTurnEngine } from '@/utils/combatTurn'
import dataService from '@/utils/dataService'
import {
  ClipboardCopy,
  Grid2x2,
  Hand,
  Image,
  Paintbrush,
  Save,
  Scaling,
  Shapes,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue'

const GRID = 90
const MAJOR = 5
const SUPER_MAJOR = 30

// 5e footprint-by-size, in grid cells per side (Tiny/Small/Medium all share
// the standard 1x1 square). Purely a rendering size — occupancy/collision
// (byCell, freeCell, move-target checks) still tracks a single anchor cell,
// so a Large+ token's extra cells aren't yet occupancy-aware.
const SIZE_SPAN = {
  Tiny: 1,
  Small: 1,
  Medium: 1,
  Large: 2,
  Huge: 3,
  Gargantuan: 4,
}

const ZONE_COLORS = [
  { key: 'yellow', color: '#ffdd00', label: 'Silence / Radiant' },
  { key: 'blue', color: '#4488ff', label: 'Cold / Water' },
  { key: 'red', color: '#ff4422', label: 'Fire' },
  { key: 'green', color: '#44cc44', label: 'Poison / Nature' },
  { key: 'purple', color: '#aa44ff', label: 'Psychic / Necrotic' },
  { key: 'white', color: '#ffffff', label: 'Holy / Light' },
]

// Textured zones: scenery placed with the zone tool, sized in whole 5ft steps
// (the stepper is a diameter/side, not a radius, so a tree can be 5ft across).
// A zone with no `texture` is a translucent spell zone. circleOnly textures
// ignore the shape picker; `sym` marks covered cells in the text export.
const ZONE_TEXTURES = [
  { key: 'tree', label: 'Tree', circleOnly: true, sym: '*' },
  { key: 'bush', label: 'Bush', circleOnly: true, sym: '"' },
  { key: 'boulder', label: 'Boulder', circleOnly: true, sym: 'o' },
  { key: 'water', label: 'Water', sym: '~' },
  { key: 'lava', label: 'Lava', sym: '^' },
]

// Small seeded PRNG so a textured zone looks the same on every redraw.
function seededRng(seed) {
  let s = Math.trunc(seed) || 1
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
  next()
  next()
  return next
}

const TERRAIN_GROUPS = [
  [
    { key: 'brown1', color: '#c8a46a', label: 'Sand' },
    { key: 'brown2', color: '#7a4e28', label: 'Earth' },
    { key: 'brown3', color: '#3e2010', label: 'Dark earth' },
  ],
  [
    { key: 'green1', color: '#6aaa5a', label: 'Grass' },
    { key: 'green2', color: '#3a7030', label: 'Forest' },
    { key: 'green3', color: '#1a3e18', label: 'Dense forest' },
  ],
  [
    { key: 'blue1', color: '#6ab4d0', label: 'Shallow water' },
    { key: 'blue2', color: '#2e6a96', label: 'Water' },
    { key: 'blue3', color: '#102040', label: 'Deep water' },
  ],
  [
    { key: 'grey1', color: '#a09890', label: 'Gravel' },
    { key: 'grey2', color: '#686060', label: 'Stone' },
    { key: 'grey3', color: '#302828', label: 'Dark stone' },
  ],
  [{ key: 'x', color: null, label: 'Obstacle' }],
  // Objects live in their own layer (`objects`, not `terrain`) so a wall or
  // tree sits on top of whatever terrain paint is underneath it. Drawn
  // procedurally in drawObject(); `color` is just the swatch/hover tint.
  [
    { key: 'wood', color: '#8b5e34', label: 'Wood (boards)', object: true },
    { key: 'stone', color: '#7d7a74', label: 'Stone (masonry)', object: true },
    { key: 'door', color: '#a8743a', label: 'Door', object: true },
    { key: 'tree', color: '#2f6b2a', label: 'Tree', object: true },
  ],
  // Stairs are objects too, but painting one also paints the matching stair
  // on the floor above/below (see STAIR_LINKS / paintStairs).
  [
    {
      key: 'stairs_up',
      color: '#a39c8e',
      label: 'Stairs up (also marks the floor above)',
      object: true,
      glyph: '▲',
    },
    {
      key: 'stairs_down',
      color: '#4f4a42',
      label: 'Stairs down (also marks the floor below)',
      object: true,
      glyph: '▼',
    },
  ],
]

const TERRAIN_PALETTE = TERRAIN_GROUPS.flat()
const OBJECT_KEYS = new Set(
  TERRAIN_PALETTE.filter((t) => t.object).map((t) => t.key)
)

// Grid line colour options. 'normal' keeps the subtle themed lines; the rest
// are deliberately loud for when the grid gets lost in a busy texture.
const GRID_STYLES = [
  { key: 'normal', label: 'Normal', rgb: null },
  { key: 'yellow', label: 'Yellow', rgb: '255,225,0' },
  { key: 'pink', label: 'Pink', rgb: '255,60,200' },
  { key: 'white', label: 'White', rgb: '255,255,255' },
]

// CSS thumbnails for the object swatches, so they look like what they paint
// (a flat colour doesn't say "wall" or "tree").
const OBJECT_SWATCH_CSS = {
  wood: 'linear-gradient(to bottom, #94643a 0 30%, #2a180a 30% 36%, #7f5430 36% 64%, #2a180a 64% 70%, #8a5c33 70%)',
  stone:
    'linear-gradient(to bottom, transparent 46%, #4a4742 46% 54%, transparent 54%), ' +
    'linear-gradient(to right, transparent 46%, #4a4742 46% 54%, transparent 54%) top / 100% 50% no-repeat, ' +
    'linear-gradient(to right, transparent 21%, #4a4742 21% 29%, transparent 29% 71%, #4a4742 71% 79%, transparent 79%) bottom / 100% 50% no-repeat, ' +
    '#8a867f',
  door:
    'radial-gradient(circle at 78% 50%, #e8c14a 0 9%, transparent 11%), ' +
    'linear-gradient(to right, #2a180a 0 8%, #a8743a 8% 36%, #2a180a 36% 40%, #96672f 40% 64%, #2a180a 64% 68%, #a8743a 68% 92%, #2a180a 92%)',
  tree: 'radial-gradient(circle at 50% 50%, #4a9a40 0 22%, #2f6b2a 23% 62%, #1d4a1a 63% 68%, transparent 70%)',
  stairs_up:
    'repeating-linear-gradient(to bottom, #9d968a 0 4px, #3c382f 4px 5px)',
  stairs_down:
    'repeating-linear-gradient(to bottom, #5c574e 0 4px, #25221d 4px 5px)',
}

// Symbols for objects in the text export (letters are taken by tokens)
const OBJECT_EXPORT_SYMS = {
  wood: '=',
  stone: '#',
  door: '+',
  tree: '*',
  stairs_up: '<',
  stairs_down: '>',
}

// Floors are stacked by integer z (0 = ground, negative = below). A stair
// object leads `dz` floors away and is mirrored by `partner` on that floor.
const STAIR_LINKS = {
  stairs_up: { dz: 1, partner: 'stairs_down' },
  stairs_down: { dz: -1, partner: 'stairs_up' },
}

// Floors run from MAX_Z above ground to MAX_Z below: 11 in all.
const MAX_Z = 5

// Where the map was last looking ({ cellSize, left, top }). Module-level so it
// outlives the component: leaving the battle phase destroys the map, and the
// next fight shouldn't reset the zoom and scroll.
let lastView = null

function makeLevel(z) {
  return {
    z,
    terrain: {},
    objects: {},
    zones: [],
    bgFill: null,
    bgImage: null,
  }
}

// Background textures (CC0, Poly Haven — see public/battlemap/README.txt).
// Rendered as a CSS background on the canvas element, with the canvas itself
// transparent where nothing is painted, so terrain/object paint always sits
// on top and tiling costs nothing per redraw. tileCells = how many grid cells
// one repeat of the image spans.
const BACKGROUNDS = [
  {
    key: 'grass',
    label: 'Grassland',
    src: './battlemap/grass.jpg',
    tileCells: 12,
  },
  {
    key: 'cobble',
    label: 'City cobbles',
    src: './battlemap/cobblestone.jpg',
    tileCells: 5,
  },
  {
    key: 'desert',
    label: 'Desert',
    src: './battlemap/desert.jpg',
    tileCells: 12,
  },
  { key: 'snow', label: 'Snow', src: './battlemap/snow.jpg', tileCells: 8 },
]

export default {
  name: 'BattleMap',

  components: {
    ClipboardCopy,
    Grid2x2,
    Hand,
    Image,
    Paintbrush,
    Save,
    Scaling,
    Shapes,
    ZoomIn,
    ZoomOut,
  },

  props: {
    order: { type: Array, default: () => [] },
    combatantStates: { type: Object, default: () => ({}) },
    combatTurn: { type: Object, default: null },
    visible: { type: Boolean, default: false },
  },

  emits: ['close', 'set-token-size'],

  data() {
    return {
      positions: {},
      selectedKey: null,
      hoverCol: null,
      hoverRow: null,
      cellSize: lastView?.cellSize ?? 24,
      MIN_CELL: 8,
      MAX_CELL: 40,
      // Per-floor paint lives in `levels` (kept sorted by z); terrain,
      // objects, zones, bgFill and bgImage below are computed views of the
      // floor being viewed, so the painting code doesn't care about floors.
      levels: [makeLevel(0)],
      activeZ: 0,
      MAX_Z,
      notice: '',
      BACKGROUNDS,
      gridStyle: 'normal',
      GRID_STYLES,
      paintMode: false,
      selectedPaint: 'brown1',
      isPainting: false,
      zoneMode: false,
      zoneRadius: 4,
      zoneShape: 'circle',
      zoneSide: 4,
      selectedZoneColor: 'yellow',
      zoneTexture: 'spell',
      // Saved maps (dev server only — see dataService.listBattleMaps)
      canSaveMaps: dataService.isDevMode(),
      mapsOpen: false,
      savedMaps: [],
      mapName: '',
      TERRAIN_GROUPS,
      ZONE_COLORS,
      ZONE_TEXTURES,
      copyFlash: false,
    }
  },

  computed: {
    selectedName() {
      return this.order.find((e) => e.key === this.selectedKey)?.name ?? ''
    },
    selectedEntry() {
      return this.order.find((e) => e.key === this.selectedKey) ?? null
    },
    // Only enemy tokens get a manual size override — players/companions
    // aren't Large+ in this campaign, and the bestiary path already
    // auto-populates encounterData.size correctly for them anyway.
    selectedSize() {
      return this.selectedEntry?.encounterData?.size ?? 'Medium'
    },
    sizeOptions() {
      return Object.keys(SIZE_SPAN)
    },
    byCell() {
      const m = {}
      for (const e of this.order) {
        const p = this.positions[e.key]
        if (p && p.z === this.activeZ) m[`${p.col},${p.row}`] = e
      }
      return m
    },

    // ── Floors ──
    level() {
      return this.levels.find((l) => l.z === this.activeZ)
    },
    // The fixed 11-slot strip, top (+MAX_Z) to bottom (−MAX_Z).
    levelSlots() {
      const slots = []
      for (let z = MAX_Z; z >= -MAX_Z; z--) {
        slots.push({ z, exists: this.levels.some((l) => l.z === z) })
      }
      return slots
    },
    canStepUp() {
      return this.activeZ < MAX_Z
    },
    canStepDown() {
      return this.activeZ > -MAX_Z
    },
    terrain() {
      return this.level.terrain
    },
    objects() {
      return this.level.objects
    },
    zones: {
      get() {
        return this.level.zones
      },
      set(v) {
        this.level.zones = v
      },
    },
    spellZones() {
      return this.zones.filter((z) => !z.texture)
    },
    // The picked texture's definition, or null for a spell zone.
    zoneTextureDef() {
      return ZONE_TEXTURES.find((t) => t.key === this.zoneTexture) ?? null
    },
    effectiveZoneShape() {
      return this.zoneTextureDef?.circleOnly ? 'circle' : this.zoneShape
    },
    // Spell circles are sized by radius; everything else by its full width.
    zoneSizeIsRadius() {
      return !this.zoneTextureDef && this.zoneShape === 'circle'
    },
    // Width of the zone being placed, in cells. Odd widths centre on a cell,
    // even ones on a grid intersection (see zoneSnap).
    zoneExtent() {
      return this.zoneSizeIsRadius ? this.zoneRadius * 2 : this.zoneSide
    },
    bgFill: {
      get() {
        return this.level.bgFill
      },
      set(v) {
        this.level.bgFill = v
      },
    },
    bgImage: {
      get() {
        return this.level.bgImage
      },
      set(v) {
        this.level.bgImage = v
      },
    },
    selectedPaintLabel() {
      return (
        TERRAIN_PALETTE.find((t) => t.key === this.selectedPaint)?.label ?? ''
      )
    },
  },

  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => {
          this.draw()
          this.restoreView()
          this.$refs.overlay?.focus()
        })
      }
    },

    order: {
      immediate: true,
      handler(entries) {
        const players = entries.filter(
          (e) => e.type === 'player' || e.type === 'companion'
        )
        const enemies = entries.filter((e) => e.type === 'enemy')
        const pos = { ...this.positions }
        // New combatants appear on whichever floor is being viewed.
        const z = this.activeZ
        players.forEach((p, i) => {
          if (!pos[p.key])
            pos[p.key] = this.findFreeCell(pos, z, 52, 31 + i * 3)
        })
        enemies.forEach((e, i) => {
          if (!pos[e.key])
            pos[e.key] = this.findFreeCell(pos, z, 35, 31 + i * 3)
        })
        this.positions = pos
      },
    },
    activeZ() {
      this.applyBackground()
      this.draw()
    },
    cellSize() {
      this.$nextTick(() => {
        this.resizeCanvas()
        this.draw()
        this.saveView()
      })
    },
    zoneRadius() {
      this.draw()
    },
    zoneSide() {
      this.draw()
    },
    zoneShape() {
      this.draw()
    },
    zoneTexture() {
      this.draw()
    },
    bgImage() {
      this.applyBackground()
      this.draw()
    },
    gridStyle() {
      this.draw()
    },
    selectedZoneColor() {
      this.draw()
    },
  },

  mounted() {
    this._stopPainting = () => {
      this.isPainting = false
      this._lastPaintKey = null
    }
    document.addEventListener('mouseup', this._stopPainting)

    this.resizeCanvas()
    this.draw()
    // Usually still hidden here (the overlay is v-show'd), in which case
    // the `visible` watcher positions the view on first open instead.
    this.$nextTick(() => {
      this.restoreView()
      this.$refs.overlay?.focus()
    })
  },

  // Switching to another tab and back detaches the DOM (keep-alive), and the
  // browser forgets the scroll offset of anything detached or hidden.
  activated() {
    if (this.visible) this.$nextTick(() => this.restoreView())
  },

  beforeDestroy() {
    document.removeEventListener('mouseup', this._stopPainting)
    clearTimeout(this._noticeTimer)
  },

  methods: {
    // ── View (zoom + scroll) ──────────────────────────────────

    // Remember where the map was looking. Only while it's actually on screen:
    // a hidden or detached scroller reports 0,0, which would overwrite it.
    saveView() {
      const wrap = this.$refs.wrap
      if (!this.visible || !wrap || !wrap.clientWidth) return
      lastView = {
        cellSize: this.cellSize,
        left: wrap.scrollLeft,
        top: wrap.scrollTop,
      }
    },

    // Scroll back to the remembered spot, or the middle of the grid on the
    // very first open. No-op while hidden (nothing to scroll yet).
    restoreView() {
      const wrap = this.$refs.wrap
      if (!wrap || !wrap.clientWidth) return
      if (lastView) {
        wrap.scrollLeft = lastView.left
        wrap.scrollTop = lastView.top
      } else {
        const mid = (GRID / 2) * this.cellSize
        wrap.scrollLeft = mid - wrap.clientWidth / 2
        wrap.scrollTop = mid - wrap.clientHeight / 2
      }
      this.saveView()
    },

    // ── Floors ────────────────────────────────────────────────

    levelTitle(z) {
      return z === 0
        ? 'Ground floor'
        : z > 0
        ? `Floor ${z} (above ground)`
        : `Basement ${-z}`
    },
    tokenCount(z) {
      return this.order.filter((e) => this.positions[e.key]?.z === z).length
    },
    flashNotice(msg) {
      this.notice = msg
      clearTimeout(this._noticeTimer)
      this._noticeTimer = setTimeout(() => {
        this.notice = ''
      }, 3000)
    },

    setActiveLevel(z) {
      if (z === this.activeZ) return
      this.activeZ = z
      this.hoverCol = null
      this.hoverRow = null
      this._lastPaintKey = null
    },

    // Returns the floor at z, creating it (kept sorted by z) if there is room.
    // null = the floor limit (MAX_Z above or below ground) stopped it.
    ensureLevel(z) {
      const existing = this.levels.find((l) => l.z === z)
      if (existing) return existing
      if (Math.abs(z) > MAX_Z) {
        this.flashNotice(`Floor limit reached (${MAX_Z} above or below ground)`)
        return null
      }
      this.levels.push(makeLevel(z))
      this.levels.sort((a, b) => a.z - b.z)
      return this.levels.find((l) => l.z === z)
    },

    // One floor up (+1) or down (-1) from the one being viewed; a floor
    // that doesn't exist yet is created.
    stepLevel(dir) {
      const z = this.activeZ + dir
      if (this.ensureLevel(z)) this.setActiveLevel(z)
    },

    // Nearest unoccupied cell to (col,row) on floor z, spiralling outward.
    findFreeCell(positions, z, col, row) {
      const occ = new Set(
        Object.values(positions)
          .filter((p) => p.z === z)
          .map((p) => `${p.col},${p.row}`)
      )
      if (!occ.has(`${col},${row}`)) return { col, row, z }
      for (let r = 1; r <= 12; r++) {
        for (let dc = -r; dc <= r; dc++) {
          for (let dr = -r; dr <= r; dr++) {
            if (Math.abs(dc) === r || Math.abs(dr) === r) {
              if (!occ.has(`${col + dc},${row + dr}`))
                return { col: col + dc, row: row + dr, z }
            }
          }
        }
      }
      return { col, row, z }
    },

    // If a stair at (col,row) on this floor leads somewhere that exists,
    // the floor it leads to; otherwise null.
    stairDestination(col, row) {
      const link = STAIR_LINKS[this.objects[`${col},${row}`]]
      if (!link) return null
      const z = this.activeZ + link.dz
      return this.levels.some((l) => l.z === z) ? z : null
    },

    // Removes the matching stair on the neighbouring floor when the stair
    // at cellKey on `level` is erased or replaced, so pairs never dangle.
    clearStairPartner(level, cellKey) {
      const link = STAIR_LINKS[level.objects[cellKey]]
      if (!link) return
      const other = this.levels.find((l) => l.z === level.z + link.dz)
      if (other && other.objects[cellKey] === link.partner) {
        this.$delete(other.objects, cellKey)
      }
    },

    // Paints a stair here and its mirror (same cell) on the floor it leads
    // to, creating that floor if needed.
    paintStairs(cellKey, key) {
      const link = STAIR_LINKS[key]
      if (this.objects[cellKey] === key) return
      const other = this.ensureLevel(this.activeZ + link.dz)
      if (!other) return
      this.clearStairPartner(this.level, cellKey)
      this.clearStairPartner(other, cellKey)
      this.$set(this.objects, cellKey, key)
      this.$set(other.objects, cellKey, link.partner)
    },

    setSelectedSize(size) {
      if (!this.selectedKey) return
      this.$emit('set-token-size', { key: this.selectedKey, size })
    },

    // ── Canvas setup ──────────────────────────────────────────

    resizeCanvas() {
      const dpr = window.devicePixelRatio || 1
      const canvas = this.$refs.canvas
      if (!canvas) return
      const logical = GRID * this.cellSize
      canvas.width = logical * dpr
      canvas.height = logical * dpr
      canvas.style.width = `${logical}px`
      canvas.style.height = `${logical}px`
      canvas.getContext('2d').scale(dpr, dpr)
      this.applyBackground()
    },

    // Tiles the chosen texture behind the (transparent) canvas via CSS, so
    // it scales with zoom and never has to be repainted per draw.
    applyBackground() {
      const canvas = this.$refs.canvas
      if (!canvas) return
      const bg = BACKGROUNDS.find((b) => b.key === this.bgImage)
      if (bg) {
        const tile = bg.tileCells * this.cellSize
        canvas.style.backgroundImage = `url(${bg.src})`
        canvas.style.backgroundSize = `${tile}px ${tile}px`
        canvas.style.backgroundRepeat = 'repeat'
      } else {
        canvas.style.backgroundImage = ''
        canvas.style.backgroundSize = ''
      }
    },

    swatchStyle(t) {
      if (t.object) return { background: OBJECT_SWATCH_CSS[t.key] }
      return t.color ? { background: t.color } : {}
    },

    setBackground(key) {
      this.bgImage = key || null
      if (this.bgImage) this.bgFill = null
    },

    // ── Drawing ───────────────────────────────────────────────

    // Wood boards, stone masonry and trees, drawn per cell. Seams/joints are
    // laid out so neighbouring cells line up into continuous walls, and a
    // per-cell hash varies the shades so it doesn't look stamped.
    drawObject(ctx, key, col, row, cs) {
      const x = col * cs
      const y = row * cs
      const h = ((col * 73856093) ^ (row * 19349663)) >>> 0
      const seam = Math.max(0.6, cs * 0.04)

      if (key === 'wood') {
        const boards = 3
        const bh = cs / boards
        for (let i = 0; i < boards; i++) {
          const v = ((h >> (i * 4)) & 15) / 15
          ctx.fillStyle = `hsl(30,42%,${32 + v * 10}%)`
          ctx.fillRect(x, y + bh * i, cs, bh)
        }
        ctx.strokeStyle = 'rgba(30,16,6,0.7)'
        ctx.lineWidth = seam
        for (let i = 0; i <= boards; i++) {
          ctx.beginPath()
          ctx.moveTo(x, y + bh * i)
          ctx.lineTo(x + cs, y + bh * i)
          ctx.stroke()
        }
      } else if (key === 'stone') {
        ctx.fillStyle = '#4a4742'
        ctx.fillRect(x, y, cs, cs)
        // Running bond: top course joints at 0 / .5, bottom at -.25 / .25 / .75
        const bricks = [
          [0, 0, 0.5],
          [0, 0.5, 0.5],
          [1, -0.25, 0.5],
          [1, 0.25, 0.5],
          [1, 0.75, 0.5],
        ]
        bricks.forEach(([course, bx, bw], i) => {
          const left = Math.max(0, bx)
          const right = Math.min(1, bx + bw)
          const v = ((h >> i) & 15) / 15
          ctx.fillStyle = `hsl(40,6%,${40 + v * 12}%)`
          const gl = bx >= 0 ? seam / 2 : 0
          const gr = bx + bw <= 1 ? seam / 2 : 0
          const gt = seam / 2
          ctx.fillRect(
            x + left * cs + gl,
            y + course * (cs / 2) + gt,
            (right - left) * cs - gl - gr,
            cs / 2 - seam
          )
        })
      } else if (key === 'door') {
        // Planks in a dark frame with iron straps and a brass knob. Symmetric
        // on purpose: it reads as a door in a horizontal or vertical wall.
        const f = Math.max(1, cs * 0.1)
        const planks = 3
        const pw = (cs - f * 2) / planks
        ctx.fillStyle = '#2a180a'
        ctx.fillRect(x, y, cs, cs)
        for (let i = 0; i < planks; i++) {
          const v = ((h >> (i * 4)) & 15) / 15
          ctx.fillStyle = `hsl(32,48%,${38 + v * 9}%)`
          ctx.fillRect(x + f + pw * i, y + f, pw, cs - f * 2)
        }
        ctx.strokeStyle = 'rgba(30,16,6,0.65)'
        ctx.lineWidth = seam
        for (let i = 1; i < planks; i++) {
          ctx.beginPath()
          ctx.moveTo(x + f + pw * i, y + f)
          ctx.lineTo(x + f + pw * i, y + cs - f)
          ctx.stroke()
        }
        if (cs >= 10) {
          ctx.fillStyle = 'rgba(20,12,6,0.55)'
          ctx.fillRect(x + f, y + cs * 0.24, cs - f * 2, cs * 0.07)
          ctx.fillRect(x + f, y + cs * 0.69, cs - f * 2, cs * 0.07)
          ctx.fillStyle = '#e8c14a'
          ctx.beginPath()
          ctx.arc(
            x + cs * 0.78,
            y + cs / 2,
            Math.max(1.5, cs * 0.07),
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
      } else if (key === 'stairs_up' || key === 'stairs_down') {
        // Treads fade lighter toward the top of the cell; the arrow points
        // the way the stairs go (up the screen = climbing, down = descending).
        const up = key === 'stairs_up'
        const treads = 5
        const th = cs / treads
        for (let i = 0; i < treads; i++) {
          const t = i / (treads - 1)
          ctx.fillStyle = up
            ? `hsl(38,8%,${60 - t * 26}%)`
            : `hsl(30,8%,${36 - t * 16}%)`
          ctx.fillRect(x, y + th * i, cs, th)
        }
        ctx.strokeStyle = 'rgba(20,16,10,0.7)'
        ctx.lineWidth = seam
        for (let i = 0; i <= treads; i++) {
          ctx.beginPath()
          ctx.moveTo(x, y + th * i)
          ctx.lineTo(x + cs, y + th * i)
          ctx.stroke()
        }
        if (cs >= 10) {
          const cx = x + cs / 2
          const cy = y + cs / 2
          const w = cs * 0.3
          const hh = cs * 0.34
          const dir = up ? -1 : 1
          ctx.beginPath()
          ctx.moveTo(cx, cy + dir * hh)
          ctx.lineTo(cx - w, cy - dir * hh)
          ctx.lineTo(cx + w, cy - dir * hh)
          ctx.closePath()
          ctx.fillStyle = 'rgba(255,255,255,0.92)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.75)'
          ctx.lineWidth = Math.max(1, cs * 0.05)
          ctx.stroke()
        }
      } else if (key === 'tree') {
        const cx = x + cs / 2
        const cy = y + cs / 2
        const r = cs * 0.48
        ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.beginPath()
        ctx.arc(cx + cs * 0.06, cy + cs * 0.08, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `hsl(115,45%,${21 + ((h & 7) / 7) * 5}%)`
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        if (cs >= 14) {
          for (let i = 0; i < 4; i++) {
            const ang = (((h >> (i * 3)) & 7) / 8) * Math.PI * 2 + i
            ctx.fillStyle = `hsl(110,42%,${29 + (i % 2) * 4}%)`
            ctx.beginPath()
            ctx.arc(
              cx + Math.cos(ang) * r * 0.45,
              cy + Math.sin(ang) * r * 0.45,
              r * 0.42,
              0,
              Math.PI * 2
            )
            ctx.fill()
          }
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    },

    zonePath(ctx, cs, zone) {
      const cx = zone.col * cs
      const cy = zone.row * cs
      if (zone.shape === 'square') {
        const half = (zone.side * cs) / 2
        ctx.rect(cx - half, cy - half, half * 2, half * 2)
      } else {
        ctx.arc(cx, cy, zone.radius * cs, 0, Math.PI * 2)
      }
    },

    drawZone(ctx, cs, zone, hex, fillAlpha, strokeAlpha) {
      ctx.setLineDash([5, 4])
      ctx.globalAlpha = fillAlpha
      ctx.fillStyle = hex
      ctx.beginPath()
      this.zonePath(ctx, cs, zone)
      ctx.fill()
      ctx.globalAlpha = strokeAlpha
      ctx.strokeStyle = hex
      ctx.lineWidth = 1.5
      ctx.beginPath()
      this.zonePath(ctx, cs, zone)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    },

    // Leafy disc shared by trees and bushes. `r` is the outer radius in px.
    drawCanopy(ctx, cs, cx, cy, r, rng, look) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.arc(cx + r * 0.12, cy + r * 0.16, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `hsl(${look.hue},45%,${look.light - 8 + rng() * 5}%)`
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      if (cs >= 14) {
        const cells = r / cs
        const blobR = Math.min(r * 0.42, cs * 1.6)
        const n = Math.min(120, Math.max(4, Math.round(cells * cells * 3)))
        for (let i = 0; i < n; i++) {
          const ang = rng() * Math.PI * 2
          const dist = Math.sqrt(rng()) * Math.max(0, r - blobR)
          ctx.fillStyle = `hsl(${look.hue - 5},42%,${
            look.light - 1 + (i % 2) * 4
          }%)`
          ctx.beginPath()
          ctx.arc(
            cx + Math.cos(ang) * dist,
            cy + Math.sin(ang) * dist,
            blobR,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
        if (look.berries) {
          ctx.fillStyle = look.berries
          const dots = Math.round(cells * cells * 4) + 2
          for (let i = 0; i < dots; i++) {
            const ang = rng() * Math.PI * 2
            const dist = Math.sqrt(rng()) * r * 0.85
            ctx.beginPath()
            ctx.arc(
              cx + Math.cos(ang) * dist,
              cy + Math.sin(ang) * dist,
              Math.max(1, cs * 0.06),
              0,
              Math.PI * 2
            )
            ctx.fill()
          }
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    },

    drawBoulder(ctx, cs, cx, cy, r, rng) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.arc(cx + r * 0.1, cy + r * 0.14, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#6f6b64'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#8c8880'
      ctx.beginPath()
      ctx.arc(cx - r * 0.18, cy - r * 0.2, r * 0.72, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#a6a29a'
      ctx.beginPath()
      ctx.arc(cx - r * 0.3, cy - r * 0.34, r * 0.38, 0, Math.PI * 2)
      ctx.fill()
      if (cs >= 14) {
        ctx.strokeStyle = 'rgba(30,28,24,0.55)'
        ctx.lineWidth = Math.max(1, cs * 0.04)
        const cracks = 2 + Math.min(4, Math.floor(r / cs))
        for (let i = 0; i < cracks; i++) {
          let a = rng() * Math.PI * 2
          let x = cx + Math.cos(a) * r * 0.15
          let y = cy + Math.sin(a) * r * 0.15
          ctx.beginPath()
          ctx.moveTo(x, y)
          for (let s = 0; s < 3; s++) {
            a += (rng() - 0.5) * 1.2
            x += Math.cos(a) * r * 0.25
            y += Math.sin(a) * r * 0.25
            ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    },

    // Water or lava: fill the zone shape, then scatter one mark per cell.
    drawLiquid(ctx, cs, zone, lava, rng) {
      const half = zone.shape === 'square' ? zone.side / 2 : zone.radius
      ctx.save()
      ctx.beginPath()
      this.zonePath(ctx, cs, zone)
      ctx.clip()
      ctx.fillStyle = lava ? '#b53a0c' : 'rgba(46,106,150,0.85)'
      ctx.fillRect(
        (zone.col - half) * cs,
        (zone.row - half) * cs,
        half * 2 * cs,
        half * 2 * cs
      )
      if (cs >= 10) {
        const c0 = Math.floor(zone.col - half)
        const c1 = Math.ceil(zone.col + half)
        const r0 = Math.floor(zone.row - half)
        const r1 = Math.ceil(zone.row + half)
        for (let c = c0; c < c1; c++) {
          for (let r = r0; r < r1; r++) {
            const x = (c + rng()) * cs
            const y = (r + rng()) * cs
            if (lava) {
              ctx.fillStyle = rng() > 0.5 ? '#f5821f' : '#ffd23f'
              ctx.beginPath()
              ctx.arc(x, y, cs * (0.12 + rng() * 0.18), 0, Math.PI * 2)
              ctx.fill()
            } else {
              ctx.strokeStyle = 'rgba(255,255,255,0.35)'
              ctx.lineWidth = Math.max(1, cs * 0.06)
              ctx.beginPath()
              ctx.moveTo(x - cs * 0.22, y)
              ctx.quadraticCurveTo(x - cs * 0.11, y - cs * 0.12, x, y)
              ctx.quadraticCurveTo(
                x + cs * 0.11,
                y + cs * 0.12,
                x + cs * 0.22,
                y
              )
              ctx.stroke()
            }
          }
        }
      }
      ctx.restore()
      ctx.strokeStyle = lava ? '#2a1208' : 'rgba(16,40,64,0.7)'
      ctx.lineWidth = lava ? 2.5 : 1.5
      ctx.beginPath()
      this.zonePath(ctx, cs, zone)
      ctx.stroke()
    },

    drawTextureZone(ctx, cs, zone) {
      const rng = seededRng(zone.id ?? 1)
      const cx = zone.col * cs
      const cy = zone.row * cs
      const r = zone.radius * cs * 0.96
      switch (zone.texture) {
        case 'tree':
          this.drawCanopy(ctx, cs, cx, cy, r, rng, { hue: 115, light: 29 })
          break
        case 'bush':
          this.drawCanopy(ctx, cs, cx, cy, r * 0.9, rng, {
            hue: 95,
            light: 34,
            berries: 'rgba(200,50,60,0.9)',
          })
          break
        case 'boulder':
          this.drawBoulder(ctx, cs, cx, cy, r * 0.94, rng)
          break
        case 'water':
          this.drawLiquid(ctx, cs, zone, false, rng)
          break
        case 'lava':
          this.drawLiquid(ctx, cs, zone, true, rng)
          break
      }
    },

    // The zone the tool would place at (col, row) with the current settings.
    newZone(col, row) {
      const textured = !!this.zoneTextureDef
      return {
        shape: this.effectiveZoneShape,
        texture: textured ? this.zoneTexture : null,
        col,
        row,
        radius: textured ? this.zoneSide / 2 : this.zoneRadius,
        side: this.zoneSide,
        color: this.selectedZoneColor,
      }
    },

    // Is the point (x, y), in cell units, inside the zone?
    zoneContains(z, x, y) {
      return z.shape === 'square'
        ? Math.abs(x - z.col) <= z.side / 2 && Math.abs(y - z.row) <= z.side / 2
        : Math.hypot(x - z.col, y - z.row) <= z.radius
    },

    draw() {
      const canvas = this.$refs.canvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const cs = this.cellSize
      const sz = GRID * cs

      // Base. With a background texture the canvas stays transparent so the
      // CSS-tiled image (see applyBackground) shows through under all paint.
      ctx.clearRect(0, 0, sz, sz)
      if (!this.bgImage) {
        ctx.fillStyle = '#1a1612'
        ctx.fillRect(0, 0, sz, sz)
      }

      // Background fill (applied before individual terrain cells)
      if (this.bgFill) {
        if (this.bgFill === 'x') {
          ctx.fillStyle = '#111111'
          ctx.fillRect(0, 0, sz, sz)
        } else {
          const bgEntry = TERRAIN_PALETTE.find((t) => t.key === this.bgFill)
          if (bgEntry) {
            ctx.fillStyle = bgEntry.color
            ctx.fillRect(0, 0, sz, sz)
          }
        }
      }

      // Terrain fills
      for (const [cellKey, paintKey] of Object.entries(this.terrain)) {
        const [col, row] = cellKey.split(',').map(Number)
        const x = col * cs
        const y = row * cs
        if (paintKey === 'x') {
          ctx.fillStyle = '#111111'
          ctx.fillRect(x, y, cs, cs)
        } else {
          const entry = TERRAIN_PALETTE.find((t) => t.key === paintKey)
          if (entry) {
            ctx.fillStyle = entry.color
            ctx.fillRect(x, y, cs, cs)
          }
        }
      }

      // Objects (wood / stone fill the cell, so they go under the grid)
      for (const [cellKey, objKey] of Object.entries(this.objects)) {
        if (objKey === 'tree') continue
        const [col, row] = cellKey.split(',').map(Number)
        this.drawObject(ctx, objKey, col, row, cs)
      }

      // Grid lines — translucent over a texture so they read on light and
      // dark backgrounds alike
      const textured = !!this.bgImage && !this.bgFill
      const bold = GRID_STYLES.find((g) => g.key === this.gridStyle)?.rgb
      for (let i = 0; i <= GRID; i++) {
        const superMajor = i % SUPER_MAJOR === 0
        const major = i % MAJOR === 0
        if (bold) {
          ctx.strokeStyle = `rgba(${bold},${
            superMajor ? 1 : major ? 0.85 : 0.6
          })`
        } else if (textured) {
          ctx.strokeStyle = superMajor
            ? 'rgba(0,0,0,0.7)'
            : major
            ? 'rgba(0,0,0,0.5)'
            : 'rgba(0,0,0,0.3)'
        } else {
          ctx.strokeStyle = superMajor
            ? '#5a4a34'
            : major
            ? '#3a2e22'
            : '#201c16'
        }
        ctx.lineWidth = bold
          ? superMajor
            ? 2.4
            : major
            ? 1.4
            : 0.9
          : superMajor
          ? 1.8
          : major
          ? 0.8
          : 0.4
        ctx.beginPath()
        ctx.moveTo(i * cs, 0)
        ctx.lineTo(i * cs, sz)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * cs)
        ctx.lineTo(sz, i * cs)
        ctx.stroke()
      }

      // X markers on top of grid lines
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#888888'
      ctx.lineWidth = Math.max(1.5, cs * 0.1)

      // bgFill X marks (only for cells without individual terrain)
      if (this.bgFill === 'x') {
        for (let c = 0; c < GRID; c++) {
          for (let r = 0; r < GRID; r++) {
            if (this.terrain[`${c},${r}`]) continue
            const x = c * cs
            const y = r * cs
            const pad = cs * 0.2
            ctx.beginPath()
            ctx.moveTo(x + pad, y + pad)
            ctx.lineTo(x + cs - pad, y + cs - pad)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(x + cs - pad, y + pad)
            ctx.lineTo(x + pad, y + cs - pad)
            ctx.stroke()
          }
        }
      }

      // Individual X cells
      for (const [cellKey, paintKey] of Object.entries(this.terrain)) {
        if (paintKey !== 'x') continue
        const [col, row] = cellKey.split(',').map(Number)
        const x = col * cs
        const y = row * cs
        const pad = cs * 0.2
        ctx.beginPath()
        ctx.moveTo(x + pad, y + pad)
        ctx.lineTo(x + cs - pad, y + cs - pad)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + cs - pad, y + pad)
        ctx.lineTo(x + pad, y + cs - pad)
        ctx.stroke()
      }
      ctx.lineCap = 'butt'

      // Trees (canopies overhang the cell, so they go over the grid)
      for (const [cellKey, objKey] of Object.entries(this.objects)) {
        if (objKey !== 'tree') continue
        const [col, row] = cellKey.split(',').map(Number)
        this.drawObject(ctx, objKey, col, row, cs)
      }

      // Textured zones (trees, water, ...) sit over the grid, under spells
      for (const zone of this.zones) {
        if (zone.texture) this.drawTextureZone(ctx, cs, zone)
      }

      // Spell zones
      for (const zone of this.spellZones) {
        this.drawZone(ctx, cs, zone, this.zoneColorHex(zone.color), 0.25, 0.7)
      }

      // Hover highlight
      if (
        this.hoverCol !== null &&
        this.hoverCol >= 0 &&
        this.hoverCol < GRID &&
        this.hoverRow >= 0 &&
        this.hoverRow < GRID
      ) {
        if (this.zoneMode) {
          const preview = this.newZone(this.hoverCol, this.hoverRow)
          if (preview.texture) {
            ctx.globalAlpha = 0.6
            this.drawTextureZone(ctx, cs, preview)
            ctx.globalAlpha = 1
          } else {
            this.drawZone(
              ctx,
              cs,
              preview,
              this.zoneColorHex(this.selectedZoneColor),
              0.15,
              0.5
            )
          }
        } else if (this.paintMode) {
          if (this.selectedPaint === null) {
            ctx.fillStyle = 'rgba(200,80,60,0.35)'
          } else if (this.selectedPaint === 'x') {
            ctx.fillStyle = 'rgba(180,40,40,0.4)'
          } else {
            const entry = TERRAIN_PALETTE.find(
              (t) => t.key === this.selectedPaint
            )
            ctx.fillStyle = entry ? entry.color + '88' : 'rgba(255,255,255,0.2)'
          }
          ctx.fillRect(this.hoverCol * cs, this.hoverRow * cs, cs, cs)
        } else if (this.selectedKey) {
          const occupied = !!this.byCell[`${this.hoverCol},${this.hoverRow}`]
          ctx.fillStyle = occupied
            ? 'rgba(160,80,48,0.2)'
            : 'rgba(200,169,110,0.18)'
          ctx.fillRect(this.hoverCol * cs, this.hoverRow * cs, cs, cs)
        }
      }

      // Tokens
      for (const entry of this.order) {
        const pos = this.positions[entry.key]
        if (!pos || pos.z !== this.activeZ) continue
        this.drawToken(ctx, entry, pos.col, pos.row, cs)
      }
    },

    tokenSpan(entry) {
      return SIZE_SPAN[entry.encounterData?.size] ?? 1
    },

    isActiveTurn(entry) {
      if (!this.combatTurn) return false
      return this.combatTurn.order[this.combatTurn.turnIndex] === entry.key
    },

    hasActed(entry) {
      if (!this.combatTurn) return false
      return combatTurnEngine.hasActedThisRound(this.combatTurn, entry.key)
    },

    tokenLabel(entry) {
      const name = entry.name.trim()
      // Duplicated enemies are named "Base N" (e.g. "Goblin 2") — use the
      // base name's first letter plus the number so duplicates stay
      // distinguishable rather than colliding on the same two letters.
      const numbered = name.match(/^(.*\S)\s+(\d+)$/)
      if (numbered)
        return `${numbered[1].charAt(0).toUpperCase()}${numbered[2]}`
      const words = name.split(/\s+/)
      if (words.length >= 2) {
        return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    },

    drawToken(ctx, entry, col, row, cs) {
      const span = this.tokenSpan(entry)
      const cx = (col + span / 2) * cs
      const cy = (row + span / 2) * cs
      const r = Math.max(cs * span * 0.42, 3)
      const selected = entry.key === this.selectedKey
      const active = this.isActiveTurn(entry)
      const acted = this.hasActed(entry)

      if (active) {
        ctx.strokeStyle = '#ffd54a'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (selected) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.globalAlpha = acted ? 0.5 : 1
      ctx.fillStyle = this.tokenColor(entry)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      if (cs >= 12) {
        const fontSize = Math.max(Math.round(r * 0.7), 6)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.tokenLabel(entry), cx, cy)
      }
      ctx.globalAlpha = 1

      if (acted) {
        ctx.fillStyle = '#3a3a3a'
        ctx.beginPath()
        ctx.arc(
          cx + r * 0.65,
          cy - r * 0.65,
          Math.max(cs * 0.14, 5),
          0,
          Math.PI * 2
        )
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.fillStyle = '#a8d8a8'
        ctx.font = `bold ${Math.max(Math.round(cs * 0.16), 7)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✓', cx + r * 0.65, cy - r * 0.65 + 0.5)
      }
    },

    tokenColor(entry) {
      if (entry.type === 'player') return '#c8a96e'
      if (entry.type === 'companion') return '#4a9e6b'
      const s = this.combatantStates[entry.key]
      return s === 'friendly'
        ? '#4a9e6b'
        : s === 'neutral'
        ? '#c9952a'
        : '#a05030'
    },

    // ── Terrain painting ──────────────────────────────────────

    fillBackground() {
      // Objects (wood/stone/tree) are placed per cell, not used as a fill.
      if (OBJECT_KEYS.has(this.selectedPaint)) return
      this.bgFill = this.selectedPaint
      if (this.bgFill) this.bgImage = null
      this.draw()
    },

    // The ribbon's tool buttons are one exclusive set; Move is "neither of
    // the other two". (The toggles below also clear each other.)
    setTool(tool) {
      if (tool === 'paint' && !this.paintMode) this.togglePaintMode()
      else if (tool === 'zones' && !this.zoneMode) this.toggleZoneMode()
      else if (tool === 'move') {
        if (this.paintMode) this.togglePaintMode()
        if (this.zoneMode) this.toggleZoneMode()
      }
    },

    togglePaintMode() {
      this.paintMode = !this.paintMode
      if (this.paintMode) {
        this.zoneMode = false
        this.selectedKey = null
      }
      this.hoverCol = null
      this.hoverRow = null
      this.draw()
    },

    toggleZoneMode() {
      this.zoneMode = !this.zoneMode
      if (this.zoneMode) {
        this.paintMode = false
        this.selectedKey = null
      }
      this.hoverCol = null
      this.hoverRow = null
      this.draw()
    },

    placeZone(col, row) {
      if (col < 0 || col > GRID || row < 0 || row > GRID) return
      const existing = this.zones.findIndex(
        (z) =>
          z.col === col &&
          z.row === row &&
          (z.shape ?? 'circle') === this.effectiveZoneShape &&
          (z.texture ?? null) === (this.zoneTextureDef?.key ?? null)
      )
      if (existing >= 0) {
        this.zones.splice(existing, 1)
      } else {
        this.zones.push({ id: Date.now(), ...this.newZone(col, row) })
      }
      this.draw()
    },

    // Short label for the zone list: "20ft" for a circle's radius, "20ft □"
    // for a square's side.
    zoneLabel(zone) {
      return zone.shape === 'square'
        ? `${zone.side * 5}ft □`
        : `${zone.radius * 5}ft`
    },
    zoneTitle(zone) {
      const size =
        zone.shape === 'square'
          ? `${zone.side * 5}ft square`
          : `${zone.radius * 5}ft radius`
      return `${this.zoneColorLabel(zone.color)} — ${size}`
    },

    removeZone(id) {
      this.zones = this.zones.filter((z) => z.id !== id)
      this.draw()
    },
    zoneColorHex(key) {
      return ZONE_COLORS.find((c) => c.key === key)?.color ?? '#ffffff'
    },
    zoneColorLabel(key) {
      return ZONE_COLORS.find((c) => c.key === key)?.label ?? key
    },
    clearZones() {
      this.zones = []
      this.draw()
    },

    paintCell(col, row) {
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) return
      const cellKey = `${col},${row}`
      // Dragging fires this on every mouse move; act once per cell per
      // stroke so erase peels one layer (object, then terrain) at a time.
      if (this._lastPaintKey === cellKey) return
      this._lastPaintKey = cellKey
      if (this.selectedPaint === null) {
        if (this.objects[cellKey]) {
          this.clearStairPartner(this.level, cellKey)
          this.$delete(this.objects, cellKey)
        } else this.$delete(this.terrain, cellKey)
      } else if (STAIR_LINKS[this.selectedPaint]) {
        this.paintStairs(cellKey, this.selectedPaint)
      } else if (OBJECT_KEYS.has(this.selectedPaint)) {
        this.clearStairPartner(this.level, cellKey)
        this.$set(this.objects, cellKey, this.selectedPaint)
      } else {
        this.$set(this.terrain, cellKey, this.selectedPaint)
      }
      this.draw()
    },

    // ── Interaction ───────────────────────────────────────────

    gridCoords(event) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      return {
        col: Math.floor((event.clientX - rect.left) / this.cellSize),
        row: Math.floor((event.clientY - rect.top) / this.cellSize),
      }
    },

    // Snaps a zone's centre to the grid so it lines up with the lines: the
    // nearest intersection for even widths (spell circles, 2-cell trees), the
    // nearest cell centre for odd widths (their edges would otherwise land
    // mid-cell).
    zoneSnap(event) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) / this.cellSize
      const y = (event.clientY - rect.top) / this.cellSize
      if (this.zoneExtent % 2 === 1) {
        return { col: Math.floor(x) + 0.5, row: Math.floor(y) + 0.5 }
      }
      return { col: Math.round(x), row: Math.round(y) }
    },

    // Topmost zone under the pointer (right-click removal). Spell zones are
    // drawn over textured ones, so they win a tie.
    zoneAt(event) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) / this.cellSize
      const y = (event.clientY - rect.top) / this.cellSize
      const hits = this.zones.filter((z) => this.zoneContains(z, x, y))
      return hits.reverse().find((z) => !z.texture) ?? hits[0] ?? null
    },

    handleMouseDown(event) {
      if (!this.paintMode) return
      this.isPainting = true
      this._lastPaintKey = null
      const { col, row } = this.gridCoords(event)
      this.paintCell(col, row)
    },

    handleContextMenu(event) {
      if (!this.zoneMode) return
      event.preventDefault()
      const zone = this.zoneAt(event)
      if (zone) this.removeZone(zone.id)
    },

    handleMouseUp() {
      this.isPainting = false
      this._lastPaintKey = null
    },

    handleClick(event) {
      if (this.paintMode) return
      if (this.zoneMode) {
        const { col, row } = this.zoneSnap(event)
        this.placeZone(col, row)
        return
      }
      const { col, row } = this.gridCoords(event)
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) return

      const occupant = this.byCell[`${col},${row}`]
      if (occupant) {
        this.selectedKey =
          this.selectedKey === occupant.key ? null : occupant.key
      } else if (this.selectedKey) {
        // Clicking a stair that leads to an existing floor takes the token
        // there (same cell) and the view follows; anywhere else it simply
        // lands on the floor being viewed — so switching floors with a token
        // selected and clicking a square also moves it between floors.
        const dest = this.stairDestination(col, row)
        const z = dest ?? this.activeZ
        this.$set(
          this.positions,
          this.selectedKey,
          dest === null
            ? { col, row, z }
            : this.findFreeCell(this.positions, z, col, row)
        )
        this.selectedKey = null
        if (dest !== null) this.setActiveLevel(dest)
        this.hoverCol = null
        this.hoverRow = null
      }
      this.draw()
    },

    handleMouseMove(event) {
      if (this.zoneMode) {
        const { col, row } = this.zoneSnap(event)
        if (col !== this.hoverCol || row !== this.hoverRow) {
          this.hoverCol = col
          this.hoverRow = row
          this.draw()
        }
        return
      }
      const { col, row } = this.gridCoords(event)
      if (this.paintMode) {
        if (col !== this.hoverCol || row !== this.hoverRow) {
          this.hoverCol = col
          this.hoverRow = row
          this.draw()
        }
        if (this.isPainting) this.paintCell(col, row)
        return
      }
      const occupant = this.byCell[`${col},${row}`]
      if (this.$refs.canvas) {
        this.$refs.canvas.title = occupant ? occupant.name : ''
      }
      if (!this.selectedKey) return
      if (col !== this.hoverCol || row !== this.hoverRow) {
        this.hoverCol = col
        this.hoverRow = row
        this.draw()
      }
    },

    handleMouseLeave() {
      this.isPainting = false
      this._lastPaintKey = null
      this.hoverCol = null
      this.hoverRow = null
      if (this.$refs.canvas) this.$refs.canvas.title = ''
      if (this.selectedKey || this.paintMode || this.zoneMode) this.draw()
    },

    handleKeyDown(event) {
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        this.$emit('close')
        return
      }
      // Don't hijack letters typed into the Maps panel's name box etc.
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return
      const step = this.cellSize * 3
      const wrap = this.$refs.wrap
      if (key === 'w') wrap.scrollTop -= step
      else if (key === 's') wrap.scrollTop += step
      else if (key === 'a') wrap.scrollLeft -= step
      else if (key === 'd') wrap.scrollLeft += step
      else return
      event.preventDefault()
    },

    handleWheel(event) {
      this.adjustZoom(event.deltaY < 0 ? 2 : -2)
    },

    adjustZoom(delta) {
      this.cellSize = Math.min(
        this.MAX_CELL,
        Math.max(this.MIN_CELL, this.cellSize + delta)
      )
    },

    // ── Saved maps ────────────────────────────────────────────

    levelHasPaint(lv) {
      return !!(
        Object.keys(lv.terrain).length ||
        Object.keys(lv.objects).length ||
        lv.zones.length ||
        lv.bgFill ||
        lv.bgImage
      )
    },

    async toggleMapsPanel() {
      this.mapsOpen = !this.mapsOpen
      if (this.mapsOpen) await this.refreshMaps()
    },

    async refreshMaps() {
      try {
        this.savedMaps = await dataService.listBattleMaps()
      } catch (err) {
        this.flashNotice(`Couldn't load saved maps: ${err.message}`)
      }
    },

    mapTitle(map) {
      const floors = map.levels.length
      const when = map.saved_at
        ? new Date(map.saved_at).toLocaleDateString()
        : ''
      return (
        `${floors} floor${floors === 1 ? '' : 's'}` +
        (when ? ` · saved ${when}` : '')
      )
    },

    async saveCurrentMap() {
      const name = this.mapName.trim()
      if (!name) return
      const existing = this.savedMaps.find(
        (m) => m.name.toLowerCase() === name.toLowerCase()
      )
      if (
        existing &&
        !window.confirm(`Replace the saved map "${existing.name}"?`)
      )
        return
      const map = {
        id: existing?.id,
        name,
        activeZ: this.activeZ,
        gridStyle: this.gridStyle,
        levels: JSON.parse(JSON.stringify(this.levels)),
      }
      try {
        this.savedMaps = await dataService.saveBattleMap(map)
        this.flashNotice(`Saved "${name}"`)
      } catch (err) {
        this.flashNotice(`Save failed: ${err.message}`)
      }
    },

    loadMap(map) {
      if (
        this.levels.some(this.levelHasPaint) &&
        !window.confirm(`Replace the current map with "${map.name}"?`)
      )
        return
      const levels = map.levels
        .filter((l) => Number.isInteger(l.z) && Math.abs(l.z) <= MAX_Z)
        .map((l) => ({ ...makeLevel(l.z), ...JSON.parse(JSON.stringify(l)) }))
        .sort((a, b) => a.z - b.z)
      if (!levels.length) levels.push(makeLevel(0))
      const has = (z) => levels.some((l) => l.z === z)
      const z = has(map.activeZ) ? map.activeZ : has(0) ? 0 : levels[0].z

      // Saves hold the map only, never tokens (enemies have no stable
      // identity across fights). Tokens stay where they are, except any on a
      // floor the loaded map doesn't have, which drop to the viewed floor.
      const next = {}
      for (const [key, p] of Object.entries(this.positions)) {
        next[key] = has(p.z) ? p : this.findFreeCell(next, z, p.col, p.row)
      }

      this.levels = levels
      this.activeZ = z
      this.positions = next
      if (GRID_STYLES.some((g) => g.key === map.gridStyle)) {
        this.gridStyle = map.gridStyle
      }
      this.selectedKey = null
      this.hoverCol = null
      this.hoverRow = null
      this.mapName = map.name
      this.$nextTick(() => {
        this.applyBackground()
        this.draw()
      })
      this.flashNotice(`Loaded "${map.name}"`)
    },

    async deleteMap(map) {
      if (!window.confirm(`Delete the saved map "${map.name}"?`)) return
      try {
        this.savedMaps = await dataService.deleteBattleMap(map.id)
      } catch (err) {
        this.flashNotice(`Delete failed: ${err.message}`)
      }
    },

    exportMap() {
      // Collect all occupied cells to find bounding box
      const allCells = []
      for (const key of Object.keys(this.terrain)) {
        const [col, row] = key.split(',').map(Number)
        allCells.push({ col, row })
      }
      for (const key of Object.keys(this.objects)) {
        const [col, row] = key.split(',').map(Number)
        allCells.push({ col, row })
      }
      // Cells whose centre falls inside a textured zone, by symbol
      const zoneSyms = {}
      for (const zone of this.zones) {
        if (!zone.texture) continue
        const sym = ZONE_TEXTURES.find((t) => t.key === zone.texture)?.sym
        const half = zone.shape === 'square' ? zone.side / 2 : zone.radius
        for (let c = Math.floor(zone.col - half); c < zone.col + half; c++) {
          for (let r = Math.floor(zone.row - half); r < zone.row + half; r++) {
            if (!this.zoneContains(zone, c + 0.5, r + 0.5)) continue
            zoneSyms[`${c},${r}`] = sym
            allCells.push({ col: c, row: r })
          }
        }
      }
      for (const pos of Object.values(this.positions)) {
        if (pos.z === this.activeZ) allCells.push(pos)
      }
      if (allCells.length === 0) return

      const minCol = Math.min(...allCells.map((c) => c.col)) - 1
      const maxCol = Math.max(...allCells.map((c) => c.col)) + 1
      const minRow = Math.min(...allCells.map((c) => c.row)) - 1
      const maxRow = Math.max(...allCells.map((c) => c.row)) + 1

      // Assign single-char symbols to combatants
      const tokenMap = {}
      const legend = []
      const PLAYER_SYMS = 'ABCDEFGHIJKLMNOPQRSTUVWYZ'
      const ENEMY_SYMS = 'abcdefghijklmnopqrstuvwxyz'
      let pi = 0
      let ei = 0
      for (const entry of this.order) {
        const pos = this.positions[entry.key]
        if (!pos || pos.z !== this.activeZ) continue
        let sym
        if (entry.type === 'player') {
          sym = PLAYER_SYMS[pi++] ?? '@'
        } else {
          const state = this.combatantStates[entry.key]
          if (state === 'friendly') sym = 'F'
          else if (state === 'neutral') sym = 'N'
          else sym = ENEMY_SYMS[ei++] ?? 'e'
        }
        tokenMap[`${pos.col},${pos.row}`] = sym
        legend.push(`${sym} = ${entry.name}`)
      }

      // Build grid rows
      const gridRows = []
      for (let row = minRow; row <= maxRow; row++) {
        let line = ''
        for (let col = minCol; col <= maxCol; col++) {
          const key = `${col},${row}`
          if (tokenMap[key]) line += tokenMap[key]
          else if (this.objects[key])
            line += OBJECT_EXPORT_SYMS[this.objects[key]]
          else if (zoneSyms[key]) line += zoneSyms[key]
          else if (this.terrain[key] === 'x') line += 'X'
          else line += '.'
        }
        gridRows.push(line)
      }

      const objectLegend = Object.entries(OBJECT_EXPORT_SYMS)
        .filter(([k]) => Object.values(this.objects).includes(k))
        .map(([k, sym]) => `${sym} = ${k}`)
      for (const t of ZONE_TEXTURES) {
        if (Object.values(zoneSyms).includes(t.sym))
          objectLegend.push(`${t.sym} = ${t.label.toLowerCase()}`)
      }
      const legendBlock =
        (legend.length ? legend.join('\n') + '\n' : '') +
        'X = obstacle  . = open' +
        (objectLegend.length ? '  ' + objectLegend.join('  ') : '')
      const floorHeader =
        this.levels.length > 1
          ? `Floor: ${this.levelTitle(this.activeZ)}\n`
          : ''
      const text = floorHeader + gridRows.join('\n') + '\n\n' + legendBlock

      navigator.clipboard.writeText(text).then(() => {
        this.copyFlash = true
        setTimeout(() => {
          this.copyFlash = false
        }, 1500)
      })
    },
  },
}
</script>

<style scoped>
.bm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bm-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 92vw;
  height: 92vh;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

/* Close pinned to the panel's top-right corner — conventional modal
placement, and keeps it in a stable spot regardless of how many lines the
flexible toolbar wraps to below it. */
.bm-close-corner {
  position: absolute;
  top: 0.6rem;
  right: 1rem;
  z-index: 1;
}

/* ── Toolbar ── */
/* Flexible width, 2 rows, each wrapping its own controls onto another
line when it runs out of room — see the template comment above for the
2026-09-18 history (a fixed min-width was tried first and corrected). */
.bm-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 5.5rem 0.6rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Flexible width — no forced min-width (2026-09-18 correction: forcing a
fixed size was never the ask, it was a workaround for controls squeezing
illegibly at narrower widths). flex-wrap lets each row grow the toolbar's
own height by wrapping onto another line instead. Right padding on
.bm-toolbar above keeps row content clear of the corner-pinned Close
button. */
.bm-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  min-height: 1.8rem;
}

/* ── Ribbon: labelled groups of always-visible controls ── */
.bm-ribbon {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.4rem 0;
}

.bm-group {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.2rem;
  padding: 0 0.8rem;
  border-left: 1px solid var(--color-border);
}
.bm-group:first-child {
  padding-left: 0;
  border-left: none;
}

.bm-group-body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem 0.45rem;
  flex: 1;
}

.bm-group-label {
  text-align: center;
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-low);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 14rem;
}

/* Big icon-over-caption button for the tools and the map actions. */
.bm-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 3.4rem;
  padding: 0.3rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.bm-tool:hover {
  border-color: var(--color-border);
  color: var(--color-accent);
}
.bm-tool.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(200, 169, 110, 0.1);
}
.bm-tool-icon {
  width: 1.3rem;
  height: 1.3rem;
}

.bm-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.bm-icon-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.bm-icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* An icon prefixing a select. */
.bm-field {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-low);
}
.bm-ico {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.bm-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent);
  flex-shrink: 0;
}

.bm-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}

.bm-hint strong {
  color: var(--color-accent-strong);
  font-weight: normal;
}

.bm-legend {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  margin-left: auto;
}

.bm-legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 0.6rem;
}

.bm-legend-note {
  margin-left: 0.6rem;
}

.bm-legend-ring {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid #ffd54a;
  margin: 0 0.15rem;
}

.bm-legend-check {
  display: inline-block;
  color: #a8d8a8;
  font-weight: bold;
}

.bm-zoom-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.bm-zoom-label {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  min-width: 2.8rem;
  text-align: center;
}

.bm-size-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.bm-size-select {
  padding: 0.15rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-family: var(--font-body);
}

.bm-btn {
  padding: 0.2rem 0.55rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
  flex-shrink: 0;
}
.bm-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.bm-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.bm-btn--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(200, 169, 110, 0.08);
}

.bm-close-btn:hover:not(:disabled) {
  border-color: var(--color-text-danger) !important;
  color: var(--color-text-danger) !important;
}

/* ── Palette bar ── */
.bm-palette-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.bm-swatch-group {
  display: flex;
  gap: 3px;
}

.bm-swatch {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.1s;
  flex-shrink: 0;
}

.bm-swatch-obj {
  width: 28px;
  height: 28px;
  border-color: var(--color-border);
}

.bm-swatch.active {
  border-color: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
}

.bm-swatch-erase {
  background: var(--color-bg-panel);
  border-color: var(--color-border);
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  width: auto;
  padding: 0 0.4rem;
  letter-spacing: 0.03em;
}
.bm-swatch-erase:hover {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}
.bm-swatch-erase.active {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}

.bm-swatch-x {
  background: #111111;
  border-color: #444444;
  color: #888888;
  font-size: 11px;
  line-height: 1;
}
.bm-swatch-x:hover {
  border-color: #888888;
}
.bm-swatch-x.active {
  border-color: #ffffff;
}

.bm-fill-bg-btn {
  margin-left: auto;
  padding: 0.15rem 0.6rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  font-family: var(--font-body);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s, color 0.12s;
}
.bm-fill-bg-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* ── Saved maps ── */
.bm-maps-bar {
  flex-wrap: wrap;
}
.bm-maps-name {
  width: 11rem;
  padding: 0.15rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-family: var(--font-body);
}
.bm-maps-check {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}
.bm-maps-divider {
  align-self: stretch;
  border-left: 1px solid var(--color-border);
  margin: 0 0.3rem;
}
.bm-map-load {
  background: transparent;
  border: none;
  padding: 0 2px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-body);
  cursor: pointer;
}
.bm-map-load:hover {
  color: var(--color-accent);
}

/* ── Zone list ── */
.zone-list {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.zone-list-item {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 1px 4px 1px 3px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.zone-list-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.zone-remove-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: 0.6rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.1s;
}
.zone-remove-btn:hover {
  color: var(--color-text-danger);
}

/* ── Floor rail ── */
.bm-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.bm-level-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  width: 1.9rem;
  align-self: flex-start;
  margin: 0.5rem 0 0 0.4rem;
  padding: 3px;
  background: var(--color-bg-panel-dark);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  flex-shrink: 0;
}

.bm-level-step,
.bm-level-slot {
  position: relative;
  height: 1.1rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 3px;
  font-size: var(--font-size-xs);
  font-family: var(--font-body);
  line-height: 1;
  text-align: center;
}
.bm-level-step {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  cursor: pointer;
}
.bm-level-step:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.bm-level-step:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* The marks only show where you are — they aren't controls. */
.bm-level-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-low);
  cursor: default;
}
.bm-level-slot.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(200, 169, 110, 0.12);
}
.bm-level-mark {
  width: 40%;
  height: 1px;
  background: var(--color-border);
}
/* A floor that exists has a brighter mark than an empty slot */
.bm-level-slot.exists .bm-level-mark {
  height: 2px;
  background: var(--color-text-low);
}

.bm-level-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 12px;
  height: 12px;
  padding: 0 2px;
  border-radius: 6px;
  background: var(--color-accent);
  color: var(--color-bg);
  font-size: 9px;
  line-height: 12px;
}

.bm-notice strong,
.bm-notice {
  color: var(--color-text-danger);
}

.bm-swatch-glyph {
  color: #ffffff;
  font-size: 11px;
  line-height: 1;
  text-shadow: 0 0 2px #000, 0 0 2px #000;
}

/* ── Canvas wrap ── */
.bm-canvas-wrap {
  flex: 1;
  min-width: 0;
  overflow: auto;
  cursor: crosshair;
  background: var(--color-bg);
}

.bm-canvas-wrap.bm-cursor-paint {
  cursor: cell;
}
.bm-canvas-wrap.bm-cursor-zone {
  cursor: crosshair;
}

.bm-canvas-wrap::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.bm-canvas-wrap::-webkit-scrollbar-track {
  background: transparent;
}
.bm-canvas-wrap::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar);
  border-radius: 3px;
}
</style>
