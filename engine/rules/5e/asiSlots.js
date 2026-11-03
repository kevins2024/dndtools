// Which Ability Score Improvement slots a character has, and what each one went into.
//
//   asiSlotStatus(character) -> [{ class, level, state, detail }]
//     state 'ability' — a recorded improvement (ability_score_history), detail '+2 STR'
//     state 'feat'    — a feat taken in the slot, detail = the feat's name
//     state 'open'    — nothing on the sheet says what the slot went into
//
// A feat counts as taking a slot when it is on the sheet with no class, species or origin source
// (those are granted, not chosen). One with a level_gained takes that slot; the rest take the open
// slots in order. A slot is never both a feat and an
// improvement: a recorded improvement wins, and a feat only fills what is still open.
//
// Used by the level history and the ability-score tooltip so they cannot disagree about what is
// still undecided. Zero fs/path dependencies — browser code require()s this directly.

const { asiLevelsForClass } = require('./progression')

function asiSlotStatus(character, levelsFor = asiLevelsForClass) {
  const classes = character.classes || []
  const started = classes.find((c) => c.started) || classes[0]
  const ordered = started
    ? [started, ...classes.filter((c) => c !== started)]
    : []
  const improvements = (character.ability_score_history || []).filter((h) =>
    /Ability Score Improvement/i.test(h.source || '')
  )
  // Granted feats (species, origin, fighting style) never take a slot. A feat that names its level
  // takes that slot whatever its source; one with no source and no level takes the next open one.
  const feats = (character.features || []).filter(
    (f) => f.type === 'feat' && !f._grant
  )

  const slots = []
  for (const c of ordered)
    for (const level of levelsFor(c.name))
      if (level <= c.level) slots.push({ class: c.name, level, state: 'open' })

  for (const s of slots) {
    // An entry with no class (older sheets) is matched by class level, in every class that has a
    // slot at that level.
    const inc = improvements.filter(
      (h) =>
        Number(h.level_gained) === s.level && (!h.class || h.class === s.class)
    )
    if (inc.length) {
      s.state = 'ability'
      s.detail = inc
        .map((h) => `+${h.amount} ${String(h.ability).toUpperCase()}`)
        .join(', ')
    }
  }
  const unplaced = []
  for (const f of feats) {
    const slot = slots.find(
      (s) =>
        s.state === 'open' &&
        f.level_gained != null &&
        (!f._source || f._source === s.class) &&
        Number(f.level_gained) === s.level
    )
    if (slot) {
      slot.state = 'feat'
      slot.detail = f.name
    } else if (!f._source) unplaced.push(f)
  }
  for (const f of unplaced) {
    const slot = slots.find((s) => s.state === 'open')
    if (!slot) break
    slot.state = 'feat'
    slot.detail = f.name
  }
  return slots
}

module.exports = { asiSlotStatus }
