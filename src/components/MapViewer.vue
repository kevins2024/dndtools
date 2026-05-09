<template>
  <div class="map-viewer">
    <div class="map-toolbar">
      <!-- Region buttons — always visible -->
      <button class="map-btn" :class="{ active: showLymesmarch }" @click="toggleLymesmarch">
        Lymesmarch
      </button>

      <span class="toolbar-sep"></span>

      <!-- Zoom — always visible -->
      <label class="path-toggle zoom-label">
        Zoom
        <input type="range" min="1" max="8" step="0.5" v-model.number="zoomLevel" class="zoom-slider" />
        {{ zoomLevel }}x
      </label>

      <span class="toolbar-sep"></span>

      <!-- Edit mode toggle -->
      <button class="map-btn" :class="{ active: editMode }" @click="editMode = !editMode">
        Edit
      </button>

      <!-- Edit-mode controls -->
      <template v-if="editMode">
        <span class="toolbar-sep"></span>
        <span class="toolbar-label">Nodes:</span>
        <label v-for="p in pathDefs.filter(p => !p.isOutline)" :key="p.id" class="path-toggle">
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
        <g :transform="groupTransform">
          <!-- Region outline -->
          <path
            v-if="showLymesmarch && lymesmarchPathD"
            :d="lymesmarchPathD"
            fill="none"
            stroke="#4a9e6b"
            stroke-width="0.8"
            stroke-dasharray="3,1.5"
          />

          <!-- All paths -->
          <path
            v-for="p in pathDefs"
            :key="p.id"
            :d="p.d"
            fill="none"
            :stroke="p.color"
            :stroke-width="p.strokeWidth"
          />

          <!-- Edit mode: outline nodes -->
          <g v-if="editMode && showOutline">
            <g v-for="(node, i) in outlineNodes" :key="'o-' + i">
              <circle :cx="node.x" :cy="node.y" r="1" fill="#888" stroke="white" stroke-width="0.2" />
              <text v-if="showLabels" :x="node.x + 0.8" :y="node.y - 0.8" class="node-label" font-size="2" fill="#ccc" stroke="black" stroke-width="0.4" paint-order="stroke">O{{ i }}</text>
            </g>
          </g>

          <!-- Edit mode: feature path nodes -->
          <template v-if="editMode">
            <g v-for="p in featurePaths" :key="p.id + '-nodes'">
              <template v-if="p.showNodes">
                <g v-for="(node, i) in p.nodes" :key="i">
                  <circle :cx="node.x" :cy="node.y" r="1.8" :fill="p.color" stroke="white" stroke-width="0.35" />
                  <text v-if="showLabels" :x="node.x + 1.2" :y="node.y - 1.2" class="node-label" font-size="2.5" fill="white" stroke="black" stroke-width="0.5" paint-order="stroke">{{ p.prefix }}{{ i }}</text>
                </g>
              </template>
            </g>
          </template>
        </g>

        <!-- Edit mode: grid in viewBox-space (no transform — labels are display coords 0–336) -->
        <template v-if="editMode && showGrid">
          <line
            v-for="x in gridLines.cols" :key="'gc' + x"
            :x1="x" :y1="gridLines.top" :x2="x" :y2="gridLines.bottom"
            stroke="rgba(200,200,200,0.2)" stroke-width="0.4"
          />
          <text
            v-for="x in gridLines.cols" :key="'gct' + x"
            :x="x + 1" :y="gridLines.top + 7"
            font-size="5" fill="rgba(200,200,200,0.55)" font-family="monospace"
          >{{ Math.round(x) }}</text>
          <line
            v-for="y in gridLines.rows" :key="'gr' + y"
            :x1="gridLines.left" :y1="y" :x2="gridLines.right" :y2="y"
            stroke="rgba(200,200,200,0.2)" stroke-width="0.4"
          />
          <text
            v-for="y in gridLines.rows" :key="'grt' + y"
            :x="gridLines.left + 1" :y="y - 1"
            font-size="5" fill="rgba(200,200,200,0.55)" font-family="monospace"
          >{{ Math.round(y) }}</text>
        </template>
      </svg>
    </div>
  </div>
