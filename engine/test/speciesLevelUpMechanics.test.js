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
  const character = baseCharacter({ genus: 'Dwarf', subgenus: 'Hill Dwarf' })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  // Fighter d10 max = 10, CON 14 = +2 mod, Dwarven Toughness = +1 -> 13
  assert.equal(result.patch.hp_max, 13)
})

test('Dwarven Toughness: keeps applying +1 per level on later level-ups, not just at 1st', () => {
  let character = baseCharacter({ genus: 'Dwarf', subgenus: 'Hill Dwarf' })
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

test('A non-Dwarf species never gets the flat HP bonus', () => {
  const character = baseCharacter({ genus: 'Human', subgenus: null })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(result.patch.hp_max, 12)
})

test('A character with no race field at all is unaffected (traitsFor tolerates it)', () => {
  const character = baseCharacter({ genus: undefined, subgenus: undefined })
  const result = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(result.patch.hp_max, 12)
})
