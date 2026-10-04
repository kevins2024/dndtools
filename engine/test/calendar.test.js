const test = require('node:test')
const assert = require('node:assert')
const cal = require('../rules/calendar')

test('dayOfYear / yearFromDayCount: wrap every 204 days', () => {
  assert.strictEqual(cal.dayOfYear(1), 1)
  assert.strictEqual(cal.dayOfYear(204), 204)
  assert.strictEqual(cal.dayOfYear(205), 1)
  assert.strictEqual(cal.yearFromDayCount(204), 1)
  assert.strictEqual(cal.yearFromDayCount(205), 2)
})

test('dayCountFromYearAndDay: inverse of the pair, clamps stray input', () => {
  for (const n of [1, 50, 204, 205, 500, 1000]) {
    assert.strictEqual(
      cal.dayCountFromYearAndDay(cal.yearFromDayCount(n), cal.dayOfYear(n)),
      n
    )
  }
  assert.strictEqual(cal.dayCountFromYearAndDay(1, 999), 204)
  assert.strictEqual(cal.dayCountFromYearAndDay(0, -5), 1)
})

test('seasons: four of 51 days each, boundaries', () => {
  assert.strictEqual(cal.seasonForDayOfYear(1), 'Winter')
  assert.strictEqual(cal.seasonForDayOfYear(51), 'Winter')
  assert.strictEqual(cal.seasonForDayOfYear(52), 'Spring')
  assert.strictEqual(cal.seasonForDayOfYear(153), 'Summer')
  assert.strictEqual(cal.seasonForDayOfYear(154), 'Autumn')
  assert.strictEqual(cal.seasonForDayOfYear(204), 'Autumn')
  assert.strictEqual(cal.seasonForDay(60).key, 'spring')
  const total = cal.SEASONS.reduce((n, s) => n + (s.end - s.start + 1), 0)
  assert.strictEqual(total, cal.DAYS_PER_YEAR)
})

test('Festival half-week: days 49-52, no week number, day-of-week 1-4', () => {
  for (const d of [49, 50, 51, 52]) {
    assert.ok(cal.isFestivalDay(d))
    assert.strictEqual(cal.weekOfYear(d), null)
  }
  assert.ok(!cal.isFestivalDay(48))
  assert.ok(!cal.isFestivalDay(53))
  assert.deepStrictEqual([49, 50, 51, 52].map(cal.dayOfWeek), [1, 2, 3, 4])
})

test('weeks: 1-6 before the Festival, resume at 7 after it', () => {
  assert.strictEqual(cal.weekOfYear(1), 1)
  assert.strictEqual(cal.weekOfYear(8), 1)
  assert.strictEqual(cal.weekOfYear(9), 2)
  assert.strictEqual(cal.weekOfYear(48), 6)
  assert.strictEqual(cal.weekOfYear(53), 7)
  assert.strictEqual(cal.weekOfYear(204), 25)
  assert.strictEqual(cal.dayOfWeek(53), 1)
  assert.strictEqual(cal.dayOfWeek(204), 8)
})

test('every non-festival day maps to a day-of-week 1-8 and week >= 1', () => {
  for (let d = 1; d <= 204; d++) {
    const dow = cal.dayOfWeek(d)
    assert.ok(dow >= 1 && dow <= 8, `day ${d}`)
    if (!cal.isFestivalDay(d)) assert.ok(cal.weekOfYear(d) >= 1, `day ${d}`)
  }
})

test('formatGameDate', () => {
  assert.strictEqual(cal.formatGameDate(1), 'Winter · Year 1 · Week 1, Day 1')
  assert.strictEqual(cal.formatGameDate(50), 'Winter · Year 1 · Festival · Day 2')
  assert.strictEqual(cal.formatGameDate(205), 'Winter · Year 2 · Week 1, Day 1')
})

test('noteMatchesDay: none / annually / weekly / seasonally', () => {
  const none = { recurrence: 'none', absolute_day: 300 }
  assert.ok(cal.noteMatchesDay(none, cal.dayOfYear(300), 300))
  assert.ok(!cal.noteMatchesDay(none, cal.dayOfYear(300), 96))

  const annual = { recurrence: 'annually', day_of_year: 10 }
  assert.ok(cal.noteMatchesDay(annual, 10, 10))
  assert.ok(cal.noteMatchesDay(annual, 10, 214))
  assert.ok(!cal.noteMatchesDay(annual, 11, 11))

  const weekly = { recurrence: 'weekly', day_of_year: 3 }
  assert.ok(cal.noteMatchesDay(weekly, 11, 11)) // day-of-week 3
  assert.ok(cal.noteMatchesDay(weekly, 3, 3))
  assert.ok(!cal.noteMatchesDay(weekly, 4, 4))

  const seasonal = { recurrence: 'seasonally', day_of_year: 10 } // day 10 of Winter
  assert.ok(cal.noteMatchesDay(seasonal, 61, 61)) // day 10 of Spring (52 + 9)
  assert.ok(cal.noteMatchesDay(seasonal, 10, 10))
  assert.ok(!cal.noteMatchesDay(seasonal, 62, 62))
})

test('noteMatchesDay: unknown recurrence never matches', () => {
  assert.ok(!cal.noteMatchesDay({ recurrence: 'bogus' }, 1, 1))
})

test('noteMatchesDay: seasonal notes recur in every season, not just the original one', () => {
  const seasonal = { recurrence: 'seasonally', day_of_year: 10 }
  for (const season of cal.SEASONS) {
    const doy = season.start + 9
    assert.ok(cal.noteMatchesDay(seasonal, doy, doy), season.name)
    assert.ok(!cal.noteMatchesDay(seasonal, doy + 1, doy + 1), season.name)
  }
})
