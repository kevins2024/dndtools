<template>
  <div class="calendar-view">
    <!-- Current date header -->
    <div class="cal-header">
      <div class="cal-date-info">
        <div class="cal-season-pill" :class="`season-${currentSeasonKey}`">
          {{ currentSeason }}
        </div>
        <div class="cal-detail">
          <span v-if="activeParty" class="cal-party-name">{{
            activeParty.name
          }}</span>
          <span v-if="activeParty" class="cal-sep">·</span>
          <span class="cal-year">Year {{ currentYear }}</span>
          <span class="cal-sep">·</span>
          <span>Day {{ dayOfYear }} of {{ DAYS_PER_YEAR }}</span>
          <span class="cal-sep">·</span>
          <span v-if="isFestivalDay(dayOfYear)" class="festival-tag"
            >Spring Festival · Day {{ dayOfWeek }}</span
          >
          <span v-else>Week {{ weekOfYear }}, Day {{ dayOfWeek }}</span>
        </div>
      </div>
      <div class="cal-nav">
        <button class="nav-btn" @click="advance(-7)">−7d</button>
        <button class="nav-btn" @click="advance(-1)">−1d</button>
        <button class="nav-btn accent" @click="advance(1)">+1d</button>
        <button class="nav-btn" @click="advance(7)">+7d</button>
      </div>
    </div>

    <!-- Year grid -->
    <div class="cal-grid-wrap">
      <div class="cal-year-label">Year {{ currentYear }}</div>
      <div class="cal-grid">
        <div v-for="n in DAYS_PER_WEEK" :key="`h${n}`" class="cal-col-header">
          {{ n }}
        </div>

        <!-- Weeks 1–6: days 1–48 (6 complete weeks before the halfweek) -->
        <div
          v-for="day in 48"
          :key="day"
          class="cal-cell"
          :class="cellClasses(day)"
          :title="cellTitle(day)"
          @click="selectDay(day)"
        >
          <span class="cal-num">{{ day }}</span>
          <span v-if="notesForDay(day).length" class="cal-note-dot">✦</span>
        </div>

        <!-- Spring Festival halfweek — own row, not counted as a week -->
        <div class="festival-row-label">Spring Festival</div>
        <div
          v-for="day in [49, 50, 51, 52]"
          :key="day"
          class="cal-cell"
          :class="cellClasses(day)"
          :title="cellTitle(day)"
          @click="selectDay(day)"
        >
          <span class="cal-num">{{ day }}</span>
          <span v-if="notesForDay(day).length" class="cal-note-dot">✦</span>
        </div>
        <div
          v-for="n in 4"
          :key="`sp${n}`"
          class="cal-cell cal-cell-empty"
        ></div>

        <!-- Weeks 7–25: days 53–204 (week count resumes after the halfweek) -->
        <div
          v-for="i in 152"
          :key="52 + i"
          class="cal-cell"
          :class="cellClasses(52 + i)"
          :title="cellTitle(52 + i)"
          @click="selectDay(52 + i)"
        >
          <span class="cal-num">{{ 52 + i }}</span>
          <span v-if="notesForDay(52 + i).length" class="cal-note-dot"></span>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="cal-legend">
      <span class="legend-swatch season-winter">Winter</span>
      <span class="legend-swatch season-spring">Spring</span>
      <span class="legend-swatch season-summer">Summer</span>
      <span class="legend-swatch season-autumn">Autumn</span>
      <span class="legend-swatch festival-day">Festival (49–52)</span>
    </div>

    <!-- Note editor overlay -->
    <div
      v-if="noteEditorOpen"
      class="note-overlay"
      @click.self="closeNoteEditor"
    >
      <div class="note-panel">
        <div class="note-panel-header">
          <span class="note-panel-title"
            >Day {{ noteEditorDay }} — {{ noteEditorDayLabel }}</span
          >
          <button class="note-close-btn" @click="closeNoteEditor">✕</button>
        </div>

        <!-- Existing notes for this day -->
        <div
          v-for="note in notesForEditorDay"
          :key="note.id"
          class="note-existing"
        >
          <span class="note-recur-badge">{{ note.recurrence }}</span>
          <span class="note-text-existing">{{ note.text }}</span>
          <button
            class="note-delete-btn"
            title="Delete note"
            @click="deleteNote(note.id)"
          >
            ×
          </button>
        </div>

        <!-- New note form -->
        <div class="note-form">
          <textarea
            v-model="noteDraft.text"
            class="note-textarea"
            placeholder="Add a note…"
            rows="3"
          ></textarea>
          <div class="note-form-row">
            <select v-model="noteDraft.recurrence" class="note-recur-select">
              <option value="none">Once (this day only)</option>
              <option value="weekly">Repeat weekly</option>
              <option value="seasonally">Repeat seasonally</option>
              <option value="annually">Repeat annually</option>
            </select>
            <button
              class="note-save-btn"
              :disabled="!noteDraft.text.trim()"
              @click="saveNote"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations } from 'vuex'

