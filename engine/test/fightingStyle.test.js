const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')
const fightingStyles = require('../data/fighting-styles.json')
const featureCatalog = require('../data/feature-catalog.json')
const srdFeatures = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'api_data_cache',
  'features.json'
))

const srdById = new Map(srdFeatures.map((f) => [f.index, f]))

function classStyles(name) {
  return Object.entries(fightingStyles[name]).map(([styleName, data]) => ({
    name: styleName,
    ...data,
  }))
}

test('fighting-styles.json has the real per-class option counts (Fighter 6, Paladin 4, Ranger 4)', () => {
  assert.equal(classStyles('Fighter').length, 6)
  assert.equal(classStyles('Paladin').length, 4)
  assert.equal(classStyles('Ranger').length, 4)
})

test('every fighting-style id resolves to itself in feature-catalog.json AND to a real SRD cache entry with matching name', () => {
  for (const className of ['Fighter', 'Paladin', 'Ranger']) {
    for (const style of classStyles(className)) {
      assert.equal(
        featureCatalog[style.id],
        `Fighting Style: ${style.name}`,
        `${className}'s ${style.name} id "${style.id}" should resolve to its display name in feature-catalog.json`
      )
      const srd = srdById.get(style.id)
      assert.ok(srd, `${style.id} should exist in the SRD feature cache`)
      assert.equal(srd.name, `Fighting Style: ${style.name}`)
    }
  }
})

test('diffLevelUp: Fighter 1st level with no fightingStyleChoice surfaces a pendingChoice with all 6 real options', () => {
  const character = { classes: [], features: [], spells: [] }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'fightingStyleChoice'),
    {
      type: 'fightingStyleChoice',
      level: 1,
      options: [
        'Archery',
        'Defense',
        'Dueling',
        'Great Weapon Fighting',
        'Protection',
        'Two-Weapon Fighting',
      ],
    }
  )
  // The generic "Fighting Style" name is still surfaced as a feature even
  // while unresolved — it isn't hidden, just not yet a specific pick.
  assert.ok(result.newFeatures.some((f) => f.name === 'Fighting Style'))
})

test('diffLevelUp: choosing a Fighting Style resolves the generic entry into the specific one and clears the pendingChoice', () => {
  const character = { classes: [], features: [], spells: [] }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    fightingStyleChoice: 'Two-Weapon Fighting',
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'fightingStyleChoice'),
    undefined
  )
  const style = result.newFeatures.find((f) => f.type === 'fightingStyle')
  assert.equal(style.name, 'Fighting Style: Two-Weapon Fighting')
  assert.equal(style.id, 'fighter-fighting-style-two-weapon-fighting')
  // Only one "Fighting Style"-named entry should remain — the generic one
  // gets replaced in place, not duplicated alongside the resolved pick.
  assert.equal(
    result.newFeatures.filter((f) => f.name.startsWith('Fighting Style'))
      .length,
    1
  )
})

test("diffLevelUp: Paladin's 2nd-level Fighting Style only offers Paladin's real 4 options (no Archery/Two-Weapon Fighting)", () => {
  const character = {
    classes: [{ name: 'Paladin', level: 1 }],
    features: [],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Paladin',
    toLevel: 2,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'fightingStyleChoice'),
    {
      type: 'fightingStyleChoice',
      level: 2,
      options: ['Defense', 'Dueling', 'Great Weapon Fighting', 'Protection'],
    }
  )
})

test("diffLevelUp: Ranger's 2nd-level Fighting Style pick resolves to ranger-prefixed ids, not Fighter's", () => {
  const character = {
    classes: [{ name: 'Ranger', level: 1 }],
    features: [],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 2,
    fightingStyleChoice: 'Archery',
  })
  const style = result.newFeatures.find((f) => f.type === 'fightingStyle')
  assert.equal(style.id, 'ranger-fighting-style-archery')
})

test('diffLevelUp: Fighting Style is a strict one-time pick — already having one means no pendingChoice ever again', () => {
  const character = {
    classes: [{ name: 'Fighter', level: 1 }],
    features: [
      {
        name: 'Fighting Style: Dueling',
        type: 'fightingStyle',
        level_gained: 1,
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 2,
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'fightingStyleChoice'),
    undefined
  )
})

test('diffLevelUp: an unrecognized Fighting Style name is still recorded (with a note), not blocked', () => {
  const character = { classes: [], features: [], spells: [] }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    fightingStyleChoice: 'Made-Up Style',
  })
  const style = result.newFeatures.find((f) => f.type === 'fightingStyle')
  assert.equal(style.name, 'Made-Up Style')
  assert.equal(style.id, null)
  assert.ok(result.warnings.some((w) => w.includes('Made-Up Style')))
})
