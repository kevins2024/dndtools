// Thin wrapper around engine/rules/calendar.js — the shared calendar math
// for Tellonde's custom 204-day year (4 seasons of 51 days, 8-day weeks, a
// 4-day Festival half-week). See that file for the rules and for the
// 2026-10-01 consolidation of the three hand-copied versions of this math.
//
// Imports the leaf rule file directly — NOT the engine/index.js barrel,
// which breaks webpack via fs/path at require-time (see combatTurn.js's
// header comment). calendar.js has zero dependencies, so this is safe.
const calendarEngine = require('../../engine/rules/calendar')

export const DAYS_PER_YEAR = calendarEngine.DAYS_PER_YEAR
export const DAYS_PER_WEEK = calendarEngine.DAYS_PER_WEEK
export const YEAR_OFFSET = calendarEngine.YEAR_OFFSET
export const SEASONS = calendarEngine.SEASONS
export const dayOfYear = calendarEngine.dayOfYear
export const yearFromDayCount = calendarEngine.yearFromDayCount
export const dayCountFromYearAndDay = calendarEngine.dayCountFromYearAndDay
export const seasonForDay = calendarEngine.seasonForDay
export const seasonForDayOfYear = calendarEngine.seasonForDayOfYear
export const isFestivalDay = calendarEngine.isFestivalDay
export const weekOfYear = calendarEngine.weekOfYear
export const dayOfWeek = calendarEngine.dayOfWeek
export const formatGameDate = calendarEngine.formatGameDate
export const noteMatchesDay = calendarEngine.noteMatchesDay