const DAYS_PER_YEAR = 204
const DAYS_PER_WEEK = 8
const YEAR_OFFSET = 466 // campaign year 1 = world year 467
const CAMPAIGN_START_DAY = 137 // world year 467, day 137 = campaign day 1 (absolute internal day)

const SEASONS = [
  { name: 'Winter', key: 'winter', start: 1, end: 51 },
  { name: 'Spring', key: 'spring', start: 52, end: 102 },
  { name: 'Summer', key: 'summer', start: 103, end: 153 },
  { name: 'Autumn', key: 'autumn', start: 154, end: 204 },
]

const FESTIVAL_DAYS = new Set([49, 50, 51, 52])

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
  name: 'TellondeCalendar',

  data() {
    return {
      DAYS_PER_YEAR,
      DAYS_PER_WEEK,
      noteEditorOpen: false,
      noteEditorDay: null,
      noteDraft: { text: '', recurrence: 'none' },
    }
  },

  computed: {
    ...mapState(['game_day', 'calendar_notes']),
    ...mapGetters(['activePartyDay', 'activeParty']),

    currentDay() {
      return this.activePartyDay || this.game_day
    },

    internalYear() {
      return Math.floor((this.currentDay - 1) / DAYS_PER_YEAR) + 1
    },

    currentYear() {
      return this.internalYear + YEAR_OFFSET
    },

    yearStart() {
      return (this.internalYear - 1) * DAYS_PER_YEAR
    },

    dayOfYear() {
      return ((this.currentDay - 1) % DAYS_PER_YEAR) + 1
    },

    weekOfYear() {
      const d = this.dayOfYear
      if (d <= 48) return Math.ceil(d / DAYS_PER_WEEK)
      if (d <= 52) return null // halfweek — no week number
      return 6 + Math.ceil((d - 52) / DAYS_PER_WEEK)
    },

    dayOfWeek() {
      const d = this.dayOfYear
      if (d <= 48) return ((d - 1) % DAYS_PER_WEEK) + 1
      if (d <= 52) return d - 48 // halfweek day 1–4
      return ((d - 53) % DAYS_PER_WEEK) + 1
    },

    currentSeason() {
      return seasonForDay(this.dayOfYear).name
    },

    currentSeasonKey() {
      return seasonForDay(this.dayOfYear).key
    },

    noteEditorDayLabel() {
      if (!this.noteEditorDay) return ''
      if (FESTIVAL_DAYS.has(this.noteEditorDay))
        return `Spring Festival, Day ${this.noteEditorDay - 48}`
      const s = seasonForDay(this.noteEditorDay)
      return `${s.name}`
    },

    notesForEditorDay() {
      if (!this.noteEditorDay) return []
      return this.notesForDay(this.noteEditorDay)
    },
  },

  methods: {
    ...mapMutations([
      'SET_GAME_DAY',
      'SAVE_CALENDAR_NOTE',
      'DELETE_CALENDAR_NOTE',
    ]),

    advance(delta) {
      this.SET_GAME_DAY(Math.max(1, this.currentDay + delta))
    },

    selectDay(day) {
      this.SET_GAME_DAY(this.yearStart + day)
      this.noteEditorDay = day
      this.noteEditorOpen = true
      this.noteDraft = { text: '', recurrence: 'none' }
    },

    isFestivalDay(day) {
      return FESTIVAL_DAYS.has(day)
    },

    notesForDay(day) {
      const absoluteDay = this.yearStart + day
      return this.calendar_notes.filter((n) =>
        noteMatchesDay(n, day, absoluteDay)
      )
    },

    cellClasses(day) {
      const s = seasonForDay(day)
      return {
        [`season-${s.key}`]: true,
        'festival-day': this.isFestivalDay(day),
        'current-day': day === this.dayOfYear,
        'has-note': this.notesForDay(day).length > 0,
      }
    },

    cellTitle(day) {
      const s = seasonForDay(day)
      let base
      if (FESTIVAL_DAYS.has(day)) {
        base = `Day ${day} · Spring Festival, Day ${day - 48} · ${s.name}`
      } else {
        const week =
          day <= 48
            ? Math.ceil(day / DAYS_PER_WEEK)
            : 6 + Math.ceil((day - 52) / DAYS_PER_WEEK)
        const dow =
          day <= 48
            ? ((day - 1) % DAYS_PER_WEEK) + 1
            : ((day - 53) % DAYS_PER_WEEK) + 1
        base = `Day ${day} · ${s.name} · Week ${week}, Day ${dow}`
      }
      const notes = this.notesForDay(day)
      if (notes.length) {
        base += '\n' + notes.map((n) => `📌 ${n.text}`).join('\n')
      }
      return base
    },

    saveNote() {
      if (!this.noteDraft.text.trim()) return
      const note = {
        id: `note_${Date.now()}`,
        text: this.noteDraft.text.trim(),
        recurrence: this.noteDraft.recurrence,
        day_of_year: this.noteEditorDay,
        absolute_day: this.yearStart + this.noteEditorDay,
      }
      this.SAVE_CALENDAR_NOTE(note)
      this.noteDraft = { text: '', recurrence: 'none' }
    },

    deleteNote(id) {
      this.DELETE_CALENDAR_NOTE(id)
    },

    closeNoteEditor() {
      this.noteEditorOpen = false
      this.noteEditorDay = null
    },
  },
}
</script>

