// Attacks that aren't an equipped weapon: a Monk's Martial Arts unarmed
// strike, a Soulknife's manifested Psychic Blades, and the Rogue's Sneak
// Attack dice scaling. Extracted 2026-10-01 from src/utils/dnd_utils.js's
// buildWeaponRows/sneakAttackDice, which carried the die tables and the
// attack/damage math inline next to the display-row building.
//
// Same contract as weaponAttack.js: equippedItems is already filtered to
// "equipped by this character", and attack/damage come back as
// `{ value, breakdown: [{ label, amount }] }` so the UI builds its own
// tooltip. The die is returned separately (damage = die + damage.value).
//
// Zero fs/path dependencies (class JSON tables are plain `require`d data,
// which webpack bundles fine) — browser code require()s this directly; see
// src/utils/unarmedAttacks.js.

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')
const { effectiveProficiencyBonus } = require('./proficiency')
const { bonusLines } = require('./breakdown')
const { loadoutHands } = require('./weaponHands')
const { rageDamage } = require('./weaponAttack')
const monk = require('../../data/5e/classes/monk.json')
const rogue = require('../../data/5e/classes/rogue.json')

// Value of a { "1": a, "5": b, ... } by-level table at `level`: the entry
// for the highest key at or below it. null below the first key.
function tableValueAtLevel(table, level) {
  let value = null
  let bestKey = -Infinity
  for (const [key, v] of Object.entries(table ?? {})) {
    const k = Number(key)
    if (k <= level && k > bestKey) {
      bestKey = k
      value = v
    }
  }
  return value
}

function classLevel(character, className) {
  return (character.classes ?? []).find((c) => c.name === className)?.level
}

// Current Sneak Attack dice ("3d6"), from actual Rogue class level — not
// baked into a feature name, which drifts the moment the character levels
// up. null for a non-Rogue.
function sneakAttackDice(character) {
  const rogueLevel = classLevel(character, 'Rogue')
  if (!rogueLevel) return null
  const dice = tableValueAtLevel(rogue.sneak_attack_dice_by_level, rogueLevel)
  return dice ? `${dice}d6` : null
}

// A Monk's Martial Arts die ("1d6"). character.martial_arts_die is either
// 'auto' (scale with character level via the Monk table) or a fixed die
// string for a character who has the die from some other source. null if
// the character has no Martial Arts.
function martialArtsDie(character) {
  const set = character.martial_arts_die
  if (!set) return null
  if (set !== 'auto') return set
  // RAW scales with MONK level, not total character level (a Monk 5 /
  // Fighter 6 has a d6, not a d8). Falls back to total level for a
  // character with the die but no Monk class entry.
  const sides = tableValueAtLevel(
    monk.martial_arts_die_by_level,
    classLevel(character, 'Monk') ?? character.level ?? 1
  )
  return `1d${sides ?? 4}`
}

function bestOfStrDex(character, equippedItems) {
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  return {
    bonuses,
    statMod: Math.max(abilityModifier(scores.str), abilityModifier(scores.dex)),
  }
}

const dieSides = (die) => Number(String(die).split('d')[1])

const UNARMED_FIGHTING_ID = 'fighting-style-unarmed-fighting'

// Unarmed Fighting (Tasha's fighting style, from a class or Fighting
// Initiate): the style's own feature record is the single source of truth.
function hasUnarmedFighting(character) {
  return (character.features ?? []).some(
    (f) =>
      f.id === UNARMED_FIGHTING_ID ||
      f.name === 'Fighting Style: Unarmed Fighting'
  )
}

// Anything held in either hand: a weapon or a shield (Unarmed Fighting's d8
// needs both hands free of them).
function handsOccupied(character, equippedItems) {
  const h = loadoutHands(character, equippedItems)
  return Boolean(
    h.main || h.off || h.twoHanded || h.shield || h.unassigned.length
  )
}

