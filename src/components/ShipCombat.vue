<template>
  <div class="sco" v-if="hasSession && show">
    <!-- Header -->
    <div class="sco-header">
      <span class="sco-title">⚓ Ship Combat</span>
      <span class="sco-round">Round {{ round }}</span>
      <button class="sco-next-btn" @click="nextTurn" :disabled="!hasRolled">
        Next Turn ▶
      </button>
      <button class="sco-roll-all-btn" v-if="!hasRolled" @click="rollAll">
        Roll Initiative
      </button>
      <div class="sco-spacer"></div>
      <button class="sco-end-btn" @click="endCombat">End Combat</button>
      <button
        class="sco-collapse-btn"
        @click="$store.commit('TOGGLE_VEHICLE_COMBAT')"
        title="Collapse"
      >
        ▾
      </button>
    </div>

    <!-- Body -->
    <div class="sco-body">
      <!-- ── Initiative column ── -->
      <div class="sco-init-col">
        <div class="sco-init-label">Initiative</div>
        <div class="sco-init-list">
          <div
            v-for="(c, idx) in sortedCombatants"
            :key="c.id"
            class="sco-init-row"
            :class="{
              'sco-init-row--active': idx === activeIdx,
              'sco-init-row--ship': c.type === 'ship',
              'sco-init-row--npc': c.type === 'npc',
            }"
            @click="focusShip(c)"
          >
            <span
              class="sco-init-badge"
              :class="'sco-init-badge--' + (c.team || 'player')"
            >
              {{ typeGlyph(c) }}
            </span>
            <span class="sco-init-name">{{ c.name }}</span>
            <input
              type="number"
              class="sco-init-roll"
              :value="rolls[c.id]"
              @change="setRoll(c.id, $event.target.value)"
              placeholder="—"
            />
          </div>
          <div v-if="sortedCombatants.length === 0" class="sco-init-empty">
            No combatants yet.
          </div>
        </div>
      </div>

      <!-- ── Ship diagrams ── -->
      <div class="sco-ships-area">
        <div
          v-for="ship in ships"
          :key="ship.id"
          class="sco-ship-card"
          :class="[
            'sco-ship-card--' + ship.team,
            { 'sco-ship-card--focus': focusedShipId === ship.id },
            { 'sco-ship-card--active': isShipActive(ship.id) },
          ]"
        >
          <!-- Card header -->
          <div class="sco-card-head">
            <span
              class="sco-card-team-dot"
              :class="'sco-card-team-dot--' + ship.team"
            ></span>
            <span class="sco-card-name">{{ ship.name }}</span>
            <span class="sco-card-type">{{ ship.shipType }}</span>
            <button
              class="sco-card-detail-btn"
              @click="detailShip = ship"
              title="Detail view"
            >
              ⊞
            </button>
          </div>

          <!-- HP micro-bars -->
          <div class="sco-hp-strip">
            <div
              v-for="comp in hpComps(ship)"
              :key="comp.key"
              class="sco-hp-item"
            >
              <span class="sco-hp-lbl">{{ comp.label[0] }}</span>
              <div class="sco-hp-bar">
                <div
                  class="sco-hp-fill"
                  :class="hpClass(comp.pct)"
                  :style="{ width: comp.pct + '%' }"
                ></div>
              </div>
              <input
                type="number"
                class="sco-hp-inp"
                :value="ship[comp.key].current"
                min="0"
                :max="ship[comp.key].max"
                @change="setHP(ship, comp.key, $event.target.value)"
              />
            </div>
          </div>

          <!-- SVG ship diagram -->
          <div class="sco-svg-wrap" @click="focusedShipId = ship.id">
            <svg
              class="sco-ship-svg"
              :viewBox="cfg(ship).viewBox"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  :id="'sp-' + ship.id"
                  x="0"
                  y="0"
                  width="200"
                  height="13"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="200" height="7" fill="#352818" />
                  <rect y="7" width="200" height="6" fill="#2a1f10" />
                </pattern>
                <clipPath :id="'sc-' + ship.id">
                  <path :d="cfg(ship).hullInner" />
                </clipPath>
              </defs>

              <!-- Bowsprit -->
              <line
                v-if="cfg(ship).bowsprit"
                :x1="cfg(ship).bowsprit.x1"
                :y1="cfg(ship).bowsprit.y1"
                :x2="cfg(ship).bowsprit.x2"
                :y2="cfg(ship).bowsprit.y2"
                stroke="#4a3010"
                stroke-width="5"
                stroke-linecap="round"
              />

              <!-- Shrouds -->
              <line
                v-for="(s, i) in cfg(ship).shrouds"
                :key="'shr' + i"
                :x1="s.x1"
                :y1="s.y1"
                :x2="s.x2"
                :y2="s.y2"
                stroke="rgba(60,85,120,0.4)"
                stroke-width="0.8"
              />

              <!-- Hull -->
              <path
                :d="cfg(ship).hullOuter"
                fill="#100c06"
                :stroke="teamColor(ship.team)"
                stroke-width="2"
              />
              <rect
                x="-20"
                y="-20"
                width="260"
                height="420"
                :fill="'url(#sp-' + ship.id + ')'"
                :clip-path="'url(#sc-' + ship.id + ')'"
              />
              <path
                :d="cfg(ship).hullInner"
                fill="none"
                stroke="#3a2810"
                stroke-width="1.2"
                opacity="0.7"
              />

              <!-- Masts -->
              <g v-for="m in cfg(ship).masts" :key="m.id">
                <circle
                  :cx="m.cx"
                  :cy="m.cy"
                  :r="m.r"
                  fill="#0e0e1e"
                  stroke="#3a5080"
                  stroke-width="1.5"
                />
                <circle :cx="m.cx" :cy="m.cy" :r="m.r * 0.38" fill="#283050" />
              </g>

              <!-- Helm -->
              <g v-if="cfg(ship).helm">
                <circle
                  :cx="cfg(ship).helm.cx"
                  :cy="cfg(ship).helm.cy"
                  :r="cfg(ship).helm.r"
                  fill="none"
                  stroke="#7a4510"
                  stroke-width="2"
                />
                <line
                  v-for="a in helmAngles"
                  :key="a"
                  :x1="cfg(ship).helm.cx + Math.cos(a) * (cfg(ship).helm.r - 2)"
                  :y1="cfg(ship).helm.cy + Math.sin(a) * (cfg(ship).helm.r - 2)"
                  :x2="cfg(ship).helm.cx + Math.cos(a) * (cfg(ship).helm.r + 3)"
                  :y2="cfg(ship).helm.cy + Math.sin(a) * (cfg(ship).helm.r + 3)"
                  stroke="#7a4510"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <circle
                  :cx="cfg(ship).helm.cx"
                  :cy="cfg(ship).helm.cy"
                  r="2"
                  fill="#7a4510"
                />
              </g>

              <!-- Crew slots -->
              <g v-for="slot in cfg(ship).crewSlots" :key="slot.id">
                <circle
                  :cx="slot.cx"
                  :cy="slot.cy"
                  r="10"
                  :fill="slotFill(ship, slot.id)"
                  :stroke="slotStroke(ship, slot.id)"
                  stroke-dasharray="3 2"
                  stroke-width="1.4"
                />
                <text
                  v-if="crewName(ship, slot.id)"
                  :x="slot.cx"
                  :y="slot.cy"
                  fill="white"
                  font-size="6.5"
                  font-weight="bold"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-family="sans-serif"
                >
                  {{ initials(crewName(ship, slot.id)) }}
                </text>
                <title>
                  {{ slot.label
                  }}{{
                    crewName(ship, slot.id)
                      ? ' — ' + crewName(ship, slot.id)
                      : ''
                  }}
                </title>
              </g>

              <!-- Fire / Sinking overlays -->
              <ellipse
                v-if="hasCondition(ship, 'on_fire')"
                :cx="cfg(ship).cx"
                :cy="cfg(ship).vbH * 0.5"
                :rx="cfg(ship).vbW * 0.44"
                :ry="cfg(ship).vbH * 0.44"
                fill="rgba(255,80,0,0.3)"
              />
              <ellipse
                v-if="hasCondition(ship, 'sinking')"
                :cx="cfg(ship).cx"
                :cy="cfg(ship).vbH * 0.5"
                :rx="cfg(ship).vbW * 0.44"
                :ry="cfg(ship).vbH * 0.44"
                fill="rgba(30,80,200,0.28)"
              />
            </svg>
          </div>

          <!-- Conditions -->
          <div class="sco-conds">
            <span
              v-for="cond in activeConds(ship)"
              :key="cond.key"
              class="sco-cond"
              :class="'sco-cond--' + cond.cls"
            >
              {{ cond.short }}
            </span>
          </div>

          <!-- NPC crew list -->
          <div class="sco-npc-list" v-if="ship.npcs && ship.npcs.length">
            <div
              v-for="npc in ship.npcs"
              :key="npc.id"
              class="sco-npc-row"
              :class="{ 'sco-npc-row--active': isNpcActive(ship.id, npc.id) }"
            >
              <span
                class="sco-npc-dot"
                :class="'sco-npc-dot--' + ship.team"
              ></span>
              <span class="sco-npc-name">{{ npc.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ShipDetailModal -->
    <ShipDetailModal
      v-if="detailShip"
      :ship="liveShip(detailShip.id)"
      @close="detailShip = null"
    />
  </div>
</template>

<script>
import { CONFIGS } from '@/utils/shipConfigs.js'
import ShipDetailModal from './ShipDetailModal.vue'
import { dnd } from '@/utils/dnd_utils.js'

const CONDITIONS = [
  { key: 'on_fire', short: 'Fire', cls: 'fire' },
  { key: 'sinking', short: 'Sink', cls: 'sink' },
  { key: 'grappled', short: 'Grpl', cls: 'grapple' },
  { key: 'grounded', short: 'Grnd', cls: 'ground' },
]

const HP_COMPS = [
  { key: 'hull', label: 'Hull' },
  { key: 'sails', label: 'Sails' },
  { key: 'helm', label: 'Helm' },
]

const PERSON_COLORS = [
  '#7a78d0',
  '#d07a78',
  '#78d094',
  '#d0b878',
  '#78c8d0',
  '#d078bc',
  '#a0d078',
  '#9878d0',
]

const TEAM_COLORS = {
  friendly: '#8888dd',
  neutral: '#777777',
  enemy: '#cc4444',
}

export default {
  name: 'ShipCombat',
  components: { ShipDetailModal },

  data() {
    return {
      round: 1,
      activeIdx: 0,
      rolls: {},
      focusedShipId: null,
      detailShip: null,
    }
  },

  computed: {
    show() {
      return this.$store.state.showVehicleCombat
    },
    hasSession() {
      return !!this.$store.state.vehicleCombatSession
    },
    session() {
      return this.$store.state.vehicleCombatSession
    },
    ships() {
      return this.session?.ships ?? []
    },

    players() {
      const chars = this.$store.state.characters ?? []
      const partyItems = this.$store.state.party_items ?? []
      return (this.$store.state.selectedPlayers ?? []).map((name) => {
        const char = chars.find((c) => c.name === name)
        return {
          id: 'player_' + name,
          name,
          type: 'player',
          team: null,
          mod: char ? dnd.initiative(char, partyItems) : 0,
          shipId: null,
        }
      })
    },

    shipCombatants() {
      return this.ships.map((s) => ({
        id: 'ship_' + s.id,
        name: s.name,
        type: 'ship',
        team: s.team,
        mod: 0,
        shipId: s.id,
      }))
    },

    npcCombatants() {
      const list = []
      for (const s of this.ships) {
        for (const npc of s.npcs ?? []) {
          list.push({
            id: 'npc_' + s.id + '_' + npc.id,
            name: npc.name,
            type: 'npc',
            team: s.team,
            mod: npc.initMod ?? 0,
            shipId: s.id,
            npcId: npc.id,
          })
        }
      }
      return list
    },

    allCombatants() {
      return [...this.players, ...this.shipCombatants, ...this.npcCombatants]
    },

    sortedCombatants() {
      return [...this.allCombatants].sort((a, b) => {
        const ra = this.rolls[a.id] ?? -999
        const rb = this.rolls[b.id] ?? -999
        return rb - ra
      })
    },

    hasRolled() {
      return this.allCombatants.some((c) => this.rolls[c.id] !== undefined)
    },

    helmAngles() {
      return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4)
    },
  },

  mounted() {
    this.$nextTick(() => {
      if (this.ships.length && !this.focusedShipId) {
        this.focusedShipId = this.ships[0]?.id ?? null
      }
      if (!this.hasRolled && this.allCombatants.length > 0) {
        this.rollAll()
      }
    })
  },

  watch: {
    hasSession(val) {
      if (val && !this.hasRolled) {
        this.$nextTick(() => this.rollAll())
      }
    },
  },

  methods: {
    cfg(ship) {
      return CONFIGS[ship.shipType] ?? CONFIGS['Sailing Ship']
    },

    teamColor(team) {
      return TEAM_COLORS[team] ?? '#8888dd'
    },

    liveShip(id) {
      return this.ships.find((s) => s.id === id) ?? this.detailShip
    },

    hpComps(ship) {
      return HP_COMPS.filter((c) => ship[c.key]?.max > 0).map((c) => {
        const { current, max } = ship[c.key]
        const pct =
          max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
        return { ...c, pct }
      })
    },

    hpClass(pct) {
      if (pct <= 0) return 'sco-hp-fill--zero'
      if (pct <= 25) return 'sco-hp-fill--crit'
      if (pct <= 50) return 'sco-hp-fill--low'
      return 'sco-hp-fill--good'
    },

    setHP(ship, key, raw) {
      const val = Math.max(0, Math.min(ship[key].max, parseInt(raw, 10) || 0))
      this.$store.commit('PATCH_VEHICLE_SHIP', {
        id: ship.id,
        [key]: { ...ship[key], current: val },
      })
    },

    hasCondition(ship, key) {
      return (ship.conditions ?? []).includes(key)
    },

    activeConds(ship) {
      return CONDITIONS.filter((c) => this.hasCondition(ship, c.key))
    },

    crewName(ship, slotId) {
      if (ship.crewSlots?.[slotId]) return ship.crewSlots[slotId]
      return (ship.npcs ?? []).find((n) => n.slotId === slotId)?.name ?? null
    },

    isNpcSlot(ship, slotId) {
      return (
        !ship.crewSlots?.[slotId] &&
        (ship.npcs ?? []).some((n) => n.slotId === slotId)
      )
    },

    personColor(name) {
      const idx = (this.$store.state.selectedPlayers ?? []).indexOf(name)
      return PERSON_COLORS[(idx < 0 ? 0 : idx) % PERSON_COLORS.length]
    },

    slotFill(ship, slotId) {
      const name = this.crewName(ship, slotId)
      if (!name) return 'rgba(20,35,60,0.5)'
      return this.isNpcSlot(ship, slotId)
        ? 'rgba(180,130,50,0.85)'
        : this.personColor(name)
    },

    slotStroke(ship, slotId) {
      const name = this.crewName(ship, slotId)
      if (!name) return 'rgba(80,150,200,0.55)'
      return this.isNpcSlot(ship, slotId)
        ? 'rgba(255,210,90,0.6)'
        : 'rgba(255,255,255,0.4)'
    },

    initials(name) {
      return (name ?? '')
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    },

    typeGlyph(c) {
      if (c.type === 'ship') return '⚓'
      if (c.type === 'npc') return '•'
      return '◆'
    },

    setRoll(id, raw) {
      const val = parseInt(raw, 10)
      if (!isNaN(val)) this.$set(this.rolls, id, val)
    },

    rollAll() {
      const newRolls = {}
      for (const c of this.allCombatants) {
        newRolls[c.id] = Math.floor(Math.random() * 20) + 1 + (c.mod ?? 0)
      }
      this.rolls = newRolls
      this.activeIdx = 0
    },

    nextTurn() {
      const len = this.sortedCombatants.length
      if (!len) return
      this.activeIdx = (this.activeIdx + 1) % len
      if (this.activeIdx === 0) this.round++

      const active = this.sortedCombatants[this.activeIdx]
      if (active?.shipId) this.focusedShipId = active.shipId
    },

    focusShip(c) {
      if (c.shipId) this.focusedShipId = c.shipId
    },

    isShipActive(shipId) {
      const active = this.sortedCombatants[this.activeIdx]
      return active?.shipId === shipId
    },

    isNpcActive(shipId, npcId) {
      const active = this.sortedCombatants[this.activeIdx]
      return (
        active?.type === 'npc' &&
        active?.shipId === shipId &&
        active?.npcId === npcId
      )
    },

    endCombat() {
      this.$store.commit('END_VEHICLE_COMBAT')
      this.round = 1
      this.activeIdx = 0
      this.rolls = {}
      this.focusedShipId = null
      this.detailShip = null
    },
  },
}
</script>

<style scoped>
.sco {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
}

/* Header */
.sco-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 2px solid var(--color-border);
  flex-shrink: 0;
}

