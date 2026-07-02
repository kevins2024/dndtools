<template>
  <div class="map-viewer">
    <div class="map-toolbar">
      <span
        class="toolbar-label"
        style="font-weight: 600; color: var(--color-text)"
        >{{ toDisplayName(currentMapName) }}</span
      >

      <span class="toolbar-sep"></span>

      <!-- Zoom — always visible -->
      <label class="path-toggle zoom-label">
        Zoom
        <input
          type="range"
          min="1"
          max="8"
          step="0.5"
          v-model.number="zoomLevel"
          class="zoom-slider"
        />
        {{ zoomLevel }}x
      </label>

      <span class="toolbar-sep"></span>

      <!-- Edit mode toggle -->
      <button
        class="map-btn"
        :class="{ active: editMode }"
        @click="editMode = !editMode"
      >
        Edit
      </button>

      <span class="toolbar-sep"></span>

      <!-- Place Party -->
      <template v-if="!placingParty">
        <button class="map-btn map-btn--place" @click="startPlacing">
          Place Party
        </button>
      </template>
      <template v-else>
        <select
          v-model="placingPartyId"
          class="placing-select"
          @keydown.escape="placingParty = false"
        >
          <option v-for="p in parties" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <button class="map-btn" @click="placingParty = false">Cancel</button>
      </template>

      <span class="toolbar-sep"></span>

      <button
        class="map-btn"
        :class="{ active: pointInfoMode }"
        @click="pointInfoMode = !pointInfoMode"
      >
        Point Info
      </button>

      <span class="toolbar-sep"></span>

      <button
        class="map-btn"
        :class="{ active: distanceMode }"
        @click="toggleDistanceMode"
      >
        Distance
      </button>
      <template v-if="distanceMode">
        <span class="toolbar-label" style="font-size: var(--font-size-sm)">
          {{ distancePts.length === 0 ? 'Click start' : 'Click to add point' }}
        </span>
      </template>

      <!-- Edit-mode controls -->
      <template v-if="editMode">
        <span class="toolbar-sep"></span>
        <span class="toolbar-label">Nodes:</span>
        <label
          v-for="p in pathDefs.filter((p) => !p.isOutline)"
          :key="p.id"
          class="path-toggle"
        >
          <input type="checkbox" v-model="p.showNodes" />
          <span class="path-swatch" :style="{ background: p.color }"></span>
          {{ toDisplayName(p.label) }}
        </label>
        <span class="toolbar-sep"></span>
        <label class="path-toggle">
          <input type="checkbox" v-model="showLabels" />
          Labels
        </label>
        <label class="path-toggle">
          <input type="checkbox" v-model="showOutline" />
          Outline
        </label>
        <label class="path-toggle">
          <input type="checkbox" v-model="showGrid" />
          Grid
        </label>
      </template>
    </div>

    <div class="map-content">
      <aside class="map-sidebar">
        <div class="sidebar-continent">{{ toDisplayName(currentMapName) }}</div>
        <div class="sidebar-layers">
          <label
            v-for="layer in toggleableLayers"
            :key="layer.id"
            class="layer-toggle"
          >
            <input type="checkbox" v-model="layerVisibility[layer.id]" />
            {{ toDisplayName(layer.label) }}
          </label>
        </div>
        <div class="sidebar-regions">
          <button
            v-for="r in mapRegions"
            :key="r.id"
            class="region-btn"
            :class="{ active: selectedRegion === r.id }"
            @click="selectRegion(r.id)"
          >
            {{ r.name }}
          </button>
        </div>
      </aside>

      <div class="map-container">
        <div v-if="loading" class="map-loading">Loading map…</div>
        <svg
          v-else
          ref="mapSvg"
          :viewBox="activeViewBox"
          class="map-svg"
          :style="{
            cursor: isDragging
              ? 'grabbing'
              : placingParty || pointInfoMode
              ? 'crosshair'
              : 'grab',
          }"
          xmlns="http://www.w3.org/2000/svg"
          @mousedown.prevent="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp($event)"
          @mouseleave="onMouseUp($event, true)"
          @wheel.prevent="onWheel"
        >
          <g>
            <!-- Region overlay -->
            <path
              v-if="activeRegionPathD"
              :d="activeRegionPathD"
              fill="rgba(74,158,107,0.1)"
              stroke="var(--color-success)"
              stroke-width="0.8"
              stroke-dasharray="3,1.5"
            />

            <!-- All paths (filtered by layer visibility) -->
            <path
              v-for="p in visiblePathDefs"
              :key="p.id"
              :id="p.id"
              :d="p.d"
              :transform="p.transform || undefined"
              :style="p.svgStyle"
            />

            <!-- Raw SVG layers (text, images, etc.) injected as-is -->
            <g
              v-for="layer in rawLayers"
              :key="layer.id"
              :id="layer.id"
              v-show="layerVisibility[layer.id]"
              v-html="layer.innerHTML"
            />

            <!-- Edit mode: outline nodes -->
            <g v-if="editMode && showOutline">
              <g v-for="(node, i) in outlineNodes" :key="'o-' + i">
                <circle
                  :cx="node.x"
                  :cy="node.y"
                  r="1"
                  fill="#888"
                  stroke="white"
                  stroke-width="0.2"
                />
                <text
                  v-if="showLabels"
                  :x="node.x + 0.8"
                  :y="node.y - 0.8"
                  class="node-label"
                  font-size="2"
                  fill="#ccc"
                  stroke="black"
                  stroke-width="0.4"
                  paint-order="stroke"
                >
                  O{{ i }}
                </text>
              </g>
            </g>

            <!-- Edit mode: feature path nodes -->
            <template v-if="editMode">
              <g v-for="p in featurePaths" :key="p.id + '-nodes'">
                <template v-if="p.showNodes">
                  <g v-for="(node, i) in p.nodes" :key="i">
                    <circle
                      :cx="node.x"
                      :cy="node.y"
                      r="1.8"
                      :fill="p.color"
                      stroke="white"
                      stroke-width="0.35"
                    />
                    <text
                      v-if="showLabels"
                      :x="node.x + 1.2"
                      :y="node.y - 1.2"
                      class="node-label"
                      font-size="2.5"
                      fill="white"
                      stroke="black"
                      stroke-width="0.5"
                      paint-order="stroke"
                    >
                      {{ p.prefix }}{{ i }}
                    </text>
                  </g>
                </template>
              </g>
            </template>

            <!-- Party markers -->
            <g
              v-for="marker in markersForMap"
              :key="marker.id"
              class="party-marker"
              :transform="`translate(${marker.x}, ${marker.y})`"
              @click.stop="removeMarker(marker.id)"
            >
              <polygon
                points="0,-7 6,0 0,7 -6,0"
                fill="#e8c14f"
                stroke="#1a1a2e"
                stroke-width="0.6"
              />
              <circle r="1.5" fill="#1a1a2e" />
              <text
                y="-10"
                text-anchor="middle"
                font-size="4"
                fill="#e8c14f"
                stroke="#1a1a2e"
                stroke-width="0.6"
                paint-order="stroke"
                font-family="sans-serif"
              >
                {{ marker.label }}
              </text>
            </g>

            <!-- Distance measurement -->
            <g v-if="distanceMode || distancePts.length" pointer-events="none">
              <line
                v-for="(pt, i) in distancePts.slice(1)"
                :key="'dseg-' + i"
                :x1="distancePts[i].x"
                :y1="distancePts[i].y"
                :x2="pt.x"
                :y2="pt.y"
                stroke="#f0c040"
                stroke-width="0.8"
                stroke-dasharray="3,1.5"
              />
              <g v-for="(pt, i) in distancePts" :key="'dpt-' + i">
                <circle
                  :cx="pt.x"
                  :cy="pt.y"
                  r="3"
                  fill="#f0c040"
                  stroke="#1a1a2e"
                  stroke-width="0.5"
                />
                <text
                  :x="pt.x"
                  :y="pt.y - 5"
                  text-anchor="middle"
                  font-size="4"
                  fill="#f0c040"
                  stroke="#1a1a2e"
                  stroke-width="0.5"
                  paint-order="stroke"
                  font-family="sans-serif"
                >
                  {{ ptLabel(i) }}
                </text>
              </g>
            </g>
          </g>

          <!-- Edit mode: grid in viewBox-space (no transform — labels are display coords 0–336) -->
          <template v-if="editMode && showGrid">
            <line
              v-for="x in gridLines.cols"
              :key="'gc' + x"
              :x1="x"
              :y1="gridLines.top"
              :x2="x"
              :y2="gridLines.bottom"
              stroke="rgba(0,0,0,0.2)"
              stroke-width="0.4"
            />
            <text
              v-for="x in gridLines.cols"
              :key="'gct' + x"
              :x="x + 1"
              :y="gridLines.top + 7"
              font-size="5"
              fill="rgba(0,0,0,0.45)"
              font-family="monospace"
            >
              {{ Math.round(x) }}
            </text>
            <line
              v-for="y in gridLines.rows"
              :key="'gr' + y"
              :x1="gridLines.left"
              :y1="y"
              :x2="gridLines.right"
              :y2="y"
              stroke="rgba(0,0,0,0.2)"
              stroke-width="0.4"
            />
            <text
              v-for="y in gridLines.rows"
              :key="'grt' + y"
              :x="gridLines.left + 1"
              :y="y - 1"
              font-size="5"
              fill="rgba(0,0,0,0.45)"
              font-family="monospace"
            >
              {{ Math.round(y) }}
            </text>
          </template>
        </svg>
      </div>
    </div>
    <!-- map-content -->

    <!-- Distance popup -->
    <div v-if="distanceResult" class="point-popup dist-popup">
      <div class="point-popup-header">
        <span>Distance</span>
        <button class="point-popup-close" @click="distancePts = []">✕</button>
      </div>

      <!-- Segments -->
      <div
        v-for="seg in distanceResult.segments"
        :key="seg.label"
        class="point-popup-row dist-row"
      >
        <span class="dist-seg-label">{{ seg.label }}</span>
        <span class="dist-seg-val">{{ seg.miles.toFixed(1) }} mi</span>
      </div>

      <!-- Total -->
      <div class="dist-total">
        <span>Total</span>
        <span>{{ distanceResult.miles.toFixed(1) }} mi</span>
      </div>

      <!-- Terrain -->
      <div class="dist-terrain">
        <span class="dist-terrain-label">Terrain</span>
        <select v-model.number="distanceTerrain" class="dist-terrain-select">
          <option :value="0.75">Road</option>
          <option :value="1">Open / Plains</option>
          <option :value="1.5">Hills</option>
          <option :value="2">Forest</option>
          <option :value="2.5">Swamp</option>
          <option :value="3">Mountain</option>
        </select>
      </div>

      <!-- Travel modes -->
      <div
        v-for="mode in distanceResult.modes"
        :key="mode.label"
        class="point-popup-row dist-row"
      >
        <span class="point-popup-layer">{{ mode.label }}</span>
        <span class="dist-time">{{ mode.time }}</span>
      </div>
    </div>

    <!-- Point Info popup -->
    <div
      v-if="pointInfoVisible"
      class="point-popup"
      :style="{ left: pointInfoPos.x + 'px', top: pointInfoPos.y + 'px' }"
    >
      <div class="point-popup-header">
        <span>Point Info</span>
        <button class="point-popup-close" @click="pointInfoVisible = false">
          ✕
        </button>
      </div>
      <div v-if="!pointInfoResults.length" class="point-popup-empty">
        No filled layers found at this point.
      </div>
      <div
        v-for="r in pointInfoResults"
        :key="r.pathId"
        class="point-popup-row"
      >
        <span class="point-popup-layer">{{ r.layerLabel }}</span>
        <span v-if="r.pathLabel !== r.layerLabel" class="point-popup-path">{{
          r.pathLabel
        }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import mapsData from '../data/maps.json'
import dataService from '@/utils/dataService.js'

// ── SVG path parsers ─────────────────────────────────────────────────────────

function parseNums(str) {
  return (str.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(
    Number
  )
}

function extractNodes(d) {
  const nodes = []
  let cx = 0,
    cy = 0
  const re = /([MmLlCcHhVvZz])([^MmLlCcHhVvZz]*)/g
  let m
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]
    const nums = parseNums(m[2])
    let i = 0
    if (cmd === 'M') {
      while (i < nums.length) {
        cx = nums[i]
        cy = nums[i + 1]
        i += 2
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'm') {
      cx += nums[0]
      cy += nums[1]
      i = 2
      nodes.push({ x: cx, y: cy })
      while (i < nums.length) {
        cx += nums[i]
        cy += nums[i + 1]
        i += 2
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'L') {
      while (i < nums.length) {
        cx = nums[i]
        cy = nums[i + 1]
        i += 2
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'l') {
      while (i < nums.length) {
        cx += nums[i]
        cy += nums[i + 1]
        i += 2
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'C') {
      while (i < nums.length) {
        i += 4
        cx = nums[i]
        cy = nums[i + 1]
        i += 2
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'c') {
      while (i < nums.length) {
        i += 4
        cx += nums[i]
        cy += nums[i + 1]
        i += 2
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'H') {
      while (i < nums.length) {
        cx = nums[i]
        i++
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'h') {
      while (i < nums.length) {
        cx += nums[i]
        i++
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'V') {
      while (i < nums.length) {
        cy = nums[i]
        i++
        nodes.push({ x: cx, y: cy })
      }
    } else if (cmd === 'v') {
      while (i < nums.length) {
        cy += nums[i]
        i++
        nodes.push({ x: cx, y: cy })
      }
    }
  }
  return nodes
}

function extractSegments(d) {
  const segs = []
  let cx = 0,
    cy = 0
  const re = /([MmLlCcHhVvZz])([^MmLlCcHhVvZz]*)/g
  let m
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]
    const nums = parseNums(m[2])
    let i = 0
    if (cmd === 'M') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cx = nums[i]
        cy = nums[i + 1]
        i += 2
        segs.push({ type: 'M', fx, fy, x: cx, y: cy })
      }
    } else if (cmd === 'm') {
      let first = true
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cx += nums[i]
        cy += nums[i + 1]
        i += 2
        segs.push({ type: first ? 'M' : 'L', fx, fy, x: cx, y: cy })
        first = false
      }
    } else if (cmd === 'L') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cx = nums[i]
        cy = nums[i + 1]
        i += 2
        segs.push({ type: 'L', fx, fy, x: cx, y: cy })
      }
    } else if (cmd === 'l') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cx += nums[i]
        cy += nums[i + 1]
        i += 2
        segs.push({ type: 'L', fx, fy, x: cx, y: cy })
      }
    } else if (cmd === 'C') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        const x1 = nums[i],
          y1 = nums[i + 1],
          x2 = nums[i + 2],
          y2 = nums[i + 3]
        cx = nums[i + 4]
        cy = nums[i + 5]
        i += 6
        segs.push({ type: 'C', fx, fy, x: cx, y: cy, x1, y1, x2, y2 })
      }
    } else if (cmd === 'c') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        const x1 = cx + nums[i],
          y1 = cy + nums[i + 1],
          x2 = cx + nums[i + 2],
          y2 = cy + nums[i + 3]
        cx += nums[i + 4]
        cy += nums[i + 5]
        i += 6
        segs.push({ type: 'C', fx, fy, x: cx, y: cy, x1, y1, x2, y2 })
      }
    } else if (cmd === 'H') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cx = nums[i]
        i++
        segs.push({ type: 'L', fx, fy, x: cx, y: cy })
      }
    } else if (cmd === 'h') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cx += nums[i]
        i++
        segs.push({ type: 'L', fx, fy, x: cx, y: cy })
      }
    } else if (cmd === 'V') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cy = nums[i]
        i++
        segs.push({ type: 'L', fx, fy, x: cx, y: cy })
      }
    } else if (cmd === 'v') {
      while (i < nums.length) {
        const fx = cx,
          fy = cy
        cy += nums[i]
        i++
        segs.push({ type: 'L', fx, fy, x: cx, y: cy })
      }
    }
  }
  return segs
}

