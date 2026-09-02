const tables = require('../data/spellcasting-tables.json')
const { loadClass } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')

function resolveBreakpoint(map, level) {
  let value
  for (const key of Object.keys(map).sort((a, b) => Number(a) - Number(b))) {
    if (Number(key) <= level) value = map[key]
  }
  return value ?? 0
}

// A class's own spellcasting.type is normally the whole story, but a small
// number of subclasses (Eldritch Knight, Arcane Trickster) grant real
// spellcasting to a base class that otherwise has none ('none' or missing).
// This is the one place that resolves "what spellcasting actually applies
// here" so every function below sees the same answer whether it came from
// the class or a subclass — callers just pass subclassName through and don't
// need to know which case they're in.
// Returns null (not a { type: 'none' } object) whenever nothing actually
// grants spellcasting — callers gate whole UI sections on truthiness of this
// value (e.g. "does this class cast spells at all?"), so a mundane
// subclass like Champion must resolve to exactly the same null a class
// with no spellcasting field at all would, not a truthy no-op object.
function resolveSpellcasting(className, subclassName) {
  const cls = loadClass(className)
  if (cls?.spellcasting && cls.spellcasting.type !== 'none') {
    return cls.spellcasting
  }
  if (subclassName) {
    const sub = loadSubclass(className, subclassName)
    if (sub?.spellcasting && sub.spellcasting.type !== 'none') {
      return sub.spellcasting
    }
  }
  return null
}

// Third-caster (Eldritch Knight/Arcane Trickster) cantrip/spells-known
// tables are keyed by SUBCLASS name, not class name, since "Fighter" and
// "Rogue" have no spellcasting of their own to key a table under — every
// other type keys by the class's own name.
function tableKeyFor(className, subclassName, spellcasting) {
  return spellcasting?.type === 'third' && subclassName
    ? subclassName
    : loadClass(className)?.name ?? className
}

function spellSlotsForClassAtLevel(className, level, subclassName) {
  const spellcasting = resolveSpellcasting(className, subclassName)
  if (!spellcasting) return []
  const type = spellcasting.type
  if (type === 'full') return tables.full_caster_slots[String(level)] || []
  if (type === 'half') return tables.half_caster_slots[String(level)] || []
  if (type === 'artificer') return tables.artificer_slots[String(level)] || []
  if (type === 'third') return tables.third_caster_slots[String(level)] || []
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

function cantripsKnownForClass(className, level, subclassName) {
  const spellcasting = resolveSpellcasting(className, subclassName)
  const key = tableKeyFor(className, subclassName, spellcasting)
  const map = tables.cantrips_known[key]
  if (!map) return 0
  return resolveBreakpoint(map, level)
}

function spellsKnownForClass(className, level, subclassName) {
  const spellcasting = resolveSpellcasting(className, subclassName)
  const key = tableKeyFor(className, subclassName, spellcasting)
  const map = tables.spells_known[key]
  if (!map) return null // this class prepares instead of "knowing" a fixed list
  return map[String(level)] ?? 0
}

// Prepared-caster formula: ability modifier + level (full casters) or
// + half level rounded down (half casters / Artificer), minimum of 1.
// Known-caster classes (Bard, Sorcerer, Warlock, Ranger, Eldritch Knight,
// Arcane Trickster) don't prepare at all — slot-progression "type"
// (full/half/pact/third) is a different axis from known-vs-prepared, so
// that's checked separately via spellsKnownForClass, not `type`.
function preparedSpellCount(className, level, abilityModifier, subclassName) {
  const spellcasting = resolveSpellcasting(className, subclassName)
  if (!spellcasting) return 0
  if (spellsKnownForClass(className, level, subclassName) !== null) return null
  const type = spellcasting.type
  let base
  if (type === 'full') base = abilityModifier + level
  else if (type === 'half' || type === 'artificer')
    base = abilityModifier + Math.floor(level / 2)
  else return null
  return Math.max(1, base)
}

module.exports = {
  resolveSpellcasting,
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
  mysticArcanumLevelsKnownAt,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
}
