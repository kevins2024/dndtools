const fs = require('fs')
const path = require('path')
const {
  resolveSpellcasting,
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
} = require('./spellcasting')
const { multiclassSpellSlots } = require('./multiclass')

// This is the one place in engine/ that reaches OUTSIDE engine/data — spell
// TEXT (as opposed to class progression rules) already lives in src/data and
// copying it here would just be a second copy to drift out of sync. See the
// note at the top of engine/CHECKLIST.md.
const SRC_DATA = path.join(__dirname, '..', '..', '..', 'src', 'data')

let cache = null

function normalize(name) {
  return name.toLowerCase().trim()
}

function buildIndex() {
  if (cache) return cache
  const index = new Map()

  const srd = JSON.parse(
    fs.readFileSync(
      path.join(SRC_DATA, 'api_data_cache', 'srd_spells_full.json'),
      'utf8'
    )
  )
  const published = JSON.parse(
    fs.readFileSync(path.join(SRC_DATA, 'published_spells.json'), 'utf8')
  )

  // published_spells.json now holds real non-SRD content and homebrew spells
  // side by side (each entry's own `homebrew` flag tells them apart) — so
  // this is the only override tier needed on top of the SRD cache.
  for (const s of srd) index.set(normalize(s.name), s)
  for (const s of published) index.set(normalize(s.name), s)

  cache = index
  return index
}

function findSpellRecord(spellName) {
  return buildIndex().get(normalize(spellName)) || null
}

// Returns true/false if we know, or null if the spell isn't found at all or
// has no `classes` data yet (an "I don't know" that callers should treat as
// non-blocking, not as a silent false).
function isSpellOnClassList(className, spellName) {
  const record = findSpellRecord(spellName)
  if (!record || !Array.isArray(record.classes)) return null
  return record.classes.includes(className)
}

// Powers the generic known-spell/cantrip picker (any "known"-style caster
// hitting a newKnownSpells/newCantrips pendingChoice from diffLevelUp.js,
// plus Pact of the Tome's wider "any class list" cantrip grant).
//
// className: the spell list to filter by. Callers resolve third-caster
// subclasses (Eldritch Knight/Arcane Trickster both draw from WIZARD's
// list, not a list of their own) to "Wizard" before calling this — this
// function doesn't know about that mapping, it just filters by whatever
// class name it's given.
//
// options:
//   maxLevel (default 9) — the highest spell level currently selectable
//     (the caller derives this from the character's current slot/pact
//     progression; a known-caster can't pick a spell above what they can
//     currently cast).
//   cantripsOnly (default false) — true for a cantrip pick (level === 0
//     exactly), false for a leveled-spell pick (1..maxLevel, cantrips
//     excluded — they're a separate pool with a separate count, never
//     conflated per the project owner's explicit instruction).
//   pool (default 'class') — 'class' filters to spells whose `classes`
//     array includes `className`; 'any' returns every spell matching the
//     level filter regardless of class list (Pact of the Tome: "three
//     cantrips from any class's spell list").
//   excludeNames (default []) — spells to leave out (the character's
//     already-known spells, so the picker doesn't offer a duplicate).
//
// Returns [{name, level, school}], sorted by level then name. Doesn't know
// or care about the character's CURRENT known-spell count — that's the
// caller's job (diffLevelUp already computes how many picks are owed).
function listSpellsForClass(className, options = {}) {
  const {
    maxLevel = 9,
    cantripsOnly = false,
    pool = 'class',
    excludeNames = [],
    // Escape hatch for criteria beyond level/class/pool that the returned
    // {name, level, school} shape can't express on its own (e.g. a feat's
    // "must have the ritual tag" or "must require an attack roll" — see
    // listFeatSpellChoices below). Receives the RAW record (every field the
    // source JSON has, not just the 3 this function normally returns).
    extraFilter = null,
  } = options
  const exclude = new Set([...excludeNames].map(normalize))
  const results = []
  const seen = new Set()
  for (const record of buildIndex().values()) {
    if (typeof record.level !== 'number') continue
    if (cantripsOnly) {
      if (record.level !== 0) continue
    } else if (record.level === 0 || record.level > maxLevel) {
      continue
    }
    if (pool === 'class') {
      if (
        !Array.isArray(record.classes) ||
        !record.classes.some((c) => normalize(c) === normalize(className))
      ) {
        continue
      }
    }
    if (extraFilter && !extraFilter(record)) continue
    const key = normalize(record.name)
    if (exclude.has(key) || seen.has(key)) continue
    seen.add(key)
    results.push({
      name: record.name,
      level: record.level,
      school: record.school ?? null,
    })
  }
  results.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  return results
}

// Feat-granted spell choices (Magic Initiate, Ritual Caster, Spell Sniper,
// Artificer Initiate, Wood Elf Magic, Fey Touched, Shadow Touched, etc. —
// see feats.json's own _schema.choices doc for the full spell_filter shape).
// Each feat fixes its own combination of class list (or no class at all —
// Fey Touched/Shadow Touched's "any spellbook" grants), spell level, and
// extra criteria (school, ritual tag, attack-roll requirement) that plain
// listSpellsForClass alone can't express — this is the one place all of
// those combinations funnel through, so a future feat with the same shape
// needs a data entry, not new code. Replaces the old free-text "type your
// spell's name" fields those feats used to render — a free-text field can
// never guarantee what gets typed is a real, eligible spell.
function listFeatSpellChoices({
  className = null,
  level = null,
  cantripsOnly = false,
  schools = null,
  ritualOnly = false,
  attackRollOnly = false,
  excludeNames = [],
}) {
  return listSpellsForClass(className ?? '', {
    maxLevel: cantripsOnly ? 0 : level ?? 9,
    cantripsOnly,
    pool: className ? 'class' : 'any',
    excludeNames,
    extraFilter: (record) => {
      if (!cantripsOnly && level != null && record.level !== level) return false
      if (schools && schools.length && !schools.includes(record.school))
        return false
      if (ritualOnly && !record.ritual) return false
      if (attackRollOnly && !record.attack_type) return false
      return true
    },
  })
}

// The highest spell level a known-caster can currently select FROM when
// picking a new known spell (a level-5 Warlock with only 3rd-level pact
// slots can't pick a 4th-level spell just because their known-count went
// up). Lives here (not diffLevelUp.js) so it's independently callable by
// the spell-choices API route without re-running a whole level-up preview
// just to get one number — same portability reasoning as everything else
// in engine/ (see this project's README/CLAUDE.md: the engine should stay
// the one source of truth a future non-Vue frontend could also call).
// otherClasses: same shape diffLevelUp/describeLevelUp already use
// ([{name, level, subclass}, ...], the character's OTHER classes at their
// current levels) — omit for a single-classed character.
function effectiveMaxSpellLevel({
  className,
  subclassName,
  level,
  otherClasses = [],
}) {
  const spellcasting = resolveSpellcasting(className, subclassName)
  if (!spellcasting) return 0
  if (spellcasting.type === 'pact') return pactMagicForLevel(level).slot_level
  const combined = [
    ...otherClasses,
    { name: className, level, subclass: subclassName },
  ]
  const slots = otherClasses.length
    ? multiclassSpellSlots(combined)
    : spellSlotsForClassAtLevel(className, level, subclassName)
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] > 0) return i + 1
  }
  return 0
}

module.exports = {
  findSpellRecord,
  isSpellOnClassList,
  listSpellsForClass,
  listFeatSpellChoices,
  effectiveMaxSpellLevel,
}
