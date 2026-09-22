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
    publishedFeatures.filter((e) => e.category === 'feat').map((e) => e.name)
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
    .filter((e) => e.category === 'feat')
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

test('meetsFeatPrerequisites: ability-score prerequisite is hard-enforced (Grappler needs STR 13+)', () => {
  const weak = { genus: 'Human', stat_str: 10 }
  const strong = { genus: 'Human', stat_str: 14 }
  assert.equal(engine.meetsFeatPrerequisites(weak, 'Grappler').met, false)
  assert.equal(engine.meetsFeatPrerequisites(strong, 'Grappler').met, true)
})

test('meetsFeatPrerequisites: an untracked proficiency array is permissive, not a hard block', () => {
  const noProfData = { genus: 'Human' } // armor_proficiencies not tracked
  const result = engine.meetsFeatPrerequisites(noProfData, 'Heavy Armor Master')
  assert.equal(result.met, true)
  assert.equal(result.unknown, true)
})

test('meetsFeatPrerequisites: a POPULATED proficiency array IS enforced', () => {
  const noHeavy = { genus: 'Human', armor_proficiencies: ['light', 'medium'] }
  const withHeavy = {
    genus: 'Human',
    armor_proficiencies: ['light', 'medium', 'heavy'],
  }
  assert.equal(
    engine.meetsFeatPrerequisites(noHeavy, 'Heavy Armor Master').met,
    false
  )
  assert.equal(
    engine.meetsFeatPrerequisites(withHeavy, 'Heavy Armor Master').met,
    true
  )
})

test('meetsFeatPrerequisites: an uncatalogued feat is permissive (nothing to check)', () => {
  const result = engine.meetsFeatPrerequisites(
    { genus: 'Human' },
    'Not A Real Feat'
  )
  assert.equal(result.met, true)
  assert.equal(result.unknown, true)
})

test('resolveAsiOrFeat: Alert (no ASI) returns a feature carrying stat_bonuses.initiative', () => {
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  const result = engine.resolveAsiOrFeat(scores, {
    type: 'feat',
    featName: 'Alert',
  })
  assert.deepEqual(result.scores, scores) // no ability bump
  assert.equal(result.feature.name, 'Alert')
  assert.deepEqual(result.feature.stat_bonuses, { initiative: 5 })
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

test('diffLevelUp: taking Alert at an ASI level adds a feat feature with stat_bonuses.initiative to the patch', () => {
  const character = {
    name: 'Test Fighter',
    genus: 'Human',
    level: 3,
    classes: [{ name: 'Fighter', level: 3, subclass: 'Champion' }],
    stat_str: 14,
    stat_dex: 12,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 8,
    hp_max: 28,
    hp_current: 28,
    hit_dice_current: 3,
    features: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    hpMethod: 'average',
    asiOrFeatResolutions: {
      4: { type: 'feat', featName: 'Alert' },
    },
  })
  const alertFeature = result.patch.features.find((f) => f.name === 'Alert')
  assert.ok(alertFeature, 'expected an Alert feature in patch.features')
  assert.deepEqual(alertFeature.stat_bonuses, { initiative: 5 })
})

test('diffLevelUp: taking Resilient adds the chosen ability to patch.saving_throws', () => {
  const character = {
    name: 'Test Wizard',
    genus: 'Human',
    level: 3,
    classes: [{ name: 'Wizard', level: 3, subclass: 'School of Evocation' }],
    stat_str: 8,
    stat_dex: 14,
    stat_con: 12,
    stat_int: 16,
    stat_wis: 10,
    stat_cha: 10,
    hp_max: 20,
    hp_current: 20,
    hit_dice_current: 3,
    saving_throws: ['int', 'wis'],
    features: [],
  }
  const result = engine.diffLevelUp(character, {
    className: 'Wizard',
    toLevel: 4,
    hpMethod: 'average',
    asiOrFeatResolutions: {
      4: { type: 'feat', featName: 'Resilient', abilityChoice: 'con' },
    },
  })
  assert.deepEqual(result.patch.saving_throws.sort(), ['con', 'int', 'wis'])
})

test('diffLevelUp: taking Fey Touched with a chosen spell adds both the fixed and chosen spells to patch.spells', () => {
  const character = {
    name: 'Test Cleric',
    genus: 'Human',
    level: 3,
    classes: [{ name: 'Cleric', level: 3, subclass: 'Life Domain' }],
    stat_str: 10,
    stat_dex: 10,
    stat_con: 14,
    stat_int: 10,
    stat_wis: 16,
    stat_cha: 10,
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
    asiOrFeatResolutions: {
      4: {
        type: 'feat',
        featName: 'Fey Touched',
        abilityChoice: 'wis',
        choices: { __grantedSpellChoice: 'Silvery Barbs' },
      },
    },
  })
  // Caster Prestidigitation (this Cleric fixture also unconditionally gets
  // Divine Prestidigitation) lives in patch.features, not patch.spells —
  // see diffLevelUp.js's own comment on why — so it doesn't show up here.
  const names = result.patch.spells.map((s) => s.name).sort()
  assert.deepEqual(names, ['Misty Step', 'Silvery Barbs'])
  assert.ok(result.patch.spells.every((s) => s._source === 'Fey Touched'))
  assert.ok(
    result.newFeatures.some(
      (f) =>
        f.name === 'Caster Prestidigitation' &&
        (f.spells_granted || []).includes('Divine Prestidigitation')
    )
  )
})