const _f = (n) => n.toFixed(3)
function segFwd(s) {
  if (s.type === 'C')
    return `C ${_f(s.x1)},${_f(s.y1)} ${_f(s.x2)},${_f(s.y2)} ${_f(s.x)},${_f(
      s.y
    )}`
  return `L ${_f(s.x)},${_f(s.y)}`
}
function segRev(s) {
  if (s.type === 'C')
    return `C ${_f(s.x2)},${_f(s.y2)} ${_f(s.x1)},${_f(s.y1)} ${_f(s.fx)},${_f(
      s.fy
    )}`
  return `L ${_f(s.fx)},${_f(s.fy)}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default {
  name: 'MapViewer',

  data() {
    return {
      currentMapId: '',
      selectedRegion: null,
      viewBox: '0 0 336.72092 313.7638',
      groupTransform: '',
      loading: true,
      pathDefs: [],
      discoveredLayers: [],
      rawLayers: [],
      layerVisibility: {},
      showLabels: false,
      showOutline: false,
      showGrid: false,
      editMode: false,
      zoomLevel: 1,
      panX: 0,
      panY: 0,
      isDragging: false,
      dragStart: null,
      dragMoved: false,
      placingParty: false,
      placingPartyId: null,
      markers: [],
      pointInfoMode: false,
      pointInfoVisible: false,
      pointInfoResults: [],
      pointInfoPos: { x: 0, y: 0 },
      distanceMode: false,
      distancePts: [],
      milesPerUnit: 1.25,
      distanceTerrain: 1,
    }
  },

  async mounted() {
    await this.loadMap('kaemahz_complete_normalized')
    const prefs = await dataService.getUserPrefs()
    this.markers = prefs.mapMarkers ?? []
  },

  computed: {
    showFynesmarch() {
      return this.selectedRegion === 'fynesmarch'
    },

    markersForMap() {
      return this.markers.filter((m) => m.mapId === this.currentMapId)
    },

    distanceResult() {
      if (this.distancePts.length < 2) return null
      const segments = this.distancePts.slice(1).map((b, i) => {
        const a = this.distancePts[i]
        const units = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
        return {
          label: `${this.ptLabel(i)} → ${this.ptLabel(i + 1)}`,
          miles: units * this.milesPerUnit,
        }
      })
      const miles = segments.reduce((s, seg) => s + seg.miles, 0)
      const travelTime = (mph) => {
        const hours = (miles / mph) * this.distanceTerrain
        return hours < 1
          ? `${Math.round(hours * 60)} min`
          : `${hours.toFixed(1)} hrs`
      }
      const modes = [
        { label: 'On foot', mph: 3 },
        { label: 'Mounted', mph: 5 },
        { label: 'Ship (sailing)', mph: 7 },
        { label: 'Ship (fast wind)', mph: 12 },
      ].map(({ label, mph }) => ({ label, time: travelTime(mph) }))
      return { segments, miles, modes }
    },

    parties() {
      return this.$store.state.parties ?? []
    },

    currentMapName() {
      return mapsData.find((m) => m.id === this.currentMapId)?.name ?? ''
    },

    mapRegions() {
      return mapsData.find((m) => m.id === this.currentMapId)?.regions ?? []
    },

    visiblePathDefs() {
      return this.pathDefs.filter(
        (p) => this.layerVisibility[p.layerGroupId] !== false
      )
    },

    toggleableLayers() {
      const outlineGroupIds = new Set(
        this.pathDefs.filter((p) => p.isOutline).map((p) => p.layerGroupId)
      )
      return this.discoveredLayers.filter((l) => !outlineGroupIds.has(l.id))
    },

    outlineNodes() {
      const outline = this.pathDefs.find((p) => p.isOutline)
      return outline ? extractNodes(outline.d) : []
    },

    featurePaths() {
      return this.visiblePathDefs
        .filter((p) => !p.isOutline)
        .map((p) => ({ ...p, nodes: extractNodes(p.d) }))
    },

    folPoints() {
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const bDef = this.pathDefs.find((p) => p.id === 'path5')
      if (!outlineDef || !aDef || !bDef) return []
      const on = extractNodes(outlineDef.d)
      const an = extractNodes(aDef.d)
      const bn = extractNodes(bDef.d)
      const pts = []
      for (let i = 0; i <= 7; i++) {
        if (bn[i]) pts.push(bn[i])
      }
      for (let i = 0; i <= 14; i++) {
        if (an[i]) pts.push(an[i])
      }
      for (let i = 78; i <= 97; i++) {
        if (on[i]) pts.push(on[i])
      }
      return pts
    },

    orvathPoints() {
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const cDef = this.pathDefs.find((p) => p.id === 'path6')
      if (!aDef || !cDef) return []
      const an = extractNodes(aDef.d)
      const cn = extractNodes(cDef.d)
      const pts = []
      for (let i = 2; i <= 8; i++) {
        if (an[i]) pts.push(an[i])
      }
      cn.forEach((p) => pts.push(p))
      return pts
    },

    solvaleEmpirePoints() {
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const fDef = this.pathDefs.find((p) => p.id === 'path2')
      if (!outlineDef || !fDef) return []
      const on = extractNodes(outlineDef.d)
      const fn = extractNodes(fDef.d)
      const pts = []
      fn.forEach((p) => pts.push(p))
      for (let i = 19; i <= 52; i++) {
        if (on[i]) pts.push(on[i])
      }
      return pts
    },

    aranwaldPoints() {
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const dDef = this.pathDefs.find((p) => p.id === 'path7')
      const eDef = this.pathDefs.find((p) => p.id === 'path8')
      const fDef = this.pathDefs.find((p) => p.id === 'path2')
      if (!outlineDef || !dDef || !eDef || !fDef) return []
      const on = extractNodes(outlineDef.d)
      const dn = extractNodes(dDef.d)
      const en = extractNodes(eDef.d)
      const fn = extractNodes(fDef.d)
      const pts = []
      dn.forEach((p) => pts.push(p))
      en.forEach((p) => pts.push(p))
      for (let i = 15; i <= 19; i++) {
        if (on[i]) pts.push(on[i])
      }
      fn.forEach((p) => pts.push(p))
      for (let i = 52; i <= 58; i++) {
        if (on[i]) pts.push(on[i])
      }
      return pts
    },

    birindalPoints() {
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const cDef = this.pathDefs.find((p) => p.id === 'path6')
      const dDef = this.pathDefs.find((p) => p.id === 'path7')
      const eDef = this.pathDefs.find((p) => p.id === 'path8')
      if (!outlineDef || !aDef || !cDef || !dDef || !eDef) return []
      const on = extractNodes(outlineDef.d)
      const an = extractNodes(aDef.d)
      const cn = extractNodes(cDef.d)
      const dn = extractNodes(dDef.d)
      const en = extractNodes(eDef.d)
      const pts = []
      pts.push(en[0], en[1])
      dn.forEach((p) => pts.push(p))
      for (let i = 58; i <= 77; i++) {
        if (on[i]) pts.push(on[i])
      }
      for (let i = 8; i <= 14; i++) {
        if (an[i]) pts.push(an[i])
      }
      for (let i = 0; i <= 11; i++) {
        if (cn[i]) pts.push(cn[i])
      }
      return pts
    },

    torwaldPoints() {
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const bDef = this.pathDefs.find((p) => p.id === 'path5')
      const cDef = this.pathDefs.find((p) => p.id === 'path6')
      const eDef = this.pathDefs.find((p) => p.id === 'path8')
      if (!outlineDef || !aDef || !bDef || !cDef || !eDef) return []
      const on = extractNodes(outlineDef.d)
      const an = extractNodes(aDef.d)
      const bn = extractNodes(bDef.d)
      const cn = extractNodes(cDef.d)
      const en = extractNodes(eDef.d)
      const pts = []
      for (let i = 0; i <= 2; i++) {
        if (an[i]) pts.push(an[i])
      }
      cn.forEach((p) => pts.push(p))
      en.forEach((p) => pts.push(p))
      for (let i = 12; i <= 15; i++) {
        if (on[i]) pts.push(on[i])
      }
      for (let i = 7; i <= 16; i++) {
        if (bn[i]) pts.push(bn[i])
      }
      return pts
    },

    selectedRegionPoints() {
      if (this.selectedRegion === 'fynesmarch') return this.fynesmarchPoints
      if (this.selectedRegion === 'fol') return this.folPoints
      if (this.selectedRegion === 'orvath') return this.orvathPoints
      if (this.selectedRegion === 'torwald') return this.torwaldPoints
      if (this.selectedRegion === 'birindal') return this.birindalPoints
      if (this.selectedRegion === 'aranwald') return this.aranwaldPoints
      if (this.selectedRegion === 'solvale_empire')
        return this.solvaleEmpirePoints
      return []
    },

    fynesmarchPoints() {
      const on = this.outlineNodes
      const bPath = this.featurePaths.find((p) => p.id === 'path5')
      if (!bPath) return []
      const bn = bPath.nodes
      const pts = []
      for (let i = 0; i <= 11; i++) {
        if (on[i]) pts.push(on[i])
      }
      for (let i = 16; i >= 0; i--) {
        if (bn[i]) pts.push(bn[i])
      }
      const o97 = on[97],
        o98 = on[98]
      if (o97 && o98)
        pts.push({
          x: o97.x + 0.25 * (o98.x - o97.x),
          y: o97.y + 0.25 * (o98.y - o97.y),
        })
      for (let i = 98; i <= 102; i++) {
        if (on[i]) pts.push(on[i])
      }
      return pts
    },

    folPathD() {
      if (this.selectedRegion !== 'fol') return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const bDef = this.pathDefs.find((p) => p.id === 'path5')
      if (!outlineDef || !aDef || !bDef) return ''
      const os = extractSegments(outlineDef.d)
      const as_ = extractSegments(aDef.d)
      const bs = extractSegments(bDef.d)
      // Start at B0, forward to B7
      let d = `M ${_f(bs[0].x)},${_f(bs[0].y)}`
      for (let i = 1; i <= 7; i++) {
        if (bs[i]) d += ' ' + segFwd(bs[i])
      }
      // Connect to A0, forward to A14
      if (as_[0]) d += ` L ${_f(as_[0].x)},${_f(as_[0].y)}`
      for (let i = 1; i <= 14; i++) {
        if (as_[i]) d += ' ' + segFwd(as_[i])
      }
      // Connect to O78, follow outline forward to O97
      if (os[78]) d += ` L ${_f(os[78].x)},${_f(os[78].y)}`
      for (let i = 79; i <= 97; i++) {
        if (os[i]) d += ' ' + segFwd(os[i])
      }
      // Close via interpolated B0 connection point between O97 and O98
      const o97 = os[97],
        o98 = os[98]
      if (o97 && o98)
        d += ` L ${_f(o97.x + 0.25 * (o98.x - o97.x))},${_f(
          o97.y + 0.25 * (o98.y - o97.y)
        )}`
      return d + ' Z'
    },

    orvathPathD() {
      if (this.selectedRegion !== 'orvath') return ''
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const cDef = this.pathDefs.find((p) => p.id === 'path6')
      if (!aDef || !cDef) return ''
      const as_ = extractSegments(aDef.d)
      const cs = extractSegments(cDef.d)
      // Start at A2, forward to A8 (A8 ≈ C0)
      let d = `M ${_f(as_[2].x)},${_f(as_[2].y)}`
      for (let i = 3; i <= 8; i++) {
        if (as_[i]) d += ' ' + segFwd(as_[i])
      }
      // Connect to C0, forward through all of path C (C_last ≈ A2)
      if (cs[0]) d += ` L ${_f(cs[0].x)},${_f(cs[0].y)}`
      for (let i = 1; i < cs.length; i++) {
        d += ' ' + segFwd(cs[i])
      }
      return d + ' Z'
    },

    solvaleEmpirePathD() {
      if (this.selectedRegion !== 'solvale_empire') return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const fDef = this.pathDefs.find((p) => p.id === 'path2')
      if (!outlineDef || !fDef) return ''
      const os = extractSegments(outlineDef.d)
      const fs = extractSegments(fDef.d)
      // F0 forward to F4
      let d = `M ${_f(fs[0].x)},${_f(fs[0].y)}`
      for (let i = 1; i < fs.length; i++) {
        d += ' ' + segFwd(fs[i])
      }
      // F4 ≈ O52: connect, reverse O52→O19 (south coast)
      d += ` L ${_f(os[52].x)},${_f(os[52].y)}`
      for (let i = 52; i >= 20; i--) {
        d += ' ' + segRev(os[i])
      }
      // O19 ≈ F0: close
      return d + ' Z'
    },

    aranwaldPathD() {
      if (this.selectedRegion !== 'aranwald') return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const dDef = this.pathDefs.find((p) => p.id === 'path7')
      const eDef = this.pathDefs.find((p) => p.id === 'path8')
      const fDef = this.pathDefs.find((p) => p.id === 'path2')
      if (!outlineDef || !dDef || !eDef || !fDef) return ''
      const os = extractSegments(outlineDef.d)
      const ds = extractSegments(dDef.d)
      const es = extractSegments(eDef.d)
      const fs = extractSegments(fDef.d)
      // D0 forward to D2
      let d = `M ${_f(ds[0].x)},${_f(ds[0].y)}`
      for (let i = 1; i < ds.length; i++) {
        d += ' ' + segFwd(ds[i])
      }
      // D2 ≈ E1: connect, forward E2→E5
      d += ` L ${_f(es[1].x)},${_f(es[1].y)}`
      for (let i = 2; i < es.length; i++) {
        d += ' ' + segFwd(es[i])
      }
      // E5 ≈ O15: connect, forward O16→O18
      d += ` L ${_f(os[15].x)},${_f(os[15].y)}`
      for (let i = 16; i <= 19; i++) {
        if (os[i]) d += ' ' + segFwd(os[i])
      }
      // O19 ≈ F0: connect, forward F1→F4
      d += ` L ${_f(fs[0].x)},${_f(fs[0].y)}`
      for (let i = 1; i < fs.length; i++) {
        d += ' ' + segFwd(fs[i])
      }
      // F4 ≈ O52: connect, forward O53→O58
      d += ` L ${_f(os[52].x)},${_f(os[52].y)}`
      for (let i = 53; i <= 58; i++) {
        if (os[i]) d += ' ' + segFwd(os[i])
      }
      // O58 ≈ D0: close
      return d + ' Z'
    },

    birindalPathD() {
      if (this.selectedRegion !== 'birindal') return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const cDef = this.pathDefs.find((p) => p.id === 'path6')
      const dDef = this.pathDefs.find((p) => p.id === 'path7')
      const eDef = this.pathDefs.find((p) => p.id === 'path8')
      if (!outlineDef || !aDef || !cDef || !dDef || !eDef) return ''
      const os = extractSegments(outlineDef.d)
      const as_ = extractSegments(aDef.d)
      const cs = extractSegments(cDef.d)
      const ds = extractSegments(dDef.d)
      const es = extractSegments(eDef.d)
      // E0 → E1
      let d = `M ${_f(es[0].x)},${_f(es[0].y)}`
      d += ' ' + segFwd(es[1])
      // E1 ≈ D2: connect, reverse D2→D1→D0
      d += ` L ${_f(ds[ds.length - 1].x)},${_f(ds[ds.length - 1].y)}`
      for (let i = ds.length - 1; i >= 1; i--) {
        d += ' ' + segRev(ds[i])
      }
      // D0 ≈ O58: forward O58→O77
      d += ` L ${_f(os[58].x)},${_f(os[58].y)}`
      for (let i = 59; i <= 77; i++) {
        if (os[i]) d += ' ' + segFwd(os[i])
      }
      // A little beyond O77: connect to A14, reverse A14→A8
      d += ` L ${_f(as_[14].x)},${_f(as_[14].y)}`
      for (let i = 14; i >= 9; i--) {
        d += ' ' + segRev(as_[i])
      }
      // A8 ≈ C0: connect, forward C1→C11
      d += ` L ${_f(cs[0].x)},${_f(cs[0].y)}`
      for (let i = 1; i <= 11; i++) {
        if (cs[i]) d += ' ' + segFwd(cs[i])
      }
      // C11 ≈ E0: close
      return d + ' Z'
    },

    torwaldPathD() {
      if (this.selectedRegion !== 'torwald') return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const aDef = this.pathDefs.find((p) => p.id === 'path4')
      const bDef = this.pathDefs.find((p) => p.id === 'path5')
      const cDef = this.pathDefs.find((p) => p.id === 'path6')
      const eDef = this.pathDefs.find((p) => p.id === 'path8')
      if (!outlineDef || !aDef || !bDef || !cDef || !eDef) return ''
      const os = extractSegments(outlineDef.d)
      const as_ = extractSegments(aDef.d)
      const bs = extractSegments(bDef.d)
      const cs = extractSegments(cDef.d)
      const es = extractSegments(eDef.d)
      // Start at A0, forward A1→A2
      let d = `M ${_f(as_[0].x)},${_f(as_[0].y)}`
      for (let i = 1; i <= 2; i++) {
        if (as_[i]) d += ' ' + segFwd(as_[i])
      }
      // A2 ≈ C21: jump to last point of C, reverse C21→C11
      d += ` L ${_f(cs[cs.length - 1].x)},${_f(cs[cs.length - 1].y)}`
      for (let i = cs.length - 1; i >= 12; i--) {
        d += ' ' + segRev(cs[i])
      }
      // C11 ≈ E0: connect and forward E1→E5
      d += ` L ${_f(es[0].x)},${_f(es[0].y)}`
      for (let i = 1; i < es.length; i++) {
        d += ' ' + segFwd(es[i])
      }
      // E5 ≈ O15: connect and reverse O15→O12
      d += ` L ${_f(os[15].x)},${_f(os[15].y)}`
      for (let i = 15; i >= 13; i--) {
        d += ' ' + segRev(os[i])
      }
      // O12 ≈ B16: connect and reverse B16→B7 (B7 ≈ A0)
      d += ` L ${_f(bs[16].x)},${_f(bs[16].y)}`
      for (let i = 16; i >= 8; i--) {
        d += ' ' + segRev(bs[i])
      }
      return d + ' Z'
    },

    activeRegionPathD() {
      if (this.selectedRegion === 'fynesmarch') return this.fynesmarchPathD
      if (this.selectedRegion === 'fol') return this.folPathD
      if (this.selectedRegion === 'orvath') return this.orvathPathD
      if (this.selectedRegion === 'torwald') return this.torwaldPathD
      if (this.selectedRegion === 'birindal') return this.birindalPathD
      if (this.selectedRegion === 'aranwald') return this.aranwaldPathD
      if (this.selectedRegion === 'solvale_empire')
        return this.solvaleEmpirePathD
      return ''
    },

    fynesmarchPathD() {
      if (!this.showFynesmarch) return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const bDef = this.pathDefs.find((p) => p.id === 'path5')
      if (!outlineDef || !bDef) return ''
      const os = extractSegments(outlineDef.d)
      const bs = extractSegments(bDef.d)
      let d = `M ${_f(os[0].x)},${_f(os[0].y)}`
      for (let i = 1; i <= 11; i++) {
        if (os[i]) d += ' ' + segFwd(os[i])
      }
      if (bs[16]) d += ` L ${_f(bs[16].x)},${_f(bs[16].y)}`
      for (let i = 16; i >= 1; i--) {
        if (bs[i]) d += ' ' + segRev(bs[i])
      }
      const o97 = os[97],
        o98 = os[98]
      if (o97 && o98)
        d += ` L ${_f(o97.x + 0.25 * (o98.x - o97.x))},${_f(
          o97.y + 0.25 * (o98.y - o97.y)
        )}`
      for (let i = 98; i <= 102; i++) {
        if (os[i]) d += ' ' + segFwd(os[i])
      }
      return d + ' Z'
    },

    // Padded viewBox for current scene before zoom/pan.
    // Coordinates are the SVG's own viewBox space (0–336 range), not raw Inkscape path coords.
    baseViewBox() {
      let vb
      if (this.selectedRegionPoints.length > 0) {
        const [tx, ty] = (
          this.groupTransform.match(/-?[\d.]+/g) || ['0', '0']
        ).map(Number)
        const xs = this.selectedRegionPoints.map((p) => p.x + tx)
        const ys = this.selectedRegionPoints.map((p) => p.y + ty)
        const minX = Math.min(...xs),
          maxX = Math.max(...xs)
        const minY = Math.min(...ys),
          maxY = Math.max(...ys)
        vb = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
      } else {
        vb = this.viewBox
      }
      const [x, y, w, h] = vb.split(' ').map(Number)
      const px = w * 0.05,
        py = h * 0.05
      return `${(x - px).toFixed(2)} ${(y - py).toFixed(2)} ${(
        w +
        px * 2
      ).toFixed(2)} ${(h + py * 2).toFixed(2)}`
    },

    activeViewBox() {
      const [bx, by, bw, bh] = this.baseViewBox.split(' ').map(Number)
      const w = bw / this.zoomLevel
      const h = bh / this.zoomLevel
      const cx = bx + bw / 2 + this.panX
      const cy = by + bh / 2 + this.panY
      return `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(
        2
      )} ${h.toFixed(2)}`
    },

    // Grid in viewBox-space: labels are 0–336 display coordinates, not raw Inkscape path coords
    gridLines() {
      const [vx, vy, vw, vh] = this.activeViewBox.split(' ').map(Number)
      const rawStep = vw / 8
      const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
      const step = Math.ceil(rawStep / mag) * mag
      const cols = [],
        rows = []
      for (let x = Math.ceil(vx / step) * step; x <= vx + vw; x += step)
        cols.push(+x.toFixed(1))
      for (let y = Math.ceil(vy / step) * step; y <= vy + vh; y += step)
        rows.push(+y.toFixed(1))
      return { cols, rows, left: vx, right: vx + vw, top: vy, bottom: vy + vh }
    },
  },

  watch: {
    selectedRegion() {
      this.panX = 0
      this.panY = 0
      this.zoomLevel = 1
    },
  },

  methods: {
    toDisplayName(str) {
      return (str || '')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    },

    async loadMap(mapId) {
      this.loading = true
      const meta = mapsData.find((m) => m.id === mapId)
      if (!meta) {
        this.loading = false
        return
      }
      this.currentMapId = mapId

      const res = await fetch(meta.svgPath)
      const text = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'image/svg+xml')

      const svgEl = doc.querySelector('svg')
      this.viewBox = svgEl.getAttribute('viewBox') || this.viewBox
      this.groupTransform = ''

      const knownPathIds = new Set(meta.layers.map((l) => l.id))

      // Discover all Inkscape layer groups
      const inkscapeLayers = Array.from(svgEl.querySelectorAll('g')).filter(
        (g) => g.getAttribute('inkscape:groupmode') === 'layer'
      )

      const discoveredLayers = []
      const rawLayers = []
      const visibility = {}

      inkscapeLayers.forEach((g) => {
        const id = g.getAttribute('id') || ''
        const label = g.getAttribute('inkscape:label') || id
        const childPathIds = Array.from(g.querySelectorAll('path')).map((p) =>
          p.getAttribute('id')
        )
        const isKnown = childPathIds.some((pid) => knownPathIds.has(pid))
        discoveredLayers.push({ id, label, isKnown })
        if (!isKnown) rawLayers.push({ id, label, innerHTML: g.innerHTML })
        visibility[id] = true
      })

      this.pathDefs = meta.layers
        .map((layer) => {
          const el = doc.getElementById(layer.id)
          if (!el) return null
          const parent = el.parentElement
          const layerGroupId =
            parent?.getAttribute('inkscape:groupmode') === 'layer'
              ? parent.getAttribute('id') || ''
              : ''
          const svgStyle = el.getAttribute('style') || ''
          return {
            ...layer,
            d: el.getAttribute('d') || '',
            transform: '',
            showNodes: false,
            layerGroupId,
            svgStyle,
          }
        })
        .filter(Boolean)

      this.discoveredLayers = discoveredLayers
      this.rawLayers = rawLayers
      this.layerVisibility = visibility
      if (meta.milesPerUnit) this.milesPerUnit = meta.milesPerUnit
      this.loading = false
    },

    selectRegion(id) {
      this.selectedRegion = this.selectedRegion === id ? null : id
    },

    toggleFynesmarch() {
      this.showFynesmarch = !this.showFynesmarch
    },

    onMouseDown(e) {
      if (e.button !== 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const [, , vw] = this.activeViewBox.split(' ').map(Number)
      this.isDragging = true
      this.dragMoved = false
      this.dragStart = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: this.panX,
        panY: this.panY,
        scale: vw / rect.width,
        rect,
      }
    },

    onMouseMove(e) {
      if (!this.isDragging || !this.dragStart) return
      const dx = e.clientX - this.dragStart.mouseX
      const dy = e.clientY - this.dragStart.mouseY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.dragMoved = true
      this.panX = this.dragStart.panX - dx * this.dragStart.scale
      this.panY = this.dragStart.panY - dy * this.dragStart.scale
    },

    onMouseUp(e, isLeave = false) {
      if (!this.dragMoved && !isLeave) {
        if (this.placingParty) {
          const { x, y } = this.clientToSvg(e)
          this.placeMarker(x, y)
        } else if (this.pointInfoMode) {
          this.doPointInfo(e)
        } else if (this.distanceMode) {
          this.addDistancePt(e)
        }
      }
      this.isDragging = false
      this.dragStart = null
    },

    clientToSvg(e) {
      const svg = e.currentTarget
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse())
      return { x: svgPt.x, y: svgPt.y }
    },

    toggleDistanceMode() {
      this.distanceMode = !this.distanceMode
      this.distancePts = []
    },

    addDistancePt(e) {
      const { x, y } = this.clientToSvg(e)
      this.distancePts = [...this.distancePts, { x, y }]
    },

    ptLabel(i) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      return i < letters.length ? letters[i] : `P${i}`
    },

    startPlacing() {
      const active = this.parties.find((p) => p.active) ?? this.parties[0]
      this.placingPartyId = active?.id ?? null
      this.placingParty = true
    },

    placeMarker(x, y) {
      const party = this.parties.find((p) => p.id === this.placingPartyId)
      if (!party) return
      const marker = {
        id: `marker_${Date.now()}`,
        mapId: this.currentMapId,
        x,
        y,
        label: party.name,
        partyId: party.id,
        type: 'party',
      }
      this.markers = [...this.markers, marker]
      dataService.patchUserPrefs({ mapMarkers: this.markers })
      this.placingParty = false
    },

    doPointInfo(e) {
      const svg = this.$refs.mapSvg
      if (!svg) return
      const clientPt = svg.createSVGPoint()
      clientPt.x = e.clientX
      clientPt.y = e.clientY

      const results = []
      for (const path of svg.querySelectorAll('path')) {
        if (!path.id) continue
        try {
          const localPt = clientPt.matrixTransform(
            path.getScreenCTM().inverse()
          )
          if (!path.isPointInFill(localPt)) continue
          const layerLabel = this.getPathLayerLabel(path)
          const pathDef = this.pathDefs.find((d) => d.id === path.id)
          const pathLabel = pathDef
            ? this.toDisplayName(pathDef.label)
            : path.getAttribute('inkscape:label')
            ? this.toDisplayName(path.getAttribute('inkscape:label'))
            : this.toDisplayName(path.id)
          if (!results.find((r) => r.layerLabel === layerLabel))
            results.push({ pathId: path.id, layerLabel, pathLabel })
        } catch (_) {
          // path may have no fill or unsupported geometry
        }
      }

      this.pointInfoResults = results
      this.pointInfoPos = { x: e.clientX + 12, y: e.clientY + 12 }
      this.pointInfoVisible = true
    },

    getPathLayerLabel(pathEl) {
      // Walk up DOM to find a group whose id matches a known layer
      let el = pathEl.parentElement
      while (el && el.tagName.toLowerCase() !== 'svg') {
        const id = el.getAttribute('id')
        if (id) {
          const layer =
            this.rawLayers.find((l) => l.id === id) ||
            this.discoveredLayers.find((l) => l.id === id)
          if (layer) return this.toDisplayName(layer.label)
        }
        el = el.parentElement
      }
      // Fall back: use the pathDef's layerGroupId
      const pathDef = this.pathDefs.find((d) => d.id === pathEl.id)
      if (pathDef?.layerGroupId) {
        const layer = this.discoveredLayers.find(
          (l) => l.id === pathDef.layerGroupId
        )
        if (layer) return this.toDisplayName(layer.label)
      }
      return this.toDisplayName(pathEl.id)
    },

    removeMarker(id) {
      if (this.placingParty) return
      this.markers = this.markers.filter((m) => m.id !== id)
      dataService.patchUserPrefs({ mapMarkers: this.markers })
    },

    onWheel(e) {
      const delta = e.deltaY > 0 ? -0.5 : 0.5
      this.zoomLevel = Math.max(1, Math.min(8, this.zoomLevel + delta))
    },
  },
}
</script>

<style scoped>
.map-viewer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.map-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.toolbar-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}

.toolbar-sep {
  width: 1px;
  height: 1rem;
  background: var(--color-border);
}

.path-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.path-toggle input {
  cursor: pointer;
  accent-color: var(--color-accent);
}

.path-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.map-btn {
  padding: 0.15rem 0.6rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  cursor: pointer;
  font-family: var(--font-display);
}
.map-btn:hover {
  border-color: var(--color-success);
  color: var(--color-success);
}
.map-btn.active {
  border-color: var(--color-success);
  color: var(--color-success);
  background: rgba(74, 158, 107, 0.15);
}

.zoom-label {
  gap: 0.5rem;
}
.zoom-slider {
  width: 80px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.map-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.map-sidebar {
  width: 18vw;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel-dark);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
}

.sidebar-continent {
  padding: 0.75rem;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-layers {
  display: flex;
  flex-direction: column;
  padding: 0.4rem;
  gap: 0.1rem;
  border-bottom: 1px solid var(--color-border);
}

.layer-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.4rem;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  border-radius: 3px;
}

.layer-toggle:hover {
  color: var(--color-text);
}
.layer-toggle input {
  cursor: pointer;
  accent-color: var(--color-accent);
}

.sidebar-regions {
  display: flex;
  flex-direction: column;
  padding: 0.4rem;
  gap: 0.2rem;
}

.region-btn {
  text-align: left;
  padding: 0.3rem 0.6rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.region-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-border);
}

.region-btn.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.map-container {
  flex: 1;
  overflow: hidden;
  padding: 0.5rem;
}

.map-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
}

.map-svg {
  width: 100%;
  height: 100%;
  background: #1a2d4a;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  display: block;
}

.node-label {
  font-family: monospace;
  pointer-events: none;
}

.placing-select {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  padding: 0.15rem 0.5rem;
  outline: none;
}

.map-btn--place:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.party-marker {
  cursor: pointer;
}
.party-marker:hover polygon {
  fill: #f5d87a;
}

.scale-input {
  width: 4rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  padding: 1px 4px;
  text-align: right;
}
.scale-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.dist-popup {
  position: absolute;
  left: 0.5rem;
  top: 3.5rem;
  min-width: 210px;
  max-height: calc(100% - 5rem);
  overflow-y: auto;
}

.dist-seg-label {
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
}

.dist-seg-val {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.dist-total {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0.6rem;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  font-size: var(--font-size-md);
}

.dist-terrain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  gap: 0.5rem;
}

.dist-terrain-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  flex-shrink: 0;
}

.dist-terrain-select {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  padding: 1px 4px;
  flex: 1;
}
.dist-terrain-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.dist-row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.dist-time {
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  white-space: nowrap;
}

/* ── Point Info popup ── */
.point-popup {
  position: fixed;
  z-index: 200;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  min-width: 180px;
  max-width: 280px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  font-size: var(--font-size-base);
}

.point-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
}

.point-popup-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-base);
  padding: 0 0.2rem;
}
.point-popup-close:hover {
  color: var(--color-text);
}

.point-popup-empty {
  padding: 0.5rem 0.6rem;
  color: var(--color-text-low);
  font-style: italic;
}

.point-popup-row {
  padding: 0.3rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  border-bottom: 1px solid var(--color-border);
}
.point-popup-row:last-child {
  border-bottom: none;
}

.point-popup-layer {
  color: var(--color-text);
  font-weight: 500;
}

.point-popup-path {
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
}
</style>
