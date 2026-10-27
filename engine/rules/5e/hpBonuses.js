// Hit Point bonuses that come from a feat or class feature rather than the hit
// die or Constitution. Each is "+N maximum HP per level", counted retroactively
// from the level the feature is taken (so Tough at 4th level on a level 4
// character is +8 at once). Species traits (Dwarven Toughness) are handled by
// the species data's `grants_hp_per_level`, not here.
//
//   Tough (2014 and 2024 feat): +2 per character level.
//   Draconic Resilience (Sorcerer; 2014 Draconic Bloodline, 2024 Draconic Sorcery):
//     +1 per Sorcerer level (2024 words it "+3 at 3rd, +1 each level after" — the same).
//
// Pure data in, number out; no fs.

const RULES = [
  { match: /^tough$/i, perLevel: 2, scope: 'character' },
  { match: /draconic resilience$/i, perLevel: 1, scope: 'Sorcerer' },
]

// features: the sheet's feature list; classes: [{ name, level }].
function featureHpBonus(features, classes) {
  const total = classes.reduce((n, c) => n + (c.level || 0), 0)
  let sum = 0
  for (const rule of RULES) {
    if (!(features || []).some((f) => rule.match.test(f.name))) continue
    const levels =
      rule.scope === 'character'
        ? total
        : classes.find((c) => c.name === rule.scope)?.level ?? 0
    sum += rule.perLevel * levels
  }
  return sum
}

module.exports = { featureHpBonus }
