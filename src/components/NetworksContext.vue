<template>
  <div class="networks">
    <!-- ── Sending Stones ─────────────────────────── -->
    <section class="net-section">
      <div class="net-section-header">
        <span class="net-section-title">Sending Stones</span>
        <button class="net-add-btn" @click="addPair">+ Add Pair</button>
      </div>

      <div v-if="!pairs.length" class="empty-state">
        No sending stone pairs recorded.
      </div>

      <div v-for="(pair, pi) in pairs" :key="pair.id" class="pair-card">
        <div class="pair-header">
          <input
            class="pair-name-input"
            :value="pair.label"
            placeholder="Pair name…"
            @input="updatePair(pi, 'label', $event.target.value)"
          />
          <button
            class="net-delete-btn"
            title="Remove pair"
            @click="removePair(pi)"
          >
            ✕
          </button>
        </div>

        <div class="stones-row">
          <div
            v-for="side in ['stone_a', 'stone_b']"
            :key="side"
            class="stone-card"
          >
            <input
              class="stone-label-input"
              :value="pair[side].label"
              placeholder="Stone label…"
              @input="updateStone(pi, side, 'label', $event.target.value)"
            />
            <div class="stone-field">
              <span class="stone-field-label">Holder</span>
              <input
                class="stone-input"
                :value="pair[side].holder"
                placeholder="—"
                @input="updateStone(pi, side, 'holder', $event.target.value)"
              />
            </div>
            <div class="stone-field">
              <span class="stone-field-label">Location</span>
              <input
                class="stone-input"
                :value="pair[side].location"
                placeholder="—"
                @input="updateStone(pi, side, 'location', $event.target.value)"
              />
            </div>
            <div class="stone-field">
              <span class="stone-field-label">Status</span>
              <button
                class="status-chip"
                :class="'status-chip--' + pair[side].status"
                @click="cycleStoneStatus(pi, side)"
              >
                {{ stoneStatusLabel(pair[side].status) }}
              </button>
            </div>
            <textarea
              class="stone-notes"
              :value="pair[side].notes"
              placeholder="Notes…"
              rows="2"
              @input="updateStone(pi, side, 'notes', $event.target.value)"
            ></textarea>
          </div>

          <div class="pair-link">↔</div>
        </div>

        <textarea
          v-if="pair.notes !== undefined"
          class="pair-notes"
          :value="pair.notes"
          placeholder="Pair notes…"
          rows="1"
          @input="updatePair(pi, 'notes', $event.target.value)"
        ></textarea>
      </div>
    </section>

    <!-- ── Teleportation Circles ──────────────────── -->
    <section class="net-section">
      <div class="net-section-header">
        <span class="net-section-title">Teleportation Circles</span>
        <button class="net-add-btn" @click="addCircle">+ Add Circle</button>
      </div>

      <div v-if="!circles.length" class="empty-state">
        No teleportation circles recorded.
      </div>

      <div v-for="(circle, ci) in circles" :key="circle.id" class="circle-card">
        <div class="circle-header">
          <input
            class="circle-location-input"
            :value="circle.location"
            placeholder="Location name…"
            @input="updateCircle(ci, 'location', $event.target.value)"
          />
          <button
            class="net-delete-btn"
            title="Remove circle"
            @click="removeCircle(ci)"
          >
            ✕
          </button>
        </div>

        <div class="circle-meta">
          <button
            class="toggle-chip"
            :class="{ 'toggle-chip--on': circle.sigil_known }"
            @click="updateCircle(ci, 'sigil_known', !circle.sigil_known)"
          >
            {{ circle.sigil_known ? '✓ Sigil Known' : '✗ Sigil Unknown' }}
          </button>

          <button
            class="toggle-chip"
            :class="{ 'toggle-chip--on': circle.permanent }"
            @click="updateCircle(ci, 'permanent', !circle.permanent)"
          >
            {{ circle.permanent ? 'Permanent' : 'Temporary' }}
          </button>

          <button
            class="status-chip"
            :class="'status-chip--access-' + circle.access"
            @click="cycleCircleAccess(ci)"
          >
            {{ circleAccessLabel(circle.access) }}
          </button>
        </div>

        <textarea
          class="circle-notes"
          :value="circle.notes"
          placeholder="Notes — sigil sequence, conditions, history…"
          rows="2"
          @input="updateCircle(ci, 'notes', $event.target.value)"
        ></textarea>
      </div>
    </section>
  </div>
</template>

<script>
let nextId = Date.now()

const STONE_STATUSES = ['active', 'lost', 'destroyed', 'unknown']
const CIRCLE_ACCESS = ['open', 'guarded', 'restricted', 'one_way', 'unknown']

function blankStone(label) {
  return { label, holder: '', location: '', status: 'unknown', notes: '' }
}

function blankPair() {
  return {
    id: `ss_${nextId++}`,
    label: '',
    notes: '',
    stone_a: blankStone('Stone A'),
    stone_b: blankStone('Stone B'),
  }
}

function blankCircle() {
  return {
    id: `tc_${nextId++}`,
    location: '',
    sigil_known: false,
    access: 'unknown',
    permanent: true,
    notes: '',
  }
}

