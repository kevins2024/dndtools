const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const {
  RULESETS,
  DEFAULT_RULESET,
  normalizeRuleset,
  rulesetOf,
  dataFilePath,
  loadRulesetJson,
  isLegacyFallback,
} = require('../rules/5e/ruleset')

test('2024 is the default; the 2014 tree is only the fallback for what 2024 did not rewrite', () => {
  assert.equal(DEFAULT_RULESET, '2024')
  assert.deepEqual([...RULESETS].sort(), ['2014', '2024'])
})

test('normalizeRuleset defaults to 2024, accepts numbers/strings and rejects unknown rulesets', () => {
  assert.equal(normalizeRuleset(undefined), '2024')
  assert.equal(normalizeRuleset(null), '2024')
  assert.equal(normalizeRuleset(2014), '2014')
  assert.equal(normalizeRuleset(2024), '2024')
  assert.equal(normalizeRuleset('2024'), '2024')
  assert.throws(() => normalizeRuleset('3.5'), /ruleset/i)
})

test('rulesetOf reads a character, defaulting to 2024', () => {
  assert.equal(rulesetOf({ name: 'Vaz' }), '2024')
  assert.equal(rulesetOf({ name: 'Vaz', ruleset: '2014' }), '2014')
  assert.equal(rulesetOf(null), '2024')
})

test('2014 data paths point at the original data/5e tree', () => {
  const p = dataFilePath('2014', 'classes/fighter.json')
  assert.ok(p.endsWith(path.join('data', '5e', 'classes', 'fighter.json')))
  assert.ok(fs.existsSync(p))
})

test('a 2024 request with no 2024 file falls back to the legacy 2014 file', () => {
  // languages.json has no 2024 counterpart, so the 2014 file must be served.
  const p = dataFilePath('2024', 'languages.json')
  assert.ok(p.endsWith(path.join('data', '5e', 'languages.json')))
  assert.equal(isLegacyFallback('2024', 'languages.json'), true)
  assert.equal(isLegacyFallback('2024', 'classes/barbarian.json'), false)
  assert.equal(isLegacyFallback('2014', 'classes/barbarian.json'), false)
})

test('loadRulesetJson returns null for a file that exists in neither tree', () => {
  assert.equal(loadRulesetJson('2024', 'classes/not-a-class.json'), null)
  assert.equal(loadRulesetJson('2014', 'classes/not-a-class.json'), null)
})

test('loadRulesetJson caches per resolved file', () => {
  const a = loadRulesetJson('2014', 'classes/fighter.json')
  const b = loadRulesetJson('2014', 'classes/fighter.json')
  assert.equal(a, b)
  assert.equal(a.name, 'Fighter')
})
