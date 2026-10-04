// Limited-use tracking (features, spell free-casts, weapon effects, item
// spell grants) and item charge pools: spend one, restore one, never leave
// [0, max]. Extracted 2026-10-01 from src/store/index.js, where the same
// "uses_current falls back to uses_max, clamp to [0, max]" rule was
// copy-pasted into eight separate mutations.
//
// Every function is pure and returns a NEW entry. An entry with no
// `uses_max` is not limited-use and comes back untouched. `uses_current`
// absent means "never spent" — treated as full, so a first spend works.
//
// Zero dependencies — browser code require()s this directly; see
// src/utils/limitedUse.js.

// Remaining uses of a { uses_max, uses_current } entry; null if the entry
// isn't limited-use.
function usesRemaining(entry) {
  if (entry?.uses_max == null) return null
  return entry.uses_current ?? entry.uses_max
}

function canSpendUse(entry, amount = 1) {
  const left = usesRemaining(entry)
  return left != null && left >= amount
}

function spendUse(entry, amount = 1) {
  const left = usesRemaining(entry)
  if (left == null) return entry
  return { ...entry, uses_current: Math.max(0, left - amount) }
}

function restoreUse(entry, amount = 1) {
  const left = usesRemaining(entry)
  if (left == null) return entry
  return { ...entry, uses_current: Math.min(entry.uses_max, left + amount) }
}

// An item's shared charge pool (wands, staves). `amount` is the cost of a
// specific action, e.g. an upcast spell costing more than one charge.
function spendCharge(item, amount = 1) {
  return {
    ...item,
    charges_current: Math.max(0, item.charges_current - amount),
  }
}

function restoreCharge(item, amount = 1) {
  return {
    ...item,
    charges_current: Math.min(item.charges_max, item.charges_current + amount),
  }
}

// An item's spells_granted entries that carry their own use counter. When
// `choiceGroup` is set, every entry sharing that choice_group moves
// together, since they're alternative effects of the SAME single use (a
// Necklace of Prayer Beads' Curing bead: Cure Wounds OR Lesser Restoration).
// Otherwise the entry is matched by spell name. Bare-string grants and
// entries without a counter are left alone.
function adjustGrantUse(spellsGranted, { spellName, choiceGroup }, step) {
  return spellsGranted.map((g) => {
    if (typeof g === 'string' || g.uses_current == null) return g
    const matches = choiceGroup
      ? g.choice_group === choiceGroup
      : g.name === spellName
    if (!matches) return g
    if (step < 0 && g.uses_current <= 0) return g
    if (step > 0 && g.uses_current >= g.uses_max) return g
    return { ...g, uses_current: g.uses_current + step }
  })
}

function spendGrantUse(spellsGranted, match) {
  return adjustGrantUse(spellsGranted, match, -1)
}

function restoreGrantUse(spellsGranted, match) {
  return adjustGrantUse(spellsGranted, match, 1)
}

module.exports = {
  usesRemaining,
  canSpendUse,
  spendUse,
  restoreUse,
  spendCharge,
  restoreCharge,
  spendGrantUse,
  restoreGrantUse,
}
