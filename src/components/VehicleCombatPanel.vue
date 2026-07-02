<template>
  <div class="vcp" v-if="hasSession" :class="{ 'vcp--collapsed': !show }">
    <!-- Header -->
    <div class="vcp-header">
      <span class="vcp-title">⚓ Vehicle Combat</span>
      <button class="vcp-end-btn" @click="$store.commit('END_VEHICLE_COMBAT')">
        End Combat
      </button>
      <button
        class="vcp-close-btn"
        @click="$store.commit('TOGGLE_VEHICLE_COMBAT')"
        :title="show ? 'Collapse' : 'Expand'"
      >
        {{ show ? '▾' : '▴' }}
      </button>
    </div>

    <!-- Ship cards row -->
    <div class="vcp-cards" v-if="ships.length">
      <div
        v-for="ship in ships"
        :key="ship.id"
        class="ship-card"
        :class="'ship-card--' + ship.team"
      >
        <!-- Card header -->
        <div class="sc-head">
          <span class="sc-name">{{ ship.name }}</span>
          <span class="sc-type">{{ ship.shipType }}</span>
          <span class="sc-team-dot" :class="'sc-team-dot--' + ship.team"></span>
          <button
            class="sc-detail-btn"
            @click="detailShip = ship"
            title="Ship diagram"
          >
            ⊞
          </button>
        </div>

        <!-- HP bars -->
        <div class="sc-comps">
          <div
            v-for="comp in shipComps(ship)"
            :key="comp.key"
            class="sc-comp-row"
          >
            <span class="sc-comp-lbl">{{ comp.label }}</span>
            <div class="sc-hp-track">
              <div
                class="sc-hp-fill"
                :class="hpClass(comp.pct)"
                :style="{ width: (comp.pct === 0 ? 100 : comp.pct) + '%' }"
              ></div>
            </div>
            <input
              type="number"
              class="sc-hp-inp"
              :value="ship[comp.key].current"
              min="0"
              :max="ship[comp.key].max"
              @change="setHP(ship, comp.key, $event.target.value)"
            />
            <span class="sc-hp-max">/ {{ ship[comp.key].max }}</span>
          </div>
        </div>

        <!-- Conditions -->
        <div class="sc-conds">
          <button
            v-for="cond in CONDITIONS"
            :key="cond.key"
            class="sc-cond"
            :class="[
              'sc-cond--' + cond.cls,
              { 'sc-cond--on': isCondActive(ship, cond.key) },
            ]"
            @click="toggleCond(ship, cond.key)"
            :title="cond.label"
          >
            {{ cond.short }}
          </button>
        </div>

        <!-- Weapons -->
        <div class="sc-weapons" v-if="ship.weapons && ship.weapons.length">
          <div
            v-for="(wpn, wi) in ship.weapons"
            :key="wi"
            class="sc-wpn"
            :class="{ 'sc-wpn--dry': wpn.ammo === 0 }"
          >
            <span class="sc-wpn-name">{{ wpn.name }} ×{{ wpn.count }}</span>
            <input
              type="number"
              class="sc-wpn-ammo"
              :value="wpn.ammo"
              min="0"
              @change="setAmmo(ship, wi, $event.target.value)"
            />
          </div>
        </div>

        <!-- Position tag -->
        <div class="sc-pos" v-if="ship.position">
          {{ facingArrow(ship.facing) }} {{ ship.facing }}
        </div>
      </div>
    </div>

    <div v-else class="vcp-empty">No ships in this session.</div>

    <ShipDetailModal
      v-if="detailShip"
      :ship="liveShip(detailShip.id)"
      @close="detailShip = null"
    />
  </div>
</template>

<script>
import ShipDetailModal from './ShipDetailModal.vue'

const CONDITIONS = [
  { key: 'on_fire', short: 'Fire', label: 'On Fire', cls: 'fire' },
  { key: 'sinking', short: 'Sink', label: 'Sinking', cls: 'sink' },
  { key: 'grappled', short: 'Grpl', label: 'Grappled', cls: 'grapple' },
  { key: 'grounded', short: 'Grnd', label: 'Grounded', cls: 'ground' },
]

const COMPS = [
  { key: 'hull', label: 'Hull' },
  { key: 'sails', label: 'Sails' },
  { key: 'helm', label: 'Helm' },
]

const FACING_ARROWS = { N: '↑', E: '→', S: '↓', W: '←' }

