<template>
  <div class="bm-overlay" ref="overlay" tabindex="-1" @keydown="handleKeyDown">
    <div class="bm-panel">

      <!-- Toolbar -->
      <div class="bm-toolbar">
        <span class="bm-title">Battle Map</span>
        <template v-if="paintMode">
          <span class="bm-hint">
            Click or drag to paint
            <strong v-if="selectedPaint === null">— erasing</strong>
            <strong v-else-if="selectedPaint === 'x'">— obstacle</strong>
            <strong v-else>— {{ selectedPaintLabel }}</strong>
          </span>
        </template>
        <template v-else>
          <span class="bm-hint" v-if="selectedKey">Moving: <strong>{{ selectedName }}</strong> — click a square to place</span>
          <span class="bm-hint" v-else>Click a token to select, then click a square to move</span>
        </template>

        <div class="bm-legend">
          <span class="bm-legend-dot" style="background:#c8a96e"></span>Player
          <span class="bm-legend-dot" style="background:#4a9e6b"></span>Friendly
          <span class="bm-legend-dot" style="background:#c9952a"></span>Neutral
          <span class="bm-legend-dot" style="background:#a05030"></span>Enemy
        </div>

        <button class="bm-btn" :class="{ 'bm-btn--active': paintMode }" @click="togglePaintMode">
          {{ paintMode ? 'Move Mode' : 'Paint Mode' }}
        </button>
        <button class="bm-btn" :class="{ 'bm-btn--active': zoneMode }" @click="toggleZoneMode">
          {{ zoneMode ? 'Move Mode' : 'Zones' }}
        </button>

        <div class="bm-zoom-row">
          <button class="bm-btn" @click="adjustZoom(-2)" :disabled="cellSize <= MIN_CELL">−</button>
          <span class="bm-zoom-label">{{ cellSize }}px</span>
          <button class="bm-btn" @click="adjustZoom(2)" :disabled="cellSize >= MAX_CELL">+</button>
        </div>
        <button class="bm-btn bm-close-btn" @click="$emit('close')">✕ Close</button>
      </div>

      <!-- Palette bar (paint mode only) -->
      <div v-if="paintMode" class="bm-palette-bar">
        <button class="bm-swatch bm-swatch-erase"
                :class="{ active: selectedPaint === null }"
                @click="selectedPaint = null"
                title="Erase">Erase</button>

        <div v-for="(group, gi) in TERRAIN_GROUPS" :key="gi" class="bm-swatch-group">
          <button v-for="t in group" :key="t.key"
                  class="bm-swatch"
                  :class="{ active: selectedPaint === t.key, 'bm-swatch-x': t.key === 'x' }"
                  :style="t.color ? { background: t.color } : {}"
                  @click="selectedPaint = t.key"
                  :title="t.label">
            <span v-if="t.key === 'x'">✕</span>
          </button>
        </div>

        <button class="bm-fill-bg-btn" @click="fillBackground" :title="selectedPaint === null ? 'Clear background fill' : 'Fill all unpainted cells with selected color'">
          Fill Background
        </button>
      </div>

      <!-- Zone palette bar -->
      <div v-if="zoneMode" class="bm-palette-bar">
        <span class="bm-hint" style="flex-shrink:0">Zone color:</span>
        <div class="bm-swatch-group">
          <button v-for="zc in ZONE_COLORS" :key="zc.key"
                  class="bm-swatch"
                  :class="{ active: selectedZoneColor === zc.key }"
                  :style="{ background: zc.color }"
                  :title="zc.label"
                  @click="selectedZoneColor = zc.key" />
        </div>

        <span class="bm-hint" style="flex-shrink:0; margin-left:0.8rem">Radius:</span>
        <div class="bm-zoom-row">
          <button class="bm-btn" @click="zoneRadius = Math.max(1, zoneRadius - 1)">−</button>
          <span class="bm-zoom-label">{{ zoneRadius }} ({{ zoneRadius * 5 }}ft)</span>
          <button class="bm-btn" @click="zoneRadius = Math.min(20, zoneRadius + 1)">+</button>
        </div>

        <button class="bm-fill-bg-btn" style="margin-left:auto" @click="clearZones">Clear All Zones</button>
      </div>

      <!-- Canvas -->
      <div class="bm-canvas-wrap" ref="wrap" @wheel.prevent="handleWheel"
           :class="{ 'bm-cursor-paint': paintMode, 'bm-cursor-zone': zoneMode }">
        <canvas ref="canvas"
                @click="handleClick"
                @mousedown="handleMouseDown"
                @mouseup="handleMouseUp"
                @mousemove="handleMouseMove"
                @mouseleave="handleMouseLeave"
                @contextmenu="handleContextMenu" />
      </div>

    </div>
  </div>
