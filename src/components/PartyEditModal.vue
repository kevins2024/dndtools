<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel">
      <!-- Header -->
      <div class="modal-header">
        <span class="modal-title">Manage Parties</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Left: party list -->
        <div class="party-col">
          <div class="col-label">Parties</div>

          <div class="party-list">
            <div
              v-for="p in parties"
              :key="p.id"
              class="party-row"
              :class="{ selected: editingId === p.id, active: p.active }"
              @click="selectParty(p.id)"
            >
              <span class="party-row-name">{{ p.name }}</span>
              <span v-if="p.active" class="active-badge">active</span>
              <span class="member-count">{{ p.members.length }}</span>
            </div>
            <div v-if="!parties.length" class="no-parties">No parties yet.</div>
          </div>

          <div class="party-actions">
            <button class="action-btn" @click="newParty">+ New Party</button>
          </div>

          <!-- Edit form for selected party -->
          <template v-if="editingParty">
            <div class="edit-section">
              <input
                v-model="editingParty.name"
                class="party-name-input"
                placeholder="Party name…"
                @input="saveParty"
              />
              <div class="party-date-block">
                <div class="party-date-label">{{ formattedPartyDate }}</div>
                <div class="party-date-inputs">
                  <label class="date-field">
                    Year
                    <input
                      type="number"
                      min="1"
                      class="date-input"
                      :value="dateYear"
                      @change="setPartyDate($event.target.value, dateDay)"
                    />
                  </label>
                  <label class="date-field">
                    Day
                    <input
                      type="number"
                      min="1"
                      max="204"
                      class="date-input"
                      :value="dateDay"
                      @change="setPartyDate(dateYear, $event.target.value)"
                    />
                  </label>
                </div>
              </div>
              <div class="edit-btns">
                <button
                  class="action-btn"
                  @click="activateEditingParty"
                  :disabled="editingParty.active"
                >
                  Set Active
                </button>
                <button class="action-btn danger" @click="deleteParty">
                  Delete
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Right: character picker -->
        <div class="char-col">
          <div class="col-label">
            Characters
            <span v-if="editingParty" class="selection-hint">
              — click to add/remove from
              <em>{{ editingParty.name || 'party' }}</em>
            </span>
            <span v-else class="selection-hint"
              >— select or create a party first</span
            >
          </div>

          <div class="char-grid">
            <div
              v-for="char in allChars"
              :key="char.name"
              class="char-tile"
              :class="{
                selected: isSelected(char.name),
                disabled: !editingParty,
              }"
              @click="toggleMember(char.name)"
            >
              <div class="tile-portrait">
                <img :src="char.image" class="tile-img" />
                <div v-if="isSelected(char.name)" class="tile-check">✓</div>
              </div>
              <div class="tile-body">
                <div class="tile-name">{{ char.name }}</div>
                <div class="tile-class">{{ $dnd.classLabel(char) }}</div>
                <div class="tile-stat">
                  <span class="ts-key">{{ topStat(char).name }}</span>
                  <span class="ts-val">{{ topStat(char).score }}</span>
                </div>
                <div class="tile-skills">
                  <span
                    v-for="sk in topSkills(char)"
                    :key="sk.name"
                    class="ts-skill"
                  >
                    {{ sk.short }} {{ sk.signed }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Party pool reassignment — shown only when the party being deleted
         actually has loose pool gear, so deleting an empty party stays a
         single click. -->
    <div
      v-if="pendingDeleteParty"
      class="modal-backdrop pool-dialog-backdrop"
      @click.self="cancelDeleteParty"
    >
      <div class="pool-dialog">
        <div class="pool-dialog-title">
          Delete "{{ pendingDeleteParty.name }}"
        </div>
        <p class="pool-dialog-body">
          This party's pool has {{ pendingPoolCount }} item{{
            pendingPoolCount === 1 ? '' : 's'
          }}
          not carried by anyone specific. Where should
          {{ pendingPoolCount === 1 ? 'it' : 'they' }} go?
        </p>
        <select v-model="poolDestination" class="pool-dest-select">
          <option :value="null">Unassigned (no party)</option>
          <option v-for="p in otherParties" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <div class="pool-dialog-btns">
          <button class="action-btn" @click="cancelDeleteParty">Cancel</button>
          <button class="action-btn danger" @click="confirmDeleteParty">
            Delete Party
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import { dnd } from '@/utils/dnd_utils'
import {
  yearFromDayCount,
  dayOfYear,
  dayCountFromYearAndDay,
  formatGameDate,
} from '@/utils/calendar_utils.js'

const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STAT_FIELDS = [
  'stat_str',
  'stat_dex',
  'stat_con',
  'stat_int',
  'stat_wis',
  'stat_cha',
]

