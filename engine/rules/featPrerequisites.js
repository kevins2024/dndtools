const { loadFeat } = require('./grants')

// Adapter, like diffLevelUp.js and validateCharacter.js — the one other place
// besides those that knows the characters.json shape (race, stat_*,
// armor_proficiencies, weapon_proficiencies, spellcasting_ability,
// pact_magic). Everything else in engine/ stays shape-agnostic.
//
// Deliberately a SOFT-ish evaluator for proficiency-type prerequisites:
// almost no character in characters.json actually populates
// armor_proficiencies/weapon_proficiencies (see CHECKLIST.md's diffLevelUp
// multiclass note — "tool proficiencies aren't tracked on the character
// sheet yet" is the same gap one level up), so treating an ABSENT array as
// "prerequisite failed" would hide Heavy Armor Master from a Fighter in
// full plate simply because nobody ever back-filled that field. Untracked
// proficiency data is treated as "can't tell, don't block" — a populated
// array IS enforced normally. Ability-score and race prerequisites are
// always reliable (every character has stat_str..stat_cha and a race) and
// are hard-enforced.
function meetsAbility(scores, ability, min) {
  return (scores[ability] ?? 10) >= min
}

function matchesRace(character, races) {
  const own = [character.race, character.subrace]
    .filter(Boolean)
    .map((s) => s.toLowerCase())
  return races.some((r) => {
    const rl = r.toLowerCase()
    return own.some((o) => o === rl || o.includes(rl) || rl.includes(o))
  })
}

function hasSpellcasting(character) {
  return (
    Boolean(character.spellcasting_ability) || Boolean(character.pact_magic)
  )
}

// null = "no data either way, can't evaluate" (permissive) — only used for
// proficiency checks, per the file comment above.
function hasProficiency(character, proficiency) {
  const armor = character.armor_proficiencies
  const weapons = character.weapon_proficiencies
  if (proficiency === 'martial_weapon') {
    if (weapons == null) return null
    return weapons.includes('martial')
  }
  if (armor == null) return null
  if (proficiency === 'light_armor') return armor.includes('light')
  if (proficiency === 'medium_armor') return armor.includes('medium')
  if (proficiency === 'heavy_armor') return armor.includes('heavy')
  return null
}

// Returns { met: bool, reason: string|null, unknown: bool }. `unknown: true`
// means the prerequisite couldn't be reliably checked (untracked
// proficiency data) — callers should treat that as "don't hide it, but
// could surface a note."
function evaluatePrerequisite(character, prerequisite) {
  if (!prerequisite) return { met: true, reason: null, unknown: false }

  const scores = {
    str: character.stat_str,
    dex: character.stat_dex,
    con: character.stat_con,
    int: character.stat_int,
    wis: character.stat_wis,
    cha: character.stat_cha,
  }

  switch (prerequisite.type) {
    case 'ability_score': {
      const met = meetsAbility(scores, prerequisite.ability, prerequisite.min)
      return {
        met,
        reason: met
          ? null
          : `Requires ${prerequisite.ability.toUpperCase()} ${
              prerequisite.min
            }+.`,
        unknown: false,
      }
    }
    case 'any_of': {
      const met = prerequisite.options.some((o) =>
        meetsAbility(scores, o.ability, o.min)
      )
      const need = prerequisite.options
        .map((o) => `${o.ability.toUpperCase()} ${o.min}+`)
        .join(' or ')
      return { met, reason: met ? null : `Requires ${need}.`, unknown: false }
    }
    case 'race': {
      const met = matchesRace(character, prerequisite.races)
      return {
        met,
        reason: met
          ? null
          : `Requires race: ${prerequisite.races.join(' or ')}.`,
        unknown: false,
      }
    }
    case 'spellcasting': {
      const met = hasSpellcasting(character)
      return {
        met,
        reason: met ? null : 'Requires the ability to cast at least one spell.',
        unknown: false,
      }
    }
    case 'proficiency': {
      const result = hasProficiency(character, prerequisite.proficiency)
      if (result === null) {
        return {
          met: true,
          reason: `Requires proficiency with ${prerequisite.proficiency.replace(
            '_',
            ' '
          )} — not tracked on this character, not enforced.`,
          unknown: true,
        }
      }
      return {
        met: result,
        reason: result
          ? null
          : `Requires proficiency with ${prerequisite.proficiency.replace(
              '_',
              ' '
            )}.`,
        unknown: false,
      }
    }
    default:
      return { met: true, reason: null, unknown: true }
  }
}

function meetsFeatPrerequisites(character, featName) {
  const feat = loadFeat(featName)
  if (!feat) return { met: true, reason: null, unknown: true }
  return evaluatePrerequisite(character, feat.prerequisite)
}

module.exports = { meetsFeatPrerequisites, evaluatePrerequisite }