<style scoped>
.calendar-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  height: 100%;
  overflow-y: auto;
}

/* ── Header ─────────────────────────────────────── */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
}

.cal-date-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cal-season-pill {
  font-family: var(--font-display, serif);
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: 3px;
  font-weight: 600;
}

.cal-detail {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.cal-party-name {
  color: var(--color-accent);
  font-weight: 600;
  font-family: var(--font-display);
  letter-spacing: 0.02em;
}

.cal-year {
  color: var(--color-text);
  font-weight: 600;
}

.cal-sep {
  color: var(--color-text-low);
}

.festival-tag {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  background: rgba(200, 160, 80, 0.25);
  color: #c8a050;
  border: 1px solid rgba(200, 160, 80, 0.4);
}

.cal-nav {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.nav-btn {
  font-size: 0.78rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  border-radius: 3px;
  cursor: pointer;
  font-family: var(--font-display, serif);
  letter-spacing: 0.03em;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}

.nav-btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-low);
}

.nav-btn.accent {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.nav-btn.accent:hover {
  opacity: 0.85;
}

/* ── Grid ────────────────────────────────────────── */
.cal-grid-wrap {
  flex-shrink: 0;
}

.cal-year-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
  margin-bottom: 0.35rem;
  font-family: var(--font-display, serif);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.cal-col-header {
  font-size: var(--font-size-xs);
  text-align: center;
  color: var(--color-text-low);
  letter-spacing: 0.05em;
  padding-bottom: 3px;
  font-family: var(--font-display, serif);
}

.cal-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  transition: filter 0.1s, outline 0.1s;
  user-select: none;
}

.cal-cell:hover {
  filter: brightness(1.3);
  z-index: 1;
}

.cal-num {
  line-height: 1;
}

/* Note dot indicator */
.cal-note-dot {
  position: absolute;
  bottom: 1px;
  right: 2px;
  font-size: 8px;
  line-height: 1;
  color: #f0c040;
  pointer-events: none;
  text-shadow: 0 0 4px rgba(240, 192, 64, 0.6);
}

/* Subtle ring on cells with notes */
.has-note {
  box-shadow: inset 0 0 0 1px rgba(240, 192, 64, 0.45);
}

