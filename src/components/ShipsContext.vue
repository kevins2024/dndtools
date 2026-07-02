<template>
  <div class="ships-ctx">
    <!-- ── Left: ship roster ── -->
    <div class="ships-sidebar">
      <div class="sidebar-hd">
        <span class="sidebar-title">Ships</span>
        <button class="add-btn" @click="addShip" title="Add ship">＋</button>
      </div>
      <div class="ship-list">
        <div
          v-for="ship in ships"
          :key="ship.id"
          class="ship-item"
          :class="{ 'ship-item--active': selectedId === ship.id }"
          @click="selectedId = ship.id"
        >
          <div class="si-name">{{ ship.name }}</div>
          <div class="si-foot">
            <span class="si-type">{{ ship.type }}</span>
            <span
              v-if="ship.conditions.includes('on_fire')"
              class="si-flag si-fire"
              title="On Fire"
              >⚠</span
            >
            <span
              v-if="ship.conditions.includes('sinking')"
              class="si-flag si-sink"
              title="Sinking"
              >↓</span
            >
          </div>
        </div>
        <div v-if="!ships.length" class="no-ships">No ships yet.</div>
      </div>
    </div>

    <!-- ── Right: detail panel ── -->
    <template v-if="selected">
      <div class="ships-main">
        <!-- Ship name / type row -->
        <div class="ship-hdr">
          <input
            v-model="selected.name"
            class="ship-name-inp"
            placeholder="Ship name…"
          />
          <select v-model="selected.type" class="ship-type-sel">
            <option v-for="t in SHIP_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <button class="del-btn" @click="deleteShip" title="Remove ship">
            ✕
          </button>
        </div>

        <!-- Editable stat pills -->
        <div class="ship-pills">
          <label class="pill-lbl">AC</label>
          <input
            type="number"
            v-model.number="selected.ac"
            class="pill-inp"
            min="0"
          />
          <label class="pill-lbl">DT</label>
          <input
            type="number"
            v-model.number="selected.damage_threshold"
            class="pill-inp"
            min="0"
          />
          <template v-if="selected.speed_sail !== null">
            <label class="pill-lbl">Sail</label>
            <input
              type="number"
              v-model.number="selected.speed_sail"
              class="pill-inp wide"
              min="0"
            />
            <span class="pill-unit">ft</span>
          </template>
          <template v-if="selected.speed_oar !== null">
            <label class="pill-lbl">Oar</label>
            <input
              type="number"
              v-model.number="selected.speed_oar"
              class="pill-inp wide"
              min="0"
            />
            <span class="pill-unit">ft</span>
          </template>
          <label class="pill-lbl">Crew</label>
          <input
            type="number"
            v-model.number="selected.crew_min"
            class="pill-inp"
            min="0"
          />
          <span class="pill-unit">–</span>
          <input
            type="number"
            v-model.number="selected.crew_max"
            class="pill-inp"
            min="0"
          />
        </div>

        <!-- Scrollable body -->
        <div class="ship-body">
          <!-- ── Components (Hull / Sails / Helm) ── -->
          <section class="ship-sect">
            <div class="sect-hd">Components</div>
            <div class="comp-list">
              <div
                v-for="comp in componentList"
                :key="comp.key"
                class="comp-row"
                :class="{ 'comp-row--dead': comp.pct === 0 }"
              >
                <span class="comp-lbl">{{ comp.label }}</span>
                <div class="hp-track">
                  <div
                    class="hp-fill"
                    :class="hpFillClass(comp.pct)"
                    :style="{
                      width: Math.max(comp.pct, comp.pct === 0 ? 100 : 0) + '%',
                    }"
                  ></div>
                </div>
                <div class="hp-edit">
                  <input
                    type="number"
                    v-model.number="selected[comp.key].current"
                    class="hp-inp"
                    min="0"
                    :max="selected[comp.key].max"
                    @change="clampHP(comp.key)"
                  />
                  <span class="hp-slash">/</span>
                  <input
                    type="number"
                    v-model.number="selected[comp.key].max"
                    class="hp-inp hp-inp--max"
                    min="0"
                  />
                </div>
                <span v-if="comp.pct === 0" class="comp-badge comp-badge--dead"
                  >Disabled</span
                >
                <span
                  v-else-if="comp.pct <= 25"
                  class="comp-badge comp-badge--crit"
                  >Critical</span
                >
                <span v-else class="comp-badge-spacer"></span>
              </div>
            </div>
          </section>

          <!-- ── Weapons ── -->
          <section class="ship-sect">
            <div class="sect-hd">
              Weapons
              <button class="sect-add-btn" @click="addWeapon">＋</button>
            </div>
            <div v-if="selected.weapons.length" class="wpn-list">
              <div
                v-for="(wpn, wi) in selected.weapons"
                :key="wi"
                class="wpn-row"
                :class="{ 'wpn-row--disabled': wpn.disabled }"
              >
                <input
                  v-model="wpn.name"
                  class="wpn-name-inp"
                  placeholder="Weapon…"
                />
                <span class="wpn-times">×</span>
                <input
                  type="number"
                  v-model.number="wpn.count"
                  class="wpn-count-inp"
                  min="1"
                  max="20"
                />
                <span class="wpn-ammo-lbl">Ammo</span>
                <input
                  type="number"
                  v-model.number="wpn.ammo"
                  class="wpn-ammo-inp"
                  min="0"
                />
                <button
                  class="wpn-status-btn"
                  :class="{ 'wpn-status-btn--ready': !wpn.disabled }"
                  @click="wpn.disabled = !wpn.disabled"
                >
                  {{ wpn.disabled ? 'Disabled' : 'Ready' }}
                </button>
                <button
                  class="icon-btn"
                  @click="selected.weapons.splice(wi, 1)"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
            <div v-else class="sect-empty">No weapons mounted.</div>
          </section>

          <!-- ── Crew + Status side by side ── -->
          <div class="lower-row">
            <!-- Crew -->
            <section class="ship-sect">
              <div class="sect-hd">Crew</div>
              <div class="crew-count-row">
                <span class="crew-count-lbl">Current</span>
                <input
                  type="number"
                  v-model.number="selected.crew_current"
                  class="crew-inp"
                  min="0"
                  :max="selected.crew_max"
                />
                <span class="crew-of">/ {{ selected.crew_max }}</span>
                <span
                  v-if="selected.crew_current < selected.crew_min"
                  class="crew-warn"
                  >Undermanned</span
                >
              </div>
              <div class="role-list">
                <div
                  v-for="role in CREW_ROLES"
                  :key="role.key"
                  class="role-row"
                >
                  <span class="role-lbl">{{ role.label }}</span>
                  <select v-model="selected.roles[role.key]" class="role-sel">
                    <option value="">—</option>
                    <optgroup v-if="partyMembers.length" label="Party">
                      <option v-for="m in partyMembers" :key="m" :value="m">
                        {{ m }}
                      </option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </section>

            <!-- Status: conditions + wind compass -->
            <section class="ship-sect">
              <div class="sect-hd">Status</div>
              <div class="cond-row">
                <button
                  v-for="cond in CONDITIONS"
                  :key="cond.key"
                  class="cond-btn"
                  :class="[
                    `cond-btn--${cond.cls}`,
                    {
                      'cond-btn--active': selected.conditions.includes(
                        cond.key
                      ),
                    },
                  ]"
                  @click="toggleCondition(cond.key)"
                >
                  {{ cond.label }}
                </button>
              </div>
              <div class="wind-row">
                <span class="wind-lbl">Wind</span>
                <div class="compass">
                  <button
                    v-for="(d, di) in COMPASS_DIRS"
                    :key="di"
                    class="cdir-btn"
                    :class="{
                      'cdir-btn--active': selected.wind === d,
                      'cdir-btn--center': d === null,
                    }"
                    @click="d && (selected.wind = d)"
                  >
                    {{ d !== null ? d : '·' }}
                  </button>
                </div>
                <span class="wind-val">{{ selected.wind || '—' }}</span>
              </div>
            </section>
          </div>

          <!-- ── Notes ── -->
          <section class="ship-sect">
            <div class="sect-hd">Notes</div>
            <textarea
              v-model="selected.notes"
              class="ship-notes"
              rows="3"
              placeholder="Cargo, passengers, mission notes…"
            ></textarea>
          </section>
        </div>
      </div>
    </template>

    <div v-else class="ships-empty">
      <span>Select a ship or add one to get started.</span>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

