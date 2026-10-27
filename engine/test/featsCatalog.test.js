const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')
const feats = require('../data/5e/feats.json')

const publishedFeatures = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'published_features.json'
))
const featureCatalog = require('../data/5e/feature-catalog.json')

const FEAT_NAMES = Object.keys(feats).filter((k) => !k.startsWith('_'))

test('feats.json has the full 2014 PHB+XGE+TCE roster (72 feats)', () => {
  assert.equal(FEAT_NAMES.length, 72)
})

test('every feats.json entry has a matching published_features.json category:"feat" entry, and vice versa', () => {
  const pfFeatNames = new Set(
    publishedFeatures
      .filter((e) => e.category === 'feat' && e.ruleset !== '2024')
      .map((e) => e.name)
  )
  const missingInPf = FEAT_NAMES.filter((n) => !pfFeatNames.has(n))
  assert.deepEqual(
    missingInPf,
    [],
    'feats.json entries missing from published_features.json'
  )

  const extraInPf = [...pfFeatNames].filter((n) => !FEAT_NAMES.includes(n))
  assert.deepEqual(
    extraInPf,
    [],
    'published_features.json category:"feat" entries with no feats.json counterpart'
  )
})

test('every category:"feat" published_features.json entry has an id resolvable in feature-catalog.json', () => {
  const missing = publishedFeatures
    .filter((e) => e.category === 'feat' && e.ruleset !== '2024')
    .filter((e) => {
      const key = e.id?.startsWith('pub_') ? e.id.slice(4) : e.id
      return featureCatalog[key] !== e.name
    })
    .map((e) => e.name)
  assert.deepEqual(missing, [])
})

test('every feat with ability_score_increase.choice_of has a real, known ability in the list', () => {
  const VALID = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])
  for (const name of FEAT_NAMES) {
    const asi = feats[name].ability_score_increase
    if (!asi) continue
    for (const a of asi.choice_of) {
      assert.ok(VALID.has(a), `${name}: unknown ability "${a}"`)
    }
  }
})

test('every feat choices[] entry has a positive count and (for enumerable types) a non-empty options list', () => {
  for (const name of FEAT_NAMES) {
    const choices = feats[name].choices
    if (!choices) continue
    for (const c of choices) {
      assert.ok(c.count > 0, `${name}/${c.id}: count must be > 0`)
      if (!['spell_choice', 'text'].includes(c.type)) {
        assert.ok(
          Array.isArray(c.options) && c.options.length > 0,
          `${name}/${c.id}: type "${c.type}" needs a non-empty options list`
        )
      }
    }
  }
})

// 'spell_choice' entries are populated live via /api/engine/feat-spell-choices
// (LevelUpTool.vue's refreshFeatSpellOptions), not a static options array —
// see feats.json's own _schema.choices doc. Each one needs exactly one of
// fixedClass/pool:'any' (the class, or lack of one, is baked into the feat)
// or classFromChoiceId naming a REAL sibling choice (the class is itself a
// player pick) — catches a typo'd id silently breaking a picker at runtime.
test("every 'spell_choice' entry has a real spell_filter, and classFromChoiceId (if used) names a real sibling choice", () => {
  for (const name of FEAT_NAMES) {
    const choices = feats[name].choices
    if (!choices) continue
    const ids = new Set(choices.map((c) => c.id))
    for (const c of choices) {
      if (c.type !== 'spell_choice') continue
      const f = c.spell_filter
      assert.ok(
        f && typeof f === 'object',
        `${name}/${c.id}: needs spell_filter`
      )
      const hasFixedSource = Boolean(f.fixedClass) || f.pool === 'any'
      const hasSiblingSource =
        typeof f.classFromChoiceId === 'string' && ids.has(f.classFromChoiceId)
      assert.ok(
        hasFixedSource !== hasSiblingSource,
        `${name}/${c.id}: needs exactly one of fixedClass/pool:'any' or a classFromChoiceId naming a real sibling choice`
      )
    }
  }
})

// grants_spells.choice (Fey Touched/Shadow Touched-style — "any spellbook",
// not tied to one class) is a separate mechanism from choices[] (see
// feats.json's own _schema doc) — same real-options guarantee, checked
// against the live spell catalog via listFeatSpellChoices rather than a
// static list, since there's no options array to check statically at all.
test('every grants_spells.choice actually resolves to at least one real spell', () => {
  for (const name of FEAT_NAMES) {
    const choice = feats[name].grants_spells?.choice
    if (!choice) continue
    const options = engine.listFeatSpellChoices({
      level: choice.level,
      schools: choice.schools ?? null,
    })
    assert.ok(
      options.length > 0,
      `${name}: grants_spells.choice (level ${
        choice.level
      }, schools ${JSON.stringify(choice.schools)}) matched zero real spells`
    )
  }
})

test('meetsFeatPrerequisites: race prerequisite blocks a non-matching race, allows a matching one', () => {
  const gnome = {
    genus: 'Gnome',
    stat_str: 10,
    stat_dex: 10,
    stat_con: 10,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 10,
  }
  const human = { ...gnome, genus: 'Human' }
  assert.equal(engine.meetsFeatPrerequisites(gnome, 'Fade Away').met, true)
  assert.equal(engine.meetsFeatPrerequisites(human, 'Fade Away').met, false)
})

test('meetsFeatPrerequisites: an uncatalogued feat is permissive (nothing to check)', () => {
  const result = engine.meetsFeatPrerequisites(
    { genus: 'Human' },
    'Not A Real Feat'
  )
  assert.equal(result.met, true)
  assert.equal(result.unknown, true)
})

test('resolveAsiOrFeat: a feat with a generic `choices` pick carries it through on the feature object', () => {
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = engine.resolveAsiOrFeat(scores, {
    type: 'feat',
    featName: 'Skilled',
    choices: { skills_or_tools: ['Athletics', 'Stealth', "Thieves' Tools"] },
  })
  assert.deepEqual(result.feature.choices, {
    skills_or_tools: ['Athletics', 'Stealth', "Thieves' Tools"],
  })
})
