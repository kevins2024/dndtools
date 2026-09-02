const tables = require('../data/spellcasting-tables.json')
const multiclassProficiencies = require('../data/multiclass-proficiencies.json')
const multiclassPrerequisites = require('../data/multiclass-prerequisites.json')
const {
  pactMagicForLevel,
  spellSlotsForClassAtLevel,
} = require('./spellcasting')
const { loadClass } = require('./classFeatures')

// PHB p.163: to gain your first level in a class you don't already have,
// you need the listed ability score(s) at 13+ in the class you're PICKING
// UP. RAW technically also requires still meeting your existing class's own
// prerequisite at that moment, but a character's STARTING class is exempt
// from ever needing to meet its own prerequisite (official designer
// clarification — you can start as anything regardless of stats), and
// ability scores essentially never decrease in play — so checking only the
// new class covers the case that actually matters. Returns { met, required,
// mode } — mode is 'any' (Fighter's STR-or-DEX, the only PHB any_of case)
// or 'all'. An unrecognized class name doesn't block — better to let an
// unknown class through than silently deny a legitimate one over a lookup
// gap.
function meetsMulticlassPrerequisites(className, scores) {
  const req = multiclassPrerequisites[className]
  if (!req) return { met: true, required: [], mode: null }
  const meetsAbility = (ability) => (scores[ability] ?? 0) >= 13
  if (req.any_of) {
    return {
      met: req.any_of.some(meetsAbility),
      required: req.any_of,
      mode: 'any',
    }
  }
  return {
    met: req.all_of.every(meetsAbility),
    required: req.all_of,
    mode: 'all',
  }
}

// PHB multiclass spellcasting rules: round each class's contribution down
// (except Artificer, which rounds up) BEFORE summing, then look up the total
// on the same full-caster slot table used for single-classed full casters.
// Warlock is excluded entirely — Pact Magic never combines with anything.
const FULL_CASTER_CLASSES = new Set([
  'Bard',
  'Cleric',
  'Druid',
  'Sorcerer',
  'Wizard',
])

// How much a single class contributes toward the combined multiclass caster
// level, per the PHB Multiclass Spellcasting table. Returns 0 for a class
// that doesn't contribute at all (including a caster class below the
// threshold level where its contribution starts, e.g. Ranger 1).
function casterLevelContribution(c) {
  if (FULL_CASTER_CLASSES.has(c.name)) return c.level
  if (c.name === 'Artificer') return Math.ceil(c.level / 2)
  if (c.name === 'Paladin' && c.level >= 2) return Math.floor(c.level / 2)
  if (c.name === 'Ranger' && c.level >= 2) return Math.floor(c.level / 2)
  if (c.name === 'Fighter' && c.subclass === 'Eldritch Knight' && c.level >= 3)
    return Math.floor(c.level / 3)
  if (c.name === 'Rogue' && c.subclass === 'Arcane Trickster' && c.level >= 3)
    return Math.floor(c.level / 3)
  return 0
}

function multiclassCasterLevel(classes) {
  return classes.reduce((total, c) => total + casterLevelContribution(c), 0)
}

// The PHB combined-table formula (round each class's contribution, sum them,
// look the total up on the full-caster table) only actually applies once two
// or more classes are contributing spellcasting at once. A character with
// levels in several classes but only ONE of them a caster (e.g. a Ranger who
// also has Rogue/Fighter levels with no Eldritch Knight/Arcane Trickster)
// isn't "multiclassing" for spellcasting purposes at all — they just use
// that one class's own single-class table, which is NOT equivalent to
// running its level through the combined formula (half-casters in
// particular have their own, more generous dedicated progression when
// they're the only caster class in the mix).
function multiclassSpellSlots(classes) {
  const contributors = classes.filter((c) => casterLevelContribution(c) > 0)
  if (contributors.length === 0) return []
  if (contributors.length === 1) {
    return spellSlotsForClassAtLevel(
      contributors[0].name,
      contributors[0].level
    )
  }
  const level = multiclassCasterLevel(classes)
  return tables.full_caster_slots[String(Math.min(level, 20))] || []
}

function multiclassPactSlots(classes) {
  const warlock = classes.find((c) => c.name === 'Warlock')
  if (!warlock) return null
  return pactMagicForLevel(warlock.level)
}

// The starting class grants its FULL normal proficiency list (armor/weapons
// from its own data/classes/<class>.json). Every class taken later via
// multiclassing only grants the reduced list in
// data/multiclass-proficiencies.json — saving throws are never granted at
// all from a multiclassed-in class (handled separately in validateCharacter,
// since that's a simple presence check, not a union-building one).
function expectedProficienciesForCharacter(classes, startedClassName) {
  const started = loadClass(startedClassName)
  const armor = new Set(started ? started.armor_proficiencies : [])
  const weapons = new Set(started ? started.weapon_proficiencies : [])

  for (const c of classes) {
    if (c.name === startedClassName) continue
    const grant = multiclassProficiencies[c.name]
    if (!grant) continue
    for (const a of grant.armor || []) armor.add(a)
    for (const w of grant.weapons || []) weapons.add(w)
  }

  return { armor: [...armor], weapons: [...weapons] }
}

module.exports = {
  casterLevelContribution,
  multiclassCasterLevel,
  multiclassSpellSlots,
  multiclassPactSlots,
  expectedProficienciesForCharacter,
  meetsMulticlassPrerequisites,
}
