// The Travel Event wizard's roll engine: given (terrain, continent, whether
// the party knows the way, and the lead tracker's Survival modifier) pick a
// topic and resolve one event. Content (the topics themselves) lives in
// src/data/travel_events.js and is passed in — this file is purely the dice
// logic and the tier table. Extracted 2026-10-01 from
// src/utils/travel_utils.js, which also had its own hand-rolled d20 and
// advantage/disadvantage handling; that now goes through d20Test.js like
// every other d20 roll.
//
// rng is injectable (a () => number in [0, 1), default Math.random).
//
// Zero fs/path dependencies — browser code require()s this directly; see
// src/utils/travel_utils.js.

const { rollDie } = require('./5e/dice')
const { resolveD20Test } = require('./5e/d20Test')

const TIER_LABELS = {
  extremeBad: 'Extreme Bad',
  bad: 'Bad',
  mundane: 'Mundane',
  good: 'Good',
  extremeGood: 'Extreme Good',
}

// Topics eligible for a given terrain + continent. 'any' on either field
// means the topic isn't restricted along that axis.
function eligibleTopics(topics, terrain, continent) {
  return topics.filter((t) => {
    const terrainOk = t.terrains === 'any' || t.terrains.includes(terrain)
    const continentOk =
      t.continents === 'any' || t.continents.includes(continent)
    return terrainOk && continentOk
  })
}

function pickTravelTopic(topics, terrain, continent, rng = Math.random) {
  const pool = eligibleTopics(topics, terrain, continent)
  if (!pool.length) return null
  return pool[Math.floor(rng() * pool.length)]
}

// knowsWay is one of 'yes' | 'general_direction' | 'no'. It only affects
// topics with navigationRisk: true — everything else always rolls flat.
//   yes                -> advantage, on-path wording (topic.variants)
//   general_direction  -> flat roll, off-path wording (topic.offPathVariants)
//   no                 -> disadvantage, off-path wording (topic.offPathVariants)
function rollMode(topic, knowsWay) {
  if (!topic.navigationRisk) return 'normal'
  if (knowsWay === 'yes') return 'advantage'
  if (knowsWay === 'no') return 'disadvantage'
  return 'normal'
}

// A natural 1 or 20 is carved out of the bands, so the remaining 18 raw
// values (2-19) split evenly 6/6/6 across bad/mundane/good — a true
// 1/6/6/6/1 distribution across all 20 faces at mod 0.
function tierFor(natural, total) {
  if (natural === 1) return 'extremeBad'
  if (natural === 20) return 'extremeGood'
  if (total <= 7) return 'bad'
  if (total <= 13) return 'mundane'
  return 'good'
}

// Resolves a single travel event: rolls the Survival check (mode depends on
// navigationRisk + knowsWay, see rollMode), picks the tier, and fills in the
// appropriate variant text (on-path or off-path) for that topic.
function resolveTravelEvent(
  { topic, survivalMod, knowsWay, trackerName },
  rng = Math.random
) {
  const mode = rollMode(topic, knowsWay)
  const dice = mode === 'normal' ? 1 : 2
  const rolls = Array.from({ length: dice }, () => rollDie(20, rng))
  const test = resolveD20Test(rolls, { mode, modifier: survivalMod })
  const tier = tierFor(test.natural, test.value)

  const usingOffPath =
    topic.navigationRisk && knowsWay !== 'yes' && topic.offPathVariants
  const variantSet = usingOffPath ? topic.offPathVariants : topic.variants
  const label =
    usingOffPath && topic.offPathLabel ? topic.offPathLabel : topic.label
  const text = variantSet[tier].replace(/\{tracker\}/g, trackerName)
  // Not every combatFlagged topic's Bad tier is actually hostile prose (e.g.
  // a rude merchant vs. an ambush) — hostileTiers declares which tiers for
  // THIS topic genuinely describe a fight. Falls back to bad/extremeBad for
  // any combatFlagged topic that doesn't specify (shouldn't happen, but
  // fails toward "offer it" rather than silently never offering it).
  const offerEncounter =
    topic.combatFlagged &&
    (topic.hostileTiers
      ? topic.hostileTiers.includes(tier)
      : tier === 'bad' || tier === 'extremeBad')

  return {
    topic,
    label,
    rolls,
    natRoll: test.natural,
    mod: survivalMod,
    total: test.value,
    // 'flat' is the wizard's existing name for a plain roll (see
    // TravelEventModal) — kept so the UI doesn't change.
    rollMode: mode === 'normal' ? 'flat' : mode,
    tier,
    tierLabel: TIER_LABELS[tier],
    text,
    offerEncounter,
  }
}

module.exports = {
  TIER_LABELS,
  eligibleTopics,
  pickTravelTopic,
  resolveTravelEvent,
}
