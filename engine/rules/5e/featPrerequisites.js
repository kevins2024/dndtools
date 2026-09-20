const { loadFeat } = require('./grants')

// Adapter, like diffLevelUp.js and validateCharacter.js — the one other place
// besides those that knows the characters.json shape (genus, stat_*,
// armor_proficiencies, weapon_proficiencies, spellcasting_ability,
// pact_magic, classes[], features[], spells[]). Everything else in engine/
// stays shape-agnostic.
//
// Originally feat-only (hence the filename); extended 2026-09-02 to also
// evaluate Eldritch Invocation / Pact Boon prerequisites (engine/rules/
// invocations.js calls straight into evaluatePrerequisite below) rather than
// writing a second parallel checker — invocations need 3 condition types
// feats never used (level, feature, cantrip) plus an `all_of` combinator for
// the few invocations gated on two conditions at once (Thirsting Blade:
// level 5 AND Pact of the Blade); feats only ever needed `any_of`.
//
// Deliberately a SOFT-ish evaluator for proficiency-type prerequisites:
// almost no character in characters.json actually populates
// armor_proficiencies/weapon_proficiencies (see CHECKLIST.md's diffLevelUp
// multiclass note — "tool proficiencies aren't tracked on the character
// sheet yet" is the same gap one level up), so treating an ABSENT array as
// "prerequisite failed" would hide Heavy Armor Master from a Fighter in
// full plate simply because nobody ever back-filled that field. Untracked
// proficiency data is treated as "can't tell, don't block" — a populated
// array IS enforced normally. Ability-score and genus prerequisites are
// always reliable (every character has stat_str..stat_cha and a genus) and
// are hard-enforced.
function meetsAbility(scores, ability, min) {
  return (scores[ability] ?? 10) >= min
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

function matchesGenus(character, genera) {
  const own = [character.genus, character.subgenus]
    .filter(Boolean)
    .map((s) => s.toLowerCase())
  return genera.some((r) => {
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
    case 'genus': {
      const met = matchesGenus(character, prerequisite.genera)
      return {
        met,
        reason: met
          ? null
          : `Requires genus: ${prerequisite.genera.join(' or ')}.`,
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
    // Below: added for Eldritch Invocations / Pact Boon, not used by any
    // cataloged feat — see the file header comment.
    case 'level': {
      const cls = (character.classes || []).find(
        (c) => normalizeName(c.name) === normalizeName(prerequisite.className)
      )
      const level = cls?.level ?? 0
      const met = level >= prerequisite.level
      return {
        met,
        reason: met
          ? null
          : `Requires ${prerequisite.className} level ${prerequisite.level}+.`,
        unknown: false,
      }
    }
    case 'feature': {
      const met = (character.features || []).some(
        (f) => normalizeName(f.name) === normalizeName(prerequisite.feature)
      )
      return {
        met,
        reason: met ? null : `Requires the "${prerequisite.feature}" feature.`,
        unknown: false,
      }
    }
    case 'cantrip': {
      const met = (character.spells || []).some(
        (s) =>
          s.level === 0 &&
          normalizeName(s.name) === normalizeName(prerequisite.spell)
      )
      return {
        met,
        reason: met
          ? null
          : `Requires knowing the ${prerequisite.spell} cantrip.`,
        unknown: false,
      }
    }
    case 'all_of': {
      const results = prerequisite.all.map((p) =>
        evaluatePrerequisite(character, p)
      )
      const met = results.every((r) => r.met)
      return {
        met,
        reason: met
          ? null
          : results
              .filter((r) => !r.met)
              .map((r) => r.reason)
              .join(' '),
        unknown: results.some((r) => r.unknown),
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
