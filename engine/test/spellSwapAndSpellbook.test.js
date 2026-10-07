const test = require('node:test')
const assert = require('node:assert/strict')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')

// Two real PHB mechanics found missing entirely during a full Level Up tool
// audit (2026-09-06): (1) known-style casters (Bard/Sorcerer/Warlock/
// Ranger/Eldritch Knight/Arcane Trickster) can optionally replace one known
// spell every level-up, and (2) Wizards add 2 spells to their spellbook
// every level, independent of any known-spell cap. Neither had any code
// path before this — not even a documented "deliberate cut" the way
// Eldritch Invocation re-picking is.

function baseSorcerer(overrides = {}) {
  return {
    name: 'Test Sorcerer',
    level: 3,
    proficiency_bonus: 2,
    stat_str: 10,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 16,
    hp_max: 20,
    hp_current: 20,
    hit_dice_current: 3,
    features: [],
    spells: [
      { name: 'Fire Bolt', level: 0, prepared: true, type: 'cantrip' },
      { name: 'Magic Missile', level: 1, prepared: true, type: 'chosen' },
      { name: 'Shield', level: 1, prepared: true, type: 'chosen' },
    ],
    classes: [{ name: 'Sorcerer', subclass: 'Draconic Bloodline', level: 3 }],
    ...overrides,
  }
}

function baseWizard(overrides = {}) {
  return {
    name: 'Test Wizard',
    level: 2,
    proficiency_bonus: 2,
    stat_str: 8,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 16,
    stat_wis: 10,
    stat_cha: 10,
    hp_max: 14,
    hp_current: 14,
    hit_dice_current: 2,
    features: [],
    spells: [
      { name: 'Fire Bolt', level: 0, prepared: true, type: 'cantrip' },
      { name: 'Magic Missile', level: 1, prepared: true, type: 'chosen' },
    ],
    classes: [{ name: 'Wizard', subclass: 'Evocation', level: 2 }],
    ...overrides,
  }
}

// ── Known-spell swap ──────────────────────────────────────────────────

test('diffLevelUp: a known-style caster can optionally swap one known spell for another', () => {
  const character = baseSorcerer()
  const result = diffLevelUp(character, {
    className: 'Sorcerer',
    toLevel: 4,
    spellSwap: { from: 'Shield', to: 'Mirror Image' },
  })
  const names = result.patch.spells.map((s) => s.name)
  assert.ok(!names.includes('Shield'), 'the given-up spell should be gone')
  assert.ok(names.includes('Mirror Image'), 'the new spell should be added')
  assert.ok(
    names.includes('Magic Missile'),
    'spells not involved in the swap should be untouched'
  )
  assert.equal(result.warnings.length, 0)
})

test("diffLevelUp: a spell swap is entirely optional — omitting it doesn't block the level-up or touch spells", () => {
  const character = baseSorcerer()
  const result = diffLevelUp(character, { className: 'Sorcerer', toLevel: 4 })
  // Caster Prestidigitation lands in patch.features (spells_granted), not
  // patch.spells, so this Sorcerer fixture's spells stay untouched here.
  assert.equal(result.patch.spells, undefined)
  assert.ok(
    result.newFeatures.some((f) => f.name === 'Caster Prestidigitation')
  )
  assert.ok(
    !result.pendingChoices.some((p) => p.type === 'spellSwap'),
    'a swap must never be a pendingChoice — it is optional, not required'
  )
})

test("diffLevelUp: swapping a spell the character doesn't actually know is rejected with a clear warning, not silently applied", () => {
  const character = baseSorcerer()
  const result = diffLevelUp(character, {
    className: 'Sorcerer',
    toLevel: 4,
    spellSwap: { from: 'Fireball', to: 'Mirror Image' },
  })
  // Same Caster Prestidigitation note as the test above — the rejected
  // swap itself still touches nothing.
  assert.equal(result.patch.spells, undefined)
  assert.ok(
    result.warnings.some((w) => w.includes('Fireball') && w.includes("isn't"))
  )
})

test('diffLevelUp: a spell swap composes with a same-level new-known-spell pick (both apply, independently)', () => {
  const character = baseSorcerer()
  const result = diffLevelUp(character, {
    className: 'Sorcerer',
    toLevel: 4,
    spellSwap: { from: 'Shield', to: 'Mirror Image' },
    spellChoices: { spells: ['Scorching Ray'] },
  })
  const names = result.patch.spells.map((s) => s.name)
  assert.ok(!names.includes('Shield'))
  assert.ok(names.includes('Mirror Image'))
  assert.ok(names.includes('Scorching Ray'))
})

test('diffLevelUp: a prepared-style caster (no known-spell cap) is simply never offered a swap', () => {
  // Wizards don't get this PHB clause at all — real RAW gives it only to
  // known-style casters. Confirms the gating is on spellcasting.style, not
  // just "does this class cast spells."
  const character = baseWizard()
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 3,
    spellSwap: { from: 'Magic Missile', to: 'Web' },
  })
  const names = (result.patch.spells ?? []).map((s) => s.name)
  assert.ok(
    !names.includes('Web'),
    'a swap request should be a no-op for a prepared-style caster'
  )
  assert.ok(
    (result.patch.spells ?? character.spells).some(
      (s) => s.name === 'Magic Missile'
    ),
    'the "from" spell should NOT have been removed either, since no swap applies here'
  )
})

// ── Wizard spellbook growth ───────────────────────────────────────────

