const test = require('node:test')
const assert = require('node:assert/strict')
const {
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
} = require('../rules/species')

test('listSpecies includes all 9 standard PHB species', () => {
  const names = listSpecies().map((s) => s.name)
  for (const n of [
    'Human',
    'Elf',
    'Dwarf',
    'Halfling',
    'Dragonborn',
    'Gnome',
    'Half-Elf',
    'Half-Orc',
    'Tiefling',
  ]) {
    assert.ok(names.includes(n), `expected ${n} in species list`)
  }
})

test('loadSpecies is case-insensitive', () => {
  assert.equal(loadSpecies('human').name, 'Human')
  assert.equal(loadSpecies('HALF-ELF').name, 'Half-Elf')
})

test('applySpeciesBonus: Human applies +1 to all six abilities', () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = applySpeciesBonus(base, 'Human')
  assert.deepEqual(result.scores, {
    str: 11,
    dex: 11,
    con: 11,
    int: 11,
    wis: 11,
    cha: 11,
  })
})

test('applySpeciesBonus: Dragonborn applies +2 STR and +1 CHA only', () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = applySpeciesBonus(base, 'Dragonborn')
  assert.deepEqual(result.scores, {
    str: 12,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 11,
  })
})

test('applySpeciesBonus: Half-Elf requires a flexible-bonus choice and applies it correctly', () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

  assert.throws(() => applySpeciesBonus(base, 'Half-Elf'))
  assert.throws(() =>
    applySpeciesBonus(base, 'Half-Elf', { abilities: ['str'] })
  )
  // CHA is already fixed at +2 for Half-Elf — can't also be picked for the flexible bonus
  assert.throws(() =>
    applySpeciesBonus(base, 'Half-Elf', { abilities: ['str', 'cha'] })
  )

  const result = applySpeciesBonus(base, 'Half-Elf', {
    abilities: ['str', 'wis'],
  })
  assert.deepEqual(result.scores, {
    str: 11,
    dex: 10,
    con: 10,
    int: 10,
    wis: 11,
    cha: 12,
  })
})

test('applySpeciesBonus: unknown species leaves scores untouched with a note, not a crash', () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = applySpeciesBonus(base, 'Catrin')
  assert.deepEqual(result.scores, base)
  assert.ok(result.notes[0].includes("isn't in the species catalog"))
})
