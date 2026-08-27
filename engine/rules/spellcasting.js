const tables = require('../data/spellcasting-tables.json')
const { loadClass } = require('./classFeatures')

function resolveBreakpoint(map, level) {
  let value
  for (const key of Object.keys(map).sort((a, b) => Number(a) - Number(b))) {
    if (Number(key) <= level) value = map[key]
  }
  return value ?? 0
}

function spellSlotsForClassAtLevel(className, level) {
  const cls = loadClass(className)
  if (!cls || !cls.spellcasting) return []
  const type = cls.spellcasting.type
  if (type === 'full') return tables.full_caster_slots[String(level)] || []
  if (type === 'half') return tables.half_caster_slots[String(level)] || []
  if (type === 'artificer') return tables.artificer_slots[String(level)] || []
  if (type === 'pact') return [] // use pactMagicForLevel instead — different shape (all slots share one level)
  return []
}

function pactMagicForLevel(level) {
  return tables.pact_magic[String(level)] || { slots: 0, slot_level: 0 }
}

function mysticArcanumLevelsKnownAt(level) {
  return Object.entries(tables.mystic_arcanum_levels)
    .filter(([atLevel]) => Number(atLevel) <= level)
    .map(([, spellLevel]) => spellLevel)
}

function cantripsKnownForClass(className, level) {
  const cls = loadClass(className)
  const key = cls ? cls.name : className
  const map = tables.cantrips_known[key]
  if (!map) return 0
  return resolveBreakpoint(map, level)
}

function spellsKnownForClass(className, level) {
  const cls = loadClass(className)
  const key = cls ? cls.name : className
  const map = tables.spells_known[key]
  if (!map) return null // this class prepares instead of "knowing" a fixed list
  return map[String(level)] ?? 0
}

// Prepared-caster formula: ability modifier + level (full casters) or
// + half level rounded down (half casters / Artificer), minimum of 1.
// Known-caster classes (Bard, Sorcerer, Warlock, Ranger) don't prepare at all —
// slot-progression "type" (full/half/pact) is a different axis from known-vs-
// prepared, so that's checked separately via spellsKnownForClass, not `type`.
function preparedSpellCount(className, level, abilityModifier) {
  const cls = loadClass(className)
  if (!cls || !cls.spellcasting) return 0
  if (spellsKnownForClass(className, level) !== null) return null
  const type = cls.spellcasting.type
  let base
  if (type === 'full') base = abilityModifier + level
  else if (type === 'half' || type === 'artificer')
    base = abilityModifier + Math.floor(level / 2)
  else return null
  return Math.max(1, base)
}

module.exports = {
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
  mysticArcanumLevelsKnownAt,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
}
