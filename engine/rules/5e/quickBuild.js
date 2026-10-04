// The PHB's own "Quick Build" suggested ability priority per class (real RAW
// guidance, not a guess) — melee classes list both str/dex since the book
// itself treats finesse/ranged builds as equally valid, not a single right
// answer. Extracted 2026-10-01 from src/utils/dnd_utils.js.
//
// Zero dependencies — browser code require()s this directly; see
// src/utils/quickBuild.js.

const CLASS_QUICK_BUILD_ABILITIES = {
  Artificer: ['int', 'dex', 'con'],
  Barbarian: ['str', 'con'],
  Bard: ['cha', 'dex'],
  Cleric: ['wis', 'str'],
  Druid: ['wis', 'con'],
  Fighter: ['str', 'dex', 'con'],
  Monk: ['dex', 'wis'],
  Paladin: ['str', 'cha'],
  Ranger: ['dex', 'wis'],
  Rogue: ['dex'],
  Sorcerer: ['cha', 'con'],
  Warlock: ['cha', 'con'],
  Wizard: ['int', 'con'],
}

// classData: a loaded class record (needs .name and, for casters, a
// .spellcasting.ability field) — the caller passes what it already has from
// the class data rather than this re-fetching. The class's actual
// spellcasting ability comes first, then the Quick Build priorities.
// Returns an ordered, deduped array of ability keys (e.g. ['cha', 'dex']),
// or [] if the class isn't recognized.
function priorityAbilitiesForClass(classData) {
  if (!classData?.name) return []
  const abilities = []
  const seen = new Set()
  const add = (a) => {
    if (a && !seen.has(a)) {
      seen.add(a)
      abilities.push(a)
    }
  }
  add(classData.spellcasting?.ability)
  for (const a of CLASS_QUICK_BUILD_ABILITIES[classData.name] ?? []) add(a)
  return abilities
}

module.exports = { CLASS_QUICK_BUILD_ABILITIES, priorityAbilitiesForClass }
