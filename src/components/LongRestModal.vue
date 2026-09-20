<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel">
      <!-- ── Header ── -->
      <div class="modal-header">
        <span class="modal-title">{{ stepTitle }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- ══ STEP 1: Watches ══════════════════════════ -->
      <template v-if="step === 'watches'">
        <div class="watches-body" @click="closePicker">
          <div class="watch-intro">
            Each slot = 2 hrs. A character in more than one slot exceeds the
            2-hr limit and won't benefit from this long rest.
          </div>

          <div class="watch-grid">
            <div v-for="(slot, si) in watches" :key="si" class="watch-row">
              <span class="slot-label"
                >Hrs {{ si * 2 + 1 }}–{{ (si + 1) * 2 }}</span
              >

              <div v-for="pi in [0, 1]" :key="pi" class="slot-wrap">
                <!-- Slot chip -->
                <div
                  class="slot-chip"
                  :class="{
                    'slot-filled': watches[si][pi],
                    'slot-overwatch':
                      watches[si][pi] && isOverwatch(watches[si][pi]),
                  }"
                  @click.stop="togglePicker(si, pi, $event)"
                >
                  <template v-if="watches[si][pi]">
                    <img :src="charImage(watches[si][pi])" class="slot-face" />
                    <span class="slot-name">{{ watches[si][pi] }}</span>
                    <span
                      v-if="isOverwatch(watches[si][pi])"
                      class="slot-warn-icon"
                      title="In multiple slots — won't long rest"
                      >⚠</span
                    >
                    <button
                      class="slot-x"
                      @click.stop="clearSlot(si, pi)"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </template>
                  <span v-else class="slot-empty">＋</span>
                </div>

                <!-- Inline picker dropdown -->
                <div
                  v-if="
                    pickerTarget &&
                    pickerTarget.si === si &&
                    pickerTarget.pi === pi
                  "
                  class="slot-picker"
                  :style="pickerStyle"
                  @click.stop
                >
                  <div
                    v-for="char in members"
                    :key="char.name"
                    class="picker-option"
                    :class="{
                      'picker-active': watches[si][pi] === char.name,
                      'picker-taken': watches[si][1 - pi] === char.name,
                      'picker-overwatch':
                        wouldBeOverwatch(char.name, si, pi) &&
                        watches[si][pi] !== char.name,
                    }"
                    @click="
                      watches[si][1 - pi] !== char.name && pickChar(char.name)
                    "
                  >
                    <img :src="char.image" class="picker-face" />
                    <div class="picker-text">
                      <span class="picker-name">{{ char.name }}</span>
                      <span class="picker-class">{{
                        $dnd.classLabel(char)
                      }}</span>
                    </div>
                    <div class="picker-badges">
                      <span class="picker-perc">{{ signedPerc(char) }}</span>
                      <span v-if="char.darkvision" class="picker-dv">DV</span>
                      <span
                        v-if="
                          wouldBeOverwatch(char.name, si, pi) &&
                          watches[si][pi] !== char.name
                        "
                        class="picker-norest"
                        title="Already on watch — a 2nd slot means no long rest"
                        >2nd slot</span
                      >
                    </div>
                  </div>
                  <div
                    v-if="watches[si][pi]"
                    class="picker-clear"
                    @click.stop="
                      clearSlot(si, pi)
                      closePicker()
                    "
                  >
                    Clear slot
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Calendar notes for today -->
          <div v-if="todaysNotes.length" class="today-notes">
            <div class="today-notes-header">📅 Today's Calendar Notes</div>
            <div v-for="note in todaysNotes" :key="note.id" class="today-note">
              <span class="today-note-recur">{{ note.recurrence }}</span>
              <span class="today-note-text">{{ note.text }}</span>
            </div>
          </div>

          <!-- Overwatch warning -->
          <div v-if="overwatchChars.length" class="overwatch-warning">
            <span class="warn-icon">⚠</span>
            <strong>{{ overwatchChars.join(', ') }}</strong>
            {{ overwatchChars.length === 1 ? 'is' : 'are' }} on watch for 4+
            hours — no long rest benefit and will gain 1 Exhaustion.
          </div>

          <!-- Interruption check — rolls the d4 (which watch slot) + d20
               (best Perception of that slot's pair) in one click, same
               mechanical work the DM used to do by hand in the separate
               dice drawer. Deliberately stops at the numbers — there's no
               authored outcome table for this like Travel Roll's, so what
               actually happens is still the DM's call. -->
          <div class="interruption-check">
            <button
              class="roll-interruption-btn"
              @click="rollInterruptionCheck"
            >
              🎲 Roll Interruption Check
            </button>
            <div v-if="interruptionResult" class="interruption-result">
              <span class="interruption-slot"
                >Hrs {{ interruptionResult.slotIdx * 2 + 1 }}–{{
                  (interruptionResult.slotIdx + 1) * 2
                }}</span
              >
              <span class="interruption-names">{{
                interruptionResult.names.length
                  ? interruptionResult.names.join(' & ')
                  : 'nobody on watch'
              }}</span>
              <span class="interruption-math"
                >rolled {{ interruptionResult.d20 }}
                {{ interruptionResult.mod >= 0 ? '+' : '−' }}
                {{ Math.abs(interruptionResult.mod) }} =
                <strong>{{ interruptionResult.total }}</strong></span
              >
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="footer-summary">
            <template v-if="overwatchChars.length">
              {{ members.length - overwatchChars.length }} of
              {{ members.length }} members will long rest
            </template>
            <template v-else-if="totalWatchers === 0">
              No watch assigned — everyone sleeps
            </template>
            <template v-else>
              All {{ members.length }} members will long rest
            </template>
          </div>
          <button class="rest-btn" @click="beginRest">Begin Long Rest →</button>
        </div>
      </template>

      <!-- ══ STEP 2: Marching Order ═══════════════════ -->
      <template v-else-if="step === 'marching'">
        <div v-if="preparedCastersToRemind.length" class="spell-prep-reminder">
          <span class="spell-prep-icon">📖</span>
          <span>
            Rest is applied — remember to re-prepare spells for
            <strong>{{
              preparedCastersToRemind.map((c) => c.name).join(', ')
            }}</strong>
            (Spellbook tab).
          </span>
        </div>
        <div class="march-intro">
          Drag or use arrows to set today's marching order. Perception and
          Survival shown — the character in front leads travel rolls.
        </div>
        <div class="march-body">
          <div class="march-list">
            <div
              v-for="(name, idx) in marchOrder"
              :key="name"
              class="march-row"
              :class="{ 'is-tracker': idx === 0 }"
            >
              <span class="march-pos">{{ idx + 1 }}</span>
              <div class="march-avatar">
                <img :src="charImage(name)" class="avatar-img" />
              </div>
              <div class="march-info">
                <div class="march-name">
                  {{ name }}
                  <span v-if="idx === 0" class="tracker-badge">Tracker</span>
                </div>
                <div class="march-class">{{ charClass(name) }}</div>
              </div>
              <div class="march-stats">
                <div class="march-perc">
                  <span class="perc-label">Perc</span>
                  <span class="perc-val">{{ signedPercByName(name) }}</span>
                </div>
                <div
                  class="march-perc"
                  :class="{ 'is-tracker-stat': idx === 0 }"
                >
                  <span class="perc-label">Surv</span>
                  <span class="perc-val">{{ signedSurvByName(name) }}</span>
                </div>
              </div>
              <div class="march-btns">
                <button
                  class="arrow-btn"
                  :disabled="idx === 0"
                  @click="moveUp(idx)"
                >
                  ▲
                </button>
                <button
                  class="arrow-btn"
                  :disabled="idx === marchOrder.length - 1"
                  @click="moveDown(idx)"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="skip-btn" @click="skipAndSave">Skip</button>
          <button class="rest-btn" @click="saveMarchingOrder">
            Set Marching Order
          </button>
        </div>
      </template>

      <!-- ══ STEP 3: Relationships ═══════════════════ -->
      <template v-else-if="step === 'relationships'">
        <div class="rel-step-intro">
          Everyone in the party spent today together. Adjust how each pair's
          bond changed — defaults to +1.
        </div>
        <div class="rel-step-body">
          <div v-if="!relationshipPairs.length" class="rel-step-empty">
            Not enough party members to track a relationship.
          </div>
          <div v-else class="rel-pair-list">
            <div
              v-for="pair in relationshipPairs"
              :key="pair.key"
              class="rel-pair-row"
            >
              <div class="rel-pair-names">
                {{ pair.nameA }} ↔ {{ pair.nameB }}
              </div>
              <div class="rel-pair-current">{{ pair.currentScore }}</div>
              <div class="rel-pair-delta">
                <button
                  class="rel-delta-btn rel-delta-btn--sm"
                  @click="adjustDelta(pair.key, -5)"
                >
                  −5
                </button>
                <button
                  class="rel-delta-btn"
                  @click="adjustDelta(pair.key, -1)"
                >
                  −
                </button>
                <span class="rel-delta-val">{{
                  signedDelta(relationshipDeltas[pair.key] || 0)
                }}</span>
                <button class="rel-delta-btn" @click="adjustDelta(pair.key, 1)">
                  +
                </button>
                <button
                  class="rel-delta-btn rel-delta-btn--sm"
                  @click="adjustDelta(pair.key, 5)"
                >
                  +5
                </button>
              </div>
              <div class="rel-pair-preview">→ {{ previewScore(pair) }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="skip-btn" @click="skipRelationships">Skip</button>
          <button class="rest-btn" @click="saveRelationships">
            Save Relationships
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations } from 'vuex'
import { dnd } from '@/utils/dnd_utils'
import { isPreparedCaster } from '@/utils/spellUtils.js'

const DAYS_PER_YEAR = 204
const SEASONS = [
  { name: 'Winter', key: 'winter', start: 1, end: 51 },
  { name: 'Spring', key: 'spring', start: 52, end: 102 },
  { name: 'Summer', key: 'summer', start: 103, end: 153 },
  { name: 'Autumn', key: 'autumn', start: 154, end: 204 },
]

function seasonForDay(day) {
  return SEASONS.find((s) => day >= s.start && day <= s.end) ?? SEASONS[0]
}

function dowForDay(day) {
  if (day <= 48) return ((day - 1) % 8) + 1
  if (day <= 52) return day - 48
  return ((day - 53) % 8) + 1
}

function noteMatchesDay(note, dayOfYear, absoluteDay) {
  switch (note.recurrence) {
    case 'none':
      return note.absolute_day === absoluteDay
    case 'annually':
      return note.day_of_year === dayOfYear
    case 'weekly':
      return dowForDay(dayOfYear) === dowForDay(note.day_of_year)
    case 'seasonally': {
      const cs = seasonForDay(dayOfYear)
      const ns = seasonForDay(note.day_of_year)
      return (
        cs.key === ns.key &&
        dayOfYear - cs.start === note.day_of_year - ns.start
      )
    }
  }
  return false
}

export default {
  name: 'LongRestModal',
  emits: ['close', 'rested'],

  data() {
    return {
      step: 'watches',
      watches: [
        [null, null],
        [null, null],
        [null, null],
        [null, null],
      ],
      pickerTarget: null, // { si, pi }
      marchOrder: [],
      relationshipDeltas: {}, // pair key → staged delta, set when entering the step
      interruptionResult: null,
    }
  },

  computed: {
    ...mapState([
      'characters',
      'party_items',
      'parties',
      'calendar_notes',
      'relationships',
    ]),
    ...mapGetters(['activeParty', 'activePartyDay']),

    stepTitle() {
      if (this.step === 'watches') return 'Long Rest — Watch Assignment'
      if (this.step === 'marching') return 'Marching Order'
      return 'Relationship Check-in'
    },

    // Every unique pair of current party members, with their current
    // relationship strength (0 if no relationship record exists yet).
    relationshipPairs() {
      const members = this.members
      const pairs = []
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const nameA = members[i].name
          const nameB = members[j].name
          const existing = this.findRelationship(nameA, nameB)
          pairs.push({
            key: `${nameA}|${nameB}`,
            nameA,
            nameB,
            currentScore: existing?.strength ?? 0,
            existing: existing ?? null,
          })
        }
      }
      return pairs
    },

    todaysNotes() {
      const currentDay = this.activePartyDay || 1
      const dayOfYear = ((currentDay - 1) % DAYS_PER_YEAR) + 1
      return (this.calendar_notes ?? []).filter((n) =>
        noteMatchesDay(n, dayOfYear, currentDay)
      )
    },

    members() {
      if (!this.activeParty) return []
      return this.activeParty.members
        .map((name) => this.characters.find((c) => c.name === name))
        .filter(Boolean)
    },

    // Prepared casters (Cleric/Druid/Wizard/Artificer/Paladin/Ranger) who
    // actually got the rest benefit — excludes anyone in overwatchChars,
    // since a character who didn't get to finish the rest hasn't earned a
    // fresh prepared-spell list either. Surfaced as a reminder because
    // nothing else in the app prompts a re-prepare after a long rest.
    preparedCastersToRemind() {
      return this.members.filter(
        (c) => isPreparedCaster(c) && !this.overwatchChars.includes(c.name)
      )
    },

    // How many slots each character appears in
    watchSlotCount() {
      const counts = {}
      for (const slot of this.watches) {
        for (const name of slot) {
          if (name) counts[name] = (counts[name] ?? 0) + 1
        }
      }
      return counts
    },

    // Characters in 2+ slots (exceed the 2-hr limit)
    overwatchChars() {
      return Object.entries(this.watchSlotCount)
        .filter(([, c]) => c > 1)
        .map(([name]) => name)
    },

    totalWatchers() {
      return Object.keys(this.watchSlotCount).length
    },

    pickerStyle() {
      if (!this.pickerTarget?.bottom) return {}
      const { left, width, top, bottom } = this.pickerTarget
      const spaceBelow = window.innerHeight - bottom - 8
      const openUp = spaceBelow < 180
      return {
        position: 'fixed',
        left: `${left}px`,
        width: `${width}px`,
        zIndex: 200,
        ...(openUp
          ? {
              bottom: `${window.innerHeight - top + 4}px`,
              maxHeight: `${top - 12}px`,
            }
          : {
              top: `${bottom + 4}px`,
              maxHeight: `${spaceBelow}px`,
            }),
      }
    },
  },

  beforeDestroy() {
    // Ensure any in-memory party changes (e.g. game_day from LONG_REST) are persisted
    // regardless of which button closed the modal
    this.SET_PARTIES([...this.parties])
  },

  created() {
    const party = this.activeParty
    const memberNames = party?.members ?? []

    // Restore saved watch assignments
    const savedWatches = party?.watch_assignments
    if (savedWatches?.length === 4) {
      this.watches = savedWatches.map((slot) => [...slot])
    }

    // Restore marching order
    const savedOrder = party?.marching_order ?? []
    const ordered = savedOrder.filter((n) => memberNames.includes(n))
    const missing = memberNames.filter((n) => !ordered.includes(n))
    this.marchOrder = [...ordered, ...missing]
  },

  watch: {
    watches: {
      deep: true,
      handler(val) {
        const updated = this.parties.map((p) =>
          p.active ? { ...p, watch_assignments: val.map((s) => [...s]) } : p
        )
        this.SET_PARTIES(updated)
      },
    },
  },

  methods: {
    ...mapMutations(['LONG_REST', 'SET_PARTIES', 'UPDATE_TABLE_ITEM']),

    // d4 picks which of the 4 watch slots is being checked, d20 + the
    // higher Perception mod of that slot's pair is the check itself —
    // exactly the two rolls that used to be done by hand in the separate
    // dice drawer. An empty/unassigned slot still rolls (mod +0, "nobody
    // on watch" shown) rather than being skipped, since that's itself a
    // meaningful result.
    rollInterruptionCheck() {
      const slotIdx = Math.floor(Math.random() * 4)
      const names = (this.watches[slotIdx] ?? []).filter(Boolean)
      const mods = names.map((n) => {
        const char = this.characters.find((c) => c.name === n)
        return char ? dnd.skill(char, 'Perception', this.party_items) : 0
      })
      const mod = mods.length ? Math.max(...mods) : 0
      const d20 = Math.floor(Math.random() * 20) + 1
      this.interruptionResult = { slotIdx, names, mod, d20, total: d20 + mod }
    },

    signedPerc(char) {
      const val = dnd.skill(char, 'Perception', this.party_items)
      return val >= 0 ? `+${val}` : `${val}`
    },

    signedPercByName(name) {
      const char = this.characters.find((c) => c.name === name)
      if (!char) return '—'
      return this.signedPerc(char)
    },

    signedSurv(char) {
      const val = dnd.skill(char, 'Survival', this.party_items)
      return val >= 0 ? `+${val}` : `${val}`
    },

    signedSurvByName(name) {
      const char = this.characters.find((c) => c.name === name)
      if (!char) return '—'
      return this.signedSurv(char)
    },

    charImage(name) {
      return this.characters.find((c) => c.name === name)?.image ?? ''
    },

    charClass(name) {
      const char = this.characters.find((c) => c.name === name)
      return char ? dnd.classLabel(char) : ''
    },

    isOverwatch(name) {
      return (this.watchSlotCount[name] ?? 0) > 1
    },

    // Would assigning this char to (si, pi) result in them being in 2+ slots?
    wouldBeOverwatch(name, si, pi) {
      let count = 0
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          if (i === si && j === pi) continue
          if (this.watches[i][j] === name) count++
        }
      }
      return count >= 1
    },

    togglePicker(si, pi, event) {
      if (this.pickerTarget?.si === si && this.pickerTarget?.pi === pi) {
        this.pickerTarget = null
      } else {
        const r = event.currentTarget.getBoundingClientRect()
        this.pickerTarget = {
          si,
          pi,
          left: r.left,
          width: r.width,
          top: r.top,
          bottom: r.bottom,
        }
      }
    },

    closePicker() {
      this.pickerTarget = null
    },

    pickChar(name) {
      if (!this.pickerTarget) return
      const { si, pi } = this.pickerTarget
      if (this.watches[si][1 - pi] === name) return
      this.$set(this.watches[si], pi, name)
      this.pickerTarget = null
    },

    clearSlot(si, pi) {
      this.$set(this.watches[si], pi, null)
    },

    beginRest() {
      this.LONG_REST({ skipChars: this.overwatchChars })
      this.$emit('rested')
      this.step = 'marching'
    },

    moveUp(idx) {
      if (idx === 0) return
      const arr = [...this.marchOrder]
      ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
      this.marchOrder = arr
    },

    moveDown(idx) {
      if (idx === this.marchOrder.length - 1) return
      const arr = [...this.marchOrder]
      ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
      this.marchOrder = arr
    },

    skipAndSave() {
      // Persist game_day increment from LONG_REST without changing marching order
      this.SET_PARTIES([...this.parties])
      this.enterRelationshipsStep()
    },

    saveMarchingOrder() {
      const updated = this.parties.map((p) =>
        p.active ? { ...p, marching_order: [...this.marchOrder] } : p
      )
      this.SET_PARTIES(updated)
      this.enterRelationshipsStep()
    },

    // ── Relationships ──

    findRelationship(nameA, nameB) {
      const a = nameA.toLowerCase()
      const b = nameB.toLowerCase()
      return (this.relationships ?? []).find(
        (r) => r.people.includes(a) && r.people.includes(b)
      )
    },

    signedDelta(n) {
      return dnd.signed(n)
    },

    clampStrength(n) {
      return Math.max(-200, Math.min(200, n))
    },

    previewScore(pair) {
      const delta = this.relationshipDeltas[pair.key] ?? 0
      return this.clampStrength(pair.currentScore + delta)
    },

    enterRelationshipsStep() {
      const deltas = {}
      for (const pair of this.relationshipPairs) {
        deltas[pair.key] = 1
      }
      this.relationshipDeltas = deltas
      this.step = 'relationships'
    },

    adjustDelta(key, delta) {
      this.relationshipDeltas[key] = (this.relationshipDeltas[key] ?? 0) + delta
    },

    nextRelationshipId() {
      const maxNum = this.relationships.reduce((max, r) => {
        const m = /^rel_(\d+)$/.exec(r.id ?? '')
        return m ? Math.max(max, parseInt(m[1], 10)) : max
      }, 0)
      return `rel_${maxNum + 1}`
    },

    saveRelationships() {
      for (const pair of this.relationshipPairs) {
        const delta = this.relationshipDeltas[pair.key] ?? 0
        if (pair.existing) {
          if (delta === 0) continue
          this.UPDATE_TABLE_ITEM({
            table: 'relationships',
            updatedItem: {
              ...pair.existing,
              strength: this.clampStrength(pair.existing.strength + delta),
            },
          })
        } else {
          this.UPDATE_TABLE_ITEM({
            table: 'relationships',
            updatedItem: {
              id: this.nextRelationshipId(),
              people: [pair.nameA.toLowerCase(), pair.nameB.toLowerCase()],
              type: null,
              notes: '',
              strength: this.clampStrength(delta),
            },
          })
        }
      }
      this.$emit('close')
    },

    skipRelationships() {
      // "No changes" means no score adjustment — but every party pair should
      // still end up with at least a bare relationship record.
      for (const pair of this.relationshipPairs) {
        if (pair.existing) continue
        this.UPDATE_TABLE_ITEM({
          table: 'relationships',
          updatedItem: {
            id: this.nextRelationshipId(),
            people: [pair.nameA.toLowerCase(), pair.nameB.toLowerCase()],
            type: null,
            notes: '',
            strength: 0,
          },
        })
      }
      this.$emit('close')
    },
  },
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.modal-panel {
  width: min(68vw, 820px);
  max-height: 82vh;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.modal-title {
  flex: 1;
  font-family: var(--font-display, serif);
  font-size: 0.85rem;
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

/* ── Watches body ── */
.watches-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.watch-intro {
  font-size: 0.76rem;
  color: var(--color-text-low);
  line-height: 1.4;
}

/* ── Watch grid ── */
.watch-grid {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.watch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.slot-label {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.06em;
  color: var(--color-text-low);
  width: 5rem;
  flex-shrink: 0;
}

/* ── Slot chip ── */
.slot-wrap {
  position: relative;
  flex: 1;
}

.slot-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px dashed var(--color-border);
  border-radius: 5px;
  cursor: pointer;
  min-height: 2.4rem;
  transition: border-color 0.1s, background 0.12s;
  user-select: none;
}
.slot-chip:hover {
  border-color: var(--color-accent);
  background: var(--color-bg-panel-dark);
}
.slot-chip.slot-filled {
  border-style: solid;
  border-color: var(--color-border);
}
.slot-chip.slot-overwatch {
  border-color: rgba(200, 120, 40, 0.6);
  background: rgba(200, 120, 40, 0.06);
}

.slot-face {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 20%;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.slot-name {
  flex: 1;
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slot-warn-icon {
  font-size: var(--font-size-xs);
  color: #c8963a;
  flex-shrink: 0;
}
.slot-x {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-xs);
  padding: 0 0.1rem;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.1s;
}
.slot-x:hover {
  color: var(--color-text-danger);
}
.slot-empty {
  font-size: 1rem;
  color: var(--color-text-low);
  margin: 0 auto;
}

/* ── Picker dropdown ── */
.slot-picker {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  overflow-y: auto;
}

.picker-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  transition: background 0.08s;
}
.picker-option:hover:not(.picker-taken) {
  background: var(--color-bg-panel);
}
.picker-option.picker-active {
  background: rgba(var(--color-accent-rgb), 0.1);
}
.picker-option.picker-taken {
  color: var(--color-text-low);
  cursor: not-allowed;
}
.picker-option.picker-overwatch {
  color: var(--color-text-muted);
}

.picker-face {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 20%;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.picker-text {
  flex: 1;
  min-width: 0;
}
.picker-name {
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picker-class {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.picker-badges {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}
.picker-perc {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  font-weight: 600;
  color: var(--color-accent);
}
.picker-dv {
  font-size: var(--font-size-xs);
  background: rgba(80, 60, 120, 0.7);
  color: #c8a8f0;
  border: 1px solid rgba(180, 130, 255, 0.35);
  border-radius: 3px;
  padding: 1px 4px;
}
.picker-norest {
  font-size: var(--font-size-xs);
  color: #c8963a;
  background: rgba(200, 150, 58, 0.1);
  border: 1px solid rgba(200, 150, 58, 0.3);
  border-radius: 3px;
  padding: 1px 4px;
}
.picker-clear {
  padding: 0.3rem 0.65rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  cursor: pointer;
  border-top: 1px solid var(--color-border);
  transition: color 0.1s;
}
.picker-clear:hover {
  color: var(--color-text-danger);
}

/* ── Calendar notes ── */
.today-notes {
  border: 1px solid rgba(200, 160, 80, 0.5);
  background: rgba(200, 160, 80, 0.07);
  border-radius: 5px;
  padding: 0.55rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.today-notes-header {
  font-size: 0.75rem;
  font-family: var(--font-display, serif);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #c8a050;
  margin-bottom: 0.1rem;
}

.today-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
}

.today-note-recur {
  font-size: var(--font-size-xs);
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(200, 160, 80, 0.15);
  color: #c8a050;
  border: 1px solid rgba(200, 160, 80, 0.3);
  flex-shrink: 0;
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
}

.today-note-text {
  font-size: 0.82rem;
  color: #d4b060;
  line-height: 1.4;
}

/* ── Overwatch warning ── */
.overwatch-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: #c8963a;
  background: rgba(200, 150, 58, 0.08);
  border: 1px solid rgba(200, 150, 58, 0.3);
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
}
.warn-icon {
  flex-shrink: 0;
  font-size: 0.85rem;
}

/* ── Interruption check ── */
.interruption-check {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.roll-interruption-btn {
  padding: 0.3rem 0.9rem;
  background: var(--color-bg-panel);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 5px;
  font-family: var(--font-display, serif);
  font-size: 0.8rem;
  cursor: pointer;
  flex-shrink: 0;
}

.roll-interruption-btn:hover {
  color: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.interruption-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--color-text-low);
}

.interruption-slot {
  font-family: var(--font-display, serif);
  color: var(--color-text);
}

.interruption-math {
  color: var(--color-text);
}

/* ── Footer ── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1.1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
  gap: 1rem;
}
.footer-summary {
  font-size: 0.78rem;
  color: var(--color-text-low);
}

.rest-btn {
  padding: 0.35rem 1.2rem;
  background: var(--color-accent);
  color: #0e0c09;
  border: none;
  border-radius: 5px;
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.12s;
}
.rest-btn:hover {
  opacity: 0.85;
}
.skip-btn {
  padding: 0.35rem 0.9rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  cursor: pointer;
}
.skip-btn:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
}

/* ── Marching order ── */
.march-intro {
  font-size: 0.78rem;
  color: var(--color-text-low);
  padding: 0.6rem 1.1rem 0;
  flex-shrink: 0;
}
.spell-prep-reminder {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.6rem 1.1rem 0;
  padding: 0.5rem 0.7rem;
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--color-text);
  background: rgba(var(--color-info-rgb), 0.12);
  border: 1px solid rgba(var(--color-info-rgb), 0.4);
  border-radius: 6px;
}
.spell-prep-icon {
  flex-shrink: 0;
}

.march-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.1rem;
}
.march-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.march-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 5px;
}
.march-row.is-tracker {
  border-color: var(--color-accent);
}
.march-pos {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  width: 1.2rem;
  text-align: center;
  flex-shrink: 0;
}
.march-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 20%;
}
.march-info {
  flex: 1;
  min-width: 0;
}
.march-name {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.march-class {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.tracker-badge {
  font-family: var(--font-body, sans-serif);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 3px;
  padding: 0.05rem 0.3rem;
}
.march-stats {
  display: flex;
  gap: 0.7rem;
  flex-shrink: 0;
}
.march-perc {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  flex-shrink: 0;
}
.perc-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-low);
}
.perc-val {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
}
.is-tracker-stat .perc-label,
.is-tracker-stat .perc-val {
  color: var(--color-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.march-btns {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.arrow-btn {
  width: 1.4rem;
  height: 1rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.55rem;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.1s, border-color 0.1s;
}
.arrow-btn:hover:not(:disabled) {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.arrow-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* ── Relationships ── */
.rel-step-intro {
  font-size: 0.78rem;
  color: var(--color-text-low);
  padding: 0.6rem 1.1rem 0;
  flex-shrink: 0;
}
.rel-step-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.1rem;
}
.rel-step-empty {
  color: var(--color-text-low);
  font-size: 0.82rem;
  padding: 1.5rem 0;
  text-align: center;
}
.rel-pair-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rel-pair-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 5px;
}
.rel-pair-names {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
}
.rel-pair-current {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
  width: 2rem;
  text-align: right;
}
.rel-pair-delta {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.rel-delta-val {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
  width: 2.2rem;
  text-align: center;
}
.rel-delta-btn {
  min-width: 1.6rem;
  height: 1.4rem;
  padding: 0 0.3rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.72rem;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.1s, border-color 0.1s;
}
.rel-delta-btn--sm {
  font-size: 0.62rem;
  color: var(--color-text-low);
}
.rel-delta-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.rel-pair-preview {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
  width: 2.2rem;
}
</style>
