// Where does each spell on a sheet come from? One rule, used by the audit, the comparison and the
// level-up's swap list, so none of them counts a granted spell against the class.
//
// A spell is GRANTED (never one of the class's cantrips known or spells prepared) when any of these hold:
//   - the sheet's own entry says so (`featureGranted`, `domain`, `oath`, `racial`, or a type of
//     oath / domain / racial / patron) — written by the level-up and by hand
//   - a feature or feat on the sheet names it in `spells_granted` (Fey Touched, Magic Initiate,
//     a species lineage)
//   - the class always prepares it (`always_prepared_spells`: Divine Smite, Hunter's Mark)
//   - the character's subclass lists it as an always-prepared spell at a level the class has reached
// Anything else is a class pick. Items a character carries grant spells too, but those never live on
// the sheet's own list, so they are not in play here.
//
// The point of deriving the grants from the features and the class data, and not only trusting a flag
// on each stored spell, is that a sheet whose flag is missing (a hand-entered spell, a spellbook that
// cannot carry flags, a copy made before the feature was added) still counts correctly.
//
// Server and scripts only (it reads the class and subclass data).

const { loadClass } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')
const { rulesetOf } = require('./rulesetId')
const { resolveSpellcasting } = require('./spellcasting')

const key = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const SUBCLASS_SPELL_FIELDS = [
  'domain_spells_by_level',
  'oath_spells_by_level',
  'circle_spells_by_level',
  'bonus_spells_by_level',
  'patron_spells_by_level',
  'subclass_spells_by_level',
]
const GRANTED_TYPES = ['oath', 'domain', 'racial', 'patron']

// Spells a subclass always prepares, at the levels the class has reached:
// normalised name -> a label such as "Oath of the Crown (L3)".
function subclassSpells(character, ruleset = rulesetOf(character)) {
  const granted = new Map()
  for (const c of character.classes || []) {
    const sub = c.subclass ? loadSubclass(c.name, c.subclass, ruleset) : null
    if (!sub) continue
    const tables = SUBCLASS_SPELL_FIELDS.map((f) => sub[f])
    if (c.name === 'Artificer') tables.push(sub.expanded_spell_list)
    for (const table of tables)
      for (const [lvl, names] of Object.entries(table || {}))
        if (Array.isArray(names) && Number(lvl) <= c.level)
          for (const n of names) granted.set(key(n), `${c.subclass} (L${lvl})`)
  }
  return granted
}

// Spells a class always prepares: Divine Smite, Hunter's Mark.
function classAlwaysPrepared(character, ruleset = rulesetOf(character)) {
  const out = new Set()
  for (const c of character.classes || []) {
    const table = loadClass(c.name, ruleset)?.always_prepared_spells || {}
    for (const [lvl, names] of Object.entries(table))
      if (Number(lvl) <= c.level) for (const n of names) out.add(key(n))
  }
  return out
}

// Every spell the sheet's features name in `spells_granted`.
function featureGranted(character) {
  const out = new Set()
  for (const f of character.features || [])
    for (const s of f.spells_granted || [])
      out.add(key(typeof s === 'string' ? s : s?.name))
  return out
}

// The keys of every spell that is granted rather than picked, by any of the rules above.
function grantedSpellKeys(character, ruleset = rulesetOf(character)) {
  return new Set([
    ...subclassSpells(character, ruleset).keys(),
    ...classAlwaysPrepared(character, ruleset),
    ...featureGranted(character),
  ])
}

const flaggedGranted = (s) =>
  Boolean(
    s.featureGranted ||
      s.domain ||
      s.oath ||
      s.racial ||
      GRANTED_TYPES.includes(s.type)
  )

// True when this spell is granted, not a class pick. `granted` is grantedSpellKeys(character).
const isGrantedSpell = (s, granted) =>
  flaggedGranted(s) || granted.has(key(s.name))

// Classes that choose which leveled spells to prepare again after a Long Rest. What a character has
// prepared today is play, not build, so nothing audits or compares it. (A Wizard's spellbook is not
// in this set: what is in the book is a build choice.)
const DAILY_PREPARERS = new Set([
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Artificer',
])

// True when every spellcasting class the character has prepares its leveled spells daily, so the
// leveled spells on the sheet are a day's preparation and not part of the build.
function leveledSpellsArePlay(character, ruleset = rulesetOf(character)) {
  const casters = (character.classes || []).filter((c) =>
    resolveSpellcasting(c.name, c.subclass, ruleset)
  )
  return casters.length > 0 && casters.every((c) => DAILY_PREPARERS.has(c.name))
}

module.exports = {
  DAILY_PREPARERS,
  leveledSpellsArePlay,
  grantedSpellKeys,
  isGrantedSpell,
  subclassSpells,
  classAlwaysPrepared,
  featureGranted,
}