const SHIP_TYPES = ['Rowboat', 'Keelboat', 'Sailing Ship', 'Warship', 'Galley']

const CREW_ROLES = [
  { key: 'captain', label: 'Captain' },
  { key: 'helmsman', label: 'Helmsman' },
  { key: 'bosun', label: 'Bosun' },
  { key: 'gunner', label: 'Gunner' },
]

const CONDITIONS = [
  { key: 'on_fire', label: 'On Fire', cls: 'fire' },
  { key: 'sinking', label: 'Sinking', cls: 'sink' },
  { key: 'grappled', label: 'Grappled', cls: 'grapple' },
  { key: 'grounded', label: 'Grounded', cls: 'ground' },
]

// 3×3 compass grid — null = center (non-interactive)
const COMPASS_DIRS = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE']

let nextId = Date.now()

function makeShip(overrides = {}) {
  return {
    id: `ship_${nextId++}`,
    name: 'New Ship',
    type: 'Sailing Ship',
    ac: 15,
    damage_threshold: 10,
    speed_sail: 45,
    speed_oar: null,
    crew_min: 20,
    crew_max: 100,
    crew_current: 20,
    hull: { current: 300, max: 300 },
    sails: { current: 100, max: 100 },
    helm: { current: 50, max: 50 },
    weapons: [],
    roles: { captain: '', helmsman: '', bosun: '', gunner: '' },
    conditions: [],
    wind: 'N',
    notes: '',
    ...overrides,
  }
}

