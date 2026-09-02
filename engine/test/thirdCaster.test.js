const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const engine = require('../index')

// "Third caster" = Eldritch Knight (Fighter) / Arcane Trickster (Rogue) —
// the PHB multiclassing table has both contribute level/3 (rounded down)
// toward combined caster level, same idea as "half caster" for Paladin/
// Ranger. Added 2026-09-01: neither existed before this — Fighter and
// Rogue's own spellcasting.type is 'none', and nothing in this engine let a
// SUBCLASS grant spellcasting a base class doesn't have. Verified against
// dnd5e.wikidot.com + a second WebSearch pass, same as the Rogue subclasses
// above.

test('Eldritch Knight and Arcane Trickster both resolve as third-casters with matching slot/cantrip/known tables', () => {
  for (const [className, subclassName] of [
    ['Fighter', 'Eldritch Knight'],
    ['Rogue', 'Arcane Trickster'],
  ]) {
    assert.deepEqual(
      engine.spellSlotsForClassAtLevel(className, 3, subclassName),
      [2],
      `${subclassName} should get its first spell slot at level 3`
    )
    assert.deepEqual(
      engine.spellSlotsForClassAtLevel(className, 20, subclassName),
      [4, 3, 3, 1],
      `${subclassName} should cap at 4th-level spells by 20`
    )
    assert.equal(
      engine.cantripsKnownForClass(className, 3, subclassName),
      2,
      `${subclassName} should know 2 cantrips at level 3`
    )
    assert.equal(
      engine.cantripsKnownForClass(className, 10, subclassName),
      3,
      `${subclassName} should know 3 cantrips at level 10`
    )
    assert.equal(
      engine.spellsKnownForClass(className, 3, subclassName),
      3,
      `${subclassName} should know 3 spells at level 3`
    )
    assert.equal(
      engine.spellsKnownForClass(className, 20, subclassName),
      13,
      `${subclassName} should know 13 spells at level 20`
    )
  }
})

test('A Fighter with no subclass (or a non-caster subclass) still gets zero spell slots — third-caster support does not leak', () => {
  assert.deepEqual(engine.spellSlotsForClassAtLevel('Fighter', 5), [])
  assert.deepEqual(
    engine.spellSlotsForClassAtLevel('Fighter', 5, 'Battle Master'),
    []
  )
  assert.equal(engine.cantripsKnownForClass('Fighter', 5, 'Battle Master'), 0)
  assert.equal(engine.spellsKnownForClass('Fighter', 5, 'Battle Master'), null)
})

// Real bug caught while building this: resolveSpellcasting's fallback used
// to return the class's own { type: 'none' } object rather than null when a
// mundane subclass had no spellcasting of its own — a truthy object, unlike
// null. Every UI that gates a whole spellcasting section on
// `description.spellcasting` being truthy (NewCharacterTool.vue,
// LevelUpTool.vue) would have shown an empty "Cantrips: 0→0" spellcasting
// summary for every mundane subclass of every class, not just Fighter.
test('describeLevelUp: a mundane subclass (Champion) resolves spellcasting to exactly null, not a truthy {type:"none"} object', () => {
  const description = engine.describeLevelUp({
    className: 'Fighter',
    subclassName: 'Champion',
    fromLevel: 2,
    toLevel: 3,
    abilityModifierAtLevel: () => 0,
  })
  assert.equal(description.spellcasting, null)
})

test('describeLevelUp: Fighter 2->3 into Eldritch Knight produces real third-caster spellcasting, not null', () => {
  const description = engine.describeLevelUp({
    className: 'Fighter',
    subclassName: 'Eldritch Knight',
    fromLevel: 2,
    toLevel: 3,
    abilityModifierAtLevel: () => 3,
  })
  assert.ok(description.spellcasting, 'spellcasting should not be null')
  assert.equal(description.spellcasting.type, 'third')
  assert.equal(description.spellcasting.style, 'known')
  assert.deepEqual(description.spellcasting.slotsBefore, [])
  assert.deepEqual(description.spellcasting.slotsAfter, [2])
  assert.equal(description.spellcasting.cantripsAfter, 2)
  assert.equal(description.spellcasting.knownAfter, 3)
})

test('Multiclass caster-level contribution recognizes Eldritch Knight/Arcane Trickster (level/3, rounded down)', () => {
  assert.equal(
    engine.casterLevelContribution({
      name: 'Fighter',
      subclass: 'Eldritch Knight',
      level: 6,
    }),
    2
  )
  assert.equal(
    engine.casterLevelContribution({
      name: 'Rogue',
      subclass: 'Arcane Trickster',
      level: 3,
    }),
    1
  )
  // Below level 3, doesn't contribute yet — no spellcasting at all until 3.
  assert.equal(
    engine.casterLevelContribution({
      name: 'Fighter',
      subclass: 'Eldritch Knight',
      level: 2,
    }),
    0
  )
})

test('Every Eldritch Knight/Arcane Trickster feature name has a matching entry in published_features.json', () => {
  const publishedFeatures = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'src',
        'data',
        'published_features.json'
      ),
      'utf8'
    )
  )
  const byName = new Set(publishedFeatures.map((f) => f.name))
  for (const [className, subclassName] of [
    ['Fighter', 'Eldritch Knight'],
    ['Rogue', 'Arcane Trickster'],
  ]) {
    const sub = engine.loadSubclass(className, subclassName)
    assert.ok(sub, `${subclassName} should resolve`)
    for (const names of Object.values(sub.features_by_level)) {
      for (const name of names) {
        assert.ok(
          byName.has(name),
          `"${name}" (${subclassName}) should have a published_features.json entry`
        )
      }
    }
  }
})
