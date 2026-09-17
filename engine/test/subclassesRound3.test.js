const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('listSubclasses includes all subclasses built in round 3', () => {
  assert.ok(engine.listSubclasses().length >= 23)
})

test('Artificer subclass_feature_levels bug fix: was [3,5,9,13,17], corrected to [3,5,9,15]', () => {
  const artificer = engine.loadClass('Artificer')
  assert.deepEqual(artificer.subclass_feature_levels, [3, 5, 9, 15])
  const artillerist = engine.loadSubclass('Artificer', 'Artillerist')
  const levels = Object.keys(artillerist.features_by_level).map(Number)
  for (const lvl of levels) {
    assert.ok(artificer.subclass_feature_levels.includes(lvl))
  }
})

test('subclass file/name slug consistency: every file matches slugify(class, name)', () => {
  const fs = require('fs')
  const path = require('path')
  const dir = path.join(__dirname, '..', 'data', '5e', 'subclasses')
  const { slugify } = require('../rules/5e/subclasses')
  for (const file of fs.readdirSync(dir)) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
    const expected = slugify(data.class, data.name) + '.json'
    assert.equal(file, expected, `${file} should be named ${expected}`)
  }
})

test('Bladesinger resolves under the name actually used on the roster ("Bladesinger", not "Bladesinging")', () => {
  const sub = engine.loadSubclass('Wizard', 'Bladesinger')
  assert.ok(sub)
  assert.deepEqual(sub.features_by_level['2'], [
    'Bladesinger — Training in War and Song',
    'Bladesong',
  ])
})

test('Tackett\'s actual Circle of Stars features resolve under "Circle of Stars" (not "Circle of the Stars")', () => {
  const path = require('path')
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))
  const tackett = characters.find((c) => c.name === 'Tackett')
  const sub = engine.loadSubclass('Druid', 'Circle of Stars')
  assert.ok(sub)
  const allNames = Object.values(sub.features_by_level).flat()
  const overlap = allNames.filter((n) =>
    tackett.features.some((f) => f.name === n)
  )
  assert.ok(
    overlap.length > 0,
    "at least some Circle of Stars features should match Tackett's real data"
  )
})
