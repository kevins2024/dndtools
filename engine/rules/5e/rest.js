// Short rest and long rest (PHB ch. 8 "Resting") applied to a character
// record, plus recharging party items on a rest. Extracted 2026-10-01 from
// src/store/index.js's SHORT_REST/LONG_REST mutations and
// src/components/ShortRestModal.vue — real rules that were buried in a Vuex
// mutation and a modal's methods.
//
// Character functions return { patch, ... } (only the fields that changed),
// same shape as diffLevelUp's patch and hitPoints.js — the store merges it.
// Item recharge returns the new items array. Randomness (hit die rolls, dice
// recharges like a wand's "1d6+1") takes an injectable `rng` so tests pin it.
//
// Table conventions kept as-found (not changed here): a long rest clears
// every condition except Exhaustion (stricter than RAW, which only ends
// specific effects), and item recharge types 'daily'/'short_rest'/
// 'long_rest'/'dawn' all refill on a long rest.
//
// Zero fs/path dependencies — browser code require()s this directly; see
// src/utils/rest.js.

const { rollDie, rollDiceExpr, isDiceExpr } = require('./dice')
const { abilityModifier } = require('./abilities')

const MAX_EXHAUSTION = 6

// "d8" -> 8. Falls back to d8 for a missing/garbled value, matching what the
// old modal did.
function hitDieSides(hitDie) {
  const sides = parseInt(String(hitDie || 'd8').slice(1), 10)
  return Number.isFinite(sides) && sides > 0 ? sides : 8
}

function hitDiceAvailable(character) {
  return character.hit_dice_current ?? character.level ?? 1
}

function hpMissing(character) {
  return (character.hp_max ?? 0) - (character.hp_current ?? 0)
}

// Average HP one hit die heals: the die's average roll plus CON mod.
function averageHitDieHealing(character) {
  const avg = (hitDieSides(character.hit_die) + 1) / 2
  return avg + abilityModifier(character.stat_con ?? 10)
}

// Expected HP from spending `dice` hit dice: average roll + CON mod each,
// clamped to what's actually missing. For the "what would this heal"
// preview before committing to real rolls.
function shortRestHealEstimate(character, dice) {
  if (!(dice > 0)) return 0
  const total = Math.round(dice * averageHitDieHealing(character))
  return Math.min(Math.max(0, total), Math.max(0, hpMissing(character)))
}

// Actually roll `dice` hit dice. PHB: each die is rolled and CON mod added
// (a die can't heal below 0 in total — the sum is floored at 0, matching the
// old modal's Math.max(0, ...)), and HP can't exceed what was missing.
function rollShortRestHealing(character, dice, rng = Math.random) {
  const sides = hitDieSides(character.hit_die)
  const conMod = abilityModifier(character.stat_con ?? 10)
  const rolls = Array.from({ length: Math.max(0, dice) }, () =>
    rollDie(sides, rng)
  )
  const rawTotal = rolls.reduce((sum, r) => sum + r + conMod, 0)
  const hpGained = Math.max(
    0,
    Math.min(rawTotal, Math.max(0, hpMissing(character)))
  )
  return { rolls, hpGained }
}

// Short names for the results screen ("Channel Divinity" rather than
// "Cleric — Channel Divinity (1/rest)").
function shortFeatureName(name) {
  return name
    .replace(/\s*\(.*\)/, '')
    .replace(/^.+—\s*/, '')
    .trim()
}

// Names of what a short rest would actually refill for this character —
// only things that are currently below max, so the results screen lists
// real changes.
function shortRestRecharges(character) {
  const recharged = []
  for (const f of character.features ?? []) {
    if (
      f.recharge === 'short_rest' &&
      f.uses_max &&
      (f.uses_current ?? f.uses_max) < f.uses_max
    ) {
      recharged.push(shortFeatureName(f.name))
    }
  }
  const pm = character.pact_magic
  if (pm?.recharge === 'short_rest' && (pm.current ?? pm.max) < pm.max) {
    recharged.push('Pact Magic')
  }
  if (
    character.ki_points &&
    character.ki_points.current < character.ki_points.max
  ) {
    recharged.push('Ki Points')
  }
  for (const r of character.resources ?? []) {
    if (r.max != null && r.recharge === 'short_rest' && r.current < r.max) {
      recharged.push(r.name)
    }
  }
  return recharged
}