export default {
  name: 'VehicleCombatPanel',
  components: { ShipDetailModal },

  data() {
    return { CONDITIONS, detailShip: null }
  },

  computed: {
    show() {
      return this.$store.state.showVehicleCombat
    },
    hasSession() {
      return !!this.$store.state.vehicleCombatSession
    },
    ships() {
      return this.$store.state.vehicleCombatSession?.ships ?? []
    },
  },

  methods: {
    liveShip(id) {
      return this.ships.find((s) => s.id === id) ?? this.detailShip
    },

    shipComps(ship) {
      return COMPS.filter((c) => ship[c.key] && ship[c.key].max > 0).map(
        (c) => {
          const { current, max } = ship[c.key]
          const pct =
            max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
          return { ...c, pct }
        }
      )
    },

    isCondActive(ship, key) {
      return (ship.conditions ?? []).includes(key)
    },

    setHP(ship, key, raw) {
      const val = Math.max(0, Math.min(ship[key].max, parseInt(raw, 10) || 0))
      this.$store.commit('PATCH_VEHICLE_SHIP', {
        id: ship.id,
        [key]: { ...ship[key], current: val },
      })
    },

    setAmmo(ship, wi, raw) {
      const val = Math.max(0, parseInt(raw, 10) || 0)
      const weapons = (ship.weapons ?? []).map((w, i) =>
        i === wi ? { ...w, ammo: val } : w
      )
      this.$store.commit('PATCH_VEHICLE_SHIP', { id: ship.id, weapons })
    },

    toggleCond(ship, key) {
      const conds = [...(ship.conditions ?? [])]
      const idx = conds.indexOf(key)
      if (idx === -1) conds.push(key)
      else conds.splice(idx, 1)
      this.$store.commit('PATCH_VEHICLE_SHIP', {
        id: ship.id,
        conditions: conds,
      })
    },

    hpClass(pct) {
      if (pct === 0) return 'sc-hp-fill--zero'
      if (pct <= 25) return 'sc-hp-fill--crit'
      if (pct <= 50) return 'sc-hp-fill--low'
      return 'sc-hp-fill--good'
    },

    facingArrow(f) {
      return FACING_ARROWS[f] ?? '→'
    },
  },
}
</script>

<style scoped>
.vcp {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 260px;
  transition: height 0.2s ease;
}

.vcp--collapsed {
  height: 36px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  border-top: 2px solid var(--color-border);
  background: var(--color-bg-panel);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.vcp-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-bg-surface);
}

.vcp-title {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
  flex: 1;
}

.vcp-end-btn {
  padding: 0.15rem 0.65rem;
  background: none;
  border: 1px solid var(--color-text-danger);
  border-radius: 4px;
  color: var(--color-text-danger);
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  cursor: pointer;
  transition: background 0.1s;
}
.vcp-end-btn:hover {
  background: rgba(220, 80, 80, 0.12);
}

.vcp-close-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: color 0.1s;
}
.vcp-close-btn:hover {
  color: var(--color-accent);
}

/* Cards */
.vcp-cards {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  align-items: flex-start;
}

.vcp-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}

/* Ship card */
.ship-card {
  flex-shrink: 0;
  width: 260px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ship-card--friendly {
  border-left: 3px solid var(--color-accent);
}
.ship-card--neutral {
  border-left: 3px solid var(--color-text-low);
}
.ship-card--enemy {
  border-left: 3px solid var(--color-text-danger);
}

.sc-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}

.sc-name {
  font-family: var(--font-display, serif);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
}

.sc-team-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sc-team-dot--friendly {
  background: var(--color-accent);
}
.sc-team-dot--neutral {
  background: var(--color-text-low);
}
.sc-team-dot--enemy {
  background: var(--color-text-danger);
}

.sc-detail-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.05rem 0.3rem;
  line-height: 1.4;
  flex-shrink: 0;
  transition: color 0.1s, border-color 0.1s;
}
.sc-detail-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* HP bars */
.sc-comps {
  padding: 0.35rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  border-bottom: 1px solid var(--color-border);
}

.sc-comp-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.sc-comp-lbl {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-low);
  width: 2.4rem;
  flex-shrink: 0;
}

.sc-hp-track {
  flex: 1;
  height: 6px;
  background: var(--color-bg-panel);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.sc-hp-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.2s;
}
.sc-hp-fill--good {
  background: var(--color-success);
}
.sc-hp-fill--low {
  background: var(--color-neutral-amber);
}
.sc-hp-fill--crit {
  background: var(--color-text-danger);
}
.sc-hp-fill--zero {
  background: var(--color-bg-panel);
}

.sc-hp-inp {
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

.sc-hp-max {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
  min-width: 2rem;
}

/* Conditions */
.sc-conds {
  display: flex;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--color-border);
}

.sc-cond {
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.sc-cond--fire.sc-cond--on {
  background: #7c2d12;
  border-color: #ea580c;
  color: #fed7aa;
}
.sc-cond--sink.sc-cond--on {
  background: #1e3a5f;
  border-color: #3b82f6;
  color: #bfdbfe;
}
.sc-cond--grapple.sc-cond--on {
  background: #3b1a5a;
  border-color: #a855f7;
  color: #e9d5ff;
}
.sc-cond--ground.sc-cond--on {
  background: #3d2b0a;
  border-color: #d97706;
  color: #fde68a;
}

/* Weapons */
.sc-weapons {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.3rem 0.5rem;
}

.sc-wpn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.sc-wpn--dry .sc-wpn-name {
  color: var(--color-text-low);
  text-decoration: line-through;
}

.sc-wpn-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-wpn-ammo {
  width: 3rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.25rem;
  text-align: right;
}

/* Position tag */
.sc-pos {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  padding: 0.2rem 0.5rem;
  font-style: italic;
}
</style>
