// Every real character can be taken one level further, in every class they have, purely through
// the choice descriptions (the way the Level Up screen does it): all questions are answerable
// and nothing is left open or reported as a problem.
const test = require('node:test')
const assert = require('node:assert/strict')
const roster = require('../../src/data/characters.json')
const spellbooks = require('../../src/data/spellbooks.json')
const { autoLevelUp } = require('../rules/5e/choiceProtocol')

for (const c of roster) {
  for (const k of c.classes.filter((k) => k.level < 20)) {
    test(`${c.name}: ${k.name} ${k.level} -> ${
      k.level + 1
    } answers through the choice descriptions`, () => {
      const draft = JSON.parse(JSON.stringify(c))
      if (draft.spellbook_id) {
        // The same shim the Level Up screen applies: a Wizard's known spells live on the spellbook.
        const book = spellbooks.find((b) => b.id === draft.spellbook_id)
        draft.spells = (book?.spells ?? []).map((s) => ({
          name: s.name,
          level: s.level,
        }))
      }
      const r = autoLevelUp(draft, {
        className: k.name,
        toLevel: k.level + 1,
        hpMethod: 'average',
      })
      assert.deepEqual(r.problems, [])
      assert.equal(r.complete, true)
      assert.equal(
        r.patch.classes.find((x) => x.name === k.name).level,
        k.level + 1
      )
      assert.ok(r.hp.gain > 0)
    })
  }
}
