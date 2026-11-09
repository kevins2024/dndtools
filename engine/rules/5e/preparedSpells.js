// How many spells a character can have PREPARED today (2024 PHB): each class's
// own table column "Prepared Spells" (data/5e2024/classes/<class>.json,
// prepared_spells_by_level) gives the count for that class level. It no longer
// depends on the ability modifier; the 2014 "modifier + level" formula is retired.
// A multiclass character works each class out separately with THAT class's level,
// and the limits add up. Classes that choose again after every Long Rest are
// Cleric, Druid, Paladin, Ranger, Wizard (from the spellbook) and Artificer; Bard,
// Sorcerer, Warlock and the third casters change picks only on a level-up, so they
// are not counted here.
//
// Class data comes from the 2024 class JSON via plain `require`, which webpack
// bundles (no fs/path), so browser code can require() this file directly; see
// src/utils/preparedSpells.js. spellcasting.js's own preparedSpellCount is the
// fs-based sibling and can't be used in the browser.

const CLASS_DATA = {
  Artificer: require('../../data/5e2024/classes/artificer.json'),
  Cleric: require('../../data/5e2024/classes/cleric.json'),
  Druid: require('../../data/5e2024/classes/druid.json'),
  Paladin: require('../../data/5e2024/classes/paladin.json'),
  Ranger: require('../../data/5e2024/classes/ranger.json'),
  Wizard: require('../../data/5e2024/classes/wizard.json'),
}

function tableValue(column, level) {
  let value = 0
  for (const key of Object.keys(column).sort((a, b) => Number(a) - Number(b))) {
    if (Number(key) <= level) value = column[key]
  }
  return value
}

function preparingClassData(className) {
  const data = CLASS_DATA[className]
  return data && data.prepared_spells_by_level ? data : null
}

function isPreparedCaster(character) {
  return (character.classes ?? []).some((c) => preparingClassData(c.name))
}

// Returns null if the character prepares no spells. Otherwise
// { max, classes: [{ name, ability, max, breakdown }], breakdown }, where each
// class's breakdown is [{ label, amount }] and the top-level one concatenates them.
function preparedSpellLimit(character) {
  const classes = []
  for (const cls of character.classes ?? []) {
    const data = preparingClassData(cls.name)
    if (!data) continue
    const max = tableValue(data.prepared_spells_by_level, cls.level)
    classes.push({
      name: cls.name,
      ability: data.spellcasting.ability,
      max,
      breakdown: [
        {
          label: `${cls.name} ${cls.level}: prepared spells in the class table`,
          amount: max,
        },
      ],
    })
  }
  if (!classes.length) return null
  return {
    max: classes.reduce((sum, c) => sum + c.max, 0),
    classes,
    breakdown: classes.flatMap((c) => c.breakdown),
  }
}

module.exports = { isPreparedCaster, preparedSpellLimit }
