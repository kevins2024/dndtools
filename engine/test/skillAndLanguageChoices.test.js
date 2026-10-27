const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')
const languages = require('../data/5e/languages.json')

// New Character tool skill/language picker data — added 2026-09-03 to close
// the real, twice-confirmed gap logged in TODO.md ("New Character tool has
// no class-level skill picker at all", Siv and Jaygar both ended up
// under-provisioned). Every class's skill_choices count/list and every
// background's language_choices count were verified against
// dnd5e.wikidot.com, cross-checked against a second independent source for a
// sample (5thsrd.org, dndbeyond.com, or a WebSearch cross-reference where the
// first two were unreachable) — see engine/CHECKLIST.md for the full
// per-class/per-background source log.

const SKILL_IDS = new Set(engine.listSkills().map((s) => s.id))

test('every class has skill_choices with a real count and a real, resolvable options list (or "any")', () => {
  for (const name of engine.listClasses()) {
    const cls = engine.loadClass(name)
    assert.ok(cls.skill_choices, `${name} is missing skill_choices`)
    const { count, options } = cls.skill_choices
    assert.ok(
      Number.isInteger(count) && count > 0,
      `${name}'s skill_choices.count should be a positive integer`
    )
    if (options === 'any') continue
    assert.ok(
      Array.isArray(options) && options.length > 0,
      `${name}'s skill_choices.options should be a non-empty array or "any"`
    )
    assert.ok(
      count <= options.length,
      `${name} can't choose ${count} skills from only ${options.length} options`
    )
    for (const id of options) {
      assert.ok(
        SKILL_IDS.has(id),
        `${name}'s skill_choices references unknown skill id "${id}"`
      )
    }
    // No duplicate options within one class's own list.
    assert.equal(
      new Set(options).size,
      options.length,
      `${name}'s skill_choices.options has a duplicate entry`
    )
  }
})

test('languages.json has the 16 real PHB standard/exotic player-choosable languages, no duplicates', () => {
  assert.equal(languages.length, 16)
  assert.equal(new Set(languages.map((l) => l.id)).size, 16)
  assert.equal(new Set(languages.map((l) => l.name)).size, 16)
  for (const l of languages) {
    assert.ok(['standard', 'exotic'].includes(l.type))
  }
  assert.ok(languages.some((l) => l.name === 'Common'))
  assert.ok(languages.some((l) => l.name === 'Undercommon'))
})

test('engine.listLanguages / loadLanguage resolve correctly', () => {
  assert.equal(engine.listLanguages().length, 16)
  assert.equal(engine.loadLanguage('draconic').name, 'Draconic')
  assert.equal(engine.loadLanguage('Deep Speech').id, 'deep_speech')
  assert.equal(engine.loadLanguage('Not A Real Language'), null)
})
