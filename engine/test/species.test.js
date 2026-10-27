const test = require('node:test')
const assert = require('node:assert/strict')
const {
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
  traitsFor,
} = require('../rules/5e/species')

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

// Real mechanical wiring (2026-09-07) — species traits previously carried
// only display text (name/description), with no structured field a caller
// could actually apply. See TODO.md/CHECKLIST.md for the full writeup;
// these tests just guard the new fields' shapes, not NewCharacterTool.vue's
// own consumption of them (that's Vue-side, no test runner exists for it
// per CLAUDE.md).

function allTraits(sp) {
  return [
    ...(sp.traits ?? []),
    ...(sp.subraces ?? []).flatMap((sub) => sub.traits ?? []),
  ]
}

test('Every grants_weapon_proficiency/grants_armor_proficiency/grants_tool_proficiency is a non-empty array of strings', () => {
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      for (const field of [
        'grants_weapon_proficiency',
        'grants_armor_proficiency',
        'grants_tool_proficiency',
      ]) {
        if (!(field in trait)) continue
        assert.ok(
          Array.isArray(trait[field]) && trait[field].length > 0,
          `${sp.name}/"${trait.name}"'s ${field} should be a non-empty array`
        )
        for (const v of trait[field]) {
          assert.equal(
            typeof v,
            'string',
            `${sp.name}/"${trait.name}"'s ${field} should contain only strings`
          )
        }
      }
    }
  }
})

test('Every grants_skill_proficiency is a lowercase skill id, and every _choice variant has a positive count', () => {
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      if ('grants_skill_proficiency' in trait) {
        assert.equal(
          trait.grants_skill_proficiency,
          trait.grants_skill_proficiency.toLowerCase(),
          `${sp.name}/"${trait.name}"'s grants_skill_proficiency should be a lowercase id`
        )
      }
      if ('grants_skill_proficiency_choice' in trait) {
        assert.ok(trait.grants_skill_proficiency_choice.count > 0)
      }
      if ('grants_tool_proficiency_choice' in trait) {
        const c = trait.grants_tool_proficiency_choice
        assert.ok(c.count > 0)
        assert.ok(Array.isArray(c.options) && c.options.length > 0)
      }
    }
  }
})

test('Every grants_resistance is a real damage type (or array of them) or the "ancestry" sentinel (Dragonborn)', () => {
  const realDamageTypes = [
    'acid',
    'bludgeoning',
    'cold',
    'fire',
    'force',
    'lightning',
    'necrotic',
    'piercing',
    'poison',
    'psychic',
    'radiant',
    'slashing',
    'thunder',
  ]
  // Most traits grant one resistance (a bare string); a trait that grants more
  // than one (Aasimar's Celestial Resistance: necrotic AND radiant) uses an
  // array instead — checked the same way either shape.
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      if (!('grants_resistance' in trait)) continue
      const values = Array.isArray(trait.grants_resistance)
        ? trait.grants_resistance
        : [trait.grants_resistance]
      for (const v of values)
        assert.ok(
          v === 'ancestry' || realDamageTypes.includes(v),
          `${sp.name}/"${trait.name}"'s grants_resistance ("${trait.grants_resistance}") should be a real damage type or "ancestry"`
        )
    }
  }
})

test('Every grants_spells has either fixed or choice (never neither), and a real ability', () => {
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      if (!('grants_spells' in trait)) continue
      const g = trait.grants_spells
      assert.ok(
        (g.fixed && g.fixed.length) || g.choice,
        `${sp.name}/"${trait.name}"'s grants_spells needs fixed or choice`
      )
      assert.ok(
        abilities.includes(g.ability),
        `${sp.name}/"${trait.name}"'s grants_spells.ability should be a real ability`
      )
    }
  }
})

// listSpecies() only returns {name} — these tests need the FULL records
// (traits, ancestry_options, etc.), same as loadSpecies gives for one.
function listSpeciesFull() {
  return listSpecies().map((s) => loadSpecies(s.name))
}

test('traitsFor: species + subrace returns base traits AND the subrace traits combined', () => {
  const traits = traitsFor('Dwarf', 'Hill Dwarf')
  const names = traits.map((t) => t.name)
  assert.ok(names.includes('Dwarven Resilience'), 'base Dwarf trait present')
  assert.ok(names.includes('Dwarven Toughness'), 'Hill Dwarf trait present')
  assert.ok(
    !names.includes('Dwarven Armor Training'),
    "Mountain Dwarf's trait should NOT leak into a Hill Dwarf's list"
  )
})

test('traitsFor: unknown species returns an empty array, not a crash', () => {
  assert.deepEqual(traitsFor('Catrin', null), [])
})

// Real mechanical wiring, 2026-09-10 — the three gaps this app's own
// TODO.md flagged as "deliberately not built" when species mechanics were
// first wired up 2026-09-07: flat HP-per-level (Dwarven Toughness),
// advantage-on-saves (Fey Ancestry/Brave/Gnome Cunning/Dwarven & Stout
// Resilience), and Drow Magic/Infernal Legacy's 3rd/5th-level tiered
// spells. These tests guard the DATA shape; engine/test/
// speciesLevelUpMechanics.test.js covers diffLevelUp.js actually applying it.

test("grants_hp_per_level only appears on Hill Dwarf's Dwarven Toughness, and is a positive number", () => {
  let found = 0
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      if (!('grants_hp_per_level' in trait)) continue
      found++
      assert.equal(sp.name, 'Dwarf')
      assert.equal(trait.name, 'Dwarven Toughness')
      assert.ok(trait.grants_hp_per_level > 0)
    }
  }
  assert.equal(found, 1)
})
