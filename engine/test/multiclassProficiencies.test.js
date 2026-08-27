const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('expectedProficienciesForCharacter: starting class gets its full list, multiclassed-in class gets the reduced PHB list', () => {
  // Kerra started as Warlock (light armor, simple weapons — her full starting
  // list) and multiclassed into Fighter (which, per the PHB Multiclassing
  // Proficiencies table, only adds light/medium armor + shields + simple/
  // martial weapons when gained via multiclassing, not Fighter's full normal
  // heavy-armor list).
  const result = engine.expectedProficienciesForCharacter(
    [
      { name: 'Fighter', level: 4 },
      { name: 'Warlock', level: 5 },
    ],
    'Warlock'
  )
  assert.deepEqual(result.armor.sort(), ['light', 'medium', 'shields'])
  assert.deepEqual(result.weapons.sort(), ['martial', 'simple'])
  // Fighter's own heavy armor proficiency should NOT appear — Kerra never
  // started as Fighter, so she never gets it.
  assert.ok(!result.armor.includes('heavy'))
})

test('expectedProficienciesForCharacter: reversed starting class changes the result', () => {
  // Same two classes, but if Fighter had been the starting class instead,
  // heavy armor WOULD be present.
  const result = engine.expectedProficienciesForCharacter(
    [
      { name: 'Fighter', level: 4 },
      { name: 'Warlock', level: 5 },
    ],
    'Fighter'
  )
  assert.ok(result.armor.includes('heavy'))
})
