// Hit point rules: damage (temp HP absorbs first), healing (capped at max),
// temp HP (doesn't stack — take the higher), and the concentration save DC.
// Extracted 2026-10-01 from src/components/HpTracker.vue and Battle.vue —
// real PHB rules that were written inline in Vue methods, twice (once for a
// character record, once for an enemy in the combat tracker).
//
// Character functions take the character and return a PATCH (only the
// fields that changed) rather than mutating, matching diffLevelUp's `patch`
// shape — the caller merges it however its own state layer does.
//
// hp_max_modifier is a signed adjustment to max HP (Aid's +5 for 8 hours, or
// a max-HP-draining effect) kept separate from hp_max itself, so
// effectiveMaxHp is hp_max + that.
//
// Zero dependencies (no fs/path, no other rule file) — browser code
// require()s this directly; see src/utils/hitPoints.js.

function effectiveMaxHp(character) {
  return (character.hp_max ?? 0) + (character.hp_max_modifier ?? 0)
}

// PHB p. 198: temp HP is lost first, any remainder carries to real HP. The
// one place that rule lives — a character's hp_current and an enemy's
// damage-taken tracker both route through it.
function absorbTempHp(temp, amount) {
  const absorbed = Math.min(temp ?? 0, amount)
  return {
    absorbed,
    remaining: amount - absorbed,
    tempLeft: (temp ?? 0) - absorbed,
  }
}

// Returns { patch, absorbed, dealt }: `absorbed` is what temp HP soaked up,
// `dealt` is what actually reduced hp_current (less than the remainder if
// hp_current bottoms out at 0 — overkill isn't tracked; death saves and
// instant death are a separate rule).
function applyDamage(character, amount) {
  if (!(amount > 0)) return { patch: {}, absorbed: 0, dealt: 0 }
  const { absorbed, remaining, tempLeft } = absorbTempHp(
    character.hp_temp,
    amount
  )
  const hpBefore = character.hp_current ?? 0
  const hpAfter = Math.max(0, hpBefore - remaining)
  return {
    patch: { hp_temp: tempLeft, hp_current: hpAfter },
    absorbed,
    dealt: hpBefore - hpAfter,
  }
}

// Healing never exceeds the effective max (hp_max + hp_max_modifier).
function applyHealing(character, amount) {
  if (!(amount > 0)) return { patch: {}, healed: 0 }
  const hpBefore = character.hp_current ?? 0
  const hpAfter = Math.min(effectiveMaxHp(character), hpBefore + amount)
  return { patch: { hp_current: hpAfter }, healed: hpAfter - hpBefore }
}

// PHB p. 198: temp HP don't stack — a new source replaces the current pool
// only if it's higher (otherwise you keep the old one).
function applyTempHp(character, amount) {
  if (!(amount > 0)) return { patch: {} }
  return { patch: { hp_temp: Math.max(character.hp_temp ?? 0, amount) } }
}

// Enemies in the combat tracker are tracked as damage TAKEN against an
// optional max ({ damage, maxHp, tempHp }), not as a current-HP number —
// the DM often doesn't know a monster's exact max. Same rules, same
// primitives, different shape. Each returns { hp: <new tracker>, ... }.
function applyTrackedDamage(hp, amount) {
  if (!(amount > 0)) return { hp, absorbed: 0 }
  const { absorbed, remaining, tempLeft } = absorbTempHp(hp.tempHp, amount)
  return {
    hp: { ...hp, damage: (hp.damage ?? 0) + remaining, tempHp: tempLeft },
    absorbed,
  }
}

function applyTrackedHealing(hp, amount) {
  if (!(amount > 0)) return { hp }
  return { hp: { ...hp, damage: Math.max(0, (hp.damage ?? 0) - amount) } }
}

function applyTrackedTempHp(hp, amount) {
  if (!(amount > 0)) return { hp }
  return { hp: { ...hp, tempHp: Math.max(hp.tempHp ?? 0, amount) } }
}

// PHB p. 203: concentration save DC is 10 or half the damage taken,
// whichever is higher. "Damage taken" is the full amount, before temp HP
// absorbs any of it — temp HP cushions HP loss, not the disruption.
function concentrationDC(damage) {
  return Math.max(10, Math.floor(damage / 2))
}

module.exports = {
  effectiveMaxHp,
  absorbTempHp,
  applyDamage,
  applyHealing,
  applyTempHp,
  applyTrackedDamage,
  applyTrackedHealing,
  applyTrackedTempHp,
  concentrationDC,
}