export default {
  name: 'ShipsContext',

  data() {
    return {
      SHIP_TYPES,
      CREW_ROLES,
      CONDITIONS,
      COMPASS_DIRS,
      selectedId: 'ship_sample',
      ships: [
        makeShip({
          id: 'ship_sample',
          name: "The Serpent's Tooth",
          type: 'Sailing Ship',
          hull: { current: 240, max: 300 },
          sails: { current: 65, max: 100 },
          helm: { current: 50, max: 50 },
          crew_current: 28,
          weapons: [
            { name: 'Ballista', count: 4, ammo: 20, disabled: false },
            { name: 'Mangonel', count: 2, ammo: 8, disabled: false },
          ],
          conditions: ['on_fire'],
          wind: 'SW',
          notes: "Captured from the Kraken's Maw fleet. Repairs ongoing.",
        }),
      ],
    }
  },

  computed: {
    ...mapState(['characters']),
    ...mapGetters(['activeParty']),

    selected() {
      return this.ships.find((s) => s.id === this.selectedId) ?? null
    },

    partyMembers() {
      return this.activeParty?.members ?? []
    },

    componentList() {
      if (!this.selected) return []
      return [
        { key: 'hull', label: 'Hull' },
        { key: 'sails', label: 'Sails' },
        { key: 'helm', label: 'Helm' },
      ]
        .filter((c) => this.selected[c.key] !== null)
        .map((c) => {
          const { current, max } = this.selected[c.key]
          const pct =
            max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
          return { ...c, pct }
        })
    },
  },

  methods: {
    addShip() {
      const ship = makeShip()
      this.ships.push(ship)
      this.selectedId = ship.id
    },

    deleteShip() {
      const idx = this.ships.findIndex((s) => s.id === this.selectedId)
      if (idx !== -1) this.ships.splice(idx, 1)
      this.selectedId = this.ships[0]?.id ?? null
    },

    addWeapon() {
      if (this.selected) {
        this.selected.weapons.push({
          name: 'Ballista',
          count: 1,
          ammo: 10,
          disabled: false,
        })
      }
    },

    clampHP(key) {
      const comp = this.selected[key]
      if (comp.current > comp.max) comp.current = comp.max
      if (comp.current < 0) comp.current = 0
    },

    hpFillClass(pct) {
      if (pct === 0) return 'hp-fill--zero'
      if (pct <= 25) return 'hp-fill--crit'
      if (pct <= 50) return 'hp-fill--low'
      return 'hp-fill--good'
    },

    toggleCondition(key) {
      const idx = this.selected.conditions.indexOf(key)
      if (idx === -1) this.selected.conditions.push(key)
      else this.selected.conditions.splice(idx, 1)
    },
  },
}
</script>