</template>

<script>
const GRID        = 90
const MAJOR       = 5
const SUPER_MAJOR = 30

const ZONE_COLORS = [
  { key: 'yellow', color: '#ffdd00', label: 'Silence / Radiant' },
  { key: 'blue',   color: '#4488ff', label: 'Cold / Water'      },
  { key: 'red',    color: '#ff4422', label: 'Fire'              },
  { key: 'green',  color: '#44cc44', label: 'Poison / Nature'   },
  { key: 'purple', color: '#aa44ff', label: 'Psychic / Necrotic'},
  { key: 'white',  color: '#ffffff', label: 'Holy / Light'      },
]

const TERRAIN_GROUPS = [
  [
    { key: 'brown1', color: '#c8a46a', label: 'Sand'         },
    { key: 'brown2', color: '#7a4e28', label: 'Earth'        },
    { key: 'brown3', color: '#3e2010', label: 'Dark earth'   },
  ],
  [
    { key: 'green1', color: '#6aaa5a', label: 'Grass'        },
    { key: 'green2', color: '#3a7030', label: 'Forest'       },
    { key: 'green3', color: '#1a3e18', label: 'Dense forest' },
  ],
  [
    { key: 'blue1',  color: '#6ab4d0', label: 'Shallow water' },
    { key: 'blue2',  color: '#2e6a96', label: 'Water'         },
    { key: 'blue3',  color: '#102040', label: 'Deep water'    },
  ],
  [
    { key: 'grey1',  color: '#a09890', label: 'Gravel'      },
    { key: 'grey2',  color: '#686060', label: 'Stone'       },
    { key: 'grey3',  color: '#302828', label: 'Dark stone'  },
  ],
  [
    { key: 'x',     color: null,       label: 'Obstacle'    },
  ],
]

const TERRAIN_PALETTE = TERRAIN_GROUPS.flat()

