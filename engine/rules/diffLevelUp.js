const { loadClass } = require('./classFeatures')
const { describeLevelUp } = require('./levelUp')
const { proficiencyBonus } = require('./progression')
const { abilityModifier } = require('./abilities')
const { resolveAsiOrFeat } = require('./asiFeat')
const { multiclassSpellSlots, multiclassPactSlots } = require('./multiclass')
const { spellSlotsForClassAtLevel } = require('./spellcasting')

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
// Only levels up a class the character ALREADY has. Picking up a brand-new
// class via multiclassing (an empty `classes` slot that doesn't exist yet)
// is a different, not-yet-built feature — this returns a warning instead of
// guessing what such a patch should look like.
function diffLevelUp(
  character,
  {
    className,
    toLevel,
    hpMethod = 'roll',
    hpRolls = [],
    asiOrFeatResolutions = {},
  } = {}
) {
  const classIndex = (character.classes || []).findIndex(
    (c) => normalizeName(c.name) === normalizeName(className)
  )
  if (classIndex === -1) {
    return {
      patch: null,
      pendingChoices: [],
      warnings: [
        `"${character.name}" has no "${className}" class to level up — picking up a brand-new class via multiclassing isn't supported by this function yet.`,
      ],
      description: null,
    }
  }

  const classEntry = character.classes[classIndex]
  const fromLevel = classEntry.level
  const finalToLevel = toLevel ?? fromLevel + 1
  const otherClasses = character.classes
    .filter((_, i) => i !== classIndex)
    .map((c) => ({ name: c.name, level: c.level, subclass: c.subclass }))
  const spellcastingAbility = character.spellcasting_ability

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

  const description = describeLevelUp({
    className: classEntry.name,
    subclassName: classEntry.subclass,
    fromLevel,
    toLevel: finalToLevel,
    otherClasses,
    hpMethod,
    hpRolls,
    abilityModifierAtLevel: (lvl) =>
      spellcastingAbility
        ? abilityModifier(scoresResolvedThrough(lvl)[spellcastingAbility])
        : 0,
  })

  const pendingChoices = []
  const notes = []

  // Apply every SUPPLIED resolution in level order; anything crossed without
  // one is a pending choice, not a guess.
  let scores = extractScores(character)
  for (const lvl of description.asiOrFeatLevels) {
    const resolution = asiOrFeatResolutions[lvl]
    if (!resolution) {
      pendingChoices.push({ type: 'asiOrFeat', level: lvl })
      continue
    }
    const result = resolveAsiOrFeat(scores, resolution)
    scores = result.scores
    notes.push(...result.notes.map((n) => `Level ${lvl}: ${n}`))
  }

  // Only add features the character doesn't already have (name match,
  // case/whitespace-insensitive) — avoids duplicating something already
  // entered by hand.
  const existingNames = new Set(
    (character.features || []).map((f) => normalizeName(f.name))
  )
  const newFeatures = []
  for (const group of [
    ...description.baseFeaturesGained,
    ...description.subclassFeaturesGained,
  ]) {
    for (const name of group.names) {
      if (existingNames.has(normalizeName(name))) continue
      newFeatures.push({
        name,
        type: 'feature',
        level_gained: group.level,
        _source: classEntry.name,
      })
      existingNames.add(normalizeName(name))
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
  const hpGained = description.totalHpGained + conMod * levelsGained

  const patch = {
    level: (character.level || 0) + levelsGained,
    proficiency_bonus: proficiencyBonus((character.level || 0) + levelsGained),
    hp_max: (character.hp_max || 0) + hpGained,
    hp_current: (character.hp_current || 0) + hpGained,
    hit_dice_current: (character.hit_dice_current ?? fromLevel) + levelsGained,
    classes: character.classes.map((c, i) =>
      i === classIndex ? { ...c, level: finalToLevel } : c
    ),
    ...scoresToPatchFields(scores),
  }

  if (newFeatures.length) {
    patch.features = [...(character.features || []), ...newFeatures]
  }

  if (description.spellcasting) {
    const combinedClasses = [
      ...otherClasses,
      { name: classEntry.name, level: finalToLevel },
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
        : spellSlotsForClassAtLevel(classEntry.name, finalToLevel)
      const spellSlots = {}
      slots.forEach((max, i) => {
        spellSlots[`level_${i + 1}`] = { max, current: max }
      })
      patch.spell_slots = spellSlots
    }

    if (description.spellcasting.style === 'known') {
      const gained =
        description.spellcasting.knownAfter -
        description.spellcasting.knownBefore
      if (gained > 0) {
        pendingChoices.push({
          type: 'newKnownSpells',
          count: gained,
          level: finalToLevel,
        })
      }
    }
  }

  // newFeatures is the same array merged into patch.features, exposed on its
  // own so a caller (a UI) can display "here's what's new" without having to
  // diff patch.features against the character's original list itself.
  return { patch, newFeatures, pendingChoices, warnings: notes, description }
}

module.exports = { diffLevelUp }
