const { loadClass } = require('./classFeatures')
const { describeLevelUp } = require('./levelUp')
const { proficiencyBonus } = require('./progression')
const { abilityModifier } = require('./abilities')
const { resolveAsiOrFeat } = require('./asiFeat')
const {
  multiclassSpellSlots,
  multiclassPactSlots,
  meetsMulticlassPrerequisites,
} = require('./multiclass')
const {
  spellSlotsForClassAtLevel,
  resolveSpellcasting,
} = require('./spellcasting')
const {
  invocationsKnownForLevel,
  loadInvocation,
  loadPactBoon,
} = require('./invocations')
const { listFightingStyles, loadFightingStyle } = require('./fightingStyles')
const { findSpellRecord } = require('./spellLists')
const { loadSkill } = require('./skills')
const { traitsFor } = require('./species')
const multiclassProficiencies = require('../../data/5e/multiclass-proficiencies.json')
const favoredEnemies = require('../../data/5e/favored-enemies.json')
const naturalExplorerTerrains = require('../../data/5e/natural-explorer-terrains.json')

const ABILITY_FIELDS = {
  str: 'stat_str',
  dex: 'stat_dex',
  con: 'stat_con',
  int: 'stat_int',
  wis: 'stat_wis',
  cha: 'stat_cha',
}

function extractScores(character) {
  const scores = {}
  for (const [ability, field] of Object.entries(ABILITY_FIELDS)) {
    scores[ability] = character[field] ?? 10
  }
  return scores
}

function scoresToPatchFields(scores) {
  const patch = {}
  for (const [ability, field] of Object.entries(ABILITY_FIELDS)) {
    patch[field] = scores[ability]
  }
  return patch
}

function normalizeName(name) {
  return name.trim().toLowerCase()
}