// Unarmed strike. Three things can turn it from the plain 1-damage strike
// into a real attack: Martial Arts (a Monk: the Monk's die, and best of
// STR/DEX for attack and damage), Tavern Brawler ("your unarmed strike
// deals 1d4 bludgeoning damage" — `character.unarmed_strike_die`, STR only)
// and the Unarmed Fighting style (1d6 + STR, 1d8 while no weapon or shield
// is held, plus 1d4 to a creature you have grappled at the start of your
// turn). The character is proficient with unarmed strikes either way. With
// several, the biggest die wins and the Monk's best-of-STR/DEX still
// applies. null if the character has none of them.
function unarmedStrike(character, equippedItems = []) {
  const monkDie = martialArtsDie(character)
  const brawlDie = character.unarmed_strike_die ?? null
  const unarmedFighting = hasUnarmedFighting(character)
  const fightingDie = unarmedFighting
    ? handsOccupied(character, equippedItems)
      ? '1d6'
      : '1d8'
    : null
  const dice = [monkDie, brawlDie, fightingDie].filter(Boolean)
  if (!dice.length) return null
  const die = dice.reduce((best, d) =>
    dieSides(d) > dieSides(best) ? d : best
  )
  const { scores, bonuses } = resolveEffectiveStats(character, equippedItems)
  const statMod = monkDie
    ? Math.max(abilityModifier(scores.str), abilityModifier(scores.dex))
    : abilityModifier(scores.str)
  const statLabel = monkDie ? 'Martial Arts (best of STR/DEX)' : 'STR'
  const prof = effectiveProficiencyBonus(character, bonuses)
  const atkBonus = bonuses.unarmed_attack ?? 0
  const dmgBonus = bonuses.unarmed_damage ?? 0
  // Rage adds to melee attacks made with Strength: an unarmed strike counts,
  // unless a Monk's Martial Arts is using a better DEX modifier.
  const usesStrength =
    !monkDie || abilityModifier(scores.str) >= abilityModifier(scores.dex)
  const rage = usesStrength ? rageDamage(character) : 0

  return {
    name: 'Unarmed Strike',
    die,
    attack: {
      value: statMod + prof + atkBonus,
      breakdown: [
        { label: statLabel, amount: statMod },
        { label: 'Proficiency', amount: prof },
        ...bonusLines(equippedItems, 'unarmed_attack'),
        ...bonusLines(character.features, 'unarmed_attack'),
      ],
    },
    damage: {
      value: statMod + dmgBonus + rage,
      breakdown: [
        { label: statLabel, amount: statMod },
        ...(rage ? [{ label: 'Raging', amount: rage }] : []),
        ...bonusLines(equippedItems, 'unarmed_damage'),
        ...bonusLines(character.features, 'unarmed_damage'),
      ],
    },
    // Items whose extra damage applies to unarmed strikes specifically.
    extras: [
      ...equippedItems
        .filter((i) => i.extra_damage?.applies_to === 'unarmed')
        .map((i) => ({
          source: i.name,
          die: i.extra_damage.die,
          type: i.extra_damage.type,
          trigger: i.extra_damage.trigger ?? 'on hit',
        })),
      ...(unarmedFighting
        ? [
            {
              source: 'Unarmed Fighting',
              die: '1d4',
              type: 'bludgeoning',
              trigger: 'start of your turn, one creature you have grappled',
            },
          ]
        : []),
    ],
  }
}

// Soulknife Rogue's Psychic Blades — manifested weapons, not real items.
// RAW: the damage die (1d6 main / 1d4 bonus-action second blade) does NOT
// scale with level — confirmed against dnd5e.wikidot.com and a second
// source; only the separate Psionic Energy die pool scales, a different
// mechanic not modeled here. Finesse (best of STR/DEX), thrown 60ft. Both
// blades share one attack bonus and one damage bonus. null if the character
// doesn't have them.
function psychicBlades(character, equippedItems = []) {
  if (!character.psychic_blades) return null
  const { bonuses, statMod } = bestOfStrDex(character, equippedItems)
  const prof = effectiveProficiencyBonus(character, bonuses)
  const atkBonus = bonuses.psychic_blade_attack ?? 0
  const dmgBonus = bonuses.psychic_blade_damage ?? 0

  const attack = {
    value: statMod + prof + atkBonus,
    breakdown: [
      { label: 'Finesse (best of STR/DEX)', amount: statMod },
      { label: 'Proficiency', amount: prof },
      ...bonusLines(equippedItems, 'psychic_blade_attack'),
      ...bonusLines(character.features, 'psychic_blade_attack'),
    ],
  }
  const damage = {
    value: statMod + dmgBonus,
    breakdown: [
      { label: 'Finesse (best of STR/DEX)', amount: statMod },
      ...bonusLines(equippedItems, 'psychic_blade_damage'),
      ...bonusLines(character.features, 'psychic_blade_damage'),
    ],
  }
  return [
    {
      id: 'psychic-blade-main',
      name: 'Psychic Blade',
      die: '1d6',
      attack,
      damage,
      thrown: { normal: 60, long: 60 },
    },
    {
      id: 'psychic-blade-bonus',
      name: 'Psychic Blade (bonus action)',
      die: '1d4',
      attack,
      damage,
      thrown: null,
    },
  ]
}

module.exports = {
  tableValueAtLevel,
  sneakAttackDice,
  martialArtsDie,
  unarmedStrike,
  psychicBlades,
}
