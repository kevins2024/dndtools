const test = require('node:test')
const assert = require('node:assert')
const {
  TIER_LABELS,
  eligibleTopics,
  pickTravelTopic,
  resolveTravelEvent,
} = require('../rules/travel')

const variants = {
  extremeBad: 'xb {tracker}',
  bad: 'b {tracker}',
  mundane: 'm',
  good: 'g',
  extremeGood: 'xg',
}
const offPathVariants = {
  extremeBad: 'off-xb',
  bad: 'off-b',
  mundane: 'off-m',
  good: 'off-g',
  extremeGood: 'off-xg',
}
const topic = { label: 'Weather', terrains: 'any', continents: 'any', variants }
const navTopic = {
  label: 'Path',
  terrains: 'any',
  continents: 'any',
  navigationRisk: true,
  variants,
  offPathVariants,
  offPathLabel: 'Lost',
}

// rng so a d20 lands on `face`; a sequence repeats the last value.
const face = (f) => () => (f - 1) / 20 + 0.001
const seq = (...faces) => {
  let i = 0
  return () => face(faces[Math.min(i++, faces.length - 1)])()
}

test('eligibleTopics: filters by terrain and continent, "any" is unrestricted', () => {
  const topics = [
    topic,
    { ...topic, label: 'Forest only', terrains: ['forest'] },
    { ...topic, label: 'Kaemahz only', continents: ['Kaemahz'] },
  ]
  assert.deepStrictEqual(
    eligibleTopics(topics, 'forest', 'Kaemahz').map((t) => t.label),
    ['Weather', 'Forest only', 'Kaemahz only']
  )
  assert.deepStrictEqual(
    eligibleTopics(topics, 'road', 'Yetgrese').map((t) => t.label),
    ['Weather']
  )
})

test('pickTravelTopic: null for an empty pool, otherwise uses rng over the pool', () => {
  assert.strictEqual(pickTravelTopic([], 'road', 'x'), null)
  const topics = [
    { ...topic, label: 'A' },
    { ...topic, label: 'B' },
  ]
  assert.strictEqual(pickTravelTopic(topics, 'road', 'x', () => 0).label, 'A')
  assert.strictEqual(
    pickTravelTopic(topics, 'road', 'x', () => 0.99).label,
    'B'
  )
})

test('resolveTravelEvent: tier bands at mod 0 — 1 extreme bad, 2-7 bad, 8-13 mundane, 14-19 good, 20 extreme good', () => {
  const tierAt = (n) =>
    resolveTravelEvent(
      { topic, survivalMod: 0, knowsWay: 'yes', trackerName: 'T' },
      face(n)
    ).tier
  assert.strictEqual(tierAt(1), 'extremeBad')
  assert.strictEqual(tierAt(2), 'bad')
  assert.strictEqual(tierAt(7), 'bad')
  assert.strictEqual(tierAt(8), 'mundane')
  assert.strictEqual(tierAt(13), 'mundane')
  assert.strictEqual(tierAt(14), 'good')
  assert.strictEqual(tierAt(19), 'good')
  assert.strictEqual(tierAt(20), 'extremeGood')
})

test('resolveTravelEvent: the modifier moves the tier but never past a natural 1/20', () => {
  const r = (n, mod) =>
    resolveTravelEvent(
      { topic, survivalMod: mod, knowsWay: 'yes', trackerName: 'T' },
      face(n)
    )
  assert.strictEqual(r(6, 3).tier, 'mundane') // 9
  assert.strictEqual(r(1, 10).tier, 'extremeBad') // natural 1 stays
  assert.strictEqual(r(20, -10).tier, 'extremeGood') // natural 20 stays
  assert.strictEqual(r(10, 4).total, 14)
})

test('resolveTravelEvent: a topic without navigationRisk always rolls flat on-path text', () => {
  const r = resolveTravelEvent(
    { topic, survivalMod: 0, knowsWay: 'no', trackerName: 'T' },
    face(10)
  )
  assert.strictEqual(r.rollMode, 'flat')
  assert.strictEqual(r.rolls.length, 1)
  assert.strictEqual(r.text, 'm')
})

test('resolveTravelEvent: navigationRisk — yes is advantage, no is disadvantage, general direction is flat', () => {
  const run = (knowsWay) =>
    resolveTravelEvent(
      { topic: navTopic, survivalMod: 0, knowsWay, trackerName: 'T' },
      seq(4, 16)
    )
  const yes = run('yes')
  assert.strictEqual(yes.rollMode, 'advantage')
  assert.deepStrictEqual(yes.rolls, [4, 16])
  assert.strictEqual(yes.natRoll, 16)
  assert.strictEqual(yes.text, 'g') // on-path wording

  const no = run('no')
  assert.strictEqual(no.rollMode, 'disadvantage')
  assert.strictEqual(no.natRoll, 4)
  assert.strictEqual(no.text, 'off-b') // off-path wording
  assert.strictEqual(no.label, 'Lost')

  const gen = run('general_direction')
  assert.strictEqual(gen.rollMode, 'flat')
  assert.strictEqual(gen.rolls.length, 1)
  assert.strictEqual(gen.label, 'Lost') // off-path wording and label, flat roll
})

test('resolveTravelEvent: {tracker} is replaced everywhere in the text', () => {
  const t = {
    ...topic,
    variants: { ...variants, bad: '{tracker} slips; {tracker} swears' },
  }
  const r = resolveTravelEvent(
    { topic: t, survivalMod: 0, knowsWay: 'yes', trackerName: 'Eldi' },
    face(3)
  )
  assert.strictEqual(r.text, 'Eldi slips; Eldi swears')
  assert.strictEqual(r.tierLabel, TIER_LABELS.bad)
})

test('resolveTravelEvent: offerEncounter respects hostileTiers, defaults to bad/extremeBad', () => {
  const flagged = { ...topic, combatFlagged: true }
  const at = (t, n) =>
    resolveTravelEvent(
      { topic: t, survivalMod: 0, knowsWay: 'yes', trackerName: 'T' },
      face(n)
    ).offerEncounter
  assert.ok(at(flagged, 3))
  assert.ok(at(flagged, 1))
  assert.ok(!at(flagged, 10))
  const onlyExtreme = { ...flagged, hostileTiers: ['extremeBad'] }
  assert.ok(!at(onlyExtreme, 3))
  assert.ok(at(onlyExtreme, 1))
  assert.ok(!at(topic, 3)) // not combatFlagged
})