// What a rest of each kind WOULD restore for this character right now, as
// plain data — for a party overview showing who still needs which rest. The
// UI decides how to abbreviate/format it. Raw feature names (not shortened).
function shortRestPreview(character) {
  const features = (character.features ?? [])
    .filter(
      (f) =>
        f.recharge === 'short_rest' &&
        f.uses_max &&
        (f.uses_current ?? f.uses_max) < f.uses_max
    )
    .map((f) => f.name)
  const pm = character.pact_magic
  const pactSlotsSpent = pm ? Math.max(0, pm.max - (pm.current ?? pm.max)) : 0
  return { features, pactSlotsSpent }
}

function longRestPreview(character) {
  const features = (character.features ?? [])
    .filter(
      (f) =>
        f.recharge === 'long_rest' &&
        f.uses_max &&
        (f.uses_current ?? f.uses_max) < f.uses_max
    )
    .map((f) => f.name)
  let spellSlotsSpent = 0
  for (const slot of Object.values(character.spell_slots ?? {})) {
    spellSlotsSpent += Math.max(0, slot.max - (slot.current ?? slot.max))
  }
  return { hpMissing: Math.max(0, hpMissing(character)), features, spellSlotsSpent }
}

// { diceSpent, hpGained } is what the player chose/rolled. Returns
// { patch, recharged }.
function applyShortRest(character, { diceSpent = 0, hpGained = 0 } = {}) {
  const recharged = shortRestRecharges(character)
  const patch = {}
  if (hpGained > 0) {
    patch.hp_current = Math.min(
      character.hp_max,
      (character.hp_current ?? 0) + hpGained
    )
  }
  if (diceSpent > 0) {
    patch.hit_dice_current = Math.max(
      0,
      hitDiceAvailable(character) - diceSpent
    )
  }
  if (character.features) {
    patch.features = character.features.map((f) =>
      f.uses_max != null && f.recharge === 'short_rest'
        ? { ...f, uses_current: f.uses_max }
        : f
    )
  }
  // Spell free-cast uses that recharge on a short rest (e.g. Fey
  // Teleportation's Misty Step) — the only spell-use case that isn't
  // long-rest-only.
  if (character.spells) {
    patch.spells = character.spells.map((s) =>
      s.uses_max != null && s.recharge === 'short_rest'
        ? { ...s, uses_current: s.uses_max }
        : s
    )
  }
  if (character.pact_magic?.recharge === 'short_rest') {
    patch.pact_magic = {
      ...character.pact_magic,
      current: character.pact_magic.max,
    }
  }
  if (character.ki_points) {
    patch.ki_points = {
      ...character.ki_points,
      current: character.ki_points.max,
    }
  }
  if (character.resources) {
    patch.resources = character.resources.map((r) =>
      r.max != null && r.recharge === 'short_rest'
        ? { ...r, current: r.max }
        : r
    )
  }
  return { patch, recharged }
}

// PHB: a long rest recovers spent hit dice up to half your total (round
// down, minimum 1).
function hitDiceRecoveredOnLongRest(maxHitDice) {
  return Math.max(1, Math.floor(maxHitDice / 2))
}

function isExhaustion(condition) {
  return typeof condition === 'string'
    ? condition === 'Exhaustion'
    : condition?.name === 'Exhaustion'
}

// A rest that couldn't be completed (e.g. someone pulled a second watch
// shift, so never got the 6+ hours) gives no benefit and costs a level of
// exhaustion. Tracked in `exhaustion_level` — the field the combat sheet's
// Exhaustion chip actually reads — capped at 6 (death).
function applyInterruptedRest(character) {
  const level = Math.min(MAX_EXHAUSTION, (character.exhaustion_level ?? 0) + 1)
  return { patch: { exhaustion_level: level } }
}

