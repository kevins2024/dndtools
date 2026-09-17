const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')
const invocations = require('../data/5e/invocations.json')
const pactBoons = require('../data/5e/pact-boons.json')
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
const publishedFeatures = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'published_features.json'
))

const INVOCATION_NAMES = Object.keys(invocations).filter(
  (k) => !k.startsWith('_')
)
const PACT_BOON_NAMES = Object.keys(pactBoons).filter((k) => !k.startsWith('_'))
const srdById = new Map(srdFeatures.map((f) => [f.index, f]))
const REAL_INVOCATION_LEVELS = new Set([2, 5, 7, 9, 12, 15, 18])

test('invocations.json has all 32 real PHB Eldritch Invocations (SCAG-only Eldritch Smite/Tomb of Levistus deliberately excluded)', () => {
  assert.equal(INVOCATION_NAMES.length, 32)
})

test('every invocation id resolves to itself in feature-catalog.json AND to a real SRD cache entry with matching name', () => {
  for (const name of INVOCATION_NAMES) {
    const inv = invocations[name]
    assert.equal(
      featureCatalog[inv.id],
      `Eldritch Invocation: ${name}`,
      `${name}: feature-catalog.json id "${inv.id}" mismatch`
    )
    const srd = srdById.get(inv.id)
    assert.ok(srd, `${name}: no SRD cache entry for id "${inv.id}"`)
    assert.equal(srd.name, `Eldritch Invocation: ${name}`)
  }
})

test('every invocation (except the 3 that predate this pass) has a matching published_features.json category:"warlock_invocation" entry', () => {
  const pfNames = new Set(
    publishedFeatures
      .filter((e) => e.category === 'warlock_invocation')
      .map((e) => e.name)
  )
  // Thirsting Blade predates the category convention (an older type:"feature"
  // entry, added ad hoc for a real character before this pass) — still
  // resolves fine via lookupFeature's id-based SRD lookup, just doesn't use
  // the category tag other invocations added this pass do.
  const missing = INVOCATION_NAMES.filter(
    (n) => !pfNames.has(n) && n !== 'Thirsting Blade'
  )
  assert.deepEqual(missing, [])
})

test('every invocation prerequisite referencing a level names a real Invocations Known breakpoint level', () => {
  function collectLevels(prereq) {
    if (!prereq) return []
    if (prereq.type === 'level') return [prereq.level]
    if (prereq.type === 'all_of') return prereq.all.flatMap(collectLevels)
    return []
  }
  for (const name of INVOCATION_NAMES) {
    for (const level of collectLevels(invocations[name].prerequisite)) {
      assert.ok(
        REAL_INVOCATION_LEVELS.has(level),
        `${name}: level ${level} isn't one of [2,5,7,9,12,15,18]`
      )
    }
  }
})

test('every invocation prerequisite referencing a feature names a real Pact Boon option', () => {
  function collectFeatures(prereq) {
    if (!prereq) return []
    if (prereq.type === 'feature') return [prereq.feature]
    if (prereq.type === 'all_of') return prereq.all.flatMap(collectFeatures)
    return []
  }
  for (const name of INVOCATION_NAMES) {
    for (const feature of collectFeatures(invocations[name].prerequisite)) {
      assert.ok(
        PACT_BOON_NAMES.includes(feature),
        `${name}: references unknown feature "${feature}"`
      )
    }
  }
})

test('invocationsKnownForLevel matches the verified 5thsrd.org breakpoint table', () => {
  const expected = {
    1: 0,
    2: 2,
    4: 2,
    5: 3,
    6: 3,
    7: 4,
    8: 4,
    9: 5,
    11: 5,
    12: 6,
    14: 6,
    15: 7,
    17: 7,
    18: 8,
    20: 8,
  }
  for (const [level, count] of Object.entries(expected)) {
    assert.equal(
      engine.invocationsKnownForLevel(Number(level)),
      count,
      `level ${level}`
    )
  }
})

test('pact-boons.json has exactly the 3 real options, each id-resolvable', () => {
  assert.deepEqual(PACT_BOON_NAMES.sort(), [
    'Pact of the Blade',
    'Pact of the Chain',
    'Pact of the Tome',
  ])
  for (const name of PACT_BOON_NAMES) {
    const boon = pactBoons[name]
    assert.equal(featureCatalog[boon.id], name)
    assert.ok(srdById.has(boon.id))
  }
  assert.deepEqual(pactBoons['Pact of the Tome'].grants_cantrips, {
    count: 3,
    pool: 'any',
  })
})

test('meetsInvocationPrerequisite: Agonizing Blast requires the Eldritch Blast cantrip specifically', () => {
  const noBlast = { classes: [{ name: 'Warlock', level: 2 }], spells: [] }
  const withBlast = {
    classes: [{ name: 'Warlock', level: 2 }],
    spells: [{ name: 'Eldritch Blast', level: 0 }],
  }
  assert.equal(
    engine.meetsInvocationPrerequisite(noBlast, 'Agonizing Blast').met,
    false
  )
  assert.equal(
    engine.meetsInvocationPrerequisite(withBlast, 'Agonizing Blast').met,
    true
  )
})

