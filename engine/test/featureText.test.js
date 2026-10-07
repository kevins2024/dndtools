const test = require('node:test')
const assert = require('node:assert')
const { resolveFeatureText } = require('../rules/5e/featureText')
const published = require('../../src/data/published_features.json')
const byId = (id) => published.find((f) => f.id === id)

test('a record with its own description returns it', () => {
  assert.strictEqual(resolveFeatureText({ description: 'x' }, () => undefined), 'x')
})
test('text_from follows to the referenced record, through a chain', () => {
  const db = { a: { text_from: 'b' }, b: { text_from: 'c' }, c: { description: 'real' } }
  assert.strictEqual(resolveFeatureText(db.a, (i) => db[i]), 'real')
})
test('dangling and circular references return empty text instead of throwing', () => {
  const db = { a: { text_from: 'b' }, b: { text_from: 'a' } }
  assert.strictEqual(resolveFeatureText(db.a, (i) => db[i]), '')
  assert.strictEqual(resolveFeatureText({ text_from: 'nope' }, () => undefined), '')
})
test('every text_from in published_features points at a record with real text, and a record never has both', () => {
  for (const f of published.filter((r) => r.text_from)) {
    assert.ok(!f.description, `${f.id} has both description and text_from`)
    assert.ok(resolveFeatureText(f, byId), `${f.id} text_from ${f.text_from} resolves to nothing`)
  }
})