// Full long-rest benefit: HP to max, every slot/pool/use refilled, half the
// hit dice back, one exhaustion level removed, and non-Exhaustion
// conditions cleared. Pass { interrupted: true } for a character who didn't
// get the rest (see applyInterruptedRest).
function applyLongRest(character, { interrupted = false } = {}) {
  if (interrupted) return applyInterruptedRest(character)

  const patch = { hp_current: character.hp_max }
  if (character.spell_slots) {
    const slots = {}
    for (const [level, slot] of Object.entries(character.spell_slots)) {
      slots[level] = { ...slot, current: slot.max }
    }
    patch.spell_slots = slots
  }
  if (character.pact_magic) {
    patch.pact_magic = {
      ...character.pact_magic,
      current: character.pact_magic.max,
    }
  }
  if (character.ki_points) {
    patch.ki_points = {
      ...character.ki_points,
      current: character.ki_points.max,
    }
  }
  // Short-rest uses refill on a long rest too — hence any `recharge` value.
  if (character.features) {
    patch.features = character.features.map((f) =>
      f.uses_max != null && f.recharge ? { ...f, uses_current: f.uses_max } : f
    )
  }
  if (character.spells) {
    patch.spells = character.spells.map((s) =>
      s.uses_max != null && s.recharge ? { ...s, uses_current: s.uses_max } : s
    )
  }
  if (character.resources) {
    patch.resources = character.resources.map((r) =>
      r.max != null &&
      (r.recharge === 'long_rest' || r.recharge === 'short_rest')
        ? { ...r, current: r.max }
        : r
    )
  }
  const hdMax = character.level ?? 1
  const hdCurrent = character.hit_dice_current ?? hdMax
  patch.hit_dice_current = Math.min(
    hdMax,
    hdCurrent + hitDiceRecoveredOnLongRest(hdMax)
  )
  if (character.exhaustion_level > 0) {
    patch.exhaustion_level = character.exhaustion_level - 1
  }
  if (character.conditions?.length) {
    patch.conditions = character.conditions.filter(isExhaustion)
  }
  return { patch }
}

// A dice-expression recharge (a wand's "1d6+1", the Gem of Seeing's "1d3")
// is a "regains X charges daily at dawn" recharge — every one on the roster
// is — so it rolls on a rest that passes through dawn (a long rest) and NOT
// on a short rest. (It used to roll on any rest, short rests included, so a
// Staff of Power could refill during a 1-hour breather.)
const DAWN_TYPES = ['dawn', 'daily', 'long_rest']
function shouldGrantRecharge(recharge, rechargeTypes) {
  if (!recharge || recharge === 'none') return false
  if (isDiceExpr(recharge)) return DAWN_TYPES.some((t) => rechargeTypes.includes(t))
  return rechargeTypes.includes(recharge)
}

// rechargeTypes: the recharge keywords this rest satisfies, e.g.
// ['short_rest'] or ['daily', 'short_rest', 'long_rest', 'dawn']. Covers an
// item's shared charge pool, per-spell uses on spells_granted objects, and
// weapon_effects' own uses.
function rechargeItems(items, rechargeTypes, rng = Math.random) {
  return items.map((item) => {
    let next = item

    if (item.charges_current != null && item.charges_max != null) {
      const r = item.charges_recharge
      if (shouldGrantRecharge(r, rechargeTypes)) {
        next = isDiceExpr(r)
          ? {
              ...next,
              charges_current: Math.min(
                next.charges_max,
                (next.charges_current ?? 0) + rollDiceExpr(r, rng)
              ),
            }
          : { ...next, charges_current: next.charges_max }
      }
    }

    if (Array.isArray(item.spells_granted)) {
      let changed = false
      const grants = item.spells_granted.map((g) => {
        if (typeof g === 'string' || g.uses_max == null) return g
        if (!shouldGrantRecharge(g.recharge, rechargeTypes)) return g
        changed = true
        return { ...g, uses_current: g.uses_max }
      })
      if (changed) next = { ...next, spells_granted: grants }
    }

    if (Array.isArray(item.weapon_effects)) {
      let changed = false
      const effects = item.weapon_effects.map((e) => {
        if (e.uses_max == null) return e
        if (!shouldGrantRecharge(e.recharge, rechargeTypes)) return e
        changed = true
        return { ...e, uses_current: e.uses_max }
      })
      if (changed) next = { ...next, weapon_effects: effects }
    }

    return next
  })
}

const SHORT_REST_RECHARGE_TYPES = ['short_rest']
// An overnight long rest naturally passes through dawn, and covers daily.
const LONG_REST_RECHARGE_TYPES = ['daily', 'short_rest', 'long_rest', 'dawn']

module.exports = {
  hitDieSides,
  hitDiceAvailable,
  hpMissing,
  averageHitDieHealing,
  shortRestHealEstimate,
  rollShortRestHealing,
  shortRestRecharges,
  shortRestPreview,
  longRestPreview,
  applyShortRest,
  hitDiceRecoveredOnLongRest,
  applyLongRest,
  rechargeItems,
  SHORT_REST_RECHARGE_TYPES,
  LONG_REST_RECHARGE_TYPES,
}