/* Season colors — muted for dark theme */
.season-winter {
  background: rgba(80, 120, 180, 0.25);
  color: #88aad8;
}
.season-spring {
  background: rgba(80, 160, 90, 0.22);
  color: #7dba87;
}
.season-summer {
  background: rgba(180, 130, 50, 0.25);
  color: #c8a050;
}
.season-autumn {
  background: rgba(180, 80, 50, 0.25);
  color: #c87050;
}

/* Festival row label — spans full grid width */
.festival-row-label {
  grid-column: 1 / -1;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #c8a050;
  font-family: var(--font-display, serif);
  padding: 3px 4px 2px;
  border-top: 1px solid rgba(200, 160, 80, 0.35);
  border-bottom: 1px solid rgba(200, 160, 80, 0.2);
  background: rgba(200, 160, 80, 0.06);
  margin-top: 1px;
}

/* Empty spacer cells after the 4 festival days */
.cal-cell-empty {
  background: transparent !important;
  pointer-events: none;
  opacity: 0;
}

/* Festival overlay — amber glow */
.festival-day {
  outline: 1px solid rgba(200, 160, 80, 0.6);
  background: rgba(200, 160, 80, 0.22) !important;
  color: #d4b060 !important;
}

/* Current day */
.current-day {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
  font-weight: 700;
  z-index: 2;
  color: #fff !important;
  filter: brightness(1.4);
}

/* Season pill colors */
.cal-season-pill.season-winter {
  background: rgba(80, 120, 180, 0.3);
  color: #88aad8;
}
.cal-season-pill.season-spring {
  background: rgba(80, 160, 90, 0.28);
  color: #7dba87;
}
.cal-season-pill.season-summer {
  background: rgba(180, 130, 50, 0.3);
  color: #c8a050;
}
.cal-season-pill.season-autumn {
  background: rgba(180, 80, 50, 0.3);
  color: #c87050;
}

/* ── Legend ──────────────────────────────────────── */
.cal-legend {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.legend-swatch {
  font-size: var(--font-size-xs);
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
}

.legend-swatch.season-winter {
  background: rgba(80, 120, 180, 0.25);
  color: #88aad8;
}
.legend-swatch.season-spring {
  background: rgba(80, 160, 90, 0.22);
  color: #7dba87;
}
.legend-swatch.season-summer {
  background: rgba(180, 130, 50, 0.25);
  color: #c8a050;
}
.legend-swatch.season-autumn {
  background: rgba(180, 80, 50, 0.25);
  color: #c87050;
}
.legend-swatch.festival-day {
  background: rgba(200, 160, 80, 0.22);
  color: #d4b060;
  outline: 1px solid rgba(200, 160, 80, 0.5);
}

/* ── Note editor overlay ─────────────────────────── */
.note-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
}

.note-panel {
  width: min(420px, 90vw);
  background: var(--color-bg-surface);
  border: 1px solid rgba(200, 160, 80, 0.45);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.note-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.1rem;
}

.note-panel-title {
  font-size: 0.82rem;
  font-family: var(--font-display, serif);
  color: #c8a050;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.note-close-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0;
  transition: color 0.1s;
}

.note-close-btn:hover {
  color: var(--color-text-danger);
}

.note-existing {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.note-recur-badge {
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

.note-text-existing {
  flex: 1;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.note-delete-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: 1rem;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.1s;
}

.note-delete-btn:hover {
  color: var(--color-text-danger);
}

.note-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.note-textarea {
  width: 100%;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  padding: 0.3rem 0.45rem;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.note-textarea:focus {
  outline: 1px solid rgba(200, 160, 80, 0.7);
  border-color: rgba(200, 160, 80, 0.7);
}

.note-form-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.note-recur-select {
  flex: 1;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  padding: 0.25rem 0.4rem;
  cursor: pointer;
}

.note-save-btn {
  padding: 0.25rem 0.85rem;
  background: rgba(200, 160, 80, 0.8);
  color: #0e0c09;
  border: none;
  border-radius: 4px;
  font-family: var(--font-display, serif);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.12s;
}

.note-save-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.note-save-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
