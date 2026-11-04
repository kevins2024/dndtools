// A number a feature's data asks for ("a number of d4s equal to your Proficiency Bonus", "DC 8 plus your
// Constitution modifier and Proficiency Bonus", "1d10, 2d10 at 5th level..."), resolved against a character.
// Returns the shared { value, breakdown: [{ label, amount }] } so a tooltip comes from the list.
//
//   3                                         a plain number
//   { type: 'proficiency_bonus' }             the Proficiency Bonus (multiplier optional)
//   { type: 'ability_mod', ability: 'con' }   an ability modifier, items included
//   { type: 'by_level', table: { 1: 1, 5: 2 } }   the entry at the highest level reached
//   { type: 'dc', ability: 'cha' }            8 + the ability's modifier + the Proficiency Bonus
//
// No fs/path, so browser code may use it.

const { proficiencyBonus } = require('./progression')
const { resolveEffectiveStats } = require('./characterStats')

const modifier = (score) => Math.floor(((score ?? 10) - 10) / 2)
const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

function totalLevel(character) {
  return (
    (character.classes ?? []).reduce((n, c) => n + (c.level || 0), 0) ||
    character.level ||
    0
  )
}

function proficiencyLine(character) {
  const level = totalLevel(character)
  return {
    label: `Proficiency Bonus (level ${level})`,
    amount: proficiencyBonus(Math.max(1, level)),
  }
}

function abilityLine(character, ability, equippedItems) {
  const { scores } = resolveEffectiveStats(character, equippedItems)
  return {
    label: `${ABILITY_NAMES[ability] ?? ability} modifier`,
    amount: modifier(scores[ability]),
  }
}

function resolveAmount(formula, character, equippedItems = []) {
  if (typeof formula === 'number')
    return { value: formula, breakdown: [{ label: 'Fixed', amount: formula }] }
  if (!formula) return { value: 0, breakdown: [] }
  let breakdown
  if (formula.type === 'proficiency_bonus') {
    const line = proficiencyLine(character)
    breakdown = [{ ...line, amount: line.amount * (formula.multiplier ?? 1) }]
  } else if (formula.type === 'ability_mod') {
    breakdown = [abilityLine(character, formula.ability, equippedItems)]
  } else if (formula.type === 'by_level') {
    const level = totalLevel(character)
    const key = Object.keys(formula.table)
      .map(Number)
      .filter((k) => k <= level)
      .sort((a, b) => b - a)[0]
    breakdown =
      key == null
        ? []
        : [{ label: `Level ${key}+`, amount: formula.table[key] }]
  } else if (formula.type === 'dc') {
    breakdown = [
      { label: 'Base', amount: formula.base ?? 8 },
      abilityLine(character, formula.ability, equippedItems),
      proficiencyLine(character),
    ]
  } else {
    throw new Error(`Unknown amount type "${formula.type}"`)
  }
  return { value: breakdown.reduce((n, l) => n + l.amount, 0), breakdown }
}

module.exports = { resolveAmount, totalLevel, modifier }
