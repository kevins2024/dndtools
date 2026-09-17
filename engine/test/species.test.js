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

test('Every grants_resistance is a real damage type or the "ancestry" sentinel (Dragonborn)', () => {
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
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      if (!('grants_resistance' in trait)) continue
      assert.ok(
        trait.grants_resistance === 'ancestry' ||
          realDamageTypes.includes(trait.grants_resistance),
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

test("Dragonborn's ancestry_options has exactly the 10 real dragon types, each with a real damage type and breath shape/save", () => {
  const sp = loadSpecies('Dragonborn')
  const realDamageTypes = ['acid', 'cold', 'fire', 'lightning', 'poison']
  assert.equal(sp.ancestry_options.length, 10)
  const types = sp.ancestry_options.map((a) => a.type)
  assert.equal(new Set(types).size, 10, 'no duplicate dragon types')
  for (const a of sp.ancestry_options) {
    assert.ok(realDamageTypes.includes(a.damage_type))
    assert.ok(['dex', 'con'].includes(a.breath_save))
    assert.ok(/line|cone/.test(a.breath_shape))
  }
  // The Draconic Ancestry trait itself points at this table.
  const ancestryTrait = sp.traits.find((t) => t.name === 'Draconic Ancestry')
  assert.equal(ancestryTrait.choice.from, 'ancestry_options')
})

// listSpecies() only returns {name} — these tests need the FULL records
// (traits, ancestry_options, etc.), same as loadSpecies gives for one.
function listSpeciesFull() {
  return listSpecies().map((s) => loadSpecies(s.name))
}

// traitsFor() — the flattening helper diffLevelUp.js uses to apply a
// character's real species+subrace traits after creation (2026-09-10, see
// TODO.md's "Real racial/background mechanical data" entry).
test('traitsFor: species with no subrace returns just the base traits', () => {
  const traits = traitsFor('Gnome', null)
  assert.ok(traits.some((t) => t.name === 'Gnome Cunning'))
  assert.equal(traits.length, loadSpecies('Gnome').traits.length)
})

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

test('traitsFor: case-insensitive subrace match, and an unknown subrace just returns base traits', () => {
  const traits = traitsFor('Dwarf', 'hill dwarf')
  assert.ok(traits.some((t) => t.name === 'Dwarven Toughness'))

  const unknownSub = traitsFor('Dwarf', 'Not A Real Subrace')
  assert.ok(!unknownSub.some((t) => t.name === 'Dwarven Toughness'))
  assert.ok(unknownSub.some((t) => t.name === 'Dwarven Resilience'))
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

test('Every grants_saving_throw_advantage is a non-empty string, and covers every real RAW trait that grants one', () => {
  const bySpeciesTrait = {}
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      if (!('grants_saving_throw_advantage' in trait)) continue
      assert.equal(typeof trait.grants_saving_throw_advantage, 'string')
      assert.ok(trait.grants_saving_throw_advantage.trim().length > 0)
      bySpeciesTrait[`${sp.name}/${trait.name}`] =
        trait.grants_saving_throw_advantage
    }
  }
  assert.deepEqual(bySpeciesTrait, {
    'Elf/Fey Ancestry': 'being_charmed',
    'Half-Elf/Fey Ancestry': 'being_charmed',
    'Dwarf/Dwarven Resilience': 'poison',
    'Halfling/Brave': 'being_frightened',
    'Halfling/Stout Resilience': 'poison',
    'Gnome/Gnome Cunning': 'magic',
  })
})

test('Every grants_spells.tiered entry has a positive level greater than 1, a real spell name, and a uses string', () => {
  let found = 0
  for (const sp of listSpeciesFull()) {
    for (const trait of allTraits(sp)) {
      for (const tier of trait.grants_spells?.tiered ?? []) {
        found++
        assert.ok(
          tier.level > 1,
          `${trait.name}'s tier should be above 1st level`
        )
        assert.ok(tier.spell && tier.spell.trim().length > 0)
        assert.ok(tier.uses && tier.uses.trim().length > 0)
      }
    }
  }
  // Drow Magic (Faerie Fire, Darkness) + Infernal Legacy (Hellish Rebuke, Darkness)
  assert.equal(found, 4)
})
