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
const multiclassProficiencies = require('../data/multiclass-proficiencies.json')

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

  // A class gained by MULTICLASSING grants only the PHB's reduced
  // proficiency list (data/multiclass-proficiencies.json) — never the full
  // starting-class list, and NEVER a new saving throw proficiency (that's
  // explicitly starting-class-only, RAW). Skill/tool choices this class
  // would also grant (Bard/Ranger/Rogue skills; Bard/Rogue/Artificer tools)
  // aren't structurally modeled yet — no class has a real skill/tool LIST
  // anywhere in engine/data (same gap as the New Character tool's missing
  // class-skill picker) — surfaced as a warning instead of guessed at.
  if (isMulticlassPickup) {
    const grant = multiclassProficiencies[className]
    if (grant) {
      const armor = new Set(character.armor_proficiencies || [])
      for (const a of grant.armor || []) armor.add(a)
      const weapons = new Set(character.weapon_proficiencies || [])
      for (const w of grant.weapons || []) weapons.add(w)
      patch.armor_proficiencies = [...armor]
      patch.weapon_proficiencies = [...weapons]

      if (grant.skills) {
        notes.push(
          `Multiclassing into ${className} also grants proficiency in ${grant.skills.choose} skill of your choice from its class list — not automatically added, pick one by hand.`
        )
      }
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
