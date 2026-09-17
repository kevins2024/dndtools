const test = require('node:test')
const assert = require('node:assert/strict')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')

// Covers the two "deliberately not built" gaps closed 2026-09-10 (see
// TODO.md's "Real racial/background mechanical data" entry): a flat
// non-class HP-per-level source (Dwarven Toughness), and species grants
// keyed on a level past 1st (Drow Magic/Infernal Legacy's 3rd/5th-level
// spells). Both are exercised through diffLevelUp.js directly, the one
// place with real character-shape knowledge (race/subrace, other classes),
// rather than through describeLevelUp (pure, single-class, no species
// awareness at all).

function baseCharacter(overrides = {}) {
  return {
    stat_str: 12,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 12,
    hp_max: 0,
    hp_current: 0,
    features: [],
    classes: [{ name: 'Fighter', level: 0, subclass: null }],
    ...overrides,
  }
}

test('Dwarven Toughness: a Hill Dwarf gains +1 HP at 1st level on top of the normal max-hit-die + CON', () => {
  const character = baseCharacter({ race: 'Dwarf', subrace: 'Hill Dwarf' })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  // Fighter d10 max = 10, CON 14 = +2 mod, Dwarven Toughness = +1 -> 13
  assert.equal(result.patch.hp_max, 13)
})

test('Dwarven Toughness: keeps applying +1 per level on later level-ups, not just at 1st', () => {
  let character = baseCharacter({ race: 'Dwarf', subrace: 'Hill Dwarf' })
  let result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  character = { ...character, ...result.patch }
  result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 3,
    hpMethod: 'average',
  })
  // 2 levels gained: Fighter d10 average (6) x2 + CON(+2) x2 + Toughness(+1) x2 = 18
  assert.equal(result.patch.hp_max, 13 + 18)
})

test('A Mountain Dwarf (no Dwarven Toughness) gets no flat HP bonus', () => {
  const character = baseCharacter({ race: 'Dwarf', subrace: 'Mountain Dwarf' })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  // Fighter d10 max = 10, CON 14 = +2, no toughness -> 12
  assert.equal(result.patch.hp_max, 12)
})

test('A non-Dwarf species never gets the flat HP bonus', () => {
  const character = baseCharacter({ race: 'Human', subrace: null })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(result.patch.hp_max, 12)
})

test('A character with no race field at all is unaffected (traitsFor tolerates it)', () => {
  const character = baseCharacter({ race: undefined, subrace: undefined })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(result.patch.hp_max, 12)
})

test('Drow Magic: Faerie Fire arrives exactly at total character level 3, not before', () => {
  const character = baseCharacter({
    race: 'Elf',
    subrace: 'Dark Elf (Drow)',
    classes: [{ name: 'Rogue', level: 1, subclass: null }],
  })
  const at2 = diffLevelUp(character, { className: 'Rogue', toLevel: 2 })
  assert.ok(
    !(at2.patch.features || []).some((f) => f.name.includes('Faerie Fire')),
    'should not appear yet at level 2'
  )

  const characterAt2 = { ...character, ...at2.patch }
  const at3 = diffLevelUp(characterAt2, { className: 'Rogue', toLevel: 3 })
  const grant = (at3.patch.features || []).find((f) =>
    f.name.includes('Faerie Fire')
  )
  assert.ok(grant, 'Faerie Fire should be granted crossing into level 3')
  assert.equal(grant.type, 'speciesTrait')
  assert.deepEqual(grant.spells_granted, ['Faerie Fire'])
  assert.equal(grant.level_gained, 3)
})

test('Drow Magic: Faerie Fire and Darkness both arrive in one jump if a level-up skips past both thresholds', () => {
  const character = baseCharacter({
    race: 'Elf',
    subrace: 'Dark Elf (Drow)',
    classes: [{ name: 'Rogue', level: 1, subclass: null }],
  })
  const result = diffLevelUp(character, { className: 'Rogue', toLevel: 5 })
  const names = (result.patch.features || []).map((f) => f.name)
  assert.ok(names.some((n) => n.includes('Faerie Fire')))
  assert.ok(names.some((n) => n.includes('Darkness')))
})

test("Drow Magic tiers key off TOTAL character level across classes, not the leveled class's own level", () => {
  // Rogue 2 already, picking up Fighter as a brand-new class (0 -> 1) —
  // total character level goes from 2 to 3, so Faerie Fire should fire even
  // though Fighter itself only just reached its own level 1.
  const character = baseCharacter({
    race: 'Elf',
    subrace: 'Dark Elf (Drow)',
    classes: [{ name: 'Rogue', level: 2, subclass: null }],
  })
  const result = diffLevelUp(character, { className: 'Fighter', toLevel: 1 })
  const names = (result.patch.features || []).map((f) => f.name)
  assert.ok(
    names.some((n) => n.includes('Faerie Fire')),
    'total level 3 should grant Faerie Fire even via a different class'
  )
})

test('Infernal Legacy: Hellish Rebuke and Darkness are separate from Drow Magic and only apply to Tieflings', () => {
  const character = baseCharacter({
    race: 'Tiefling',
    subrace: null,
    classes: [{ name: 'Rogue', level: 1, subclass: null }],
  })
  const result = diffLevelUp(character, { className: 'Rogue', toLevel: 5 })
  const names = (result.patch.features || []).map((f) => f.name)
  assert.ok(names.some((n) => n.includes('Hellish Rebuke')))
  assert.ok(names.some((n) => n.includes('Darkness')))
  assert.ok(!names.some((n) => n.includes('Faerie Fire')))
})

test('A second diffLevelUp call over an already-granted tier does not duplicate the feature', () => {
  const character = baseCharacter({
    race: 'Elf',
    subrace: 'Dark Elf (Drow)',
    classes: [{ name: 'Rogue', level: 1, subclass: null }],
  })
  const first = diffLevelUp(character, { className: 'Rogue', toLevel: 3 })
  const characterAt3 = { ...character, ...first.patch }
  // Re-running the SAME level-up (e.g. a re-opened preview, or applying a
  // patch twice by mistake) should not add a second Faerie Fire grant. At
  // fromLevel === toLevel === 3, the level-crossing loop never runs at all,
  // so `patch.features` is correctly left unset (nothing NEW to merge) —
  // check the fully-merged character, the shape a real caller applies, not
  // the raw patch by itself.
  const rerun = diffLevelUp(characterAt3, {
    className: 'Rogue',
    toLevel: 3,
  })
  const merged = { ...characterAt3, ...rerun.patch }
  const faerieFireGrants = merged.features.filter((f) =>
    f.name.includes('Faerie Fire')
  )
  assert.equal(faerieFireGrants.length, 1)
})
