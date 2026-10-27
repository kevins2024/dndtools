const { loadRulesetJson } = require('./ruleset')

// The 2024 file, once it exists, must be complete — it replaces the 2014 one
// wholesale (known-spell classes became prepared casters, so the shapes differ).
const tablesFor = (ruleset) => loadRulesetJson(ruleset, 'spellcasting-tables.json')
const { loadClass } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')

// Exported for reuse — invocations.js uses this same breakpoint-table shape
// for invocations_known, which lives alongside cantrips_known/spells_known
// in spellcasting-tables.json but isn't itself a spellcasting concept.
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
function resolveSpellcasting(className, subclassName, ruleset) {
  const cls = loadClass(className, ruleset)
  if (cls?.spellcasting && cls.spellcasting.type !== 'none') {
    return cls.spellcasting
  }
  if (subclassName) {
    const sub = loadSubclass(className, subclassName, ruleset)
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
function tableKeyFor(className, subclassName, spellcasting, ruleset) {
  return spellcasting?.type === 'third' && subclassName
    ? subclassName
    : loadClass(className, ruleset)?.name ?? className
}

// A 2024 class file carries its own spellcasting columns straight from the
// PHB class table (cantrips_by_level, prepared_spells_by_level, and one
// spell_slots_level_N_by_level per slot level). Classes the 2024 rules did not
// rewrite (Artificer) and subclass casters have none, and use the shared
// tables file instead — so a class-file column, when present, wins.
function classColumn(className, ruleset, column) {
  return loadClass(className, ruleset)?.[column] ?? null
}

function slotsFromClassTable(className, level, ruleset) {
  if (!classColumn(className, ruleset, 'spell_slots_level_1_by_level')) return null
  const out = []
  for (let n = 1; n <= 9; n++) {
    const col = classColumn(className, ruleset, `spell_slots_level_${n}_by_level`)
    out.push(col ? resolveBreakpoint(col, level) : 0)
  }
  while (out.length && out[out.length - 1] === 0) out.pop()
  return out
}

function spellSlotsForClassAtLevel(className, level, subclassName, ruleset) {
  const tables = tablesFor(ruleset)
  const spellcasting = resolveSpellcasting(className, subclassName, ruleset)
  if (!spellcasting) return []
  const fromClass = slotsFromClassTable(className, level, ruleset)
  if (fromClass) return fromClass
  const type = spellcasting.type
  if (type === 'full') return tables.full_caster_slots[String(level)] || []
  if (type === 'half') return tables.half_caster_slots[String(level)] || []
  if (type === 'artificer') return tables.artificer_slots[String(level)] || []
  if (type === 'third') return tables.third_caster_slots[String(level)] || []
  if (type === 'pact') return [] // use pactMagicForLevel instead — different shape (all slots share one level)
  return []
}

function pactMagicForLevel(level, ruleset) {
  const slots = classColumn('Warlock', ruleset, 'spell_slots_by_level')
  const slotLevel = classColumn('Warlock', ruleset, 'slot_level_by_level')
  if (slots && slotLevel) {
    return {
      slots: resolveBreakpoint(slots, level),
      slot_level: resolveBreakpoint(slotLevel, level),
    }
  }
  return tablesFor(ruleset).pact_magic[String(level)] || { slots: 0, slot_level: 0 }
}

function mysticArcanumLevelsKnownAt(level, ruleset) {
  return Object.entries(tablesFor(ruleset).mystic_arcanum_levels)
    .filter(([atLevel]) => Number(atLevel) <= level)
    .map(([, spellLevel]) => spellLevel)
}

function cantripsKnownForClass(className, level, subclassName, ruleset) {
  const spellcasting = resolveSpellcasting(className, subclassName, ruleset)
  const key = tableKeyFor(className, subclassName, spellcasting, ruleset)
  const fromClass = classColumn(className, ruleset, 'cantrips_by_level')
  if (fromClass) return resolveBreakpoint(fromClass, level)
  const map = tablesFor(ruleset).cantrips_known[key]
  if (!map) return 0
  return resolveBreakpoint(map, level)
}

function spellsKnownForClass(className, level, subclassName, ruleset) {
  const spellcasting = resolveSpellcasting(className, subclassName, ruleset)
  const key = tableKeyFor(className, subclassName, spellcasting, ruleset)
  // 2024: every caster prepares from a fixed per-level count in its class table.
  if (classColumn(className, ruleset, 'prepared_spells_by_level')) return null
  const map = tablesFor(ruleset).spells_known[key]
  if (!map) return null // this class prepares instead of "knowing" a fixed list
  return map[String(level)] ?? 0
}

// Prepared-caster formula: ability modifier + level (full casters) or
// + half level rounded down (half casters / Artificer), minimum of 1.
// Known-caster classes (Bard, Sorcerer, Warlock, Ranger, Eldritch Knight,
// Arcane Trickster) don't prepare at all — slot-progression "type"
// (full/half/pact/third) is a different axis from known-vs-prepared, so
// that's checked separately via spellsKnownForClass, not `type`.
function preparedSpellCount(
  className,
  level,
  abilityModifier,
  subclassName,
  ruleset
) {
  const spellcasting = resolveSpellcasting(className, subclassName, ruleset)
  if (!spellcasting) return 0
  const fixed = classColumn(className, ruleset, 'prepared_spells_by_level')
  if (fixed) return resolveBreakpoint(fixed, level)
  if (spellsKnownForClass(className, level, subclassName, ruleset) !== null)
    return null
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
  resolveBreakpoint,
}