export default {
  name: 'NetworksContext',

  computed: {
    networks() {
      return (
        this.$store.state.networks ?? {
          sending_stones: [],
          teleportation_circles: [],
        }
      )
    },
    pairs() {
      return this.networks.sending_stones ?? []
    },
    circles() {
      return this.networks.teleportation_circles ?? []
    },
  },

  methods: {
    save(updated) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'networks',
        updatedItem: updated,
      })
    },

    // ── Sending Stones ──
    addPair() {
      this.save({
        sending_stones: [...this.pairs, blankPair()],
        teleportation_circles: this.circles,
      })
    },
    removePair(i) {
      const updated = this.pairs.filter((_, idx) => idx !== i)
      this.save({
        sending_stones: updated,
        teleportation_circles: this.circles,
      })
    },
    updatePair(i, field, value) {
      const updated = this.pairs.map((p, idx) =>
        idx === i ? { ...p, [field]: value } : p
      )
      this.save({
        sending_stones: updated,
        teleportation_circles: this.circles,
      })
    },
    updateStone(pi, side, field, value) {
      const updated = this.pairs.map((p, idx) =>
        idx === pi ? { ...p, [side]: { ...p[side], [field]: value } } : p
      )
      this.save({
        sending_stones: updated,
        teleportation_circles: this.circles,
      })
    },
    cycleStoneStatus(pi, side) {
      const current = this.pairs[pi][side].status
      const next =
        STONE_STATUSES[
          (STONE_STATUSES.indexOf(current) + 1) % STONE_STATUSES.length
        ]
      this.updateStone(pi, side, 'status', next)
    },
    stoneStatusLabel(status) {
      return (
        {
          active: '● Active',
          lost: '◌ Lost',
          destroyed: '✕ Destroyed',
          unknown: '? Unknown',
        }[status] ?? status
      )
    },

    // ── Teleportation Circles ──
    addCircle() {
      this.save({
        sending_stones: this.pairs,
        teleportation_circles: [...this.circles, blankCircle()],
      })
    },
    removeCircle(i) {
      const updated = this.circles.filter((_, idx) => idx !== i)
      this.save({ sending_stones: this.pairs, teleportation_circles: updated })
    },
    updateCircle(i, field, value) {
      const updated = this.circles.map((c, idx) =>
        idx === i ? { ...c, [field]: value } : c
      )
      this.save({ sending_stones: this.pairs, teleportation_circles: updated })
    },
    cycleCircleAccess(i) {
      const current = this.circles[i].access
      const next =
        CIRCLE_ACCESS[
          (CIRCLE_ACCESS.indexOf(current) + 1) % CIRCLE_ACCESS.length
        ]
      this.updateCircle(i, 'access', next)
    },
    circleAccessLabel(access) {
      return (
        {
          open: '● Open',
          guarded: '◑ Guarded',
          restricted: '✕ Restricted',
          one_way: '→ One-Way',
          unknown: '? Unknown',
        }[access] ?? access
      )
    },
  },
}
</script>

<style scoped>
.networks {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

/* ── Sections ── */
.net-section {
  margin-bottom: 2.5rem;
}

.net-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--color-border);
}

.net-section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  letter-spacing: 0.05em;
}

.net-add-btn {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all 0.12s;
}
.net-add-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.net-delete-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-md);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}
.net-delete-btn:hover {
  color: var(--color-danger);
}

/* ── Sending Stone pairs ── */
.pair-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.pair-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pair-name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.04em;
  outline: none;
  padding: 0.15rem 0;
}
.pair-name-input:focus {
  border-bottom-color: var(--color-accent);
}
.pair-name-input::placeholder {
  color: var(--color-text-low);
}

.stones-row {
  display: flex;
  gap: 0;
  align-items: stretch;
  position: relative;
}

.stone-card {
  flex: 1;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.stone-card:first-child {
  border-radius: 6px 0 0 6px;
  border-right: none;
}
.stone-card:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}

.pair-link {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  color: var(--color-text-low);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
  align-self: center;
}

.stone-label-input {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  outline: none;
  padding: 0;
  width: 100%;
}
.stone-label-input::placeholder {
  color: var(--color-text-low);
}

.stone-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stone-field-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  width: 4rem;
  flex-shrink: 0;
}

.stone-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  outline: none;
  padding: 0.1rem 0;
  min-width: 0;
}
.stone-input:focus {
  border-bottom-color: var(--color-border);
}
.stone-input::placeholder {
  color: var(--color-text-low);
}

.stone-notes,
.pair-notes,
.circle-notes {
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  resize: none;
  outline: none;
  padding: 0.2rem 0;
  box-sizing: border-box;
}
.stone-notes:focus,
.pair-notes:focus,
.circle-notes:focus {
  border-color: var(--color-border);
}
.stone-notes::placeholder,
.pair-notes::placeholder,
.circle-notes::placeholder {
  color: var(--color-text-low);
  font-style: italic;
}

.pair-notes {
  margin-top: 0.5rem;
}

/* ── Status chips ── */
.status-chip {
  font-size: var(--font-size-base);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.status-chip--active {
  color: var(--color-success);
  border-color: var(--color-success);
}
.status-chip--lost {
  color: var(--color-neutral-amber);
  border-color: var(--color-neutral-amber);
}
.status-chip--destroyed {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.status-chip--unknown {
  color: var(--color-text-low);
}

.status-chip--access-open {
  color: var(--color-success);
  border-color: var(--color-success);
}
.status-chip--access-guarded {
  color: var(--color-neutral-amber);
  border-color: var(--color-neutral-amber);
}
.status-chip--access-restricted {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.status-chip--access-one_way {
  color: var(--color-info);
  border-color: var(--color-info);
}
.status-chip--access-unknown {
  color: var(--color-text-low);
}

/* ── Toggle chips ── */
.toggle-chip {
  font-size: var(--font-size-base);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  transition: all 0.12s;
}
.toggle-chip--on {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* ── Teleportation circles ── */
.circle-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.circle-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.circle-location-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  outline: none;
  padding: 0.15rem 0;
}
.circle-location-input:focus {
  border-bottom-color: var(--color-accent);
}
.circle-location-input::placeholder {
  color: var(--color-text-low);
}

.circle-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.circle-notes {
  margin-top: 0.15rem;
}
</style>
