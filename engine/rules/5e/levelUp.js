const { loadClass } = require('./classFeatures')
const { isAsiLevel, hitDieForClass, hpGainForLevel } = require('./progression')
const {
  resolveSpellcasting,
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
} = require('./spellcasting')
const {
  subclassFeaturesGainedAtLevel,
  subclassFeatureIdsGainedAtLevel,
} = require('./subclasses')
const { multiclassSpellSlots } = require('./multiclass')

// The function the future level-up wizard calls, one level at a time.
// Pure — takes plain values, returns a plain description of what changed.
// abilityModifierAtLevel is a function(level) -> number, since an ASI along
// the way can change the caster's spellcasting-ability modifier mid-transition.
// otherClasses (optional): the character's OTHER classes at their current,
// unchanged levels — e.g. [{name:'Rogue', level:2}, {name:'Fighter', level:2}]
// for a Ranger who is leveling up. Needed to compute spell slots correctly
// when two or more classes actually combine for spellcasting (see
// multiclass.js) — omit entirely for a single-classed character.
// hpMethod/hpRolls (optional): 'roll' (default) or 'average' for the hit-die
// portion of HP gained at each level crossed. For 'roll', hpRolls[i] can
// supply an already-rolled value for the i-th level gained (e.g. from
// physical dice); any level without one gets a fresh random roll here.
// The returned hp figures are hit-die only — CON modifier per level is the
// caller's responsibility to add, since this function doesn't know a
// character's ability scores.
// isCharactersFirstLevelEver (default true, matching every existing
// caller's behavior): the "1st level HP is always max" RAW rule applies
// once, ever, per character — not once per class. Picking up a brand-new
// class via multiclassing is that class's own level 1, but NOT the
// character's first level ever, so it must roll/average like any other
// level. Pass false only from a genuine multiclass-pickup path.
function describeLevelUp({
  className,
  subclassName,
  fromLevel,
  toLevel,
  abilityModifierAtLevel,
  otherClasses = [],
  hpMethod = 'roll',
  hpRolls = [],
  isCharactersFirstLevelEver = true,
}) {
  const cls = loadClass(className)
  if (!cls) return { error: `No rules data for class "${className}"` }

  const result = {
    hitDie: hitDieForClass(className),
    levelsGained: toLevel - fromLevel,
    hp: [],
    totalHpGained: 0,
    asiOrFeatLevels: [],
    baseFeaturesGained: [],
    subclassFeaturesGained: [],
    subclassChoiceNeeded: false,
    spellcasting: null,
  }

  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    const forceMax = lvl === 1 && isCharactersFirstLevelEver
    const gained = hpGainForLevel(
      className,
      hpMethod,
      hpRolls[lvl - fromLevel - 1] ?? null,
      forceMax ? 1 : null
    )
    result.hp.push({ level: lvl, gained, method: forceMax ? 'max' : hpMethod })
    result.totalHpGained += gained

    if (isAsiLevel(className, lvl)) result.asiOrFeatLevels.push(lvl)

    const named = cls.features_by_level[String(lvl)] || []
    const ids = cls.features_by_level_ids[String(lvl)] || []
    if (named.length)
      result.baseFeaturesGained.push({ level: lvl, names: named, ids })

    if (lvl === cls.subclass_choice_level && !subclassName) {
      result.subclassChoiceNeeded = true
    } else if (subclassName) {
      // Deliberately NOT gated on cls.subclass_feature_levels — a homebrew
      // subclass can grant something at a level the base class doesn't
      // normally use for subclass features (e.g. Circle of the Moon's Wild
      // Symbiosis at 8th). subclassFeaturesGainedAtLevel already returns []
      // for any level the subclass file doesn't define, so this is purely
      // data-driven from the subclass file, not the class's own schedule.
      const subFeatures = subclassFeaturesGainedAtLevel(
        className,
        subclassName,
        lvl
      )
      if (subFeatures.length) {
        const subFeatureIds = subclassFeatureIdsGainedAtLevel(
          className,
          subclassName,
          lvl
        )
        result.subclassFeaturesGained.push({
          level: lvl,
          names: subFeatures,
          ids: subFeatureIds,
        })
      }
    }
  }

  // Resolves the class's own spellcasting UNLESS it's 'none'/missing and the
  // subclass grants it instead (Eldritch Knight, Arcane Trickster) — see
  // spellcasting.js's resolveSpellcasting for the shared logic every
  // lookup below goes through via subclassName.
  const effectiveSpellcasting = resolveSpellcasting(className, subclassName)
  if (effectiveSpellcasting) {
    const type = effectiveSpellcasting.type
    const modBefore = abilityModifierAtLevel
      ? abilityModifierAtLevel(fromLevel)
      : 0
    const modAfter = abilityModifierAtLevel
      ? abilityModifierAtLevel(toLevel)
      : 0
    const isMulticlassed = otherClasses.length > 0

    result.spellcasting = {
      type,
      slotsBefore:
        type === 'pact'
          ? null
          : isMulticlassed
          ? multiclassSpellSlots([
              ...otherClasses,
              { name: className, level: fromLevel, subclass: subclassName },
            ])
          : spellSlotsForClassAtLevel(className, fromLevel, subclassName),
      slotsAfter:
        type === 'pact'
          ? null
          : isMulticlassed
          ? multiclassSpellSlots([
              ...otherClasses,
              { name: className, level: toLevel, subclass: subclassName },
            ])
          : spellSlotsForClassAtLevel(className, toLevel, subclassName),
      // Pact Magic is Warlock's own separate resource — it never joins the
      // normal-slot multiclass pool, so this is always just the Warlock
      // level's own table regardless of what else is on the sheet.
      pactSlotsBefore: type === 'pact' ? pactMagicForLevel(fromLevel) : null,
      pactSlotsAfter: type === 'pact' ? pactMagicForLevel(toLevel) : null,
      cantripsBefore: cantripsKnownForClass(className, fromLevel, subclassName),
      cantripsAfter: cantripsKnownForClass(className, toLevel, subclassName),
    }

    const knownCapAfter = spellsKnownForClass(className, toLevel, subclassName)
    if (knownCapAfter !== null) {
      result.spellcasting.style = 'known'
      result.spellcasting.knownBefore = spellsKnownForClass(
        className,
        fromLevel,
        subclassName
      )
      result.spellcasting.knownAfter = knownCapAfter
    } else {
      result.spellcasting.style = 'prepared'
      result.spellcasting.preparedBefore = preparedSpellCount(
        className,
        fromLevel,
        modBefore,
        subclassName
      )
      result.spellcasting.preparedAfter = preparedSpellCount(
        className,
        toLevel,
        modAfter,
        subclassName
      )
    }
  }

  return result
}

module.exports = { describeLevelUp }
