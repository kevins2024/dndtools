const test = require('node:test')
const assert = require('node:assert')
const { threeWayMerge, getKeyField } = require('../../merge-utils')

test('arrays of rows with ids merge by id: each side keeps its own change', () => {
  const base = [{ id: 'a', hp: 10 }, { id: 'b', hp: 10 }]
  const ours = [{ id: 'a', hp: 7 }, { id: 'b', hp: 10 }]
  const theirs = [{ id: 'a', hp: 10 }, { id: 'b', hp: 4 }]
  const { merged, conflicts } = threeWayMerge(base, ours, theirs)
  assert.deepStrictEqual(merged, [{ id: 'a', hp: 7 }, { id: 'b', hp: 4 }])
  assert.deepStrictEqual(conflicts, [])
})

test('rows with no id are NOT collapsed into one (bug 2.12)', () => {
  // The old code keyed by the first row's field, so rows missing it all got
  // the key "undefined" and collapsed. With ids on only some rows the array
  // is keyed by name instead; with no usable key it merges as a unit.
  const base = [{ name: 'A' }, { name: 'B' }, { id: 'x', name: 'C' }]
  assert.strictEqual(getKeyField(base, base, base), 'name')
  const { merged } = threeWayMerge(base, [...base, { name: 'D' }], base)
  assert.deepStrictEqual(merged.map((r) => r.name), ['A', 'B', 'C', 'D'])

  const keyless = [{ uses: 1 }, { uses: 2 }]
  assert.strictEqual(getKeyField(keyless, keyless, keyless), null)
  const added = threeWayMerge(keyless, [...keyless, { uses: 3 }], keyless)
  assert.strictEqual(added.merged.length, 3)
})

test('a mix where only some elements have the id falls back to name, then to the whole array', () => {
  const mixed = [{ id: 'a', name: 'A' }, { name: 'B' }]
  assert.strictEqual(getKeyField(mixed), 'name')
  const noKeys = [{ x: 1 }, { x: 2 }]
  assert.strictEqual(getKeyField(noKeys), null)
})

test('duplicate ids inside one array make that field unusable instead of merging wrong', () => {
  const dup = [{ id: 'a', n: 1 }, { id: 'a', n: 2 }]
  assert.notStrictEqual(getKeyField(dup), 'id')
})

test('arrays of primitives still merge as a unit', () => {
  assert.strictEqual(getKeyField(['x', 'y'], ['x'], ['y']), null)
  const { merged } = threeWayMerge(['x'], ['x', 'y'], ['x'])
  assert.deepStrictEqual(merged, ['x', 'y'])
})

test('a keyless array both sides changed differently raises a conflict instead of dropping rows', () => {
  const base = [{ uses: 1 }, { uses: 2 }]
  const ours = [...base, { uses: 3 }]
  const theirs = [...base, { uses: 4 }]
  const { merged, conflicts } = threeWayMerge(base, ours, theirs)
  assert.ok(conflicts.length > 0)
  assert.strictEqual(merged.length, 3)
})

test('objects with the same data in a different key order are equal, not a conflict', () => {
  const { deepEqual } = require('../../merge-utils')
  assert.strictEqual(deepEqual({ a: 1, b: { x: 1, y: 2 } }, { b: { y: 2, x: 1 }, a: 1 }), true)
  assert.strictEqual(deepEqual({ a: 1 }, { a: 2 }), false)
  const base = { id: 1, hp: 10, ac: 15 }
  const reordered = { ac: 15, id: 1, hp: 10 }
  const { conflicts } = threeWayMerge(base, { ...base, hp: 7 }, reordered)
  assert.deepStrictEqual(conflicts, [])
})
