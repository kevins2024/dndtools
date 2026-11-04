// The repo rule (CLAUDE.md, "The engine IS the game"): nothing functional lives only in a feature's
// text. This test finds features whose description says they grant a proficiency, resistance, immunity,
// advantage, sense or speed but whose feature-mechanics entry has no structured grant.
//
//   - 2024 species and the homebrew species are held to zero gaps. (speciesRulesCoverage.test.js is the
//     stricter check for species: it does not read text at all.)
//   - class, subclass, feat and option features are a ratchet: the count of text-only hits may only go
//     DOWN. When you structure a feature, lower its baseline; when a new feature appears, structure it
//     (adding one that lacks a grant fails this test).
//
// The description scan is a heuristic (it finds candidates, it does not prove a feature is fine), so a
// feature the scan misses can still need engine work; TODO.md lists the ones known by hand.
const test = require('node:test')
const assert = require('node:assert/strict')
const published = require('../../src/data/published_features.json')
const mechanics = require('../data/5e/feature-mechanics.json')
const { isRule } = require('../rules/5e/featureGrants')
const speciesCache = require('../../src/data/api_data_cache/species.json')

const features = Array.isArray(published)
  ? published
  : Object.values(published)[0]

const KINDS = {
  proficiency:
    /\b(you gain|you have|you are|gain) proficiency|proficiency (in|with) (the |one |two |three |any |all )?(following )?(skill|tool|armor|weapon|saving|light|medium|heavy|martial|simple|\w+'s tools|\w+ tools)/i,
  resistance: /resistance to|resistant to/i,
  advantage:
    /advantage on (saving throws|(\w+ )?(\(\w+\) )?checks|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i,
  immunity: /immune to|immunity to/i,
  sense: /darkvision|blindsight|tremorsense|truesight/i,
  speed: /(walking )?speed increases by|fly speed|swim speed|climb speed/i,
}
const isStructured = (id) =>
  Object.keys(mechanics[id] ?? {}).some((k) => isRule(k) || k === 'pick')
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
const hits = (f) =>
  Object.entries(KINDS)
    .filter(([, re]) => re.test(f.description ?? ''))
    .map(([k]) => k)

// Text-only candidates in the non-species groups when this rule was introduced (2026-11-04). Lower
// these as features are structured; never raise them.
const BASELINE = { class: 20, subclass: 72, feat: 24, option: 5 }

test('no 2024 species trait describes a grant that has no structured entry (the full, text-independent check is speciesRulesCoverage.test.js)', () => {
  const gaps = features
    .filter((f) => group(String(f.id)) === 'species')
    .filter((f) => hits(f).length && !isStructured(f.id))
    .map((f) => f.id)
    .sort()
  assert.deepEqual(gaps, [])
})

test('every homebrew species trait has an id and a feature-mechanics entry that says what it does', () => {
  const species = (
    Array.isArray(speciesCache) ? speciesCache : Object.values(speciesCache)[0]
  ).filter((s) => s.homebrew && s.playable !== false && s.traits)
  assert.ok(species.length >= 3)
  for (const s of species)
    for (const t of s.traits) {
      assert.match(t.id ?? '', /^homebrew_species_/, `${s.name} ${t.name}: id`)
      const m = mechanics[t.id]
      assert.ok(m, `${s.name} ${t.name}: feature-mechanics entry`)
      const effect =
        isStructured(t.id) ||
        m.uses_max != null ||
        m.uses_formula ||
        m.action_type ||
        m.recharge
      assert.ok(effect, `${s.name} ${t.name}: entry has no effect`)
      if (t.type === 'active')
        assert.ok(
          m.recharge ||
            Object.values(m.grants_spells?.free_cast ?? {}).some(
              (x) => x.recharge
            ),
          `${s.name} ${t.name}: active trait needs recharge`
        )
    }
})

test('text-only functional features in class, subclass, feat and option groups only go down', () => {
  const counts = {}
  for (const f of features) {
    const id = String(f.id)
    if (!id.startsWith('pub24')) continue
    const g = group(id)
    if (g === 'species') continue
    if (hits(f).length && !isStructured(id)) counts[g] = (counts[g] ?? 0) + 1
  }
  for (const [g, max] of Object.entries(BASELINE))
    assert.ok(
      (counts[g] ?? 0) <= max,
      `${g}: ${counts[g]} features describe a grant with no structured entry (baseline ${max}). Structure the new one in feature-mechanics.json.`
    )
  // the baseline must be tight: lower it when features are structured
  for (const [g, max] of Object.entries(BASELINE))
    assert.equal(
      counts[g] ?? 0,
      max,
      `${g}: now ${counts[g]}, lower BASELINE.${g} to ${counts[g]}`
    )
})
