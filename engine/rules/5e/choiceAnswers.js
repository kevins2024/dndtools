// Answers a pending choice from diffLevelUp with a deterministic policy (first valid
// option, or the caller's preferences), folding the answer into the inputs for the next
// diffLevelUp call. This is the one place "what do we pick for this choice?" is
// implemented for everything that has no person at the screen: the NPC builder, the
// rules-conformance sweeps and the migration tooling.
//
//   const inputs = {}
//   for (const p of result.pendingChoices)
//     answerChoice(p, inputs, { character, className, toLevel }, prefs)
//   diffLevelUp(character, { className, toLevel, hpMethod, ...inputs })
//
// Returns true when it knew what to do with the choice. `prefs` (all optional):
//   cantripPreferences, spellPreferences  ordered spell names to take first
//   invocationPreferences                  ordered invocation names
//   pactBoon, fightingStyle, favoredEnemy, naturalExplorer, expertiseSkills
//   abilityOrder                           ability keys, most wanted first, for ASIs
// It uses the spell lists and invocation tables, so it is server/engine-side only.

const { listSpellsForClass, effectiveMaxSpellLevel } = require('./spellLists')
const { listFeats } = require('./grants')
const { loadClass } = require('./classFeatures')
const {
  listInvocations,
  meetsInvocationPrerequisite,
} = require('./invocations')
const { DEFAULT_RULESET } = require('./rulesetId')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

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

// `options` with the preferred names (when they are among them) moved to the front.
const preferFirst = (options, preferred = []) => {
  const name = (o) => (typeof o === 'string' ? o : o.name)
  const ranked = preferred
    .map((n) => (options || []).find((o) => name(o) === n))
    .filter(Boolean)
  return [...ranked, ...(options || []).filter((o) => !ranked.includes(o))]
}

// Folds one pending choice into the inputs for the next diffLevelUp call. Returns
// true when it knew what to do.
function answerChoice(p, inputs, ctx, prefs = {}) {
  const { character, className, toLevel } = ctx
  const ruleset = ctx.ruleset ?? DEFAULT_RULESET
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
        // Spend both points in the preferred order (default: highest score first),
        // spilling into the next score once one reaches 20.
        const order =
          prefs.abilityOrder ??
          ABILITIES.map((a) => [a, character[`stat_${a}`]])
            .sort((x, y) => y[1] - x[1])
            .map(([a]) => a)
        const increases = {}
        let left = 2
        for (const a of order) {
          const room = Math.max(0, 20 - (character[`stat_${a}`] ?? 10))
          const spend = Math.min(room, left)
          if (spend > 0) increases[a] = spend
          left -= spend
          if (left <= 0) break
        }
        if (left > 0) increases.con = (increases.con ?? 0) + left
        res[p.level] = { type: 'asi', increases }
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
            preferFirst(
              listSpellsForClass(cls, {
                cantripsOnly: true,
                ruleset,
                extraFilter: (r) => !r.homebrew,
              }),
              prefs.cantripPreferences
            ),
            p.count,
            known
          )
        )
      } else if (p.type === 'newKnownSpells') {
        sc.spells.push(
          ...takeFirst(
            preferFirst(
              listSpellsForClass(cls, {
                maxLevel,
                ruleset,
                extraFilter: (r) => !r.homebrew,
              }),
              prefs.spellPreferences
            ),
            p.count,
            known
          )
        )
      } else {
        inputs.spellbookChoices = [
          ...(inputs.spellbookChoices || []),
          ...takeFirst(
            preferFirst(
              listSpellsForClass('Wizard', {
                maxLevel,
                ruleset,
                extraFilter: (r) => !r.homebrew,
              }),
              prefs.spellPreferences
            ),
            p.count ?? 2,
            known
          ),
        ]
      }
      return true
    }
    case 'invocationChoice': {
      // Invocations with no prerequisite and within reach of this level.
      const open = preferFirst(
        listInvocations(ruleset)
          .filter((o) =>
            prefs.invocationPreferences
              ? meetsInvocationPrerequisite(character, o.name)
              : (!o.prerequisite || o.prerequisite.type === 'level') &&
                (o.level ?? 1) <= toLevel
          )
          .map((o) => o.name),
        prefs.invocationPreferences
      )
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
      inputs.pactBoonChoice = prefs.pactBoon ?? 'Pact of the Blade'
      return true
    case 'fightingStyleChoice':
      c24.fightingStyle = [
        ...(c24.fightingStyle || []),
        ...takeFirst(
          preferFirst(p.options, [prefs.fightingStyle]),
          p.count ?? 1,
          c24.fightingStyle || []
        ),
      ]
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
      const pool = preferFirst(
        (names.length ? names : [...prof]).filter(
          (n) => prof.has(n) && !done.has(n)
        ),
        prefs.expertiseSkills
      )
      const pick = pool.slice(0, p.count ?? 2)
      ;(c24.expertise ||= {})[p.level] = pick
      return true
    }
    case 'metamagicChoice':
      c24.metamagic = [
        ...(c24.metamagic || []),
        ...takeFirst(p.options, p.count, c24.metamagic || []),
      ]
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
        preferFirst(p.options, [prefs.favoredEnemy]),
        1,
        (character.features || []).map((f) => f.choice)
      )[0]
      return true
    case 'naturalExplorerChoice':
      inputs.naturalExplorerChoice = takeFirst(
        preferFirst(p.options, [prefs.naturalExplorer]),
        1
      )[0]
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

module.exports = { answerChoice, takeFirst }