<style scoped>
/* ── Root layout ── */
.ships-ctx {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ─────────────────────────────────────
   Sidebar
───────────────────────────────────── */
.ships-sidebar {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  overflow: hidden;
}

.sidebar-hd {
  display: flex;
  align-items: center;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sidebar-title {
  flex: 1;
  font-family: var(--font-display, serif);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-low);
}

.add-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  width: 1.4rem;
  height: 1.4rem;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}
.add-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.ship-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.ship-item {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s;
}
.ship-item:hover {
  background: var(--color-bg-surface);
}
.ship-item--active {
  background: var(--color-bg-surface);
  border-left-color: var(--color-accent);
}

.si-name {
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.si-foot {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 1px;
}

.si-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex: 1;
}

.si-flag {
  font-size: var(--font-size-xs);
  font-weight: 700;
}
.si-fire {
  color: #e06828;
}
.si-sink {
  color: #4098d4;
}

.no-ships {
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-low);
  font-style: italic;
}

/* ─────────────────────────────────────
   Main panel
───────────────────────────────────── */
.ships-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.ships-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-low);
  font-size: 0.82rem;
  font-style: italic;
}

/* ── Header (name + type) ── */
.ship-hdr {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-bg-surface);
}

.ship-name-inp {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--color-text);
  font-family: var(--font-display, serif);
  font-size: 1.05rem;
  padding: 0.1rem 0.2rem;
  transition: border-color 0.1s;
}
.ship-name-inp:focus {
  outline: none;
  border-bottom-color: var(--color-accent);
}

.ship-type-sel {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  padding: 0.2rem 0.4rem;
  cursor: pointer;
  flex-shrink: 0;
}

.del-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem 0.3rem;
  transition: color 0.1s;
  flex-shrink: 0;
}
.del-btn:hover {
  color: var(--color-text-danger);
}

/* ── Stat pills ── */
.ship-pills {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.pill-lbl {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-low);
  flex-shrink: 0;
}

.pill-inp {
  width: 3rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
  font-weight: 600;
  font-size: 0.78rem;
  text-align: center;
  padding: 0.15rem 0.25rem;
}
.pill-inp.wide {
  width: 3.6rem;
}
.pill-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}

.pill-unit {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  margin-right: 0.3rem;
}

/* ── Scrollable body ── */
.ship-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.65rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ── Generic section card ── */
.ship-sect {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.sect-hd {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
}

.sect-add-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.65rem;
  width: 1.15rem;
  height: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}
.sect-add-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.sect-empty {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-low);
  font-style: italic;
}

/* ── Components ── */
.comp-list {
  padding: 0.45rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.comp-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.comp-row--dead {
  opacity: 0.55;
}

.comp-lbl {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  color: var(--color-text-low);
  width: 3rem;
  flex-shrink: 0;
}

.hp-track {
  flex: 1;
  height: 9px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  overflow: hidden;
}

.hp-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease, background-color 0.3s ease;
}
.hp-fill--good {
  background: var(--color-accent);
}
.hp-fill--low {
  background: #c87030;
}
.hp-fill--crit {
  background: #c83838;
}
.hp-fill--zero {
  background: #602020;
  width: 100% !important;
}

.hp-edit {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.hp-inp {
  width: 3.2rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  font-size: 0.75rem;
  text-align: center;
  padding: 0.1rem 0.2rem;
}
.hp-inp--max {
  color: var(--color-text-low);
}
.hp-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}

.hp-slash {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.comp-badge {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
  width: 4.5rem;
  text-align: center;
}
.comp-badge--dead {
  color: #a06060;
  background: rgba(160, 60, 60, 0.1);
  border: 1px solid rgba(160, 60, 60, 0.3);
}
.comp-badge--crit {
  color: #c87030;
  background: rgba(200, 112, 48, 0.1);
  border: 1px solid rgba(200, 112, 48, 0.3);
}
.comp-badge-spacer {
  width: 4.5rem;
  flex-shrink: 0;
}

/* ── Weapons ── */
.wpn-list {
  padding: 0.4rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.wpn-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: opacity 0.15s;
}
.wpn-row--disabled {
  opacity: 0.45;
}

.wpn-name-inp {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
}
.wpn-name-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}

