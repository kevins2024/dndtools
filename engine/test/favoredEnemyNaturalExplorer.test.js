const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')
const favoredEnemies = require('../data/5e/favored-enemies.json')
const naturalExplorerTerrains = require('../data/5e/natural-explorer-terrains.json')

test('favored-enemies.json has the real 13 RAW types plus the humanoid-races escape hatch', () => {
  assert.equal(favoredEnemies.options.length, 14)
  assert.ok(favoredEnemies.options.includes('Undead'))
  assert.ok(favoredEnemies.options.includes('Two humanoid races (specify)'))
})

test('natural-explorer-terrains.json has exactly the real 7 RAW terrains (no Underdark)', () => {
  assert.deepEqual(naturalExplorerTerrains.options, [
    'Arctic',
    'Coast',
    'Desert',
    'Forest',
    'Grassland',
    'Mountain',
    'Swamp',
  ])
})

test('diffLevelUp: Ranger 1st level with no choices surfaces both pendingChoices with the real option lists', () => {
  const character = { classes: [], features: [], spells: [] }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 1,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'favoredEnemyChoice'),
    { type: 'favoredEnemyChoice', level: 1, options: favoredEnemies.options }
  )
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'naturalExplorerChoice'),
    {
      type: 'naturalExplorerChoice',
      level: 1,
      options: naturalExplorerTerrains.options,
    }
  )
  // The generic names are still surfaced as features even while unresolved.
  assert.ok(result.newFeatures.some((f) => f.name === 'Favored Enemy'))
  assert.ok(result.newFeatures.some((f) => f.name === 'Natural Explorer'))
})

test('diffLevelUp: choosing both at 1st level resolves the generic entries and clears both pendingChoices', () => {
  const character = { classes: [], features: [], spells: [] }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 1,
    favoredEnemyChoice: 'Undead',
    naturalExplorerChoice: 'Forest',
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'favoredEnemyChoice'),
    undefined
  )
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'naturalExplorerChoice'),
    undefined
  )
  const fe = result.newFeatures.find((f) => f.type === 'favoredEnemy')
  assert.equal(fe.name, 'Favored Enemy: Undead')
  assert.equal(fe.level_gained, 1)
  const ne = result.newFeatures.find((f) => f.type === 'naturalExplorer')
  assert.equal(ne.name, 'Natural Explorer: Forest')
  assert.equal(ne.level_gained, 1)
})

test('diffLevelUp: Ranger 5->6 surfaces a FRESH favoredEnemyChoice/naturalExplorerChoice for the improvement grants, not blocked by the 1st-level picks already on record', () => {
  const character = {
    classes: [{ name: 'Ranger', level: 5 }],
    features: [
      { name: 'Favored Enemy: Undead', type: 'favoredEnemy', level_gained: 1 },
      {
        name: 'Natural Explorer: Forest',
        type: 'naturalExplorer',
        level_gained: 1,
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 6,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'favoredEnemyChoice'),
    { type: 'favoredEnemyChoice', level: 6, options: favoredEnemies.options }
  )
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'naturalExplorerChoice'),
    {
      type: 'naturalExplorerChoice',
      level: 6,
      options: naturalExplorerTerrains.options,
    }
  )
})

test('diffLevelUp: Ranger 5->6 choosing the improvement values produces a SECOND, distinct feature entry rather than overwriting the 1st-level one', () => {
  const character = {
    classes: [{ name: 'Ranger', level: 5 }],
    features: [
      { name: 'Favored Enemy: Undead', type: 'favoredEnemy', level_gained: 1 },
      {
        name: 'Natural Explorer: Forest',
        type: 'naturalExplorer',
        level_gained: 1,
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 6,
    favoredEnemyChoice: 'Fiends',
    naturalExplorerChoice: 'Mountain',
  })
  const fe = result.newFeatures.find((f) => f.type === 'favoredEnemy')
  assert.equal(fe.name, 'Favored Enemy: Fiends')
  assert.equal(fe.level_gained, 6)
  const ne = result.newFeatures.find((f) => f.type === 'naturalExplorer')
  assert.equal(ne.name, 'Natural Explorer: Mountain')
  assert.equal(ne.level_gained, 6)
})

test('diffLevelUp: Ranger 13->14 only surfaces favoredEnemyChoice (not naturalExplorerChoice, which has no grant at 14)', () => {
  const character = {
    classes: [{ name: 'Ranger', level: 13 }],
    features: [
      { name: 'Favored Enemy: Undead', type: 'favoredEnemy', level_gained: 1 },
      { name: 'Favored Enemy: Fiends', type: 'favoredEnemy', level_gained: 6 },
      {
        name: 'Natural Explorer: Forest',
        type: 'naturalExplorer',
        level_gained: 1,
      },
      {
        name: 'Natural Explorer: Mountain',
        type: 'naturalExplorer',
        level_gained: 6,
      },
    ],
    spells: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 14,
  })
  assert.deepEqual(
    result.pendingChoices.find((p) => p.type === 'favoredEnemyChoice'),
    { type: 'favoredEnemyChoice', level: 14, options: favoredEnemies.options }
  )
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'naturalExplorerChoice'),
    undefined
  )
})

test('diffLevelUp: a re-preview at a level already resolved on the real character record does not re-prompt', () => {
  const character = {
    classes: [{ name: 'Ranger', level: 0 }],
    features: [],
    spells: [],
  }
  // Simulate the level having already been confirmed and saved with a pick.
  character.features.push({
    name: 'Favored Enemy: Undead',
    type: 'favoredEnemy',
    level_gained: 1,
  })
  character.features.push({
    name: 'Natural Explorer: Forest',
    type: 'naturalExplorer',
    level_gained: 1,
  })
  character.classes[0].level = 1
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 1,
  })
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'favoredEnemyChoice'),
    undefined
  )
  assert.equal(
    result.pendingChoices.find((p) => p.type === 'naturalExplorerChoice'),
    undefined
  )
})

test('diffLevelUp: an unrecognized Favored Enemy value is still recorded (with a note), not blocked', () => {
  const character = { classes: [], features: [], spells: [] }
  const result = engine.diffLevelUp(character, {
    className: 'Ranger',
    toLevel: 1,
    favoredEnemyChoice: 'Robots',
    naturalExplorerChoice: 'Forest',
  })
  const fe = result.newFeatures.find((f) => f.type === 'favoredEnemy')
  assert.equal(fe.name, 'Favored Enemy: Robots')
  assert.ok(result.warnings.some((w) => w.includes('Robots')))
})