test('diffLevelUp: a Wizard gains a pendingChoice for 2 new spellbook spells when none are supplied', () => {
  const character = baseWizard()
  const result = diffLevelUp(character, { className: 'Wizard', toLevel: 3 })
  const choice = result.pendingChoices.find(
    (p) => p.type === 'spellbookAdditions'
  )
  assert.ok(choice, 'expected a spellbookAdditions pendingChoice')
  assert.equal(choice.count, 2)
  assert.equal(choice.level, 3)
})

test('diffLevelUp: supplying 2 spellbook picks resolves the choice and adds them as prepared:false', () => {
  const character = baseWizard()
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 3,
    spellbookChoices: ['Web', 'Mirror Image'],
  })
  assert.ok(!result.pendingChoices.some((p) => p.type === 'spellbookAdditions'))
  const added = result.patch.spells.filter((s) =>
    ['Web', 'Mirror Image'].includes(s.name)
  )
  assert.equal(added.length, 2)
  assert.ok(
    added.every((s) => s.prepared === false),
    'spellbook additions are not automatically prepared, unlike every other spell pick'
  )
})

test('diffLevelUp: a partial spellbook pick (only 1 of 2) leaves a pendingChoice for the remainder', () => {
  const character = baseWizard()
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 3,
    spellbookChoices: ['Web'],
  })
  const choice = result.pendingChoices.find(
    (p) => p.type === 'spellbookAdditions'
  )
  assert.ok(choice)
  assert.equal(choice.count, 1)
  assert.ok(result.patch.spells.some((s) => s.name === 'Web'))
})

test('diffLevelUp: Wizard spellbook growth scales with levels crossed (2 per level, not a flat 2)', () => {
  const character = baseWizard()
  const result = diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 4, // 2 -> 4, two levels crossed
    spellbookChoices: ['Web', 'Mirror Image', 'Misty Step', 'Suggestion'],
  })
  const added = result.patch.spells.filter((s) =>
    ['Web', 'Mirror Image', 'Misty Step', 'Suggestion'].includes(s.name)
  )
  assert.equal(added.length, 4)
  assert.ok(!result.pendingChoices.some((p) => p.type === 'spellbookAdditions'))
})

test('diffLevelUp: a non-Wizard class never gets a spellbookAdditions choice', () => {
  const character = baseSorcerer()
  const result = diffLevelUp(character, { className: 'Sorcerer', toLevel: 4 })
  assert.ok(!result.pendingChoices.some((p) => p.type === 'spellbookAdditions'))
})

// ── A Wizard's FIRST level: six spellbook spells, not two ───────────────

function newWizardShell(overrides = {}) {
  return {
    name: 'New Wizard',
    level: 0,
    stat_str: 8,
    stat_dex: 10,
    stat_con: 12,
    stat_int: 17,
    stat_wis: 13,
    stat_cha: 15,
    hp_max: 0,
    hp_current: 0,
    features: [],
    spells: [],
    classes: [{ name: 'Wizard', subclass: null, level: 0 }],
    ...overrides,
  }
}

const FIRST_LEVEL_SIX = [
  'Shield',
  'Magic Missile',
  'Mage Armor',
  'Sleep',
  'Detect Magic',
  'Find Familiar',
]

test('diffLevelUp: a brand-new Wizard is owed six 1st-level spellbook spells (PHB), not two', () => {
  const result = diffLevelUp(newWizardShell(), {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
  })
  const choice = result.pendingChoices.find((p) => p.type === 'spellbookAdditions')
  assert.ok(choice, 'expected a spellbookAdditions pendingChoice at creation')
  assert.equal(choice.count, 6)
  assert.equal(choice.level, 1)
})

test('diffLevelUp: a new Wizard prepares INT modifier + level spells (INT 17 -> 4)', () => {
  const result = diffLevelUp(newWizardShell(), {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(result.description.spellcasting.style, 'prepared')
  assert.equal(result.description.spellcasting.preparedAfter, 4)
  assert.equal(result.description.spellcasting.cantripsAfter, 3)
})

test('diffLevelUp: six supplied spellbook picks resolve the choice and land as unprepared spells', () => {
  const result = diffLevelUp(newWizardShell(), {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
    spellbookChoices: FIRST_LEVEL_SIX,
  })
  assert.ok(!result.pendingChoices.some((p) => p.type === 'spellbookAdditions'))
  const added = result.patch.spells.filter((s) => FIRST_LEVEL_SIX.includes(s.name))
  assert.equal(added.length, 6)
  assert.ok(added.every((s) => s.prepared === false && s.level === 1))
})

test('diffLevelUp: only the first six count — extra picks are ignored, and later levels go back to +2', () => {
  const six = diffLevelUp(newWizardShell(), {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
    spellbookChoices: [...FIRST_LEVEL_SIX, 'Burning Hands'],
  })
  assert.ok(!six.patch.spells.some((s) => s.name === 'Burning Hands'))
  const level2 = diffLevelUp(
    newWizardShell({ level: 1, classes: [{ name: 'Wizard', subclass: null, level: 1 }] }),
    { className: 'Wizard', toLevel: 2, hpMethod: 'average' }
  )
  assert.equal(
    level2.pendingChoices.find((p) => p.type === 'spellbookAdditions').count,
    2
  )
})

test('diffLevelUp: multiclassing INTO Wizard also starts the spellbook at six', () => {
  const fighter = newWizardShell({
    level: 3,
    hp_max: 28,
    hp_current: 28,
    classes: [{ name: 'Fighter', subclass: null, level: 3 }],
  })
  const result = diffLevelUp(fighter, {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
  })
  const choice = result.pendingChoices.find((p) => p.type === 'spellbookAdditions')
  assert.ok(choice)
  assert.equal(choice.count, 6)
})
