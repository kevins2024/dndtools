// How many spells a character can have PREPARED (PHB ch. 3 class
// descriptions): Cleric/Druid/Wizard prepare ability modifier + class level;
// Paladin and Artificer prepare ability modifier + half class level (round
// down); each at least 1. A multiclass character works each class out
// separately (PHB p. 164: "you determine the spells you can prepare for each
// class individually") using THAT class's casting ability and THAT class's
// level, and the limits add up. Known-spell classes (Bard, Sorcerer,
// Warlock, Ranger, and the Eldritch Knight/Arcane Trickster subclasses)
// don't prepare at all.
//
// Extracted 2026-10-01 from src/components/CharacterSpellbook.vue's
// preparationInfo computed, which hand-rolled this using the character's
// single `spellcasting_ability` field and TOTAL character level — wrong for
// any multiclass (a Barbarian 6 / Paladin 3 got Paladin's formula applied at
// level 9) and it treated Ranger as a preparer, contradicting this engine's
// own spells_known table (2014 Rangers know spells; see spellcasting.js).
//
// Class data comes from the same class JSON the rest of engine/ uses
// (spellcasting.type/ability) via plain `require`, which webpack bundles —
// no fs/path — so browser code can require() this file directly; see
// src/utils/preparedSpells.js. spellcasting.js's own preparedSpellCount is
// the single-class sibling for the level-up tool and can't be used here
// because it loads class data through fs.
//
// `scores`: the character's EFFECTIVE ability scores (after items/features),
// e.g. resolveEffectiveStats(...).scores.

const { abilityModifier } = require('./abilities')
const spellcastingTables = require('../../data/5e/spellcasting-tables.json')

const CLASS_DATA = {
  Artificer: require('../../data/5e/classes/artificer.json'),
  Cleric: require('../../data/5e/classes/cleric.json'),
  Druid: require('../../data/5e/classes/druid.json'),
  Paladin: require('../../data/5e/classes/paladin.json'),
  Ranger: require('../../data/5e/classes/ranger.json'),
  Wizard: require('../../data/5e/classes/wizard.json'),
}

// A class prepares spells if it has a spell-slot progression and isn't one
// of the known-spell classes.
function preparingClassData(className) {
  const data = CLASS_DATA[className]
  if (!data) return null
  if (spellcastingTables.spells_known[className]) return null
  const type = data.spellcasting?.type
  return type === 'full' || type === 'half' || type === 'artificer'
    ? data
    : null
}

function isPreparedCaster(character) {
  return (character.classes ?? []).some((c) => preparingClassData(c.name))
}

// Returns null if the character prepares no spells. Otherwise
// { max, classes: [{ name, ability, max, breakdown }], breakdown } where each
// class's breakdown is [{ label, amount }] (ability modifier, level
// contribution, and a "Minimum 1" correction when it applies) and the
// top-level breakdown concatenates them.
function preparedSpellLimit(character, scores) {
  const classes = []
  for (const cls of character.classes ?? []) {
    const data = preparingClassData(cls.name)
    if (!data) continue
    const ability = data.spellcasting.ability
    const mod = abilityModifier(scores[ability] ?? 10)
    const levelPart =
      data.spellcasting.type === 'full' ? cls.level : Math.floor(cls.level / 2)
    const raw = mod + levelPart
    const max = Math.max(1, raw)
    const breakdown = [
      { label: `${cls.name} — ${ability.toUpperCase()} modifier`, amount: mod },
      {
        label:
          data.spellcasting.type === 'full'
            ? `${cls.name} level`
            : `Half ${cls.name} level`,
        amount: levelPart,
      },
    ]
    if (max !== raw) breakdown.push({ label: 'Minimum 1', amount: max - raw })
    classes.push({ name: cls.name, ability, max, breakdown })
  }
  if (!classes.length) return null
  return {
    max: classes.reduce((sum, c) => sum + c.max, 0),
    classes,
    breakdown: classes.flatMap((c) => c.breakdown),
  }
}

module.exports = { isPreparedCaster, preparedSpellLimit }
