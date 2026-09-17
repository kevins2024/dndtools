const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')
const fightingStyles = require('../data/5e/fighting-styles.json')
const featureCatalog = require('../data/5e/feature-catalog.json')
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

test("fighting-styles.json has the real per-class option counts (Fighter 11, Paladin 7, Ranger 8) — 6/4/4 PHB-only plus Tasha's Cauldron's 7 additions, split unevenly since 2 of the 7 (Blessed Warrior, Druidic Warrior) are single-class-exclusive (2026-09-17)", () => {
  assert.equal(classStyles('Fighter').length, 11)
  assert.equal(classStyles('Paladin').length, 7)
  assert.equal(classStyles('Ranger').length, 8)
})

const publishedById = new Map(
  require('../../src/data/published_features.json').map((f) => [f.id, f])
)

test("every fighting-style id resolves to itself in feature-catalog.json AND to a real backing entry (SRD cache for PHB styles, published_features.json for Tasha's Cauldron ones) with matching name", () => {
  for (const className of ['Fighter', 'Paladin', 'Ranger']) {
    for (const style of classStyles(className)) {
      assert.equal(
        featureCatalog[style.id],
        `Fighting Style: ${style.name}`,
        `${className}'s ${style.name} id "${style.id}" should resolve to its display name in feature-catalog.json`
      )
      if (style.source === "Player's Handbook") {
        const srd = srdById.get(style.id)
        assert.ok(srd, `${style.id} should exist in the SRD feature cache`)
        assert.equal(srd.name, `Fighting Style: ${style.name}`)
      } else {
        // Tasha's Cauldron of Everything isn't SRD content — these live in
        // published_features.json instead (see fighting-styles.json's own
        // _schema.tce_additions note).
        const pub = publishedById.get(style.id)
        assert.ok(pub, `${style.id} should exist in published_features.json`)
        assert.equal(pub.name, `Fighting Style: ${style.name}`)
      }
    }
  }
})

test('diffLevelUp: Fighter 1st level with no fightingStyleChoice surfaces a pendingChoice with all 11 real options', () => {
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
        'Blind Fighting',
        'Interception',
        'Superior Technique',
        'Thrown Weapon Fighting',
        'Unarmed Fighting',
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

test("diffLevelUp: Paladin's 2nd-level Fighting Style only offers Paladin's real 7 options (no Archery/Two-Weapon Fighting/Superior Technique/Druidic Warrior)", () => {
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
      options: [
        'Defense',
        'Dueling',
        'Great Weapon Fighting',
        'Protection',
        'Blind Fighting',
        'Interception',
        'Blessed Warrior',
      ],
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

test("diffLevelUp: multiclassing Ranger (already has a Fighting Style) into Fighter still surfaces Fighter's OWN Fighting Style choice — real bug found 2026-09-16", () => {
  const character = {
    classes: [{ name: 'Ranger', level: 2 }],
    features: [
      {
        name: 'Fighting Style: Two-Weapon Fighting',
        id: 'ranger-fighting-style-two-weapon-fighting',
        type: 'fightingStyle',
        level_gained: 2,
        _source: 'Ranger',
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'fightingStyleChoice'),
    {
      type: 'fightingStyleChoice',
      level: 1,
      // Two-Weapon Fighting is excluded — already known from Ranger, see
      // the dedicated "options exclude a style already known" test below.
      options: [
        'Archery',
        'Defense',
        'Dueling',
        'Great Weapon Fighting',
        'Protection',
        'Blind Fighting',
        'Interception',
        'Superior Technique',
        'Thrown Weapon Fighting',
        'Unarmed Fighting',
      ],
    }
  )
})

test("diffLevelUp: Fighter's Fighting Style options exclude a style already known from Ranger — real bug found 2026-09-16, same day as the multiclass-suppression fix", () => {
  const character = {
    classes: [{ name: 'Ranger', level: 2 }],
    features: [
      {
        name: 'Fighting Style: Archery',
        id: 'ranger-fighting-style-archery',
        type: 'fightingStyle',
        level_gained: 2,
        _source: 'Ranger',
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
  })
  const choice = result.pendingChoices.find(
    (p) => p.type === 'fightingStyleChoice'
  )
  assert.deepEqual(choice.options, [
    'Defense',
    'Dueling',
    'Great Weapon Fighting',
    'Protection',
    'Two-Weapon Fighting',
    'Blind Fighting',
    'Interception',
    'Superior Technique',
    'Thrown Weapon Fighting',
    'Unarmed Fighting',
  ])
  assert.ok(!choice.options.includes('Archery'))
})

test('diffLevelUp: re-picking an already-known style anyway (bypassing the filtered options) still applies it, with a RAW-violation note', () => {
  const character = {
    classes: [{ name: 'Ranger', level: 2 }],
    features: [
      {
        name: 'Fighting Style: Archery',
        id: 'ranger-fighting-style-archery',
        type: 'fightingStyle',
        level_gained: 2,
        _source: 'Ranger',
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    fightingStyleChoice: 'Archery',
  })
  const fighterStyle = result.newFeatures.find(
    (f) => f.type === 'fightingStyle' && f._source === 'Fighter'
  )
  assert.equal(fighterStyle.name, 'Fighting Style: Archery')
  assert.ok(
    result.warnings.some(
      (w) => w.includes('Archery') && w.includes('already known')
    )
  )
})

test("diffLevelUp: choosing Fighter's own Fighting Style after a Ranger pick already exists produces a SECOND, separate feature entry, not a no-op", () => {
  const character = {
    classes: [{ name: 'Ranger', level: 2 }],
    features: [
      {
        name: 'Fighting Style: Archery',
        id: 'ranger-fighting-style-archery',
        type: 'fightingStyle',
        level_gained: 2,
        _source: 'Ranger',
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 1,
    fightingStyleChoice: 'Dueling',
  })
  const fighterStyle = result.newFeatures.find(
    (f) => f.type === 'fightingStyle' && f._source === 'Fighter'
  )
  assert.equal(fighterStyle.name, 'Fighting Style: Dueling')
  assert.equal(fighterStyle.id, 'fighter-fighting-style-dueling')
})

test('diffLevelUp: leveling Fighter past 1st (already has ITS OWN Fighting Style) does not re-prompt', () => {
  const character = {
    classes: [{ name: 'Fighter', level: 1 }],
    features: [
      {
        name: 'Fighting Style: Dueling',
        id: 'fighter-fighting-style-dueling',
        type: 'fightingStyle',
        level_gained: 1,
        _source: 'Fighter',
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