.sco-title {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
}

.sco-round {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
}

.sco-spacer {
  flex: 1;
}

.sco-roll-all-btn {
  padding: 0.3rem 1rem;
  background: none;
  border: 1px solid var(--color-accent);
  border-radius: 5px;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: background 0.1s;
}
.sco-roll-all-btn:hover {
  background: rgba(136, 136, 221, 0.12);
}

.sco-next-btn {
  padding: 0.3rem 1rem;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 5px;
  color: var(--color-bg);
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: background 0.1s;
}
.sco-next-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.sco-next-btn:not(:disabled):hover {
  background: var(--color-accent-strong);
}

.sco-end-btn {
  padding: 0.3rem 0.85rem;
  background: none;
  border: 1px solid var(--color-text-danger);
  border-radius: 5px;
  color: var(--color-text-danger);
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  cursor: pointer;
  transition: background 0.1s;
}
.sco-end-btn:hover {
  background: rgba(204, 68, 68, 0.1);
}

.sco-collapse-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0 0.2rem;
  line-height: 1;
  transition: color 0.1s;
}
.sco-collapse-btn:hover {
  color: var(--color-accent);
}

/* Body */
.sco-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Initiative column */
.sco-init-col {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  overflow-y: auto;
}

.sco-init-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
  padding: 0.4rem 0.65rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
}

