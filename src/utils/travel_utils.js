// travel_utils.js
// Roll engine for the Travel Event wizard. Content lives in travel_events.js;
// this file is purely the dice logic that turns (terrain, continent, whether
// the party knows the way, and the lead tracker's Survival mod) into a single
// resolved event.

import { TRAVEL_EVENTS } from '@/data/travel_events.js'

export const TIER_LABELS = {
  extremeBad: 'Extreme Bad',
  bad: 'Bad',
  mundane: 'Mundane',
  good: 'Good',
  extremeGood: 'Extreme Good',
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1
}

// Topics eligible for a given terrain + continent. 'any' on either field
// means the topic isn't restricted along that axis.
export function eligibleTopics(terrain, continent) {
  return TRAVEL_EVENTS.filter((t) => {
    const terrainOk = t.terrains === 'any' || t.terrains.includes(terrain)
    const continentOk =
      t.continents === 'any' || t.continents.includes(continent)
    return terrainOk && continentOk
  })
}

export function pickTravelTopic(terrain, continent) {
  const pool = eligibleTopics(terrain, continent)
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

// knowsWay is one of 'yes' | 'general_direction' | 'no'. It only affects
// topics with navigationRisk: true — everything else always rolls flat.
//   yes                -> advantage, on-path wording (topic.variants)
//   general_direction  -> flat roll, off-path wording (topic.offPathVariants)
//   no                 -> disadvantage, off-path wording (topic.offPathVariants)
function rollMode(topic, knowsWay) {
  if (!topic.navigationRisk) return 'flat'
  if (knowsWay === 'yes') return 'advantage'
  if (knowsWay === 'no') return 'disadvantage'
  return 'flat'
}

// Resolves a single travel event: rolls the Survival check (mode depends on
// navigationRisk + knowsWay, see rollMode), picks the tier, and fills in the
// appropriate variant text (on-path or off-path) for that topic.
export function resolveTravelEvent({
  topic,
  survivalMod,
  knowsWay,
  trackerName,
}) {
  const mode = rollMode(topic, knowsWay)
  const rolls = mode === 'flat' ? [rollD20()] : [rollD20(), rollD20()]
  const natRoll =
    mode === 'disadvantage' ? Math.min(...rolls) : Math.max(...rolls)
  const total = natRoll + survivalMod

  // Natural 1/20 are carved out above before this ever runs, so the
  // remaining 18 raw values (2-19) split evenly 6/6/6 across bad/mundane/
  // good — a true 1/6/6/6/1 distribution across all 20 faces at mod 0.
  let tier
  if (natRoll === 1) tier = 'extremeBad'
  else if (natRoll === 20) tier = 'extremeGood'
  else if (total <= 7) tier = 'bad'
  else if (total <= 13) tier = 'mundane'
  else tier = 'good'

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
    natRoll,
    mod: survivalMod,
    total,
    rollMode: mode,
    tier,
    tierLabel: TIER_LABELS[tier],
    text,
    offerEncounter,
  }
}
