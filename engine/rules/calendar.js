// Tellonde's custom calendar: a 204-day year of 4 seasons (51 days each),
// 8-day weeks, and a 4-day "Festival" half-week (days 49-52) with no week
// number. Everything operates on a single integer "day count" — days since
// campaign day 1 — matching party.game_day, or on a day-of-year (1-204).
//
// Consolidated 2026-10-01: this math had been hand-copied into three places
// (src/utils/calendar_utils.js, TellondeCalendar.vue, and LongRestModal.vue's
// note-matching) that had already begun to drift — the two Vue copies each
// carried their own SEASONS table and day-of-week function. They now all go
// through this file.
//
// Campaign-level rules (not 5e), so this sits beside houseRules.js.
//
// Zero dependencies — browser code require()s this directly; see
// src/utils/calendar_utils.js.

const DAYS_PER_YEAR = 204
const DAYS_PER_WEEK = 8
// Campaign year 1 = world year 467 (display only — the internal year stays
// 1-based).
const YEAR_OFFSET = 466

const SEASONS = [
  { name: 'Winter', key: 'winter', start: 1, end: 51 },
  { name: 'Spring', key: 'spring', start: 52, end: 102 },
  { name: 'Summer', key: 'summer', start: 103, end: 153 },
  { name: 'Autumn', key: 'autumn', start: 154, end: 204 },
]

const FESTIVAL_START = 49
const FESTIVAL_END = 52

function dayOfYear(dayCount) {
  return ((dayCount - 1) % DAYS_PER_YEAR) + 1
}

function yearFromDayCount(dayCount) {
  return Math.floor((dayCount - 1) / DAYS_PER_YEAR) + 1
}

// Inverse of dayOfYear/yearFromDayCount — combine a (year, day-of-year)
// pair back into a single day count. `doy` is clamped to [1, DAYS_PER_YEAR]
// defensively (a stray out-of-range UI input shouldn't produce a day count
// that silently drifts into the wrong year).
function dayCountFromYearAndDay(year, doy) {
  const clampedDoy = Math.min(DAYS_PER_YEAR, Math.max(1, Math.round(doy)))
  return (Math.max(1, Math.round(year)) - 1) * DAYS_PER_YEAR + clampedDoy
}

// The season record ({ name, key, start, end }) a day-of-year falls in.
function seasonForDay(doy) {
  return SEASONS.find((s) => doy >= s.start && doy <= s.end) ?? SEASONS[0]
}

function seasonForDayOfYear(doy) {
  return seasonForDay(doy).name
}

function isFestivalDay(doy) {
  return doy >= FESTIVAL_START && doy <= FESTIVAL_END
}

// Week-of-year and day-of-week share the same 3-way split: a normal 6-week
// season span (days 1-48), the 4-day Festival half-week with no week number
// (49-52), then weeks resume counting from 6 (53-204). Applies uniformly
// since doy here is always day-of-YEAR, not day-of-season.
function weekOfYear(doy) {
  if (doy <= 48) return Math.ceil(doy / DAYS_PER_WEEK)
  if (doy <= FESTIVAL_END) return null // Festival
  return 6 + Math.ceil((doy - FESTIVAL_END) / DAYS_PER_WEEK)
}

function dayOfWeek(doy) {
  if (doy <= 48) return ((doy - 1) % DAYS_PER_WEEK) + 1
  if (doy <= FESTIVAL_END) return doy - 48
  return ((doy - 53) % DAYS_PER_WEEK) + 1
}

// "Winter · Year 3 · Week 2, Day 5" / "Spring · Year 1 · Festival · Day 2"
function formatGameDate(dayCount) {
  const year = yearFromDayCount(dayCount)
  const doy = dayOfYear(dayCount)
  const season = seasonForDayOfYear(doy)
  const week = weekOfYear(doy)
  const dow = dayOfWeek(doy)
  const weekPart = week ? `Week ${week}, ` : 'Festival · '
  return `${season} · Year ${year} · ${weekPart}Day ${dow}`
}

// Whether a calendar note (see user_prefs calendar_notes) shows on a given
// day. `doy` is the day-of-year, `absoluteDay` the day count. Recurrence:
//   none       — only that one absolute day
//   annually   — same day-of-year every year
//   weekly     — same day-of-week (weeks restart each year's Festival)
//   seasonally — same offset into every season (4 times a year)
function noteMatchesDay(note, doy, absoluteDay) {
  switch (note.recurrence) {
    case 'none':
      return note.absolute_day === absoluteDay
    case 'annually':
      return note.day_of_year === doy
    case 'weekly':
      return dayOfWeek(doy) === dayOfWeek(note.day_of_year)
    case 'seasonally': {
      // Same offset into ANY season. (Both previous copies of this also
      // required the same season, which made "seasonally" identical to
      // "annually" — the UI offers it as "Repeat seasonally", i.e. four
      // times a year.)
      const current = seasonForDay(doy)
      const noted = seasonForDay(note.day_of_year)
      return doy - current.start === note.day_of_year - noted.start
    }
  }
  return false
}

module.exports = {
  DAYS_PER_YEAR,
  DAYS_PER_WEEK,
  YEAR_OFFSET,
  SEASONS,
  FESTIVAL_START,
  FESTIVAL_END,
  dayOfYear,
  yearFromDayCount,
  dayCountFromYearAndDay,
  seasonForDay,
  seasonForDayOfYear,
  isFestivalDay,
  weekOfYear,
  dayOfWeek,
  formatGameDate,
  noteMatchesDay,
}
