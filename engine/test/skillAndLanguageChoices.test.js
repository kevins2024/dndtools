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

// Spot-check the exact RAW numbers for a representative sample, citing the
// verified source in each assertion — same rigor as featsCatalog.test.js's
// count assertions. Rogue is the class that motivated this whole pass (Siv
// was missing 2 of her 4).
test('spot-check real RAW skill_choices counts/lists (dnd5e.wikidot.com, cross-checked)', () => {
  assert.deepEqual(engine.loadClass('Rogue').skill_choices, {
    count: 4,
    options: [
      'acrobatics',
      'athletics',
      'deception',
      'insight',
      'intimidation',
      'investigation',
      'perception',
      'performance',
      'persuasion',
      'sleight_of_hand',
      'stealth',
    ],
  })
  assert.deepEqual(engine.loadClass('Bard').skill_choices, {
    count: 3,
    options: 'any',
  })
  assert.deepEqual(engine.loadClass('Ranger').skill_choices, {
    count: 3,
    options: [
      'animal_handling',
      'athletics',
      'insight',
      'investigation',
      'nature',
      'perception',
      'stealth',
      'survival',
    ],
  })
  assert.deepEqual(engine.loadClass('Wizard').skill_choices, {
    count: 2,
    options: [
      'arcana',
      'history',
      'insight',
      'investigation',
      'medicine',
      'religion',
    ],
  })
  // Artificer is TCE/Eberron content, not PHB — real list includes Sleight
  // of Hand, which an initial memory-only pass would likely have missed
  // (confirmed via both dnd5e.wikidot.com and an independent WebSearch
  // cross-check before writing this data).
  assert.deepEqual(engine.loadClass('Artificer').skill_choices, {
    count: 2,
    options: [
      'arcana',
      'history',
      'investigation',
      'medicine',
      'nature',
      'perception',
      'sleight_of_hand',
    ],
  })
})

test('every background has a non-negative integer language_choices', () => {
  for (const bg of engine.listBackgrounds()) {
    assert.ok(
      Number.isInteger(bg.language_choices) && bg.language_choices >= 0,
      `${bg.name} is missing a valid language_choices count`
    )
  }
})

// Spot-check real PHB language grants (dnd5e.wikidot.com, cross-checked
// against dndbeyond.com/a second WebSearch source) — Sage is the concrete
// case named in TODO.md (Jaygar's 2 languages had to be backfilled by hand).
test('spot-check real RAW background language_choices', () => {
  assert.equal(engine.loadBackground('Acolyte').language_choices, 2)
  assert.equal(engine.loadBackground('Sage').language_choices, 2)
  assert.equal(engine.loadBackground('Hermit').language_choices, 1)
  assert.equal(engine.loadBackground('Guild Artisan').language_choices, 1)
  // These grant skills/tools but explicitly NO languages per RAW — a naive
  // "everyone gets at least one" guess would get these wrong.
  assert.equal(engine.loadBackground('Charlatan').language_choices, 0)
  assert.equal(engine.loadBackground('Criminal').language_choices, 0)
  assert.equal(engine.loadBackground('Soldier').language_choices, 0)
})

test('every species has a languages field, either the standard {automatic, choice} shape or a flat homebrew array', () => {
  for (const name of engine.listSpecies().map((s) => s.name)) {
    const sp = engine.loadSpecies(name)
    assert.ok(sp.languages, `${name} is missing a languages field`)
    assert.ok(
      Array.isArray(sp.languages.automatic) &&
        sp.languages.automatic.length > 0,
      `${name}'s languages.automatic should be a non-empty array`
    )
    assert.ok(
      sp.languages.automatic.includes('Common'),
      `${name} should automatically know Common per RAW`
    )
  }
})

// Spot-check real RAW language grants (dnd5e.wikidot.com, cross-checked)
// — Human and Half-Elf are the two standard species with an actual flexible
// choice component, the highest-risk cases to get wrong.
test('spot-check real RAW species language grants', () => {
  assert.deepEqual(engine.loadSpecies('Human').languages, {
    automatic: ['Common'],
    choice: { count: 1 },
  })
  assert.deepEqual(engine.loadSpecies('Half-Elf').languages, {
    automatic: ['Common', 'Elvish'],
    choice: { count: 1 },
  })
  assert.deepEqual(engine.loadSpecies('Dwarf').languages, {
    automatic: ['Common', 'Dwarvish'],
    choice: null,
  })
  assert.deepEqual(engine.loadSpecies('Gnome').languages, {
    automatic: ['Common', 'Gnomish'],
    choice: null,
  })
  // High Elf grants ONE extra language on top of Elf's base Common+Elvish —
  // real RAW, additive like ability score bonuses already are for subraces.
  const highElf = engine
    .loadSpecies('Elf')
    .subraces.find((sr) => sr.name === 'High Elf')
  assert.deepEqual(highElf.languages, { choice: { count: 1 } })
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