// The missing piece describeLevelUp deliberately doesn't do: compares what a
// SINGLE class's level-up SHOULD change (computed in isolation) against what
// a real character record ACTUALLY has, and produces an apply-able patch —
// plus a list of choices nothing here can make for the player instead of
// guessing at them.
//
// This is an adapter, like validateCharacter.js — the one place besides that
// file that knows the characters.json shape (stat_str/stat_dex/etc,
// spell_slots, pact_magic). Everything it calls into stays shape-agnostic.
//
// Pure — does NOT mutate `character` and does NOT write anything to disk.
// Returns { patch, pendingChoices, warnings, description } for a caller
// (eventually a UI) to review, resolve pendingChoices for, and apply.
//
// Levels up a class the character already has, OR picks up a brand-new one
// (real multiclassing) if `className` isn't in `character.classes` yet — the
// new class starts at level 0 so the rest of this function (feature grants,
// spell slots, HP, patch-building) runs unchanged for both cases; only
// proficiencies/prerequisites are pickup-specific, added further down.
function diffLevelUp(
  character,
  {
    className,
    toLevel,
    hpMethod = 'roll',
    hpRolls = [],
    asiOrFeatResolutions = {},
    // Warlock-only picks (see engine/CHECKLIST.md for the schema writeup).
    // invocationChoices: array of invocation names newly picked THIS call —
    // only as many as are actually needed get applied (extras ignored, not
    // erroring — the UI is expected to only submit what fits).
    invocationChoices = [],
    // pactBoonChoice: 'Pact of the Blade' | 'Pact of the Chain' | 'Pact of
    // the Tome' | null — the one-time level-3 pick.
    pactBoonChoice = null,
    // pactBoonBonusSpells: cantrip names for Pact of the Tome's "3 cantrips
    // from any class's list" grant — relevant only when the boon (just
    // chosen this call, or already on the character) is Pact of the Tome.
    pactBoonBonusSpells = [],
    // spellChoices: { cantrips: [names], spells: [names] } — the generic
    // known-spell/cantrip picker's resolution. Applies to whichever pool(s)
    // actually grew this level-up; cantrips and leveled spells are always
    // counted and applied separately, never conflated.
    spellChoices = {},
    // spellSwap: {from, to} | null — the PHB's optional "replace one spell
    // you know with another" clause, available every level-up to every
    // known-style caster (Bard/Sorcerer/Warlock/Ranger/Eldritch Knight/
    // Arcane Trickster — same style==='known' set spellsKnownForClass
    // already identifies). Genuinely optional (a player may skip it every
    // level), so unlike every other *Choices param above it never becomes a
    // pendingChoice — it's just applied if present, ignored if not. Only one
    // swap is modeled per diffLevelUp call, matching how the UI always
    // levels up one level at a time.
    spellSwap = null,
    // spellbookChoices: [names] — Wizard-only. PHB: "whenever you gain a
    // level in this class, you can add two wizard spells to your spellbook"
    // — flat +2 per level gained, entirely independent of any known-spell
    // cap (Wizard has none) and NOT automatically prepared (spellbook
    // contents still have to be prepared like any other Wizard spell), so
    // this is modeled as its own pendingChoice/patch path rather than
    // reusing the known-spell picker's prepared:true shape.
    spellbookChoices = [],
    // multiclassSkillChoice: a skill id (see engine/data/skills.json) —
    // resolves the PHB "Multiclassing Proficiencies" table's skill grant
    // (data/multiclass-proficiencies.json), currently real for Bard/Ranger/
    // Rogue, always exactly 1 skill per that table. Only meaningful on a
    // genuine multiclass pickup; ignored otherwise.
    multiclassSkillChoice = null,
    // fightingStyleChoice: a style name (e.g. "Two-Weapon Fighting") —
    // resolves Fighter 1st/Paladin 2nd/Ranger 2nd's Fighting Style pick.
    // Structurally the same problem as pactBoonChoice (a one-time named pick
    // never re-chosen later, see engine/data/fighting-styles.json's schema
    // note) except Fighting Style already has its own features_by_level
    // entry ("fighter-fighting-style" etc.) generating a generic newFeatures
    // item, which gets replaced with the resolved specific style once
    // picked, or left as-is (plus a pendingChoice) if not.
    fightingStyleChoice = null,
    // favoredEnemyChoice / naturalExplorerChoice: a single option string (e.g.
    // "Undead" / "Forest") — resolves whichever ONE of Ranger's Favored
    // Enemy (1st/6th/14th) or Natural Explorer (1st/6th/10th) grants is
    // being crossed by THIS call. Unlike fightingStyleChoice, this feature
    // is granted three separate times over a Ranger's career, not once —
    // each grant gets its own feature entry (see the dedup note above on
    // diffLevelUp's existingByLevel: "Ranger's Favored Enemy/Natural
    // Explorer improvements" are the documented reason level_gained is part
    // of the dedup key, not just name) — so only ONE of these two params
    // is ever meaningful per call, matching every other *Choice param's
    // one-level-at-a-time assumption.
    favoredEnemyChoice = null,
    naturalExplorerChoice = null,
    // expertiseChoice: an array of exactly 2 strings — skill proficiency
    // names the character already has, or "Thieves' Tools" for Rogue's
    // "or thieves' tools" alternative (PHB p.96; that tool proficiency
    // isn't tracked in a real tool_proficiencies list anywhere in this app
    // yet — see the multiclass tool-grant note above — so it's just always
    // offered to a Rogue rather than checked against a list that doesn't
    // exist). Resolves whichever ONE of Rogue's Expertise (1st/6th) or
    // Bard's Expertise (3rd/10th) grants is being crossed by THIS call,
    // same one-choice-per-call assumption as every other *Choice param.
    expertiseChoice = null,
  } = {}
) {
  const classIndex = (character.classes || []).findIndex(
    (c) => normalizeName(c.name) === normalizeName(className)
  )
  // A found entry with level 0 is a UI-only placeholder (see LevelUpTool.vue's
  // applySubclassChoice) letting the caller stash a subclass pick for a
  // brand-new class BEFORE the pickup is confirmed — level 1 with a
  // level-1 subclass_choice_level (Cleric/Sorcerer/Warlock) needs somewhere
  // to record that choice on the very first preview, and character.classes
  // is the only place describeLevelUp's subclassName comes from. Still a
  // genuine multiclass pickup either way: no real saved character ever has
  // a level-0 class entry.
  const existingEntry = classIndex !== -1 ? character.classes[classIndex] : null
  const isMulticlassPickup = !existingEntry || existingEntry.level === 0

  if (isMulticlassPickup && !loadClass(className)) {
    return {
      patch: null,
      pendingChoices: [],
      warnings: [`No rules data for class "${className}".`],
      description: null,
    }
  }

  const classEntry = existingEntry ?? {
    name: className,
    level: 0,
    subclass: null,
  }
  const fromLevel = classEntry.level
  const finalToLevel = toLevel ?? fromLevel + 1
  // Works for both branches: classIndex is -1 when there's no entry at all
  // (filter drops nothing, keeping the full list), or the placeholder's own
  // index when there is one (filter drops just that one).
  const otherClasses = character.classes
    .filter((_, i) => i !== classIndex)
    .map((c) => ({ name: c.name, level: c.level, subclass: c.subclass }))
  // Species/subrace traits (Dwarven Toughness's flat HP-per-level, Drow
  // Magic/Infernal Legacy's 3rd/5th-level tiered spells below) key off the
  // character's TOTAL level across every class, not the one being leveled
  // here — a multiclassed Drow's Faerie Fire arrives at total character
  // level 3, whether that 3rd level came from her first class or her second.
  const raceTraits = traitsFor(character.race, character.subrace)
  const otherClassesLevelSum = otherClasses.reduce((sum, c) => sum + c.level, 0)
  const totalLevelBefore = otherClassesLevelSum + fromLevel
  const totalLevelAfter = otherClassesLevelSum + finalToLevel
  // character.spellcasting_ability is set once at character creation from
  // the class's own spellcasting.ability — but a class that grants none of
  // its own (Fighter, Rogue) leaves it null forever, even after the player
  // picks up Eldritch Knight/Arcane Trickster later via a level-up. Fall
  // back to whatever the resolved class-or-subclass spellcasting says.
  const spellcastingAbility =
    character.spellcasting_ability ??
    resolveSpellcasting(classEntry.name, classEntry.subclass)?.ability ??
    null

  // Reflects any supplied ASI/feat resolution for a level BEFORE `lvl`, so a
  // mid-transition ASI into the spellcasting ability affects prepared-spell
  // counts correctly from that point on.
  function scoresResolvedThrough(lvl) {
    let s = extractScores(character)
    for (let l = fromLevel + 1; l <= lvl; l++) {
      const res = asiOrFeatResolutions[l]
      if (res) s = resolveAsiOrFeat(s, res).scores
    }
    return s
  }

  const pendingChoices = []
  const notes = []
  // Filled in by the Expertise block below, read when `patch` is built —
  // has to live up here since patch construction happens well after that
  // block runs.
  const expertiseSkillsGained = []

  // PHB p.163: gaining your first level in a class you don't already have
  // requires 13+ in that class's prerequisite ability score(s). A soft
  // warning, not a hard block — matches this project's general philosophy
  // (validateCharacter.js flags RAW deviations rather than preventing a
  // save; a DM may have a real reason to allow an exception).
  if (isMulticlassPickup) {
    const prereq = meetsMulticlassPrerequisites(
      className,
      extractScores(character)
    )
    if (!prereq.met) {
      const need = prereq.required
        .map((a) => a.toUpperCase() + ' 13')
        .join(prereq.mode === 'any' ? ' or ' : ' and ')
      notes.push(
        `${character.name} doesn't meet the multiclass prerequisite for ${className} (needs ${need}).`
      )
    }
  }

  const description = describeLevelUp({
    className: classEntry.name,
    subclassName: classEntry.subclass,
    fromLevel,
    toLevel: finalToLevel,
    otherClasses,
    hpMethod,
    hpRolls,
    // The "1st level HP is always max" rule applies once, ever, per
    // character — not once per class. Only a character with zero other
    // classes could possibly be hitting their true first level here.
    isCharactersFirstLevelEver: otherClasses.length === 0,
    abilityModifierAtLevel: (lvl) =>
      spellcastingAbility
        ? abilityModifier(scoresResolvedThrough(lvl)[spellcastingAbility])
        : 0,
  })

  // Apply every SUPPLIED resolution in level order; anything crossed without
  // one is a pending choice, not a guess.
  let scores = extractScores(character)
  const featFeatures = [] // {name, level, feature} — feat-granted feature entries to merge into patch.features
  // Spells granted through something OTHER than the character's own normal
  // known-spell/cantrip pick — feat grants (Fey Touched, etc: {name, level:
  // null, prepared: true, featureGranted: true, _source}), Pact of the
  // Tome's bonus cantrips (featureGranted: true, _source: 'Pact of the
  // Tome'), AND (below) the normal known-spell/cantrip picker's OWN writes
  // ({name, level, prepared: true, type: 'chosen'} — no featureGranted, same
  // shape a human already hand-enters, e.g. Kerra's real "Eldritch Blast"/
  // "Hex" entries) — all merged into patch.spells the same way at the
  // bottom of this function, hence one shared array/name despite the
  // now-broader set of sources.
  const extraGrantedSpells = []
  // Name of a known spell being given up this level via the optional PHB
  // spell-swap clause (set below, inside the spellcasting block) — removed
  // from the base list patch.spells is built from, further down.
  let spellSwapRemoval = null
  const featSavingThrowProfs = [] // ability keys to add to patch.saving_throws
  // Real attributable history for every point an ASI or a feat's own bump
  // adds to an ability score — {ability, amount, source, level_gained}.
  // `stat_str` etc. keep meaning "the final number" (unchanged, backward
  // compatible with every existing character); this is purely additive/
  // explanatory, built from resolveAsiOrFeat's own `deltas` (the ACTUAL
  // applied change, post-cap) so it always sums correctly even when a bump
  // gets capped at 20. See engine/CHECKLIST.md for the full design writeup.
  const abilityScoreHistory = []
  for (const lvl of description.asiOrFeatLevels) {
    const resolution = asiOrFeatResolutions[lvl]
    if (!resolution) {
      pendingChoices.push({ type: 'asiOrFeat', level: lvl })
      continue
    }
    const result = resolveAsiOrFeat(scores, resolution)
    scores = result.scores
    notes.push(...result.notes.map((n) => `Level ${lvl}: ${n}`))

    const source =
      resolution.type === 'asi'
        ? 'Ability Score Improvement'
        : resolution.featName
    for (const { ability, amount } of result.deltas ?? []) {
      if (amount === 0) continue // fully capped at 20 — nothing actually happened
      abilityScoreHistory.push({
        ability,
        amount,
        source,
        level_gained: lvl,
      })
    }

    if (resolution.type === 'feat' && result.feature) {
      const { feature } = result
      featFeatures.push({
        name: feature.name,
        id: null,
        type: 'feat',
        level_gained: lvl,
        ability_choice: feature.ability_choice,
        choices: feature.choices,
        ...(feature.stat_bonuses ? { stat_bonuses: feature.stat_bonuses } : {}),
      })
      if (feature.grants_saving_throw_proficiency) {
        featSavingThrowProfs.push(feature.grants_saving_throw_proficiency)
      }
      if (feature.grants_spells) {
        for (const spellName of feature.grants_spells.fixed ?? []) {
          extraGrantedSpells.push({
            name: spellName,
            level: null,
            prepared: true,
            featureGranted: true,
            _source: feature.name,
          })
        }
        // The "choice" half of grants_spells (e.g. Fey Touched's 1st-level
        // Divination/Enchantment pick) isn't enumerable from feats.json alone
        // (it's any matching spell in the whole catalog) — the level-up UI
        // collects it as a free-text pick under the reserved
        // `__grantedSpellChoice` key, same as every other "type: spell_text"
        // choice.
        const chosen = resolution.choices?.__grantedSpellChoice
        if (chosen) {
          extraGrantedSpells.push({
            name: chosen,
            level: null,
            prepared: true,
            featureGranted: true,
            _source: feature.name,
          })
        }
      }
    }
  }

  // Only add a feature the character doesn't already have — but "already
  // have" means either (a) the exact same name at the exact same
  // level_gained (a real repeat of this specific grant, e.g. re-running a
  // preview twice), or (b) the exact same name with NO level_gained
  // recorded at all (an older/hand-entered feature where the level was
  // never captured — ambiguous which grant it represents, so conservatively
  // assume it's this one rather than risk a duplicate).
  //
  // Deliberately NOT a same-name-at-any-level match: several real class
  // tables grant the identically-named feature more than once at different
  // levels (Rogue/Bard's Expertise at two levels each, Bard's Magical
  // Secrets three times, Ranger's Favored Enemy/Natural Explorer
  // improvements, Monk's Unarmored Movement scaling) — matching on name
  // alone silently ate every one of those second-or-later grants. Found via
  // a real character audit (Siv, Rogue 9, missing her level 6 Expertise
  // entirely — her level-1 Expertise had a recorded level_gained, so this
  // wasn't even the no-level-recorded case, just a plain wrong match).
  const existingByLevel = new Set() // "name@level" — exact repeat of one grant
  const existingNoLevel = new Set() // "name" — legacy entry, level unknown
  for (const f of character.features || []) {
    const n = normalizeName(f.name)
    if (f.level_gained == null) existingNoLevel.add(n)
    else existingByLevel.add(`${n}@${f.level_gained}`)
  }
  const newFeatures = []
  for (const group of [
    ...description.baseFeaturesGained,
    ...description.subclassFeaturesGained,
  ]) {
    group.names.forEach((name, i) => {
      const n = normalizeName(name)
      if (existingByLevel.has(`${n}@${group.level}`) || existingNoLevel.has(n))
        return
      newFeatures.push({
        name,
        id: group.ids?.[i] ?? null,
        type: 'feature',
        level_gained: group.level,
        _source: classEntry.name,
      })
      existingByLevel.add(`${n}@${group.level}`)
    })
  }

  // ── Fighting Style — Fighter (1st)/Paladin (2nd)/Ranger (2nd) ────────
  // Fighting Style already has its own features_by_level entry, so the
  // generic loop above just pushed a plain "Fighting Style" newFeatures item
  // with no chosen option — real bug found 2026-09-09, the New Character
  // Tool listed it with no way to actually pick one, because nothing ever
  // turned it into a pendingChoice. Structurally the same problem as Pact
  // Boon (a one-time named pick, never re-chosen later) once resolved here.
  const fightingStyleGenericIds = {
    fighter: 'fighter-fighting-style',
    paladin: 'paladin-fighting-style',
    ranger: 'ranger-fighting-style',
  }
  const fightingStyleGenericId =
    fightingStyleGenericIds[normalizeName(classEntry.name)]
  if (fightingStyleGenericId) {
    const genericIdx = newFeatures.findIndex(
      (f) => f.id === fightingStyleGenericId
    )
    // Scoped to THIS class specifically, not "any fightingStyle feature
    // anywhere" — real bug found 2026-09-16 (project owner: multiclassing
    // Ranger into Fighter showed no Fighting Style choice at either Fighter
    // 1 or 2). RAW: a second class that separately grants Fighting Style
    // still gets its own pick (you just can't take the identical option
    // twice) — Fighter 1st/Paladin 2nd/Ranger 2nd each grant their OWN
    // choice. The old blanket check meant a Ranger's already-picked style
    // silently suppressed Fighter's entirely separate grant — the generic
    // "Fighting Style" newFeatures entry was left unresolved forever with
    // no pendingChoice ever pushed for it.
    const alreadyHasStyle = (character.features || []).some(
      (f) => f.type === 'fightingStyle' && f._source === classEntry.name
    )
    // RAW (PHB Fighting Style, and repeated on every class that grants it):
    // "if you already have a fighting style from a different source, you
    // can't take the same option twice, even if a class feature offers to
    // give it to you again" — a second class's grant is still a REAL pick
    // (see alreadyHasStyle above, fixed 2026-09-16), but the option already
    // known from a different source has to be excluded from what's offered.
    // Real bug found the same day the multiclass fix shipped: the options
    // list was never filtered, so e.g. a Ranger's Archery pick didn't stop
    // Fighter's later grant from offering Archery again.
    const knownStyleNames = new Set(
      (character.features || [])
        .filter((f) => f.type === 'fightingStyle')
        .map((f) => f.name.replace(/^Fighting Style: /, ''))
    )
    if (genericIdx !== -1 && !alreadyHasStyle) {
      if (fightingStyleChoice) {
        const style = loadFightingStyle(classEntry.name, fightingStyleChoice)
        if (!style) {
          notes.push(
            `"${fightingStyleChoice}" isn't one of ${classEntry.name}'s cataloged Fighting Styles — recorded as chosen anyway, no automatic effects applied.`
          )
        } else if (knownStyleNames.has(fightingStyleChoice)) {
          notes.push(
            `"${fightingStyleChoice}" is already known from a different source — RAW says a repeated Fighting Style grant must pick a different option, recorded anyway.`
          )
        }
        newFeatures[genericIdx] = {
          name: style ? `Fighting Style: ${style.name}` : fightingStyleChoice,
          id: style?.id ?? null,
          type: 'fightingStyle',
          level_gained: newFeatures[genericIdx].level_gained,
          _source: classEntry.name,
        }
      } else {
        pendingChoices.push({
          type: 'fightingStyleChoice',
          level: newFeatures[genericIdx].level_gained,
          options: listFightingStyles(classEntry.name)
            .map((s) => s.name)
            .filter((name) => !knownStyleNames.has(name)),
        })
      }
    }
  }

  // ── Favored Enemy / Natural Explorer — Ranger (1st, then 6th and 14th /
  // 1st, then 6th and 10th) ─────────────────────────────────────────────
  // Same root problem Fighting Style had (real bug found 2026-09-16, same
  // day as the audit that found it): both features already have their own
  // features_by_level entries, so the generic loop above just pushes a
  // plain "Favored Enemy"/"Natural Explorer" newFeatures item with no
  // chosen type — nothing ever turned it into a pendingChoice. Unlike
  // Fighting Style, each of these is granted THREE separate times over a
  // Ranger's career (not a one-time pick), so the "already chosen" check
  // below is scoped to level_gained, not just feature type — otherwise the
  // 6th/14th (or 6th/10th) grants would silently never prompt at all once
  // the 1st-level one was resolved.
  if (normalizeName(classEntry.name) === 'ranger') {
    const resolveRangerChoice = ({
      genericId,
      choiceType,
      featureType,
      baseLabel,
      choiceValue,
      catalog,
    }) => {
      const idx = newFeatures.findIndex((f) => f.id === genericId)
      if (idx === -1) return
      const levelGained = newFeatures[idx].level_gained
      const alreadyChosenAtThisLevel = (character.features || []).some(
        (f) => f.type === featureType && f.level_gained === levelGained
      )
      if (alreadyChosenAtThisLevel) return
      if (choiceValue) {
        const valid = catalog.options.includes(choiceValue)
        if (!valid) {
          notes.push(
            `"${choiceValue}" isn't one of ${baseLabel}'s cataloged options — recorded as chosen anyway.`
          )
        }
        // RAW calls this the same feature name every time it's granted
        // (1st/6th/14th, or 1st/6th/10th) — the catalog's own "...
        // improvement" suffix on the 6th/14th (or 10th) grant is an
        // internal bookkeeping distinction (see feature-catalog.json),
        // not something that should leak into the player-facing name.
        newFeatures[idx] = {
          name: `${baseLabel}: ${choiceValue}`,
          id: null,
          type: featureType,
          level_gained: levelGained,
          _source: classEntry.name,
        }
      } else {
        pendingChoices.push({
          type: choiceType,
          level: levelGained,
          options: catalog.options,
        })
      }
    }

    resolveRangerChoice({
      genericId: 'gen_ranger_base_favored-enemy',
      choiceType: 'favoredEnemyChoice',
      featureType: 'favoredEnemy',
      baseLabel: 'Favored Enemy',
      choiceValue: favoredEnemyChoice,
      catalog: favoredEnemies,
    })
    resolveRangerChoice({
      genericId: 'gen_ranger_base_favored-enemy-improvement',
      choiceType: 'favoredEnemyChoice',
      featureType: 'favoredEnemy',
      baseLabel: 'Favored Enemy',
      choiceValue: favoredEnemyChoice,
      catalog: favoredEnemies,
    })
    resolveRangerChoice({
      genericId: 'gen_ranger_base_natural-explorer',
      choiceType: 'naturalExplorerChoice',
      featureType: 'naturalExplorer',
      baseLabel: 'Natural Explorer',
      choiceValue: naturalExplorerChoice,
      catalog: naturalExplorerTerrains,
    })
    resolveRangerChoice({
      genericId: 'gen_ranger_base_natural-explorer-improvement',
      choiceType: 'naturalExplorerChoice',
      featureType: 'naturalExplorer',
      baseLabel: 'Natural Explorer',
      choiceValue: naturalExplorerChoice,
      catalog: naturalExplorerTerrains,
    })
  }

  // ── Expertise — Rogue (1st, then 6th) / Bard (3rd, then 10th) ─────────
  // Same root problem Fighting Style/Favored Enemy had (real bug found
  // 2026-09-17 — project owner: "made a new test Rogue and there's no way
  // to do anything with Expertise"): both classes' features_by_level
  // entries just produce a generic "Expertise" newFeatures item with no
  // chosen skills — nothing ever turned it into a pendingChoice. Granted
  // TWICE per class (like Favored Enemy/Natural Explorer), so "already
  // resolved" is scoped to level_gained + class, not "any Expertise exists
  // anywhere" (which would wrongly suppress the 2nd grant).
  const expertiseGenericIds = {
    rogue: ['rogue-expertise-1', 'rogue-expertise-2'],
    bard: ['bard-expertise-1', 'bard-expertise-2'],
  }
  const expertiseIds = expertiseGenericIds[normalizeName(classEntry.name)]
  if (expertiseIds) {
    // Rogue's (and Bard's) own class table references the SAME generic id
    // at both grant levels rather than a distinct "-improvement" id like
    // Favored Enemy — match on any of this class's Expertise ids, whichever
    // one actually shows up in newFeatures for the level this call covers.
    const genericIdx = newFeatures.findIndex((f) => expertiseIds.includes(f.id))
    if (genericIdx !== -1) {
      const levelGained = newFeatures[genericIdx].level_gained
      const alreadyChosenAtThisLevel = (character.features || []).some(
        (f) =>
          f.type === 'expertise' &&
          f.level_gained === levelGained &&
          f._source === classEntry.name
      )
      if (!alreadyChosenAtThisLevel) {
        const isRogue = normalizeName(classEntry.name) === 'rogue'
        const alreadyExpertise = new Set(character.skill_expertise || [])
        // RAW: must already be proficient in whatever's picked, and can't
        // double up on a skill that already has Expertise from an earlier
        // grant. Rogue's "or thieves' tools" alternative is always offered
        // (every Rogue gets that tool proficiency at 1st level, RAW) rather
        // than checked against a tracked tool_proficiencies list — this app
        // doesn't track that anywhere yet (see the multiclass tool-grant
        // note above).
        const validOptions = (character.skill_proficiencies || []).filter(
          (s) => !alreadyExpertise.has(s)
        )
        if (isRogue && !alreadyExpertise.has("Thieves' Tools")) {
          validOptions.push("Thieves' Tools")
        }
        if (expertiseChoice) {
          const picks = Array.isArray(expertiseChoice)
            ? expertiseChoice
            : [expertiseChoice]
          if (picks.length !== 2) {
            notes.push(
              `Expertise needs exactly 2 picks for ${classEntry.name} (got ${picks.length}) — recorded as given.`
            )
          } else if (picks[0] === picks[1]) {
            notes.push(
              `Expertise needs two DIFFERENT proficiencies — "${picks[0]}" was picked twice, recorded anyway.`
            )
          }
          for (const pick of picks) {
            if (!validOptions.includes(pick) && !alreadyExpertise.has(pick)) {
              notes.push(
                `"${pick}" isn't one of ${
                  classEntry.name
                }'s valid Expertise picks (not a skill this character is proficient in${
                  isRogue ? " or thieves' tools" : ''
                }) — recorded anyway.`
              )
            }
          }
          newFeatures[genericIdx] = {
            name: `Expertise: ${picks.join(', ')}`,
            id: null,
            type: 'expertise',
            level_gained: levelGained,
            _source: classEntry.name,
          }
          expertiseSkillsGained.push(...picks)
        } else {
          pendingChoices.push({
            type: 'expertiseChoice',
            level: levelGained,
            count: 2,
            options: validOptions,
          })
        }
      }
    }
  }

  // Feat-granted feature entries (built above from resolveAsiOrFeat) go
  // through the SAME existingByLevel/existingNoLevel dedup as class-table
  // features — a re-run preview shouldn't double them either.
  for (const f of featFeatures) {
    const n = normalizeName(f.name)
    if (existingByLevel.has(`${n}@${f.level_gained}`) || existingNoLevel.has(n))
      continue
    newFeatures.push(f)
    existingByLevel.add(`${n}@${f.level_gained}`)
  }

  // ── Species tiered spells (Drow Magic's Faerie Fire/Darkness, Infernal
  // Legacy's Hellish Rebuke/Darkness) — keyed on TOTAL character level
  // (totalLevelBefore/After, computed above), not this class's own level, so
  // a multiclassed character still gets these at the right overall level
  // regardless of which class happened to cross the threshold. Goes through
  // the same existingByLevel/existingNoLevel dedup as every other feature
  // grant, level_gained set to the trait's tier level (not the class level).
  for (const trait of raceTraits) {
    for (const tier of trait.grants_spells?.tiered ?? []) {
      if (tier.level <= totalLevelBefore || tier.level > totalLevelAfter)
        continue
      const featureName = `${trait.name}: ${tier.spell}`
      const n = normalizeName(featureName)
      if (existingByLevel.has(`${n}@${tier.level}`) || existingNoLevel.has(n))
        continue
      newFeatures.push({
        name: featureName,
        id: null,
        type: 'speciesTrait',
        level_gained: tier.level,
        spells_granted: [tier.spell],
        _source: trait.name,
      })
      existingByLevel.add(`${n}@${tier.level}`)
    }
  }

  // ── Eldritch Invocations / Pact Boon — Warlock only ──────────────────
  // Both are "pick from a prerequisite-gated catalog" choices, structurally
  // similar to a feat pick, but genuinely different in shape: Pact Boon is a
  // strict one-time single pick (never re-chosen — see engine/CHECKLIST.md
  // for why re-picking/"swapping" an invocation on a later level-up,
  // something real RAW does allow, is a deliberate v1 cut, same spirit as
  // Tough's retroactive HP in the feat work), while invocations are a
  // repeating multi-pick against a running total. Gated on the class being
  // leveled THIS call being Warlock — invocations/Pact Boon only ever change
  // on a Warlock level-up, so fromLevel/finalToLevel above are already the
  // Warlock levels needed, no otherClasses lookup required.
  if (normalizeName(classEntry.name) === 'warlock') {
    const knownInvocationCount = (character.features || []).filter(
      (f) => f.type === 'invocation'
    ).length
    const invocationsNeeded = Math.max(
      0,
      invocationsKnownForLevel(finalToLevel) - knownInvocationCount
    )
    if (invocationsNeeded > 0) {
      const known = new Set(
        (character.features || [])
          .filter((f) => f.type === 'invocation')
          .map((f) => normalizeName(f.name))
      )
      const picked = (invocationChoices || []).filter(
        (n) => !known.has(normalizeName(n))
      )
      const applied = picked.slice(0, invocationsNeeded)
      for (const name of applied) {
        const inv = loadInvocation(name)
        newFeatures.push({
          name,
          id: inv?.id ?? null,
          type: 'invocation',
          level_gained: finalToLevel,
          _source: 'Warlock',
        })
      }
      const stillNeeded = invocationsNeeded - applied.length
      if (stillNeeded > 0) {
        pendingChoices.push({
          type: 'invocationChoice',
          count: stillNeeded,
          level: finalToLevel,
        })
      }
    }

    const hasPactBoon = (character.features || []).some(
      (f) => f.type === 'pactBoon'
    )
    if (!hasPactBoon && finalToLevel >= 3) {
      if (pactBoonChoice) {
        const boon = loadPactBoon(pactBoonChoice)
        // Unrecognized name (hand-typed/homebrew) still gets recorded, same
        // "Other (not yet catalogued)" tolerance the feat picker has — just
        // flagged, not blocked.
        if (!boon) {
          notes.push(
            `"${pactBoonChoice}" isn't one of the 3 cataloged Pact Boons — recorded as chosen anyway, no automatic effects applied.`
          )
        }
        newFeatures.push({
          name: pactBoonChoice,
          id: boon?.id ?? null,
          type: 'pactBoon',
          level_gained: finalToLevel,
          _source: 'Warlock',
        })
      } else {
        pendingChoices.push({ type: 'pactBoonChoice', level: 3 })
      }
    }

    // Pact of the Tome's "choose three cantrips from any class's spell
    // list" — triggers whether the boon was just picked THIS call or was
    // already recorded on an earlier one, and self-heals to whatever's
    // actually still missing rather than assuming exactly 0 or 3 already
    // exist (a re-run preview, or a character whose data predates this
    // feature, might have 1 or 2 already recorded by hand).
    const pactOfTheTomeActive =
      normalizeName(pactBoonChoice || '') === 'pact of the tome' ||
      (character.features || []).some(
        (f) =>
          f.type === 'pactBoon' && normalizeName(f.name) === 'pact of the tome'
      )
    if (pactOfTheTomeActive) {
      const existingTomeCantrips = new Set(
        (character.spells || [])
          .filter((s) => s._source === 'Pact of the Tome')
          .map((s) => normalizeName(s.name))
      )
      const need = 3 - existingTomeCantrips.size
      if (need > 0) {
        const picked = (pactBoonBonusSpells || []).filter(
          (n) => !existingTomeCantrips.has(normalizeName(n))
        )
        const applied = picked.slice(0, need)
        for (const name of applied) {
          extraGrantedSpells.push({
            name,
            level: 0,
            prepared: true,
            featureGranted: true,
            _source: 'Pact of the Tome',
          })
        }
        const stillNeeded = need - applied.length
        if (stillNeeded > 0) {
          pendingChoices.push({
            type: 'bonusSpellChoice',
            count: stillNeeded,
            level: finalToLevel,
            source: 'Pact of the Tome',
            pool: 'any',
            cantripsOnly: true,
          })
        }
      }
    }
  }

  if (description.subclassChoiceNeeded) {
    const cls = loadClass(classEntry.name)
    pendingChoices.push({
      type: 'subclassChoice',
      level: cls ? cls.subclass_choice_level : null,
    })
  }

  const levelsGained = finalToLevel - fromLevel
  const conMod = abilityModifier(scores.con)
  // Flat non-class HP source (Dwarven Toughness: "+1 at 1st, +1 every level
  // thereafter" — same gap noted for Sorcerer's Draconic Resilience, but
  // that's a subclass feature, out of scope for this species-only fix).
  // Multiplying by levelsGained covers the "+1 at 1st" case too: a brand-new
  // character's very first level-up call is fromLevel 0 -> toLevel 1, i.e.
  // levelsGained === 1, so it falls out of the same per-level math with no
  // separate "at creation" special case needed.
  const hpPerLevelBonus = raceTraits.reduce(
    (sum, t) => sum + (t.grants_hp_per_level || 0),
    0
  )
  const hpGained =
    description.totalHpGained +
    conMod * levelsGained +
    hpPerLevelBonus * levelsGained

  const patch = {
    level: (character.level || 0) + levelsGained,
    proficiency_bonus: proficiencyBonus((character.level || 0) + levelsGained),
    hp_max: (character.hp_max || 0) + hpGained,
    hp_current: (character.hp_current || 0) + hpGained,
    hit_dice_current: (character.hit_dice_current ?? fromLevel) + levelsGained,
    classes: isMulticlassPickup
      ? [
          ...character.classes.filter((_, i) => i !== classIndex),
          {
            name: className,
            level: finalToLevel,
            subclass: classEntry.subclass,
          },
        ]
      : character.classes.map((c, i) =>
          i === classIndex ? { ...c, level: finalToLevel } : c
        ),
    ...scoresToPatchFields(scores),
  }

  if (newFeatures.length) {
    patch.features = [...(character.features || []), ...newFeatures]
  }

  if (abilityScoreHistory.length) {
    patch.ability_score_history = [
      ...(character.ability_score_history || []),
      ...abilityScoreHistory,
    ]
  }

  // Resilient is the only cataloged feat with grants_saving_throw_proficiency
  // — add the chosen ability to the character's saving-throw proficiency
  // list if it isn't already there (a re-run preview shouldn't duplicate it).
  if (featSavingThrowProfs.length) {
    const existing = new Set(character.saving_throws || [])
    for (const ability of featSavingThrowProfs) existing.add(ability)
    patch.saving_throws = [...existing]
  }

  // Expertise picks (see the Rogue/Bard block above) double proficiency
  // bonus wherever dnd.skill()/SkillList.vue/VitalsChipRow.vue already
  // check skill_expertise — no new mechanical wiring needed on the src/
  // side, just populating the field the app already reads.
  if (expertiseSkillsGained.length) {
    const existing = new Set(character.skill_expertise || [])
    for (const skill of expertiseSkillsGained) existing.add(skill)
    patch.skill_expertise = [...existing]
  }

  // A class gained by MULTICLASSING grants only the PHB's reduced
  // proficiency list (data/multiclass-proficiencies.json) — never the full
  // starting-class list, and NEVER a new saving throw proficiency (that's
  // explicitly starting-class-only, RAW).
  if (isMulticlassPickup) {
    const grant = multiclassProficiencies[className]
    if (grant) {
      const armor = new Set(character.armor_proficiencies || [])
      for (const a of grant.armor || []) armor.add(a)
      const weapons = new Set(character.weapon_proficiencies || [])
      for (const w of grant.weapons || []) weapons.add(w)
      patch.armor_proficiencies = [...armor]
      patch.weapon_proficiencies = [...weapons]

      // Skill grant (Bard/Ranger/Rogue, always "choose 1" per the real PHB
      // table) — real picker now, using the same skill_choices.options list
      // (engine/data/classes/<class>.json) the New Character tool's own
      // class-skill picker already reads, rather than the flat "class skill
      // list" placeholder text the multiclass-proficiencies.json table
      // itself carries only for display. A choice already on the character
      // (from the starting class, a feat, etc.) doesn't need re-picking —
      // skipped silently rather than wasting the pick or erroring.
      if (grant.skills) {
        const existingSkillNames = new Set(character.skill_proficiencies || [])
        if (multiclassSkillChoice) {
          const classData = loadClass(className)
          const validOptions = classData?.skill_choices?.options
          const skill = loadSkill(multiclassSkillChoice)
          const isValidChoice =
            skill &&
            (validOptions === 'any' ||
              (Array.isArray(validOptions) &&
                validOptions.includes(multiclassSkillChoice)))
          if (!isValidChoice) {
            notes.push(
              `"${multiclassSkillChoice}" isn't a valid ${className} skill choice — not applied, pick again.`
            )
            pendingChoices.push({
              type: 'multiclassSkillChoice',
              count: grant.skills.choose,
              className,
            })
          } else if (existingSkillNames.has(skill.name)) {
            notes.push(
              `${skill.name} is already a proficiency — multiclassing into ${className} grants no additional skill this time.`
            )
          } else {
            patch.skill_proficiencies = [...existingSkillNames, skill.name]
          }
        } else {
          pendingChoices.push({
            type: 'multiclassSkillChoice',
            count: grant.skills.choose,
            className,
          })
        }
      }
      // Tool grant (Bard/Rogue/Artificer) — still surfaced as a warning
      // only. Unlike skills, this app has no tool_proficiencies field
      // anywhere on the character schema yet (not just for multiclassing —
      // a starting class's OWN tool grants, e.g. Rogue's thieves' tools,
      // aren't tracked either), so building a real picker here would mean
      // inventing a new schema field used nowhere else in the app — a
      // bigger, separate decision than this multiclass-specific gap.
      if (grant.tools) {
        const toolText = Array.isArray(grant.tools)
          ? grant.tools.join(', ')
          : `${grant.tools.choose} of your choice from ${grant.tools.from}`
        notes.push(
          `Multiclassing into ${className} also grants proficiency with ${toolText} — tool proficiencies aren't tracked on the character sheet yet.`
        )
      }
    }
  }

  if (description.spellcasting) {
    const combinedClasses = [
      ...otherClasses,
      {
        name: classEntry.name,
        level: finalToLevel,
        subclass: classEntry.subclass,
      },
    ]

    if (description.spellcasting.type === 'pact') {
      const pact = multiclassPactSlots(combinedClasses)
      patch.pact_magic = {
        slot_level: pact.slot_level,
        max: pact.slots,
        current: pact.slots,
        recharge: 'short_rest',
      }
    } else {
      const isMulticlassed = otherClasses.length > 0
      const slots = isMulticlassed
        ? multiclassSpellSlots(combinedClasses)
        : spellSlotsForClassAtLevel(
            classEntry.name,
            finalToLevel,
            classEntry.subclass
          )
      const spellSlots = {}
      slots.forEach((max, i) => {
        spellSlots[`level_${i + 1}`] = { max, current: max }
      })
      patch.spell_slots = spellSlots
    }

    // Cantrips are GENERIC — every spellcasting class/type (prepared or
    // known) chooses a fixed number of cantrips, never "prepares" them daily
    // (see spellcasting.js's own cantripsKnownForClass, used by prepared AND
    // known casters alike) — so this isn't gated on style === 'known' the
    // way the leveled-spell pick below is. This is the real, previously
    // entirely-missing half of "known spell/cantrip picks": describeLevelUp
    // always computed cantripsBefore/cantripsAfter, but nothing ever turned
    // a positive delta into a pendingChoice or wrote a pick anywhere.
    const cantripsGained =
      description.spellcasting.cantripsAfter -
      description.spellcasting.cantripsBefore
    if (cantripsGained > 0) {
      const existingCantrips = new Set(
        (character.spells || [])
          .filter((s) => s.level === 0)
          .map((s) => normalizeName(s.name))
      )
      const picked = (spellChoices.cantrips || []).filter(
        (n) => !existingCantrips.has(normalizeName(n))
      )
      const applied = picked.slice(0, cantripsGained)
      for (const name of applied) {
        extraGrantedSpells.push({
          name,
          level: 0,
          prepared: true,
          type: 'chosen',
        })
      }
      const stillNeeded = cantripsGained - applied.length
      if (stillNeeded > 0) {
        pendingChoices.push({
          type: 'newCantrips',
          count: stillNeeded,
          level: finalToLevel,
        })
      }
    }

    if (description.spellcasting.style === 'known') {
      const gained =
        description.spellcasting.knownAfter -
        description.spellcasting.knownBefore
      if (gained > 0) {
        const existingKnown = new Set(
          (character.spells || [])
            .filter((s) => s.level > 0)
            .map((s) => normalizeName(s.name))
        )
        const picked = (spellChoices.spells || []).filter(
          (n) => !existingKnown.has(normalizeName(n))
        )
        const applied = picked.slice(0, gained)
        for (const name of applied) {
          const record = findSpellRecord(name)
          extraGrantedSpells.push({
            name,
            level: record?.level ?? null,
            prepared: true,
            type: 'chosen',
          })
          if (record?.level == null) {
            notes.push(
              `"${name}" isn't in the local spell catalog — added with no level recorded, fix by hand.`
            )
          }
        }
        const stillNeeded = gained - applied.length
        if (stillNeeded > 0) {
          pendingChoices.push({
            type: 'newKnownSpells',
            count: stillNeeded,
            level: finalToLevel,
          })
        }
      }

      // PHB: "Additionally, when you gain a level in this class, you can
      // choose one of the spells you know and replace it with another
      // spell..." — every known-style caster gets this, every level, fully
      // optional (a player may simply not submit spellSwap this call).
      // Deliberately NOT a pendingChoice: nothing here should ever block
      // Confirm Level Up over an optional swap the player doesn't want.
      if (spellSwap?.from && spellSwap?.to) {
        const fromNorm = normalizeName(spellSwap.from)
        const currentlyKnown = (character.spells || []).some(
          (s) => s.level > 0 && normalizeName(s.name) === fromNorm
        )
        if (!currentlyKnown) {
          notes.push(
            `Can't swap "${spellSwap.from}" for "${spellSwap.to}" — "${spellSwap.from}" isn't currently a known spell.`
          )
        } else {
          const record = findSpellRecord(spellSwap.to)
          extraGrantedSpells.push({
            name: spellSwap.to,
            level: record?.level ?? null,
            prepared: true,
            type: 'chosen',
          })
          if (record?.level == null) {
            notes.push(
              `"${spellSwap.to}" isn't in the local spell catalog — swapped in with no level recorded, fix by hand.`
            )
          }
          spellSwapRemoval = spellSwap.from
        }
      }
    }

    // PHB: "Whenever you gain a level in this class, you can add two wizard
    // spells to your spellbook" — a flat +2 per level gained, entirely
    // separate from any known-spell cap (Wizard has none, it's a 'prepared'
    // caster) and NOT automatically prepared, unlike every other spell pick
    // above — spellbook contents still need to be prepared like any other
    // Wizard spell, so `prepared: false` here specifically.
    if (normalizeName(classEntry.name) === 'wizard') {
      const spellbookGained = 2 * levelsGained
      const existingSpellbook = new Set(
        (character.spells || [])
          .filter((s) => s.level > 0)
          .map((s) => normalizeName(s.name))
      )
      const picked = (spellbookChoices || []).filter(
        (n) => !existingSpellbook.has(normalizeName(n))
      )
      const applied = picked.slice(0, spellbookGained)
      for (const name of applied) {
        const record = findSpellRecord(name)
        extraGrantedSpells.push({
          name,
          level: record?.level ?? null,
          prepared: false,
          type: 'chosen',
        })
        if (record?.level == null) {
          notes.push(
            `"${name}" isn't in the local spell catalog — added to spellbook with no level recorded, fix by hand.`
          )
        }
      }
      const stillNeeded = spellbookGained - applied.length
      if (stillNeeded > 0) {
        pendingChoices.push({
          type: 'spellbookAdditions',
          count: stillNeeded,
          level: finalToLevel,
        })
      }
    }
  }

  // Spells collected into extraGrantedSpells — feat grants (Fey Touched/
  // Shadow Touched's fixed + chosen spell, Telekinetic's Mage Hand, etc:
  // {name, level: null, prepared, featureGranted, _source: featName} — same
  // shape a human currently enters by hand, see spellUtils.js's
  // getCharacterSpells step 1 and any real character's Fey Touched/Shadow
  // Touched entries; `level: null` is resolved asynchronously by the UI the
  // same way spellUtils.js's own feature-granted-spell path documents),
  // Pact of the Tome's bonus cantrips, and the normal known-spell/cantrip
  // picker's own writes just above ({name, level, prepared: true, type:
  // 'chosen'} — no featureGranted/_source, the exact shape a human already
  // hand-enters, e.g. Kerra's real Eldritch Blast/Hex entries) — ALL merged
  // here, keyed on name+_source so a re-run preview never adds the same
  // spell twice. `s._source ?? ''` on BOTH sides matters: the picker's own
  // entries carry no _source at all, and without the coalesce on the filter
  // side too, `undefined` would stringify differently than the existing
  // set's `''` and defeat the dedup entirely.
  // A resolved spell swap (spellSwapRemoval, set above) removes the given-up
  // spell from the base list BEFORE anything is added — otherwise the
  // replacement would just pile on top of the old spell still sitting there.
  const baseSpells = spellSwapRemoval
    ? (character.spells || []).filter(
        (s) => normalizeName(s.name) !== normalizeName(spellSwapRemoval)
      )
    : character.spells || []

  if (extraGrantedSpells.length) {
    const existingSpellKeys = new Set(
      baseSpells.map((s) => `${s.name}\0${s._source ?? ''}`)
    )
    const toAdd = extraGrantedSpells.filter(
      (s) => !existingSpellKeys.has(`${s.name}\0${s._source ?? ''}`)
    )
    if (toAdd.length || spellSwapRemoval) {
      patch.spells = [...baseSpells, ...toAdd]
    }
  } else if (spellSwapRemoval) {
    patch.spells = baseSpells
  }

  // newFeatures is the same array merged into patch.features, exposed on its
  // own so a caller (a UI) can display "here's what's new" without having to
  // diff patch.features against the character's original list itself.
  return { patch, newFeatures, pendingChoices, warnings: notes, description }
}

module.exports = { diffLevelUp }
