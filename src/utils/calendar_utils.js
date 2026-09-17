// Shared calendar math for Tellonde's custom 204-day year (4 seasons of 51
// days each — the last 4 days of Winter/Spring/Summer are absorbed into a
// "Festival" half-week rather than a clean 6.375-week season; see SEASONS
// below) — extracted from AppLayout.vue's restDateLabel, which is the
// simpler of two independent copies of this math that existed in the
// codebase (TellondeCalendar.vue has its own, richer copy that additionally
// applies a real-world year offset for display — left as its own thing
// rather than reconciled here, since the two were already showing different
// "Year N" numbers for the same day before this file existed, and untangling
// that is a separate task from "give PartyEditModal a shared place to read
// this from").
//
// Everything here operates on a single integer "day count" — days since
// campaign day 1 — matching party.game_day.

export const DAYS_PER_YEAR = 204
export const DAYS_PER_WEEK = 8

export const SEASONS = [
  { name: 'Winter', start: 1, end: 51 },
  { name: 'Spring', start: 52, end: 102 },
  { name: 'Summer', start: 103, end: 153 },
  { name: 'Autumn', start: 154, end: 204 },
]

export function dayOfYear(dayCount) {
  return ((dayCount - 1) % DAYS_PER_YEAR) + 1
}

export function yearFromDayCount(dayCount) {
  return Math.floor((dayCount - 1) / DAYS_PER_YEAR) + 1
}

// Inverse of dayOfYear/yearFromDayCount — combine a (year, day-of-year)
// pair back into a single day count. `doy` is clamped to [1, DAYS_PER_YEAR]
// defensively (a stray out-of-range UI input shouldn't produce a day count
// that silently drifts into the wrong year).
export function dayCountFromYearAndDay(year, doy) {
  const clampedDoy = Math.min(DAYS_PER_YEAR, Math.max(1, Math.round(doy)))
  return (Math.max(1, Math.round(year)) - 1) * DAYS_PER_YEAR + clampedDoy
}

export function seasonForDayOfYear(doy) {
  return (SEASONS.find((s) => doy >= s.start && doy <= s.end) ?? SEASONS[0])
    .name
}

// Week-of-year and day-of-week share the same 3-way split: a normal 6-week
// season (days 1-48), a 4-day "Festival" half-week with no week number
// (49-52), then weeks resume counting from 6 (53-204). Applies uniformly
// within every season since doy here is always day-of-YEAR, not
// day-of-season — a season boundary just happens to also be a week boundary
// in this calendar.
export function weekOfYear(doy) {
  if (doy <= 48) return Math.ceil(doy / DAYS_PER_WEEK)
  if (doy <= 52) return null // Festival
  return 6 + Math.ceil((doy - 52) / DAYS_PER_WEEK)
}

export function dayOfWeek(doy) {
  if (doy <= 48) return ((doy - 1) % DAYS_PER_WEEK) + 1
  if (doy <= 52) return doy - 48
  return ((doy - 53) % DAYS_PER_WEEK) + 1
}

// "Winter · Year 3 · Week 2, Day 5" / "Spring · Year 1 · Festival · Day 2"
export function formatGameDate(dayCount) {
  const year = yearFromDayCount(dayCount)
  const doy = dayOfYear(dayCount)
  const season = seasonForDayOfYear(doy)
  const week = weekOfYear(doy)
  const dow = dayOfWeek(doy)
  const weekPart = week ? `Week ${week}, ` : 'Festival · '
  return `${season} · Year ${year} · ${weekPart}Day ${dow}`
}