</template>

<script>
import mapsData from '../data/maps.json'

// ── SVG path parsers ─────────────────────────────────────────────────────────

function parseNums(str) {
  return (str.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number)
}

function extractNodes(d) {
  const nodes = []
  let cx = 0, cy = 0
  const re = /([MmLlCcHhVvZz])([^MmLlCcHhVvZz]*)/g
  let m
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]; const nums = parseNums(m[2]); let i = 0
    if (cmd === 'M') { while (i < nums.length) { cx = nums[i]; cy = nums[i+1]; i += 2; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'm') { cx += nums[0]; cy += nums[1]; i = 2; nodes.push({ x: cx, y: cy }); while (i < nums.length) { cx += nums[i]; cy += nums[i+1]; i += 2; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'L') { while (i < nums.length) { cx = nums[i]; cy = nums[i+1]; i += 2; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'l') { while (i < nums.length) { cx += nums[i]; cy += nums[i+1]; i += 2; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'C') { while (i < nums.length) { i += 4; cx = nums[i]; cy = nums[i+1]; i += 2; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'c') { while (i < nums.length) { i += 4; cx += nums[i]; cy += nums[i+1]; i += 2; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'H') { while (i < nums.length) { cx = nums[i]; i++; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'h') { while (i < nums.length) { cx += nums[i]; i++; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'V') { while (i < nums.length) { cy = nums[i]; i++; nodes.push({ x: cx, y: cy }) } }
    else if (cmd === 'v') { while (i < nums.length) { cy += nums[i]; i++; nodes.push({ x: cx, y: cy }) } }
  }
  return nodes
}

function extractSegments(d) {
  const segs = []
  let cx = 0, cy = 0
  const re = /([MmLlCcHhVvZz])([^MmLlCcHhVvZz]*)/g
  let m
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1]; const nums = parseNums(m[2]); let i = 0
    if (cmd === 'M') { while (i < nums.length) { const fx = cx, fy = cy; cx = nums[i]; cy = nums[i+1]; i += 2; segs.push({ type: 'M', fx, fy, x: cx, y: cy }) } }
    else if (cmd === 'm') { let first = true; while (i < nums.length) { const fx = cx, fy = cy; cx += nums[i]; cy += nums[i+1]; i += 2; segs.push({ type: first ? 'M' : 'L', fx, fy, x: cx, y: cy }); first = false } }
    else if (cmd === 'L') { while (i < nums.length) { const fx = cx, fy = cy; cx = nums[i]; cy = nums[i+1]; i += 2; segs.push({ type: 'L', fx, fy, x: cx, y: cy }) } }
    else if (cmd === 'l') { while (i < nums.length) { const fx = cx, fy = cy; cx += nums[i]; cy += nums[i+1]; i += 2; segs.push({ type: 'L', fx, fy, x: cx, y: cy }) } }
    else if (cmd === 'C') { while (i < nums.length) { const fx = cx, fy = cy; const x1 = nums[i], y1 = nums[i+1], x2 = nums[i+2], y2 = nums[i+3]; cx = nums[i+4]; cy = nums[i+5]; i += 6; segs.push({ type: 'C', fx, fy, x: cx, y: cy, x1, y1, x2, y2 }) } }
    else if (cmd === 'c') { while (i < nums.length) { const fx = cx, fy = cy; const x1 = cx+nums[i], y1 = cy+nums[i+1], x2 = cx+nums[i+2], y2 = cy+nums[i+3]; cx += nums[i+4]; cy += nums[i+5]; i += 6; segs.push({ type: 'C', fx, fy, x: cx, y: cy, x1, y1, x2, y2 }) } }
    else if (cmd === 'H') { while (i < nums.length) { const fx = cx, fy = cy; cx = nums[i]; i++; segs.push({ type: 'L', fx, fy, x: cx, y: cy }) } }
    else if (cmd === 'h') { while (i < nums.length) { const fx = cx, fy = cy; cx += nums[i]; i++; segs.push({ type: 'L', fx, fy, x: cx, y: cy }) } }
    else if (cmd === 'V') { while (i < nums.length) { const fx = cx, fy = cy; cy = nums[i]; i++; segs.push({ type: 'L', fx, fy, x: cx, y: cy }) } }
    else if (cmd === 'v') { while (i < nums.length) { const fx = cx, fy = cy; cy += nums[i]; i++; segs.push({ type: 'L', fx, fy, x: cx, y: cy }) } }
  }
  return segs
}

const _f = (n) => n.toFixed(3)
function segFwd(s) {
  if (s.type === 'C') return `C ${_f(s.x1)},${_f(s.y1)} ${_f(s.x2)},${_f(s.y2)} ${_f(s.x)},${_f(s.y)}`
  return `L ${_f(s.x)},${_f(s.y)}`
}
function segRev(s) {
  if (s.type === 'C') return `C ${_f(s.x2)},${_f(s.y2)} ${_f(s.x1)},${_f(s.y1)} ${_f(s.fx)},${_f(s.fy)}`
  return `L ${_f(s.fx)},${_f(s.fy)}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default {
  name: 'MapViewer',

  data() {
    return {
      viewBox: '0 0 336.72092 313.7638',
      groupTransform: '',
      loading: true,
      pathDefs: [],
      showLabels: true,
      showOutline: false,
      showLymesmarch: false,
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
    await this.loadMap('lymesmarch_base')
  },

  computed: {
    outlineNodes() {
      const outline = this.pathDefs.find((p) => p.isOutline)
      return outline ? extractNodes(outline.d) : []
    },

    featurePaths() {
      return this.pathDefs
        .filter((p) => !p.isOutline)
        .map((p) => ({ ...p, nodes: extractNodes(p.d) }))
    },

    lymesmarchPoints() {
      const on = this.outlineNodes
      const bPath = this.featurePaths.find((p) => p.id === 'path5')
      if (!bPath) return []
      const bn = bPath.nodes
      const pts = []
      for (let i = 0; i <= 11; i++) { if (on[i]) pts.push(on[i]) }
      for (let i = 16; i >= 0; i--) { if (bn[i]) pts.push(bn[i]) }
      const o97 = on[97], o98 = on[98]
      if (o97 && o98) pts.push({ x: o97.x + 0.25 * (o98.x - o97.x), y: o97.y + 0.25 * (o98.y - o97.y) })
      for (let i = 98; i <= 102; i++) { if (on[i]) pts.push(on[i]) }
      return pts
    },

    lymesmarchPathD() {
      if (!this.showLymesmarch) return ''
      const outlineDef = this.pathDefs.find((p) => p.isOutline)
      const bDef = this.pathDefs.find((p) => p.id === 'path5')
      if (!outlineDef || !bDef) return ''
      const os = extractSegments(outlineDef.d)
      const bs = extractSegments(bDef.d)
      let d = `M ${_f(os[0].x)},${_f(os[0].y)}`
      for (let i = 1; i <= 11; i++) { if (os[i]) d += ' ' + segFwd(os[i]) }
      if (bs[16]) d += ` L ${_f(bs[16].x)},${_f(bs[16].y)}`
      for (let i = 16; i >= 1; i--) { if (bs[i]) d += ' ' + segRev(bs[i]) }
      const o97 = os[97], o98 = os[98]
      if (o97 && o98) d += ` L ${_f(o97.x + 0.25 * (o98.x - o97.x))},${_f(o97.y + 0.25 * (o98.y - o97.y))}`
      for (let i = 98; i <= 102; i++) { if (os[i]) d += ' ' + segFwd(os[i]) }
      return d + ' Z'
    },

    // Padded viewBox for current scene before zoom/pan.
    // Coordinates are the SVG's own viewBox space (0–336 range), not raw Inkscape path coords.
    baseViewBox() {
      let vb
      if (this.showLymesmarch && this.lymesmarchPoints.length > 0) {
        // Convert path-space points to viewBox space using the group transform offset
        const [tx, ty] = (this.groupTransform.match(/-?[\d.]+/g) || ['0','0']).map(Number)
        const xs = this.lymesmarchPoints.map((p) => p.x + tx)
        const ys = this.lymesmarchPoints.map((p) => p.y + ty)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        vb = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
      } else {
        vb = this.viewBox
      }
      const [x, y, w, h] = vb.split(' ').map(Number)
      const px = w * 0.05, py = h * 0.05
      return `${(x - px).toFixed(2)} ${(y - py).toFixed(2)} ${(w + px * 2).toFixed(2)} ${(h + py * 2).toFixed(2)}`
    },

    activeViewBox() {
      const [bx, by, bw, bh] = this.baseViewBox.split(' ').map(Number)
      const w = bw / this.zoomLevel
      const h = bh / this.zoomLevel
      const cx = bx + bw / 2 + this.panX
      const cy = by + bh / 2 + this.panY
      return `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`
    },

    // Grid in viewBox-space: labels are 0–336 display coordinates, not raw Inkscape path coords
    gridLines() {
      const [vx, vy, vw, vh] = this.activeViewBox.split(' ').map(Number)
      const rawStep = vw / 8
      const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
      const step = Math.ceil(rawStep / mag) * mag
      const cols = [], rows = []
      for (let x = Math.ceil(vx / step) * step; x <= vx + vw; x += step) cols.push(+x.toFixed(1))
      for (let y = Math.ceil(vy / step) * step; y <= vy + vh; y += step) rows.push(+y.toFixed(1))
      return { cols, rows, left: vx, right: vx + vw, top: vy, bottom: vy + vh }
    },
  },

  watch: {
    showLymesmarch() {
      this.panX = 0
      this.panY = 0
      this.zoomLevel = 1
    },
  },

  methods: {
    async loadMap(mapId) {
      this.loading = true
      const meta = mapsData.find((m) => m.id === mapId)
      if (!meta) { this.loading = false; return }

      const res = await fetch(meta.svgPath)
      const text = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'image/svg+xml')

      const svgEl = doc.querySelector('svg')
      this.viewBox = svgEl.getAttribute('viewBox') || this.viewBox

      const layerG = svgEl.querySelector('g')
      this.groupTransform = layerG?.getAttribute('transform') || ''

      this.pathDefs = meta.layers
        .map((layer) => {
          const el = doc.getElementById(layer.id)
          if (!el) return null
          return { ...layer, d: el.getAttribute('d') || '', showNodes: !layer.isOutline }
        })
        .filter(Boolean)

      this.loading = false
    },

    toggleLymesmarch() {
      this.showLymesmarch = !this.showLymesmarch
    },

    onMouseDown(e) {
      if (e.button !== 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const [,, vw] = this.activeViewBox.split(' ').map(Number)
      this.isDragging = true
      this.dragStart = {
        mouseX: e.clientX, mouseY: e.clientY,
        panX: this.panX, panY: this.panY,
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
  font-size: var(--font-size-tiny);
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
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.path-toggle input { cursor: pointer; accent-color: var(--color-accent); }

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
  font-size: var(--font-size-tiny);
  cursor: pointer;
  font-family: var(--font-display);
}
.map-btn:hover { border-color: #4a9e6b; color: #4a9e6b; }
.map-btn.active { border-color: #4a9e6b; color: #4a9e6b; background: rgba(74, 158, 107, 0.15); }

.zoom-label { gap: 0.5rem; }
.zoom-slider { width: 80px; accent-color: var(--color-accent); cursor: pointer; }

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
  font-size: var(--font-size-small);
}

.map-svg {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  display: block;
}

.node-label {
  font-family: monospace;
  pointer-events: none;
}
</style>