const SKILL_SHORT = {
  Acrobatics: 'Acro',
  'Animal Handling': 'AH',
  Arcana: 'Arca',
  Athletics: 'Athl',
  Deception: 'Dcpt',
  History: 'Hist',
  Insight: 'Insi',
  Intimidation: 'Inti',
  Investigation: 'Invs',
  Medicine: 'Medi',
  Nature: 'Natu',
  Perception: 'Perc',
  Performance: 'Perf',
  Persuasion: 'Pers',
  Religion: 'Reli',
  'Sleight of Hand': 'SoH',
  Stealth: 'Stlth',
  Survival: 'Surv',
}

let nextId = Date.now()

export default {
  name: 'PartyEditModal',

  emits: ['close'],

  data() {
    return {
      editingId: null,
      editingParty: null, // working copy of the party being edited
      pendingDeleteParty: null, // party awaiting pool-reassignment confirmation
      poolDestination: null,
    }
  },

  computed: {
    ...mapState(['parties', 'characters', 'party_items']),

    allChars() {
      return this.characters
    },

    dateYear() {
      return this.editingParty
        ? yearFromDayCount(this.editingParty.game_day || 1)
        : 1
    },
    dateDay() {
      return this.editingParty ? dayOfYear(this.editingParty.game_day || 1) : 1
    },
    formattedPartyDate() {
      return this.editingParty
        ? formatGameDate(this.editingParty.game_day || 1)
        : ''
    },

    otherParties() {
      if (!this.pendingDeleteParty) return []
      return this.parties.filter((p) => p.id !== this.pendingDeleteParty.id)
    },

    pendingPoolCount() {
      if (!this.pendingDeleteParty) return 0
      return this.party_items.filter(
        (i) =>
          i.carried_by === 'party' && i.party_id === this.pendingDeleteParty.id
      ).length
    },
  },

  methods: {
    ...mapMutations(['SET_PARTIES', 'ACTIVATE_PARTY', 'REASSIGN_PARTY_POOL']),

    selectParty(id) {
      this.editingId = id
      const p = this.parties.find((p) => p.id === id)
      this.editingParty = p ? { ...p, members: [...p.members] } : null
    },

    newParty() {
      const id = `party_${nextId++}`
      const p = { id, name: 'New Party', members: [], active: false }
      this.SET_PARTIES([...this.parties, p])
      this.selectParty(id)
    },

    saveParty() {
      if (!this.editingParty) return
      const updated = this.parties.map((p) =>
        p.id === this.editingParty.id ? { ...this.editingParty } : p
      )
      this.SET_PARTIES(updated)
    },

    // Two plain number fields (Year, Day-of-year), trusting the DM to enter
    // something sensible — no cross-checking against individual characters'
    // own history. Works for any party being edited, not just the active
    // one, so catching an inactive party's clock back up before switching
    // to it is just editing these same two fields.
    setPartyDate(year, day) {
      if (!this.editingParty) return
      this.editingParty.game_day = dayCountFromYearAndDay(
        Number(year),
        Number(day)
      )
      this.saveParty()
    },

    activateEditingParty() {
      if (!this.editingParty) return
      this.ACTIVATE_PARTY(this.editingParty.id)
      // Sync active flag in working copy
      this.editingParty = { ...this.editingParty, active: true }
    },

    deleteParty() {
      if (!this.editingParty) return
      const poolCount = this.party_items.filter(
        (i) => i.carried_by === 'party' && i.party_id === this.editingParty.id
      ).length
      if (poolCount === 0) {
        // Nothing to reassign — deleting an empty-pool party stays one click.
        this.finishDeleteParty(this.editingParty.id)
        return
      }
      this.pendingDeleteParty = this.editingParty
      const fallback = this.parties.find((p) => p.id !== this.editingParty.id)
      this.poolDestination = fallback?.id ?? null
    },

    cancelDeleteParty() {
      this.pendingDeleteParty = null
      this.poolDestination = null
    },

    confirmDeleteParty() {
      this.REASSIGN_PARTY_POOL({
        fromPartyId: this.pendingDeleteParty.id,
        toPartyId: this.poolDestination,
      })
      this.finishDeleteParty(this.pendingDeleteParty.id)
      this.pendingDeleteParty = null
      this.poolDestination = null
    },

    finishDeleteParty(partyId) {
      this.SET_PARTIES(this.parties.filter((p) => p.id !== partyId))
      this.editingId = null
      this.editingParty = null
    },

    isSelected(name) {
      return !!this.editingParty?.members.includes(name)
    },

    toggleMember(name) {
      if (!this.editingParty) return
      const idx = this.editingParty.members.indexOf(name)
      if (idx === -1) this.editingParty.members.push(name)
      else this.editingParty.members.splice(idx, 1)
      this.saveParty()
    },

    topStat(char) {
      // Effective scores (dnd.resolveStats), not raw stat_* fields directly —
      // those miss feature-granted bonuses (e.g. Elven Accuracy's +1 DEX)
      // and item stat_bonuses.
      const { stats } = dnd.resolveStats(char, this.party_items)
      let best = { name: STAT_NAMES[0], score: stats.str }
      STAT_NAMES.forEach((name, i) => {
        const score = stats[STAT_FIELDS[i].replace('stat_', '')]
        if (score > best.score) best = { name, score }
      })
      return best
    },

    topSkills(char) {
      return Object.entries(dnd.allSkills(char, this.party_items))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, val]) => ({
          name,
          short: SKILL_SHORT[name] ?? name.slice(0, 4),
          signed: val >= 0 ? `+${val}` : `${val}`,
        }))
    },
  },
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-panel {
  width: 60vw;
  height: 60vh;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Modal header ── */
.modal-header {
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.modal-title {
  flex: 1;
  font-family: var(--font-display, serif);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.close-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.1rem 0.3rem;
  line-height: 1;
}
.close-btn:hover {
  color: var(--color-text-danger);
}

/* ── Body ── */
.modal-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Party column (left) ── */
.party-col {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.col-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-low);
  padding: 0.5rem 0.75rem 0.3rem;
  font-family: var(--font-display, serif);
  flex-shrink: 0;
}
.selection-hint {
  text-transform: none;
  letter-spacing: normal;
  font-family: var(--font-body);
}
.selection-hint em {
  font-style: normal;
  color: var(--color-accent);
}

.party-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.party-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  transition: background 0.1s;
}
.party-row:hover {
  background: var(--color-bg-panel);
}
.party-row.selected {
  background: var(--color-bg-panel);
  color: var(--color-accent);
}
.party-row-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.active-badge {
  font-size: var(--font-size-xs);
  background: rgba(var(--color-accent-rgb), 0.2);
  color: var(--color-accent);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  border-radius: 3px;
  padding: 1px 4px;
}
.member-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.no-parties {
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem;
  color: var(--color-text-low);
  font-style: italic;
}

