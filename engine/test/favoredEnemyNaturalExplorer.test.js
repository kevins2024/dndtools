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
