// "The engine IS the game" for every 2024 feature, not only species (speciesRulesCoverage.test.js is the
// strict, zero-gap version for species). A feature is DISPOSED when its feature-mechanics entry is one of
//
//   - a structured rule: a `grants_*` field or one of featureGrants.RULE_KEYS (on_use, active, ...),
//   - `engine_rule: "rules/5e/<file>.js#<function>"`: bespoke engine code, which this test checks exists,
//   - `pick: true` or `narrative: "<reason>"`.
//
// A feature with no entry, or only a name or a use counter, is UNDISPOSED: the engine may or may not do
// what its text says, and nothing in the data says which. The count per group may only go down. When you
// structure a feature (or point it at the code that already implements it), lower the baseline; a new
// feature with no disposition fails this test.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const published = require('../../src/data/published_features.json')
const mechanics = require('../data/5e/feature-mechanics.json')
const { isRule } = require('../rules/5e/featureGrants')

const features = (
  Array.isArray(published) ? published : Object.values(published)[0]
).filter((f) => String(f.id).startsWith('pub24'))
const group = (id) =>
  id.startsWith('pub24_sub_')
    ? 'subclass'
    : id.startsWith('pub24_species')
    ? 'species'
    : /pub24_feat/.test(id)
    ? 'feat'
    : /invocation|maneuver|metamagic/.test(id)
    ? 'option'
    : 'class'
const disposed = (id) => {
  const m = mechanics[id]
  return !!m && (Object.keys(m).some(isRule) || !!m.pick || !!m.narrative)
}

// Undisposed features per group on 2026-11-04. Lower these; never raise them.
const BASELINE = { class: 151, subclass: 332, feat: 75, option: 62, species: 0 }

test('every engine_rule points at a function the engine exports', () => {
  const problems = []
  for (const [id, m] of Object.entries(mechanics)) {
    if (!m.engine_rule) continue
    const [file, fn] = m.engine_rule.split('#')
    let mod
    try {
      mod = require(path.join(__dirname, '..', file))
    } catch (e) {
      problems.push(`${id}: cannot load ${file}`)
      continue
    }
    if (typeof mod[fn] !== 'function')
      problems.push(`${id}: ${file} does not export ${fn}`)
  }
  assert.deepEqual(problems, [])
})

test('features with no disposition (no rule, engine_rule, pick or narrative) only go down', () => {
  const counts = {}
  for (const f of features)
    if (!disposed(f.id)) counts[group(f.id)] = (counts[group(f.id)] ?? 0) + 1
  for (const [g, max] of Object.entries(BASELINE))
    assert.equal(
      counts[g] ?? 0,
      max,
      `${g}: ${
        counts[g] ?? 0
      } undisposed features (baseline ${max}). Fewer: lower BASELINE.${g}. More: give the new feature a rule in feature-mechanics.json.`
    )
})