.party-actions {
  padding: 0.4rem 0.75rem;
  flex-shrink: 0;
}

.edit-section {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
}

.party-name-input {
  width: 100%;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 0.8rem;
  font-family: var(--font-body);
}
.party-name-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.party-date-block {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.party-date-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
}

.party-date-inputs {
  display: flex;
  gap: 0.5rem;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex: 1;
}

.date-input {
  width: 100%;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 0.8rem;
  font-family: var(--font-body);
}
.date-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.edit-btns {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.2rem 0.55rem;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}
.action-btn:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
}
.action-btn.accent {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.action-btn.accent:hover {
  background: rgba(var(--color-accent-rgb), 0.1);
}
.action-btn.danger:hover {
  color: var(--color-text-danger);
  border-color: var(--color-text-danger);
}
.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Character column (right) ── */
.char-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.char-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  align-content: start;
}

.char-tile {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.12s, opacity 0.12s;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
}
.char-tile:hover:not(.disabled) {
  border-color: var(--color-accent);
}
.char-tile.selected {
  border-color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.08);
}
.char-tile.disabled {
  opacity: 0.45;
  cursor: default;
}

.tile-portrait {
  position: relative;
  width: 56px;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-surface);
  border-radius: 5px 0 0 5px;
}
.tile-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 20%;
}
.tile-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-accent-rgb), 0.55);
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
}

.tile-body {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tile-name {
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
.tile-class {
  font-size: 0.68rem;
  color: var(--color-text-low);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.tile-stat {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  margin-top: 2px;
}
.ts-key {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-low);
}
.ts-val {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
}

.tile-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 2px;
}
.ts-skill {
  font-size: 0.62rem;
  color: var(--color-text-low);
  background: var(--color-bg-surface);
  border-radius: 2px;
  padding: 1px 3px;
  line-height: 1.3;
}

/* ── Party-pool reassignment dialog ── */
.pool-dialog-backdrop {
  z-index: 60;
}

.pool-dialog {
  width: 340px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.4);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pool-dialog-title {
  font-family: var(--font-display, serif);
  font-size: 0.9rem;
  color: var(--color-text);
}

.pool-dialog-body {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

.pool-dest-select {
  padding: 0.35rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 0.8rem;
  font-family: var(--font-body);
}

.pool-dialog-btns {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}
</style>
