// Test helper: builds a character level by level through the real diffLevelUp,
// answering every pending choice with a deterministic policy (first valid option),
// so a whole career can be simulated and audited without a person at the screen.
//
//   const { buildCharacter } = require('./helpers/autoLevel')
//   const { character, log } = buildCharacter({ className: 'Wizard', subclass: 'Evoker', toLevel: 20, ruleset: '2024' })
//
// `log[i]` = { level, result, unresolved } for each level; `unresolved` lists
// pending choices the policy has no answer for (so a sweep can report them).

const { loadClass } = require('../../rules/5e/classFeatures')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const blank = (className, subclass, ruleset) => {
  const cls = loadClass(className, ruleset)
  return {
    ability_base: { str: 15, dex: 14, con: 14, int: 14, wis: 14, cha: 8 },
    ability_score_history: [],
    name: 'Sim',
    ruleset,
    genus: 'Human',
    level: 0,
    stat_str: 15,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 14,
    stat_wis: 14,
    stat_cha: 8,
    hp_max: 0,
    hp_current: 0,
    hit_dice_current: 0,
    features: [],
    spells: [],
    skill_proficiencies: [
      'Athletics',
      'Insight',
      'Stealth',
      'Perception',
      'Arcana',
      'History',
    ],
    skill_expertise: [],
    saving_throws: cls?.saving_throw_proficiencies ?? [],
    armor_proficiencies: cls?.armor_proficiencies ?? [],
    weapon_proficiencies: cls?.weapon_proficiencies ?? [],
    classes: [{ name: className, subclass, level: 0 }],
  }
}

const { autoLevelUp } = require('../../rules/5e/choiceProtocol')

// One level-up with every choice answered by policy, through the same choice descriptions a
// UI would render (rules/5e/choiceProtocol.js).
function levelOnce(
  character,
  className,
  toLevel,
  ruleset,
  hpMethod = 'average'
) {
  const r = autoLevelUp(character, { className, toLevel, hpMethod })
  return {
    result: r,
    unresolved: r.choices.filter(
      (c) => !c.answered && c.type !== 'subclassChoice'
    ),
  }
}

function buildCharacter({
  className,
  subclass = null,
  toLevel = 20,
  ruleset = '2024',
  stopAfter = null,
}) {
  let character = blank(className, subclass, ruleset)
  const log = []
  for (let lvl = 1; lvl <= toLevel; lvl++) {
    const { result, unresolved } = levelOnce(character, className, lvl, ruleset)
    const patch = { ...result.patch }
    // diffLevelUp returns new spells in patch.spells already; classes carries the subclass
    character = { ...character, ...patch }
    log.push({ level: lvl, result, unresolved, character })
    if (stopAfter && stopAfter(character, lvl)) break
  }
  return { character, log }
}

module.exports = { buildCharacter, levelOnce, blank }

// Multiclass career: plan = [[className, subclass, classLevels], ...] taken in order.
// The first entry is the starting class. Later classes are staged as level-0
// placeholders (how LevelUpTool stashes a subclass pick) and picked up at level 1.
function buildMulticlass({ plan, ruleset = '2024' }) {
  const [firstClass, firstSub] = plan[0]
  let character = blank(firstClass, firstSub, ruleset)
  const log = []
  for (const [className, subclass, count] of plan) {
    if (!character.classes.some((c) => c.name === className))
      character = {
        ...character,
        classes: [
          ...character.classes,
          { name: className, subclass, level: 0 },
        ],
      }
    const start = character.classes.find((c) => c.name === className).level
    for (let lvl = start + 1; lvl <= start + count; lvl++) {
      const { result, unresolved } = levelOnce(
        character,
        className,
        lvl,
        ruleset
      )
      character = { ...character, ...result.patch }
      log.push({
        className,
        level: lvl,
        characterLevel: character.level,
        result,
        unresolved,
        character,
      })
    }
  }
  return { character, log }
}

module.exports.buildMulticlass = buildMulticlass