test('meetsInvocationPrerequisite: Thirsting Blade needs BOTH level 5 and Pact of the Blade (all_of)', () => {
  const levelOnly = { classes: [{ name: 'Warlock', level: 5 }], features: [] }
  const boonOnly = {
    classes: [{ name: 'Warlock', level: 2 }],
    features: [{ name: 'Pact of the Blade', type: 'pactBoon' }],
  }
  const both = {
    classes: [{ name: 'Warlock', level: 5 }],
    features: [{ name: 'Pact of the Blade', type: 'pactBoon' }],
  }
  assert.equal(
    engine.meetsInvocationPrerequisite(levelOnly, 'Thirsting Blade').met,
    false
  )
  assert.equal(
    engine.meetsInvocationPrerequisite(boonOnly, 'Thirsting Blade').met,
    false
  )
  assert.equal(
    engine.meetsInvocationPrerequisite(both, 'Thirsting Blade').met,
    true
  )
})

function baseWarlock(level, extra = {}) {
  return {
    name: 'Test Warlock',
    race: 'Human',
    level,
    classes: [{ name: 'Warlock', level, subclass: 'Great Old One' }],
    stat_str: 10,
    stat_dex: 14,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 16,
    spellcasting_ability: 'cha',
    hp_max: 10,
    hp_current: 10,
    hit_dice_current: level,
    features: [],
    spells: [],
    ...extra,
  }
}

test('diffLevelUp: Warlock 1->2 owes exactly 2 invocation picks, and applies up to (not beyond) what was submitted', () => {
  const character = baseWarlock(1)
  const under = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 2,
    hpMethod: 'average',
    invocationChoices: ['Agonizing Blast'],
  })
  assert.deepEqual(
    under.pendingChoices.find((p) => p.type === 'invocationChoice'),
    { type: 'invocationChoice', count: 1, level: 2 }
  )
  assert.deepEqual(
    under.patch.features
      .filter((f) => f.type === 'invocation')
      .map((f) => f.name),
    ['Agonizing Blast']
  )

  const full = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 2,
    hpMethod: 'average',
    invocationChoices: [
      'Agonizing Blast',
      "Devil's Sight",
      'Mask of Many Faces',
    ],
  })
  assert.equal(
    full.pendingChoices.find((p) => p.type === 'invocationChoice'),
    undefined
  )
  assert.deepEqual(
    full.patch.features
      .filter((f) => f.type === 'invocation')
      .map((f) => f.name),
    ['Agonizing Blast', "Devil's Sight"] // 3rd submitted is ignored — only 2 owed
  )
})

test('diffLevelUp: an invocation already known is never re-counted or re-offered', () => {
  const character = baseWarlock(4, {
    features: [
      { name: 'Agonizing Blast', type: 'invocation', level_gained: 2 },
      { name: "Devil's Sight", type: 'invocation', level_gained: 2 },
    ],
  })
  // Level 4->5 is where the count grows from 2 to 3 (one new pick owed).
  const result = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 5,
    hpMethod: 'average',
    invocationChoices: ['Agonizing Blast', 'Eldritch Sight'], // first is a dup
  })
  assert.deepEqual(
    result.newFeatures
      .filter((f) => f.type === 'invocation')
      .map((f) => f.name),
    ['Eldritch Sight']
  )
})

test('diffLevelUp: Warlock 2->3 owes a Pact Boon choice; resolving it records a pactBoon feature', () => {
  const character = baseWarlock(2)
  const unresolved = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 3,
    hpMethod: 'average',
  })
  assert.deepEqual(
    unresolved.pendingChoices.find((p) => p.type === 'pactBoonChoice'),
    { type: 'pactBoonChoice', level: 3 }
  )

  const resolved = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 3,
    hpMethod: 'average',
    pactBoonChoice: 'Pact of the Blade',
  })
  assert.equal(
    resolved.pendingChoices.find((p) => p.type === 'pactBoonChoice'),
    undefined
  )
  const boon = resolved.patch.features.find((f) => f.type === 'pactBoon')
  assert.equal(boon.name, 'Pact of the Blade')
  assert.equal(boon.id, 'pact-of-the-blade')
})

test('diffLevelUp: Pact Boon is a strict one-time pick — already having one means no pendingChoice ever again', () => {
  const character = baseWarlock(5, {
    features: [
      { name: 'Pact of the Chain', type: 'pactBoon', level_gained: 3 },
    ],
  })
  const result = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 6,
    hpMethod: 'average',
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'pactBoonChoice'),
    undefined
  )
})

