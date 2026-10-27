// The live roster (src/data/characters.json) must always pass the legality audit
// with no errors, and every stored number must equal the one calculated from the
// recorded base scores, history and hit dice. Warnings are known record gaps
// (unrecorded ASI choices, sheets above a standard point buy) kept visible on purpose.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { auditCharacter } = require('../rules/5e/auditCharacter')

const roster = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'characters.json'
))
const spellbooks = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'spellbooks.json'
))

for (const c of roster) {
  test(`${c.name}: no legality errors, numbers calculate from the record, history present`, () => {
    const errors = auditCharacter(c, { spellbooks }).filter(
      (i) => i.severity === 'error'
    )
    assert.deepEqual(
      errors.map((i) => `${i.code}: ${i.message}`),
      []
    )
    assert.ok(c.ability_base, 'base scores recorded')
    assert.ok(
      Array.isArray(c.level_history) &&
        c.level_history.length > c.classes.reduce((n, k) => n + k.level, 0),
      'level history present'
    )
    assert.equal(c.level_history[0].kind, 'origin')
  })
}