.wpn-times {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
}

.wpn-count-inp {
  width: 2.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  text-align: center;
  padding: 0.2rem;
}
.wpn-count-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}

.wpn-ammo-lbl {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
}

.wpn-ammo-inp {
  width: 3.2rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
  font-weight: 600;
  font-size: 0.78rem;
  text-align: center;
  padding: 0.2rem;
}
.wpn-ammo-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}

.wpn-status-btn {
  padding: 0.15rem 0.5rem;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-low);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.1s, border-color 0.1s;
  min-width: 4rem;
  text-align: center;
}
.wpn-status-btn--ready {
  color: var(--color-accent);
  border-color: rgba(var(--color-accent-rgb), 0.4);
}

.icon-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.25rem;
  transition: color 0.1s;
  flex-shrink: 0;
}
.icon-btn:hover {
  color: var(--color-text-danger);
}

/* ── Lower two-column row ── */
.lower-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

/* ── Crew ── */
.crew-count-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.crew-count-lbl {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.crew-inp {
  width: 3.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  font-size: 0.8rem;
  text-align: center;
  padding: 0.15rem;
}
.crew-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}

.crew-of {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex: 1;
}

.crew-warn {
  font-size: var(--font-size-xs);
  color: #c87030;
  background: rgba(200, 112, 48, 0.1);
  border: 1px solid rgba(200, 112, 48, 0.3);
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
}

.role-list {
  padding: 0.4rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.role-lbl {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  width: 5rem;
  flex-shrink: 0;
}

.role-sel {
  flex: 1;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  font-size: 0.75rem;
  padding: 0.18rem 0.3rem;
}
.role-sel:focus {
  outline: none;
  border-color: var(--color-accent);
}

/* ── Status: conditions ── */
.cond-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.cond-btn {
  padding: 0.2rem 0.55rem;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-low);
  cursor: pointer;
  transition: all 0.12s;
  letter-spacing: 0.03em;
}
.cond-btn:hover {
  color: var(--color-text-muted);
}
.cond-btn--fire.cond-btn--active {
  color: #e06828;
  background: rgba(224, 104, 40, 0.12);
  border-color: rgba(224, 104, 40, 0.5);
}
.cond-btn--sink.cond-btn--active {
  color: #4098d4;
  background: rgba(64, 152, 212, 0.12);
  border-color: rgba(64, 152, 212, 0.5);
}
.cond-btn--grapple.cond-btn--active {
  color: #a870e0;
  background: rgba(168, 112, 224, 0.12);
  border-color: rgba(168, 112, 224, 0.5);
}
.cond-btn--ground.cond-btn--active {
  color: #a09060;
  background: rgba(160, 144, 96, 0.12);
  border-color: rgba(160, 144, 96, 0.5);
}

/* ── Wind compass ── */
.wind-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.75rem;
}

.wind-lbl {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-low);
  flex-shrink: 0;
}

.compass {
  display: grid;
  grid-template-columns: repeat(3, 1.55rem);
  grid-template-rows: repeat(3, 1.55rem);
  gap: 2px;
}

.cdir-btn {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.5rem;
  font-family: var(--font-display, serif);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.1s, background 0.1s, border-color 0.1s;
  padding: 0;
  line-height: 1;
}
.cdir-btn:hover:not(.cdir-btn--center) {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.cdir-btn--active {
  background: var(--color-accent);
  color: #0e0c09;
  border-color: var(--color-accent);
  font-weight: 700;
}
.cdir-btn--center {
  cursor: default;
  color: var(--color-border);
  background: transparent;
  border-color: transparent;
}

.wind-val {
  font-size: 0.85rem;
  font-family: var(--font-display, serif);
  font-weight: 600;
  color: var(--color-accent);
  min-width: 1.8rem;
}

/* ── Notes ── */
.ship-notes {
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-family: var(--font-body);
  padding: 0.5rem 0.75rem;
  resize: vertical;
  line-height: 1.55;
}
.ship-notes:focus {
  outline: none;
}
.ship-notes::placeholder {
  color: var(--color-text-low);
  font-style: italic;
}
</style>