.sco-init-list {
  display: flex;
  flex-direction: column;
  padding: 0.3rem 0;
}

.sco-init-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.1s;
}
.sco-init-row:hover {
  background: var(--color-bg-surface);
}
.sco-init-row--active {
  border-left-color: var(--color-accent);
  background: rgba(136, 136, 221, 0.08);
}
.sco-init-row--ship {
  background: rgba(10, 14, 25, 0.5);
}
.sco-init-row--npc {
  padding-left: 1.1rem;
}

.sco-init-badge {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  flex-shrink: 0;
}
.sco-init-badge--player {
  background: var(--color-accent);
  color: var(--color-bg);
}
.sco-init-badge--friendly {
  background: var(--color-accent);
  color: var(--color-bg);
}
.sco-init-badge--neutral {
  background: var(--color-text-low);
  color: var(--color-bg);
}
.sco-init-badge--enemy {
  background: var(--color-text-danger);
  color: white;
}

.sco-init-name {
  flex: 1;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sco-init-roll {
  width: 2.8rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.25rem;
  text-align: right;
  flex-shrink: 0;
}

.sco-init-empty {
  padding: 1rem 0.75rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}

/* Ships area */
.sco-ships-area {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  padding: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-start;
  background: var(--color-bg);
}

/* Ship card */
.sco-ship-card {
  flex-shrink: 0;
  width: 195px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.15s;
}
.sco-ship-card--friendly {
  border-left: 3px solid var(--color-accent);
}
.sco-ship-card--neutral {
  border-left: 3px solid var(--color-text-low);
}
.sco-ship-card--enemy {
  border-left: 3px solid var(--color-text-danger);
}
.sco-ship-card--focus {
  box-shadow: 0 0 0 2px var(--color-accent);
}
.sco-ship-card--active {
  box-shadow: 0 0 0 2px white;
}

.sco-card-head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.45rem;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sco-card-team-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sco-card-team-dot--friendly {
  background: var(--color-accent);
}
.sco-card-team-dot--neutral {
  background: var(--color-text-low);
}
.sco-card-team-dot--enemy {
  background: var(--color-text-danger);
}

.sco-card-name {
  flex: 1;
  font-family: var(--font-display, serif);
  font-size: 0.7rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sco-card-type {
  font-size: 0.58rem;
  color: var(--color-text-low);
  flex-shrink: 0;
}

.sco-card-detail-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.68rem;
  cursor: pointer;
  padding: 0.02rem 0.28rem;
  line-height: 1.4;
  flex-shrink: 0;
  transition: color 0.1s, border-color 0.1s;
}
.sco-card-detail-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* HP strip */
.sco-hp-strip {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.3rem 0.45rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sco-hp-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.sco-hp-lbl {
  font-size: 0.58rem;
  text-transform: uppercase;
  color: var(--color-text-low);
  width: 0.75rem;
  flex-shrink: 0;
}

.sco-hp-bar {
  flex: 1;
  height: 5px;
  background: var(--color-bg);
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.sco-hp-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s;
}
.sco-hp-fill--good {
  background: var(--color-success);
}
.sco-hp-fill--low {
  background: var(--color-neutral-amber);
}
.sco-hp-fill--crit {
  background: var(--color-text-danger);
}
.sco-hp-fill--zero {
  background: transparent;
}

.sco-hp-inp {
  width: 2.6rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: 0.6rem;
  padding: 0.08rem 0.2rem;
  text-align: right;
  flex-shrink: 0;
}

/* SVG */
.sco-svg-wrap {
  flex: 1;
  min-height: 0;
  background: #0a0e18;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.2rem;
  cursor: pointer;
  overflow: hidden;
}

.sco-ship-svg {
  width: 100%;
  max-height: 300px;
  height: auto;
}

/* Conditions */
.sco-conds {
  display: flex;
  gap: 0.2rem;
  padding: 0.25rem 0.45rem;
  flex-wrap: wrap;
  min-height: 1.6rem;
  flex-shrink: 0;
}

.sco-cond {
  font-size: 0.58rem;
  padding: 0.08rem 0.3rem;
  border-radius: 3px;
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
}
.sco-cond--fire {
  background: #7c2d12;
  color: #fed7aa;
}
.sco-cond--sink {
  background: #1e3a5f;
  color: #bfdbfe;
}
.sco-cond--grapple {
  background: #3b1a5a;
  color: #e9d5ff;
}
.sco-cond--ground {
  background: #3d2b0a;
  color: #fde68a;
}

/* NPC crew list */
.sco-npc-list {
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sco-npc-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.45rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  border-left: 2px solid transparent;
  transition: background 0.1s;
}
.sco-npc-row--active {
  background: rgba(136, 136, 221, 0.08);
  border-left-color: var(--color-accent);
}

.sco-npc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sco-npc-dot--friendly {
  background: var(--color-accent);
}
.sco-npc-dot--neutral {
  background: var(--color-text-low);
}
.sco-npc-dot--enemy {
  background: var(--color-text-danger);
}

.sco-npc-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
