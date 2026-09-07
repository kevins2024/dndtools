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

// Species/racial trait data integrity — added alongside the ability-score-
// history/species-traits attribution work (2026-09-03). Every base species
// and subrace trait needs a real name + description so
// NewCharacterTool.vue's speciesTraitRecords (and FeaturePillsPanel's
// self-contained tooltip — deliberately NOT routed through name-based
// lookupFeature, see engine/CHECKLIST.md) always has real text to show.
test('every base species and subrace trait has a non-empty name and description', () => {
  for (const sp of listSpecies().map((s) => loadSpecies(s.name))) {
    for (const trait of sp.traits ?? []) {
      assert.ok(
        trait.name && trait.name.trim().length > 0,
        `${sp.name} has a trait with a blank name`
      )
      assert.ok(
        trait.description && trait.description.trim().length > 0,
        `${sp.name}'s "${trait.name}" trait has a blank description`
      )
    }
    for (const sub of sp.subraces ?? []) {
      for (const trait of sub.traits ?? []) {
        assert.ok(
          trait.name && trait.name.trim().length > 0,
          `${sp.name}/${sub.name} has a trait with a blank name`
        )
        assert.ok(
          trait.description && trait.description.trim().length > 0,
          `${sp.name}/${sub.name}'s "${trait.name}" trait has a blank description`
        )
      }
    }
  }
})

// The 4 species with real 2014-PHB subraces (Elf, Dwarf, Halfling, Gnome)
// should each have base-species-level named traits too (Fey Ancestry,
// Dwarven Resilience, Lucky/Brave, Gnome Cunning, etc.) — not just their
// subrace's traits — matching the motivating cases from TODO.md (Jaygar's
// missing Fade Away, Siv's unattributed DEX 20) that named Fey Ancestry and
// Lucky specifically as real traits that should render.
test('Elf, Dwarf, Halfling, and Gnome all have base-species traits, not just subrace traits', () => {
  for (const name of ['Elf', 'Dwarf', 'Halfling', 'Gnome']) {
    const sp = loadSpecies(name)
    assert.ok(
      sp.traits && sp.traits.length > 0,
      `${name} should have base-species traits`
    )
  }
})

test('Human has no named traits (correct per RAW — its identity is the ability bonus, not named traits)', () => {
  const sp = loadSpecies('Human')
  assert.ok(!sp.traits || sp.traits.length === 0)
})