export default {
  name: 'BattleMap',

  props: {
    order:           { type: Array,   default: () => [] },
    combatantStates: { type: Object,  default: () => ({}) },
    visible:         { type: Boolean, default: false },
  },

  emits: ['close'],

  data() {
    return {
      positions:         {},
      selectedKey:       null,
      hoverCol:          null,
      hoverRow:          null,
      cellSize:          24,
      MIN_CELL:          8,
      MAX_CELL:          40,
      terrain:           {},
      bgFill:            null,
      paintMode:         false,
      selectedPaint:     'brown1',
      isPainting:        false,
      zoneMode:          false,
      zones:             [],
      zoneRadius:        4,
      selectedZoneColor: 'yellow',
      TERRAIN_GROUPS,
      ZONE_COLORS,
    }
  },

  computed: {
    selectedName() {
      return this.order.find((e) => e.key === this.selectedKey)?.name ?? ''
    },
    byCell() {
      const m = {}
      for (const e of this.order) {
        const p = this.positions[e.key]
        if (p) m[`${p.col},${p.row}`] = e
      }
      return m
    },
    selectedPaintLabel() {
      return TERRAIN_PALETTE.find((t) => t.key === this.selectedPaint)?.label ?? ''
    },
  },

  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => {
          this.draw()
          this.$refs.overlay?.focus()
        })
      }
    },

    order: {
      immediate: true,
      handler(entries) {
        const players = entries.filter((e) => e.type === 'player')
        const enemies  = entries.filter((e) => e.type === 'enemy')
        const pos = { ...this.positions }
        players.forEach((p, i) => { if (!pos[p.key]) pos[p.key] = { col: 52, row: 31 + i * 3 } })
        enemies.forEach((e, i) => { if (!pos[e.key]) pos[e.key] = { col: 35, row: 31 + i * 3 } })
        this.positions = pos
      },
    },
    cellSize() {
      this.$nextTick(() => { this.resizeCanvas(); this.draw() })
    },
  },

  mounted() {
    this._stopPainting = () => { this.isPainting = false }
    document.addEventListener('mouseup', this._stopPainting)

    this.resizeCanvas()
    this.draw()
    this.$nextTick(() => {
      const wrap = this.$refs.wrap
      const mid  = (GRID / 2) * this.cellSize
      wrap.scrollLeft = mid - wrap.clientWidth  / 2
      wrap.scrollTop  = mid - wrap.clientHeight / 2
      this.$refs.overlay?.focus()
    })
  },

  beforeDestroy() {
    document.removeEventListener('mouseup', this._stopPainting)
  },

  methods: {
    // ── Canvas setup ──────────────────────────────────────────

    resizeCanvas() {
      const dpr    = window.devicePixelRatio || 1
      const canvas = this.$refs.canvas
      if (!canvas) return
      const logical = GRID * this.cellSize
      canvas.width        = logical * dpr
      canvas.height       = logical * dpr
      canvas.style.width  = `${logical}px`
      canvas.style.height = `${logical}px`
      canvas.getContext('2d').scale(dpr, dpr)
    },

    // ── Drawing ───────────────────────────────────────────────

    draw() {
      const canvas = this.$refs.canvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const cs  = this.cellSize
      const sz  = GRID * cs

      // Background
      ctx.fillStyle = '#1a1612'
      ctx.fillRect(0, 0, sz, sz)

      // Background fill (applied before individual terrain cells)
      if (this.bgFill) {
        if (this.bgFill === 'x') {
          ctx.fillStyle = '#111111'
          ctx.fillRect(0, 0, sz, sz)
        } else {
          const bgEntry = TERRAIN_PALETTE.find((t) => t.key === this.bgFill)
          if (bgEntry) { ctx.fillStyle = bgEntry.color; ctx.fillRect(0, 0, sz, sz) }
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

      // Grid lines
      for (let i = 0; i <= GRID; i++) {
        const superMajor = i % SUPER_MAJOR === 0
        const major      = i % MAJOR === 0
        ctx.strokeStyle = superMajor ? '#5a4a34' : major ? '#3a2e22' : '#201c16'
        ctx.lineWidth   = superMajor ? 1.8 : major ? 0.8 : 0.4
        ctx.beginPath(); ctx.moveTo(i * cs, 0); ctx.lineTo(i * cs, sz); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i * cs); ctx.lineTo(sz, i * cs); ctx.stroke()
      }

      // X markers on top of grid lines
      ctx.lineCap     = 'round'
      ctx.strokeStyle = '#888888'
      ctx.lineWidth   = Math.max(1.5, cs * 0.1)

      // bgFill X marks (only for cells without individual terrain)
      if (this.bgFill === 'x') {
        for (let c = 0; c < GRID; c++) {
          for (let r = 0; r < GRID; r++) {
            if (this.terrain[`${c},${r}`]) continue
            const x = c * cs; const y = r * cs; const pad = cs * 0.2
            ctx.beginPath(); ctx.moveTo(x + pad, y + pad); ctx.lineTo(x + cs - pad, y + cs - pad); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(x + cs - pad, y + pad); ctx.lineTo(x + pad, y + cs - pad); ctx.stroke()
          }
        }
      }

      // Individual X cells
      for (const [cellKey, paintKey] of Object.entries(this.terrain)) {
        if (paintKey !== 'x') continue
        const [col, row] = cellKey.split(',').map(Number)
        const x = col * cs; const y = row * cs; const pad = cs * 0.2
        ctx.beginPath(); ctx.moveTo(x + pad, y + pad); ctx.lineTo(x + cs - pad, y + cs - pad); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x + cs - pad, y + pad); ctx.lineTo(x + pad, y + cs - pad); ctx.stroke()
      }
      ctx.lineCap = 'butt'

      // Spell zones
      ctx.setLineDash([5, 4])
      for (const zone of this.zones) {
        const cx = (zone.col + 0.5) * cs
        const cy = (zone.row + 0.5) * cs
        const r  = zone.radius * cs
        const zc = ZONE_COLORS.find((c) => c.key === zone.color)
        const hex = zc ? zc.color : '#ffffff'
        ctx.globalAlpha = 0.25
        ctx.fillStyle   = hex
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 0.7
        ctx.strokeStyle = hex
        ctx.lineWidth   = 1.5
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // Hover highlight
      if (this.hoverCol !== null &&
          this.hoverCol >= 0 && this.hoverCol < GRID &&
          this.hoverRow >= 0 && this.hoverRow < GRID) {
        if (this.zoneMode) {
          const cx = (this.hoverCol + 0.5) * cs
          const cy = (this.hoverRow + 0.5) * cs
          const r  = this.zoneRadius * cs
          const zc = ZONE_COLORS.find((c) => c.key === this.selectedZoneColor)
          const hex = zc ? zc.color : '#ffffff'
          ctx.setLineDash([5, 4])
          ctx.globalAlpha = 0.15
          ctx.fillStyle   = hex
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 0.5
          ctx.strokeStyle = hex
          ctx.lineWidth   = 1.5
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
          ctx.setLineDash([])
          ctx.globalAlpha = 1
        } else if (this.paintMode) {
          if (this.selectedPaint === null) {
            ctx.fillStyle = 'rgba(200,80,60,0.35)'
          } else if (this.selectedPaint === 'x') {
            ctx.fillStyle = 'rgba(180,40,40,0.4)'
          } else {
            const entry = TERRAIN_PALETTE.find((t) => t.key === this.selectedPaint)
            ctx.fillStyle = entry ? entry.color + '88' : 'rgba(255,255,255,0.2)'
          }
          ctx.fillRect(this.hoverCol * cs, this.hoverRow * cs, cs, cs)
        } else if (this.selectedKey) {
          const occupied = !!this.byCell[`${this.hoverCol},${this.hoverRow}`]
          ctx.fillStyle = occupied ? 'rgba(160,80,48,0.2)' : 'rgba(200,169,110,0.18)'
          ctx.fillRect(this.hoverCol * cs, this.hoverRow * cs, cs, cs)
        }
      }

      // Tokens
      for (const entry of this.order) {
        const pos = this.positions[entry.key]
        if (!pos) continue
        this.drawToken(ctx, entry, pos.col, pos.row, cs)
      }
    },

    drawToken(ctx, entry, col, row, cs) {
      const cx = (col + 0.5) * cs
      const cy = (row + 0.5) * cs
      const r  = Math.max(cs * 0.38, 3)
      const selected = entry.key === this.selectedKey

      if (selected) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.fillStyle = this.tokenColor(entry)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      if (cs >= 12) {
        const fontSize = Math.max(Math.round(r * 1.1), 6)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(entry.name.charAt(0).toUpperCase(), cx, cy)
      }
    },

    tokenColor(entry) {
      if (entry.type === 'player') return '#c8a96e'
      const s = this.combatantStates[entry.key]
      return s === 'friendly' ? '#4a9e6b' : s === 'neutral' ? '#c9952a' : '#a05030'
    },

    // ── Terrain painting ──────────────────────────────────────

    fillBackground() {
      this.bgFill = this.selectedPaint
      this.draw()
    },

    togglePaintMode() {
      this.paintMode = !this.paintMode
      if (this.paintMode) { this.zoneMode = false; this.selectedKey = null }
      this.hoverCol = null
      this.hoverRow = null
      this.draw()
    },

    toggleZoneMode() {
      this.zoneMode = !this.zoneMode
      if (this.zoneMode) { this.paintMode = false; this.selectedKey = null }
      this.hoverCol = null
      this.hoverRow = null
      this.draw()
    },

    placeZone(col, row) {
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) return
      const existing = this.zones.findIndex((z) => z.col === col && z.row === row)
      if (existing >= 0) {
        this.zones.splice(existing, 1)
      } else {
        this.zones.push({ id: Date.now(), col, row, radius: this.zoneRadius, color: this.selectedZoneColor })
      }
      this.draw()
    },

    clearZones() {
      this.zones = []
      this.draw()
    },

    paintCell(col, row) {
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) return
      const cellKey = `${col},${row}`
      if (this.selectedPaint === null) {
        this.$delete(this.terrain, cellKey)
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
        row: Math.floor((event.clientY - rect.top)  / this.cellSize),
      }
    },

    handleMouseDown(event) {
      if (!this.paintMode) return
      this.isPainting = true
      const { col, row } = this.gridCoords(event)
      this.paintCell(col, row)
    },

    handleContextMenu(event) {
      if (!this.zoneMode) return
      event.preventDefault()
      const { col, row } = this.gridCoords(event)
      const existing = this.zones.findIndex((z) => z.col === col && z.row === row)
      if (existing >= 0) { this.zones.splice(existing, 1); this.draw() }
    },

    handleMouseUp() {
      this.isPainting = false
    },

    handleClick(event) {
      if (this.paintMode) return
      if (this.zoneMode) {
        const { col, row } = this.gridCoords(event)
        this.placeZone(col, row)
        return
      }
      const { col, row } = this.gridCoords(event)
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) return

      const occupant = this.byCell[`${col},${row}`]
      if (occupant) {
        this.selectedKey = this.selectedKey === occupant.key ? null : occupant.key
      } else if (this.selectedKey) {
        this.$set(this.positions, this.selectedKey, { col, row })
        this.selectedKey = null
        this.hoverCol = null
        this.hoverRow = null
      }
      this.draw()
    },

    handleMouseMove(event) {
      const { col, row } = this.gridCoords(event)
      if (this.zoneMode) {
        if (col !== this.hoverCol || row !== this.hoverRow) {
          this.hoverCol = col
          this.hoverRow = row
          this.draw()
        }
        return
      }
      if (this.paintMode) {
        if (col !== this.hoverCol || row !== this.hoverRow) {
          this.hoverCol = col
          this.hoverRow = row
          this.draw()
        }
        if (this.isPainting) this.paintCell(col, row)
        return
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
      this.hoverCol   = null
      this.hoverRow   = null
      if (this.selectedKey || this.paintMode || this.zoneMode) this.draw()
    },

    handleKeyDown(event) {
      const key = event.key.toLowerCase()
      if (key === 'escape') { this.$emit('close'); return }
      const step = this.cellSize * 3
      const wrap = this.$refs.wrap
      if      (key === 'w') wrap.scrollTop  -= step
      else if (key === 's') wrap.scrollTop  += step
      else if (key === 'a') wrap.scrollLeft -= step
      else if (key === 'd') wrap.scrollLeft += step
      else return
      event.preventDefault()
    },

    handleWheel(event) {
      this.adjustZoom(event.deltaY < 0 ? 2 : -2)
    },

    adjustZoom(delta) {
      this.cellSize = Math.min(this.MAX_CELL, Math.max(this.MIN_CELL, this.cellSize + delta))
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
  display: flex;
  flex-direction: column;
  width: 92vw;
  height: 92vh;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

/* ── Toolbar ── */
.bm-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.45rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
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

.bm-hint strong { color: var(--color-accent-strong); font-weight: normal; }

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
.bm-btn:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.bm-btn:disabled { opacity: 0.3; cursor: not-allowed; }
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

.bm-swatch.active {
  border-color: #ffffff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
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
.bm-swatch-erase:hover { border-color: var(--color-text-danger); color: var(--color-text-danger); }
.bm-swatch-erase.active { border-color: var(--color-text-danger); color: var(--color-text-danger); }

.bm-swatch-x {
  background: #111111;
  border-color: #444444;
  color: #888888;
  font-size: 11px;
  line-height: 1;
}
.bm-swatch-x:hover { border-color: #888888; }
.bm-swatch-x.active { border-color: #ffffff; }

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
.bm-fill-bg-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

/* ── Canvas wrap ── */
.bm-canvas-wrap {
  flex: 1;
  overflow: auto;
  cursor: crosshair;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
  background: #1a1612;
}

.bm-canvas-wrap.bm-cursor-paint { cursor: cell; }
.bm-canvas-wrap.bm-cursor-zone  { cursor: crosshair; }

.bm-canvas-wrap::-webkit-scrollbar { width: 6px; height: 6px; }
.bm-canvas-wrap::-webkit-scrollbar-track { background: transparent; }
.bm-canvas-wrap::-webkit-scrollbar-thumb { background: var(--color-scrollbar); border-radius: 3px; }
</style>
