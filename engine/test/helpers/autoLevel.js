// Test helper: builds a character level by level through the real diffLevelUp,
// answering every pending choice with a deterministic policy (first valid option),
// so a whole career can be simulated and audited without a person at the screen.
//
//   const { buildCharacter } = require('./helpers/autoLevel')
//   const { character, log } = buildCharacter({ className: 'Wizard', subclass: 'Evoker', toLevel: 20, ruleset: '2024' })
//
// `log[i]` = { level, result, unresolved } for each level; `unresolved` lists
// pending choices the policy has no answer for (so a sweep can report them).

const { diffLevelUp } = require('../../rules/5e/diffLevelUp')
const {
  listSpellsForClass,
  effectiveMaxSpellLevel,
} = require('../../rules/5e/spellLists')
const { listFeats } = require('../../rules/5e/grants')
const { loadClass } = require('../../rules/5e/classFeatures')
const { listInvocations } = require('../../rules/5e/invocations')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const blank = (className, subclass, ruleset) => {
  const cls = loadClass(className, ruleset)
  return {
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

const takeFirst = (options, n, taken = []) => {
  const out = []
  for (const o of options || []) {
    const name = typeof o === 'string' ? o : o.name
    if (taken.includes(name) || out.includes(name)) continue
    out.push(name)
    if (out.length >= n) break
  }
  return out
}

// Folds one pending choice into the inputs for the next diffLevelUp call. Returns
// true when it knew what to do.
function answer(p, inputs, ctx) {
  const { character, className, toLevel, ruleset } = ctx
  const is2024 = ruleset === '2024'
  const c24 = (inputs.choices2024 ||= {})
  switch (p.type) {
    case 'asiOrFeat': {
      const res = (inputs.asiOrFeatResolutions ||= {})
      if (p.epicBoon) {
        const boon = listFeats('2024').find(
          (f) =>
            f.category === 'epic_boon' && /Combat Prowess|Boon of/.test(f.name)
        )
        res[p.level] = {
          type: 'feat',
          featName: boon.name,
          abilityChoice: 'con',
        }
      } else {
        const stats = ABILITIES.map((a) => [a, character[`stat_${a}`]]).sort(
          (x, y) => y[1] - x[1]
        )
        const target = stats.find(([, v]) => v <= 18)?.[0] ?? 'con'
        res[p.level] = { type: 'asi', increases: { [target]: 2 } }
      }
      return true
    }
    case 'newCantrips':
    case 'newKnownSpells':
    case 'spellbookAdditions': {
      const sc = (inputs.spellChoices ||= { cantrips: [], spells: [] })
      const sub = character.classes.find((c) => c.name === className)?.subclass
      const cls = ['Eldritch Knight', 'Arcane Trickster'].includes(sub)
        ? 'Wizard'
        : className
      const maxLevel =
        effectiveMaxSpellLevel({
          className,
          subclassName: sub,
          level: toLevel,
          otherClasses: [],
          ruleset,
        }) || 1
      const known = [
        ...character.spells.map((s) => s.name),
        ...sc.cantrips,
        ...sc.spells,
        ...(inputs.spellbookChoices || []),
      ]
      if (p.type === 'newCantrips') {
        sc.cantrips.push(
          ...takeFirst(
            listSpellsForClass(cls, {
              cantripsOnly: true,
              ruleset,
              extraFilter: (r) => !r.homebrew,
            }),
            p.count,
            known
          )
        )
      } else if (p.type === 'newKnownSpells') {
        sc.spells.push(
          ...takeFirst(
            listSpellsForClass(cls, {
              maxLevel,
              ruleset,
              extraFilter: (r) => !r.homebrew,
            }),
            p.count,
            known
          )
        )
      } else {
        inputs.spellbookChoices = [
          ...(inputs.spellbookChoices || []),
          ...takeFirst(
            listSpellsForClass('Wizard', {
              maxLevel,
              ruleset,
              extraFilter: (r) => !r.homebrew,
            }),
            p.count ?? 2,
            known
          ),
        ]
      }
      return true
    }
    case 'invocationChoice': {
      // Invocations with no prerequisite and within reach of this level.
      const open = listInvocations(ruleset)
        .filter(
          (o) =>
            (!o.prerequisite || o.prerequisite.type === 'level') &&
            (o.level ?? 1) <= toLevel
        )
        .map((o) => o.name)
      const have = inputs.invocationChoices || []
      const pick = open
        .filter(
          (n) =>
            !have.includes(n) &&
            !(character.features || []).some((f) => f.name === n)
        )
        .slice(0, p.count)
      inputs.invocationChoices = [...have, ...pick]
      return true
    }
    case 'pactBoonChoice':
      inputs.pactBoonChoice = 'Pact of the Blade'
      return true
    case 'fightingStyleChoice':
      if (is2024)
        c24.fightingStyle = [
          ...(c24.fightingStyle || []),
          ...takeFirst(p.options, p.count ?? 1, c24.fightingStyle || []),
        ]
      else inputs.fightingStyleChoice = takeFirst(p.options, 1)[0]
      return true
    case 'weaponMasteryChoice':
      c24.weaponMastery = [
        ...(c24.weaponMastery || []),
        ...takeFirst(p.options, p.count, c24.weaponMastery || []),
      ]
      return true
    case 'divineOrderChoice':
      c24.divineOrder = 'Protector'
      return true
    case 'primalOrderChoice':
      c24.primalOrder = 'Warden'
      return true
    case 'skillChoice':
      c24.primalKnowledgeSkill = takeFirst(
        p.options,
        1,
        character.skill_proficiencies.map((s) =>
          s.toLowerCase().replace(/ /g, '_')
        )
      )[0]
      return true
    case 'expertiseChoice': {
      const prof = new Set(character.skill_proficiencies || [])
      const done = new Set(character.skill_expertise || [])
      const names = (p.options || []).map((o) =>
        typeof o === 'string' ? o : o.name
      )
      const pool = (names.length ? names : [...prof]).filter(
        (n) => prof.has(n) && !done.has(n)
      )
      const pick = pool.slice(0, p.count ?? 2)
      if (is2024) (c24.expertise ||= {})[p.level] = pick
      else inputs.expertiseChoice = pick
      return true
    }
    case 'metamagicChoice':
      if (is2024)
        c24.metamagic = [
          ...(c24.metamagic || []),
          ...takeFirst(p.options, p.count, c24.metamagic || []),
        ]
      else inputs.metamagicChoice = takeFirst(p.options, p.count)
      return true
    case 'maneuverChoice':
      inputs.maneuverChoices = {
        ...(inputs.maneuverChoices || {}),
        [p.level]: takeFirst(p.options, p.count),
      }
      return true
    case 'bonusProficienciesChoice':
      inputs.bonusProficienciesChoice = takeFirst(
        p.options,
        p.count,
        character.skill_proficiencies
      )
      return true
    case 'magicalSecretsChoice': {
      const known = [
        ...character.spells.map((x) => x.name),
        ...(inputs.magicalSecretsChoice || []),
      ]
      const pool = listSpellsForClass('Bard', {
        maxLevel: 5,
        pool: 'any',
        ruleset,
        extraFilter: (r) => !r.homebrew,
      })
      inputs.magicalSecretsChoice = takeFirst(pool, p.count ?? 2, known)
      return true
    }
    case 'favoredEnemyChoice':
      inputs.favoredEnemyChoice = takeFirst(
        p.options,
        1,
        (character.features || []).map((f) => f.choice)
      )[0]
      return true
    case 'naturalExplorerChoice':
      inputs.naturalExplorerChoice = takeFirst(p.options, 1)[0]
      return true
    case 'dragonAncestorChoice':
      inputs.dragonAncestorChoice = 'Red'
      return true
    case 'mysticArcanumChoice':
      inputs.mysticArcanumChoice = takeFirst(p.options, 1)[0]
      return true
    case 'bladesingerWeaponChoice':
      inputs.bladesingerWeaponChoice = 'rapier'
      return true
    case 'spellMasteryChoice': {
      const one = takeFirst(
        listSpellsForClass('Wizard', {
          maxLevel: 1,
          ruleset,
          extraFilter: (r) => r.level === 1 && !r.homebrew,
        }),
        1
      )
      const two = takeFirst(
        listSpellsForClass('Wizard', {
          maxLevel: 2,
          ruleset,
          extraFilter: (r) => r.level === 2 && !r.homebrew,
        }),
        1
      )
      inputs.spellMasteryChoice = [one[0], two[0]]
      return true
    }
    case 'signatureSpellsChoice': {
      const three = takeFirst(
        listSpellsForClass('Wizard', {
          maxLevel: 3,
          ruleset,
          extraFilter: (r) => r.level === 3 && !r.homebrew,
        }),
        2
      )
      inputs.signatureSpellsChoice = three
      return true
    }
    case 'multiclassSkillChoice': {
      const owned = (character.skill_proficiencies || []).map((x) =>
        x.toLowerCase().replace(/ /g, '_')
      )
      const opts = p.options?.length
        ? p.options
        : loadClass(p.className || className, ruleset)?.skill_choices
            ?.options || []
      inputs.multiclassSkillChoice = takeFirst(
        opts.map((o) => (typeof o === 'string' ? o : o.id || o.name)),
        1,
        owned
      )[0]
      return true
    }
    case 'divineMagicChoice':
      inputs.divineMagicChoice = 'good'
      return true
    case 'masterOfIntrigueGamingSetChoice':
      inputs.masterOfIntrigueGamingSetChoice = 'Dice Set'
      return true
    case 'masterOfIntrigueLanguageChoice':
      inputs.masterOfIntrigueLanguageChoices = ['Dwarvish', 'Elvish']
      return true
    case 'subclassChoice':
      return true // the build already names its subclass
    default:
      return false
  }
}

function levelOnce(
  character,
  className,
  toLevel,
  ruleset,
  hpMethod = 'average'
) {
  let inputs = {}
  let result
  let unresolved = []
  for (let attempt = 0; attempt < 8; attempt++) {
    result = diffLevelUp(character, { className, toLevel, hpMethod, ...inputs })
    if (!result.patch)
      throw new Error(`${className} ${toLevel}: ${result.warnings.join(' ')}`)
    const before = JSON.stringify(inputs)
    unresolved = []
    for (const p of result.pendingChoices) {
      if (!answer(p, inputs, { character, className, toLevel, ruleset }))
        unresolved.push(p)
    }
    if (JSON.stringify(inputs) === before) break
  }
  // final pass with the settled inputs
  result = diffLevelUp(character, { className, toLevel, hpMethod, ...inputs })
  return {
    result,
    unresolved: result.pendingChoices.filter(
      (p) => p.type !== 'subclassChoice'
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