test('diffLevelUp: choosing Pact of the Tome owes 3 bonus cantrips from ANY class list, written featureGranted+_source', () => {
  const character = baseWarlock(2)
  const unresolved = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 3,
    hpMethod: 'average',
    pactBoonChoice: 'Pact of the Tome',
  })
  assert.deepEqual(
    unresolved.pendingChoices.find((p) => p.type === 'bonusSpellChoice'),
    {
      type: 'bonusSpellChoice',
      count: 3,
      level: 3,
      source: 'Pact of the Tome',
      pool: 'any',
      cantripsOnly: true,
    }
  )

  const resolved = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 3,
    hpMethod: 'average',
    pactBoonChoice: 'Pact of the Tome',
    pactBoonBonusSpells: ['Prestidigitation', 'Minor Illusion', 'Guidance'],
  })
  const tomeCantrips = resolved.patch.spells.filter(
    (s) => s._source === 'Pact of the Tome'
  )
  assert.equal(tomeCantrips.length, 3)
  assert.ok(
    tomeCantrips.every((s) => s.featureGranted === true && s.level === 0)
  )
})

test('diffLevelUp: a generic newCantrips pendingChoice fires for ANY spellcasting class, not just Warlock (Cleric 3->4)', () => {
  const character = {
    name: 'Test Cleric',
    race: 'Human',
    level: 3,
    classes: [{ name: 'Cleric', level: 3, subclass: 'Life Domain' }],
    stat_str: 10,
    stat_dex: 10,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 16,
    stat_cha: 10,
    spellcasting_ability: 'wis',
    hp_max: 24,
    hp_current: 24,
    hit_dice_current: 3,
    features: [],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Cleric',
    toLevel: 4,
    hpMethod: 'average',
    spellChoices: { cantrips: ['Guidance'] },
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'newCantrips'),
    undefined
  )
  const written = result.patch.spells.find((s) => s.name === 'Guidance')
  assert.ok(written)
  assert.equal(written.level, 0)
  assert.equal(written.featureGranted, undefined) // a normal known pick, not feature-granted
})

test('diffLevelUp: a resolved newKnownSpells pick writes the real spell level looked up from the catalog', () => {
  const character = baseWarlock(1, {
    spells: [
      { name: 'Eldritch Blast', level: 0, prepared: true, type: 'chosen' },
    ],
  })
  const result = engine.diffLevelUp(character, {
    className: 'Warlock',
    toLevel: 2,
    hpMethod: 'average',
    spellChoices: { spells: ['Armor of Agathys'] },
  })
  const written = result.patch.spells.find((s) => s.name === 'Armor of Agathys')
  assert.ok(written)
  assert.equal(written.level, 1)
  assert.equal(written.type, 'chosen')
})

test('listSpellsForClass: class pool filters correctly, cantripsOnly separates the pool, pool:"any" widens it', () => {
  const warlockCantrips = engine.listSpellsForClass('Warlock', {
    cantripsOnly: true,
  })
  assert.ok(warlockCantrips.every((s) => s.level === 0))
  assert.ok(warlockCantrips.some((s) => s.name === 'Eldritch Blast'))
  assert.ok(!warlockCantrips.some((s) => s.name === 'Guidance')) // Cleric-only cantrip

  const anyCantrips = engine.listSpellsForClass('Warlock', {
    cantripsOnly: true,
    pool: 'any',
  })
  assert.ok(anyCantrips.some((s) => s.name === 'Guidance'))

  const leveled = engine.listSpellsForClass('Warlock', { maxLevel: 1 })
  assert.ok(leveled.every((s) => s.level >= 1 && s.level <= 1))
})

test('listSpellsForClass: excludeNames leaves out already-known spells', () => {
  const withHex = engine.listSpellsForClass('Warlock', { maxLevel: 1 })
  const withoutArmor = engine.listSpellsForClass('Warlock', {
    maxLevel: 1,
    excludeNames: ['Armor of Agathys'],
  })
  assert.ok(withHex.some((s) => s.name === 'Armor of Agathys'))
  assert.ok(!withoutArmor.some((s) => s.name === 'Armor of Agathys'))
})

test('effectiveMaxSpellLevel: Warlock uses pact slot level, not normal slot progression', () => {
  // Level 5 Warlock: pact_magic table says slot_level 3 (2 slots) — a normal
  // full-caster table would say something different entirely (irrelevant,
  // pact casters never use it).
  assert.equal(
    engine.effectiveMaxSpellLevel({ className: 'Warlock', level: 5 }),
    3
  )
})

test('effectiveMaxSpellLevel: a prepared full caster (Cleric) matches its own slot table', () => {
  assert.equal(
    engine.effectiveMaxSpellLevel({ className: 'Cleric', level: 3 }),
    2
  )
  assert.equal(
    engine.effectiveMaxSpellLevel({ className: 'Cleric', level: 1 }),
    1
  )
})
