<template>
  <div class="map-viewer">
    <div class="map-toolbar">
      <span
        class="toolbar-label"
        style="font-weight: 600; color: var(--color-text)"
        >{{ currentMapName }}</span
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
          {{ p.label }}
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
        <div class="sidebar-continent">{{ currentMapName }}</div>
        <div class="sidebar-layers">
          <label
            v-for="layer in toggleableLayers"
            :key="layer.id"
            class="layer-toggle"
          >
            <input type="checkbox" v-model="layerVisibility[layer.id]" />
            {{ layer.label }}
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
          :viewBox="activeViewBox"
          class="map-svg"
          :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
          xmlns="http://www.w3.org/2000/svg"
          @mousedown.prevent="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
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
              :d="p.d"
              :transform="p.transform || undefined"
              :style="p.svgStyle"
            />

            <!-- Raw SVG layers (text, images, etc.) injected as-is -->
            <g
              v-for="layer in rawLayers"
              :key="layer.id"
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
  </div>
</template>

<script>
import mapsData from '../data/maps.json'

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
    }
  },

  async mounted() {
    await this.loadMap('kaemahz_complete_normalized')
  },

  computed: {
    showFynesmarch() {
      return this.selectedRegion === 'fynesmarch'
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
      this.dragStart = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: this.panX,
        panY: this.panY,
        scale: vw / rect.width,
      }
    },

    onMouseMove(e) {
      if (!this.isDragging || !this.dragStart) return
      const dx = (e.clientX - this.dragStart.mouseX) * this.dragStart.scale
      const dy = (e.clientY - this.dragStart.mouseY) * this.dragStart.scale
      this.panX = this.dragStart.panX - dx
      this.panY = this.dragStart.panY - dy
    },

    onMouseUp() {
      this.isDragging = false
      this.dragStart = null
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
</style>
