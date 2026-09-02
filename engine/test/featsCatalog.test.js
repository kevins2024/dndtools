const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const engine = require('../index')
const feats = require('../data/feats.json')

const publishedFeatures = require(path.join(
  __dirname,
  '..',
  '..',
  'src',
  'data',
  'published_features.json'
))
const featureCatalog = require('../data/feature-catalog.json')

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
      if (!['spell_text', 'text'].includes(c.type)) {
        assert.ok(
          Array.isArray(c.options) && c.options.length > 0,
          `${name}/${c.id}: type "${c.type}" needs a non-empty options list`
        )
      }
    }
  }
})

test('meetsFeatPrerequisites: race prerequisite blocks a non-matching race, allows a matching one', () => {
  const gnome = {
    race: 'Gnome',
    stat_str: 10,
    stat_dex: 10,
    stat_con: 10,
    stat_int: 10,
    stat_wis: 10,
    stat_cha: 10,
  }
  const human = { ...gnome, race: 'Human' }
  assert.equal(engine.meetsFeatPrerequisites(gnome, 'Fade Away').met, true)
  assert.equal(engine.meetsFeatPrerequisites(human, 'Fade Away').met, false)
})

test('meetsFeatPrerequisites: ability-score prerequisite is hard-enforced (Grappler needs STR 13+)', () => {
  const weak = { race: 'Human', stat_str: 10 }
  const strong = { race: 'Human', stat_str: 14 }
  assert.equal(engine.meetsFeatPrerequisites(weak, 'Grappler').met, false)
  assert.equal(engine.meetsFeatPrerequisites(strong, 'Grappler').met, true)
})

test('meetsFeatPrerequisites: an untracked proficiency array is permissive, not a hard block', () => {
  const noProfData = { race: 'Human' } // armor_proficiencies not tracked
  const result = engine.meetsFeatPrerequisites(noProfData, 'Heavy Armor Master')
  assert.equal(result.met, true)
  assert.equal(result.unknown, true)
})

test('meetsFeatPrerequisites: a POPULATED proficiency array IS enforced', () => {
  const noHeavy = { race: 'Human', armor_proficiencies: ['light', 'medium'] }
  const withHeavy = {
    race: 'Human',
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
    { race: 'Human' },
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
    race: 'Human',
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
    race: 'Human',
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
    race: 'Human',
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
  const names = result.patch.spells.map((s) => s.name).sort()
  assert.deepEqual(names, ['Misty Step', 'Silvery Barbs'])
  assert.ok(result.patch.spells.every((s) => s._source === 'Fey Touched'))
})
