<template>
  <div class="ship-loadout">
    <!-- Editable stat pills -->
    <div class="ship-pills">
      <label class="pill-lbl">AC</label>
      <input type="number" v-model.number="draft.ac" class="pill-inp" min="0" />
      <label class="pill-lbl">DT</label>
      <input
        type="number"
        v-model.number="draft.damage_threshold"
        class="pill-inp"
        min="0"
      />
      <template v-if="draft.speed_sail !== null">
        <label class="pill-lbl">Sail</label>
        <input
          type="number"
          v-model.number="draft.speed_sail"
          class="pill-inp wide"
          min="0"
        />
        <span class="pill-unit">ft</span>
      </template>
      <template v-if="draft.speed_oar !== null">
        <label class="pill-lbl">Oar</label>
        <input
          type="number"
          v-model.number="draft.speed_oar"
          class="pill-inp wide"
          min="0"
        />
        <span class="pill-unit">ft</span>
      </template>
      <label class="pill-lbl">Crew</label>
      <input
        type="number"
        v-model.number="draft.crew_min"
        class="pill-inp"
        min="0"
      />
      <span class="pill-unit">–</span>
      <input
        type="number"
        v-model.number="draft.crew_max"
        class="pill-inp"
        min="0"
      />
    </div>

    <div class="loadout-body">
      <!-- ── Components ── -->
      <section class="lo-sect">
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
                :style="{ width: (comp.pct === 0 ? 100 : comp.pct) + '%' }"
              ></div>
            </div>
            <div class="hp-edit">
              <input
                type="number"
                v-model.number="draft[comp.key].current"
                class="hp-inp"
                min="0"
                :max="draft[comp.key].max"
                @change="clampHP(comp.key)"
              />
              <span class="hp-slash">/</span>
              <input
                type="number"
                v-model.number="draft[comp.key].max"
                class="hp-inp hp-inp--max"
                min="0"
              />
            </div>
            <span v-if="comp.pct === 0" class="comp-badge comp-badge--dead"
              >Disabled</span
            >
            <span v-else-if="comp.pct <= 25" class="comp-badge comp-badge--crit"
              >Critical</span
            >
            <span v-else class="comp-badge-spacer"></span>
          </div>
        </div>
      </section>

      <!-- ── Weapons ── -->
      <section class="lo-sect">
        <div class="sect-hd">
          Weapons
          <button class="sect-add-btn" @click="addWeapon">＋</button>
        </div>
        <div v-if="draft.weapons.length" class="wpn-list">
          <div
            v-for="(wpn, wi) in draft.weapons"
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
              @click="draft.weapons.splice(wi, 1)"
              title="Remove"
            >
              ✕
            </button>
          </div>
        </div>
        <div v-else class="sect-empty">No weapons mounted.</div>
      </section>

      <!-- ── Crew + Status ── -->
      <div class="lower-row">
        <!-- Crew roles -->
        <section class="lo-sect">
          <div class="sect-hd">Crew</div>
          <div class="crew-count-row">
            <span class="crew-count-lbl">Current</span>
            <input
              type="number"
              v-model.number="draft.crew_current"
              class="crew-inp"
              min="0"
              :max="draft.crew_max"
            />
            <span class="crew-of">/ {{ draft.crew_max }}</span>
            <span v-if="draft.crew_current < draft.crew_min" class="crew-warn"
              >Undermanned</span
            >
          </div>
          <div class="role-list">
            <div v-for="role in CREW_ROLES" :key="role.key" class="role-row">
              <span class="role-lbl">{{ role.label }}</span>
              <select v-model="draft.roles[role.key]" class="role-sel">
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

        <!-- Conditions + wind -->
        <section class="lo-sect">
          <div class="sect-hd">Status</div>
          <div class="cond-row">
            <button
              v-for="cond in CONDITIONS"
              :key="cond.key"
              class="cond-btn"
              :class="[
                `cond-btn--${cond.cls}`,
                { 'cond-btn--active': draft.conditions.includes(cond.key) },
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
                  'cdir-btn--active': draft.wind === d,
                  'cdir-btn--center': d === null,
                }"
                @click="d && (draft.wind = d)"
              >
                {{ d !== null ? d : '·' }}
              </button>
            </div>
            <span class="wind-val">{{ draft.wind || '—' }}</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

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

const COMPASS_DIRS = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE']

function initDraft(ship) {
  return {
    ac: ship.ac ?? 15,
    damage_threshold: ship.damage_threshold ?? 10,
    speed_sail: ship.speed_sail ?? 45,
    speed_oar: ship.speed_oar ?? null,
    crew_min: ship.crew_min ?? 20,
    crew_max: ship.crew_max ?? ship.crew_full ?? 100,
    crew_current: ship.crew_current ?? 20,
    hull: ship.hull ? { ...ship.hull } : { current: 300, max: 300 },
    sails: ship.sails ? { ...ship.sails } : { current: 100, max: 100 },
    helm: ship.helm ? { ...ship.helm } : { current: 50, max: 50 },
    weapons: ship.weapons ? ship.weapons.map((w) => ({ ...w })) : [],
    roles: ship.roles
      ? { ...ship.roles }
      : { captain: '', helmsman: '', bosun: '', gunner: '' },
    conditions: ship.conditions ? [...ship.conditions] : [],
    wind: ship.wind ?? 'N',
  }
}

export default {
  name: 'ShipLoadout',

  props: {
    ship: { type: Object, required: true },
  },

  emits: ['update'],

  data() {
    return {
      CREW_ROLES,
      CONDITIONS,
      COMPASS_DIRS,
      draft: initDraft(this.ship),
    }
  },

  computed: {
    ...mapGetters(['activeParty']),

    partyMembers() {
      return this.activeParty?.members ?? []
    },

    componentList() {
      return [
        { key: 'hull', label: 'Hull' },
        { key: 'sails', label: 'Sails' },
        { key: 'helm', label: 'Helm' },
      ].map((c) => {
        const { current, max } = this.draft[c.key]
        const pct =
          max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
        return { ...c, pct }
      })
    },
  },

  watch: {
    ship(newShip) {
      this.draft = initDraft(newShip)
    },
    draft: {
      deep: true,
      handler(val) {
        this.$emit('update', { id: this.ship.id, ...val })
      },
    },
  },

  methods: {
    clampHP(key) {
      const c = this.draft[key]
      if (c.current > c.max) c.current = c.max
      if (c.current < 0) c.current = 0
    },

    hpFillClass(pct) {
      if (pct === 0) return 'hp-fill--zero'
      if (pct <= 25) return 'hp-fill--crit'
      if (pct <= 50) return 'hp-fill--low'
      return 'hp-fill--good'
    },

    addWeapon() {
      this.draft.weapons.push({
        name: 'Ballista',
        count: 1,
        ammo: 10,
        disabled: false,
      })
    },

    toggleCondition(key) {
      const idx = this.draft.conditions.indexOf(key)
      if (idx === -1) this.draft.conditions.push(key)
      else this.draft.conditions.splice(idx, 1)
    },
  },
}
</script>

<style scoped>
.ship-loadout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Stat pills ── */
.ship-pills {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 1.25rem;
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
.loadout-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.65rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ── Section card ── */
.lo-sect {
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

/* ── Component HP bars ── */
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
  min-width: 4rem;
  text-align: center;
  transition: color 0.1s, border-color 0.1s;
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

/* ── Conditions ── */
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
</style>
