const { loadClass } = require('./classFeatures')
const { proficiencyBonus } = require('./progression')
const { spellsKnownForClass } = require('./spellcasting')

// characters.json has grown a few different conventions for "this is a free
// bonus spell that doesn't count against the normal known-spell cap":
//   - Enauweyn (Paladin oath spells): type: "oath"
//   - Petra (Cleric domain spells): domain: true
//   - Rith (Fey Touched feat, Divine Magic bonus spell): featureGranted: true, _source: "..."
// Recognize all of them rather than assuming one is the One True Schema —
// `featureGranted` is the general-purpose one going forward (works for any
// feat/feature/item grant, not just subclass bonus-spell mechanics).
//
// `type: "patron"` (Warlock Otherworldly Patron expanded spell list) is
// deliberately NOT in this set, even though it looks the same shape as
// oath/domain at a glance. RAW draws a real distinction here: Paladin oath
// spells and Cleric domain spells are explicitly "always prepared... don't
// count against the number of spells you can prepare" — genuinely free.
// A Warlock's expanded list just adds spells to the pool you can CHOOSE a
// known spell from; picking one still spends one of your limited known-spell
// slots like any other pick. Tagging a spell "patron" is useful provenance
// info (which list it came from) but must NOT exempt it from the cap.
const BONUS_SPELL_TYPES = new Set(['oath', 'domain', 'racial'])
function isBonusSpell(s) {
  if (BONUS_SPELL_TYPES.has(s.type)) return true
  if (s.domain || s.oath || s.racial) return true
  return Boolean(s.featureGranted)
}
function isCantrip(s) {
  return s.level === 0 || s.type === 'cantrip'
}

// Adapter: this is the one place that knows the characters.json shape.
// Everything else in engine/ only knows plain (class, level, ability score) inputs.
//
// Deliberately NOT checked yet: prepared-spell-cap and cantrip-cap overages
// (deprioritized per project owner — too much of the roster predates clean
// source-tagging for these to be trustworthy signal right now).
function validateCharacter(character) {
  const issues = []

  if (!character.classes || character.classes.length === 0) {
    issues.push({
      severity: 'error',
      message: 'Character has no classes listed.',
    })
    return issues
  }

  const isMulticlass = character.classes.length > 1

  const primary = character.classes[0]
  const className = primary.name
  const level = primary.level
  const cls = loadClass(className)

  if (!cls) {
    issues.push({
      severity: 'info',
      message: `No rules data yet for class "${className}" — skipping automated checks for this character.`,
    })
    return issues
  }

  const expectedPB = proficiencyBonus(character.level)
  if (character.proficiency_bonus !== expectedPB) {
    issues.push({
      severity: 'warning',
      message: `Proficiency bonus is +${character.proficiency_bonus}, expected +${expectedPB} for level ${character.level}.`,
    })
  }

  // Saving throw proficiencies only ever come from whichever class was taken
  // FIRST (RAW) — never every class you have levels in. For multiclass
  // characters this needs an explicit `started: true` marker on the right
  // entry in `classes[]`, since array order isn't reliable (confirmed against
  // real roster data: Kerra lists Fighter first but her saves are Warlock's).
  // Feats/racial traits can only ADD proficiencies (e.g. Resilient), never
  // remove the class's own — so only flag a MISSING expected save.
  if (isMulticlass) {
    const startedEntry = character.classes.find((c) => c.started)
    if (!startedEntry) {
      issues.push({
        severity: 'info',
        message:
          'Multiclass character with no class marked `started: true` — saving-throw ' +
          "check skipped (can't determine which class's saves should be present).",
      })
    } else {
      const startedCls = loadClass(startedEntry.name)
      if (startedCls) {
        const actualSaves = new Set(character.saving_throws || [])
        for (const save of startedCls.saving_throw_proficiencies) {
          if (!actualSaves.has(save)) {
            issues.push({
              severity: 'warning',
              message: `Missing expected ${startedEntry.name} (starting class) saving throw proficiency: ${save}.`,
            })
          }
        }
      }
    }
  } else {
    const actualSaves = new Set(character.saving_throws || [])
    for (const save of cls.saving_throw_proficiencies) {
      if (!actualSaves.has(save)) {
        issues.push({
          severity: 'warning',
          message: `Missing expected ${className} saving throw proficiency: ${save}.`,
        })
      }
    }
  }

  // Known-spell cap (Bard/Sorcerer/Warlock/Ranger). Checked per class, not
  // just the primary one, so it works for e.g. a Ranger with non-caster
  // multiclass levels (Rogue/Fighter) — those don't add a second known-spell
  // pool, so the check still applies cleanly. Prepared-cap and cantrip-cap
  // checks intentionally omitted for now — see note above.
  //
  // A character with TWO OR MORE known-spell-cap classes at once (e.g. a
  // real Bard/Sorcerer multiclass) genuinely has two separate pools under
  // RAW, but character.spells entries aren't tagged with which class granted
  // them, so there's no way to split the list and check each pool — flagged
  // as info instead of guessed at.
  const knownCasterClasses = character.classes.filter((c) => {
    const classData = loadClass(c.name)
    return (
      classData &&
      classData.spellcasting &&
      classData.spellcasting.type !== 'none' &&
      spellsKnownForClass(c.name, c.level) !== null
    )
  })

  if (knownCasterClasses.length === 1) {
    const c = knownCasterClasses[0]
    const knownCap = spellsKnownForClass(c.name, c.level)
    const spells = character.spells || []
    const countableSpells = spells.filter(
      (s) => !isCantrip(s) && !isBonusSpell(s)
    )
    if (countableSpells.length > knownCap) {
      issues.push({
        severity: 'warning',
        message: `${countableSpells.length} spells known, but a level ${c.level} ${c.name} caps at ${knownCap} (fixed-known caster). Check whether every entry is either a normal known pick or genuinely free (tagged featureGranted/oath/domain/racial) — a Warlock's patron-list spells are NOT free, they just expand what you can pick from.`,
      })
    }
  } else if (knownCasterClasses.length > 1) {
    issues.push({
      severity: 'info',
      message:
        `Multiple known-spell-cap classes on this character (${knownCasterClasses
          .map((c) => `${c.name} ${c.level}`)
          .join(
            ', '
          )}) — each has its own separate known-spell pool under real multiclassing ` +
        "rules, but spells aren't tagged with which class grants them, so the pools " +
        "can't be split automatically. Known-spell-cap check skipped for this character.",
    })
  }

  return issues
}

module.exports = { validateCharacter }
