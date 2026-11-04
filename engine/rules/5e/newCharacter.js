// A new 2024 character, up to the moment the first class level is taken.
//
//   const { character, pending, warnings } = createCharacter2024(answers)
//
// Builds the level 0 sheet from the 2024 character-creation steps: species (and its picks), background
// (ability bonus, skills, tool, Origin feat and the feat's picks), languages, ability scores and the
// starting class's proficiencies. Level 1 itself (hit points, class features, weapon mastery, cantrips...)
// is then taken through the ordinary level-up engine (choiceProtocol.js), exactly like every later level.
//
// Called with whatever has been answered so far it returns the character as far as it can be built plus
// `pending`: one descriptor per pick still owed, { id, title, prompt, kind: 'pick', min, max, options }, so
// a UI can render the open questions and call again. Nothing here asks for a pick the rules do not give.
//
// answers = {
//   name, species, background, className,
//   speciesPicks:    { lineage|legacy|ancestry, spellAbility, keenSenses, skillful, versatile },
//   backgroundBonus: { mode: 'twoOne', plus2, plus1 } | { mode: 'oneOneOne' },
//   backgroundTool:  'Lute',                                  (only when the background lets you choose)
//   featPicks:       { background: {...}, versatile: {...} }  (class, cantrip_1, cantrip_2, spell_1, ability,
//                                                              skills_or_tools[], tools[])
//   languages:       ['Dwarvish', 'Elvish'],                  (two beyond Common)
//   scoreMethod:     'pointBuy' | 'standardArray' | 'rolled',
//   scores:          { str, dex, con, int, wis, cha },        (before the background bonus)
//   classSkills:     ['Arcana', 'History'],
//   classTools:      ['Lute', 'Flute', 'Drum'],               (Bard, Monk, Artificer: the class's tool picks)
//   equipment:       { class: 'A', background: 'B',           (the packages taken; instrument / gamingSet
//                      instrument, gamingSet },                only when the package names one)
//   speciesPicks also carries skillAlt, the replacement for a homebrew species' skill the background gave.
// }
//
// Also returns `equipment: { items, gold }`: the party_items records (carried by the new character) and the
// gold of the chosen class and background packages, for the caller to add; nothing is written here.
//
// Server and scripts only (reads the data files through the usual loaders).

const fs = require('fs')
const path = require('path')
const { loadSpecies, listSpecies } = require('./species')
const { loadBackground, listBackgrounds } = require('./backgrounds')
const { loadClass, listClasses } = require('./classFeatures')
const { loadFeat, listFeats } = require('./grants')
const { listLanguages } = require('./languages')
const { listSkills, loadSkill } = require('./skills')
const { findSpellRecord, listFeatSpellChoices } = require('./spellLists')
const { validatePointBuy } = require('../pointBuy')
const { ARTISAN_TOOLS, INSTRUMENTS, TOOL_CATEGORIES } = require('./toolLists')
const {
  effectiveGrants,
  proficiencyGrants,
  characterGrants,
} = require('./featureGrants')
const {
  packageToItems,
  describePackage,
  placeholder,
} = require('./startingEquipment')
const { resolveAmount } = require('./amounts')
const { pickFeatureId } = require('./speciesLineage')
const SPECIES_CHOICES = require('../../data/5e2024/species-choices.json')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
const MAGIC_INITIATE_LISTS = ['Cleric', 'Druid', 'Wizard']

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim()
const same = (a, b) => norm(a) === norm(b)
const skillNameOf = (id) => loadSkill(id)?.name ?? null
const SKILL_NAMES = () => listSkills().map((s) => s.name)
const abilityLabel = (a) =>
  ({
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma',
  }[a])

// This campaign's playable homebrew species (Catrin, Drevani, Hei'ugar), from the species cache. They are
// treated like any 2024 species: no ability score bonus (that comes from the background) and no feat of
// their own (the Origin feat comes from the background; only Human's Versatile trait adds one).
function homebrewSpecies() {
  try {
    const file = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'data',
      'api_data_cache',
      'species.json'
    )
    const cache = JSON.parse(fs.readFileSync(file, 'utf8'))
    const all = Array.isArray(cache) ? cache : Object.values(cache)[0]
    return all.filter(
      (s) =>
        s.homebrew === true &&
        s.playable !== false &&
        Array.isArray(s.traits) &&
        s.traits.length
    )
  } catch (err) {
    return []
  }
}

// The species this flow can create: those with 2024 data of their own (not a legacy fallback), and the
// campaign's playable homebrew species.
function listNewCharacterSpecies() {
  return [
    ...listSpecies('2024')
      .map((s) => loadSpecies(s.name, '2024'))
      .filter((s) => s && s.ruleset === '2024' && !s.legacy)
      .map((s) => s.name),
    // species the 2024 books did not rewrite and nothing in them retires (Half-Elf, Half-Orc): the 2014
    // text, tagged legacy, with the 2024 character-origin rules (ability scores come from the background)
    ...Object.entries(SPECIES_CHOICES)
      .filter(([, v]) => v.legacyPlayable)
      .map(([name]) => name),
    ...homebrewSpecies().map((s) => s.name),
  ]
}

// ── pick bookkeeping ──────────────────────────────────────────────────────────────────────────

// Which part of the creation form a pick belongs to.
function sectionOf(id) {
  if (id === 'species' || id.startsWith('species.')) return 'species'
  if (id.startsWith('featPicks.versatile')) return 'species'
  if (id.startsWith('background') || id.startsWith('featPicks.'))
    return 'background'
  if (id === 'scores') return 'scores'
  if (id === 'languages') return 'languages'
  if (id.startsWith('equipment.')) return 'equipment'
  return 'class'
}

function makeAsker(choices) {
  // Records every pick (answered or not, so a form keeps its options) and returns the valid
  // answer(s), or null while the pick is still owed.
  return function ask(id, title, options, given, { count = 1, prompt } = {}) {
    const values = options.map((o) => (typeof o === 'string' ? o : o.value))
    const labels = options.map((o) => (typeof o === 'string' ? o : o.label))
    const chosen = (Array.isArray(given) ? given : given == null ? [] : [given])
      .map((g) => values.find((v) => same(v, g)))
      .filter(Boolean)
    const unique = [...new Set(chosen)]
    const answered = unique.length === count
    choices.push({
      id,
      section: sectionOf(id),
      title,
      prompt: prompt ?? `Choose ${count === 1 ? 'one' : count}.`,
      kind: 'pick',
      min: count,
      max: count,
      options: values.map((value, i) => ({ value, label: labels[i] })),
      answered,
      answer: answered ? (count === 1 ? unique[0] : unique) : null,
    })
    return answered ? (count === 1 ? unique[0] : unique) : null
  }
}

// ── origin feat ───────────────────────────────────────────────────────────────────────────────

// Applies an Origin feat to the character and asks for the picks it carries. `fixedList` is the spell
// list a background fixes for Magic Initiate ("Magic Initiate (Cleric)").
function addOriginFeat(
  c,
  featName,
  grant,
  source,
  picks,
  fixedList,
  ask,
  warn
) {
  const base = featName.replace(/\s*\(.*\)$/, '')
  const data = loadFeat(base, '2024')
  if (!data) {
    warn(`${featName} is not a 2024 feat.`)
    return
  }
  const where = `featPicks.${grant === 'species' ? 'versatile' : 'background'}`
  const feature = {
    name: base,
    id: data.id ?? null,
    type: 'feat',
    _grant: grant,
    _source: source,
    level_gained: 1,
  }
  if (base === 'Magic Initiate') {
    const list =
      fixedList ??
      ask(
        `${where}.class`,
        'Magic Initiate: spell list',
        MAGIC_INITIATE_LISTS,
        picks.class,
        { prompt: 'Choose the spell list for Magic Initiate.' }
      )
    if (list) {
      const exclude = (c.spells || []).map((s) => s.name)
      const cantrips = listFeatSpellChoices({
        className: list,
        cantripsOnly: true,
        excludeNames: exclude,
        ruleset: '2024',
      }).map((s) => s.name)
      const c1 = ask(
        `${where}.cantrip_1`,
        'Magic Initiate: first cantrip',
        cantrips,
        picks.cantrip_1
      )
      const c2 = ask(
        `${where}.cantrip_2`,
        'Magic Initiate: second cantrip',
        cantrips.filter((n) => !same(n, picks.cantrip_1)),
        picks.cantrip_2
      )
      const spell = ask(
        `${where}.spell_1`,
        'Magic Initiate: level 1 spell',
        listFeatSpellChoices({
          className: list,
          level: 1,
          ruleset: '2024',
        }).map((s) => s.name),
        picks.spell_1
      )
      const ability = ask(
        `${where}.ability`,
        'Magic Initiate: spellcasting ability',
        ['int', 'wis', 'cha'].map((a) => ({
          value: a,
          label: abilityLabel(a),
        })),
        picks.ability
      )
      feature.choices = { list }
      if (c1 && c2 && spell && ability) {
        feature.ability_choice = ability
        feature.choices = { list, cantrips: [c1, c2], spell }
        feature.spells_granted = [c1, c2, spell]
        for (const [name, level] of [
          [c1, 0],
          [c2, 0],
          [spell, 1],
        ])
          c.spells.push({
            name,
            level,
            prepared: true,
            ...(level === 0 ? { type: 'cantrip' } : {}),
            featureGranted: true,
            _source: 'Magic Initiate',
            ...(level === 1
              ? { uses_max: 1, uses_current: 1, recharge: 'long_rest' }
              : {}),
          })
      }
    }
  } else if (base === 'Skilled') {
    const skills = SKILL_NAMES().filter(
      (s) => !c.skill_proficiencies.some((p) => same(p, s))
    )
    const tools = loadFeat('Skilled', '2024')
      .choices[0].options.filter((o) => !SKILL_NAMES().includes(o))
      .filter((t) => !c.tool_proficiencies.some((p) => same(p, t)))
    const chosen = ask(
      `${where}.skills_or_tools`,
      'Skilled: three skills or tools',
      [...skills, ...tools],
      picks.skills_or_tools,
      { count: 3, prompt: 'Choose any combination of three skills or tools.' }
    )
    if (chosen) {
      feature.choices = { skills_or_tools: chosen }
      for (const p of chosen)
        if (SKILL_NAMES().includes(p)) c.skill_proficiencies.push(p)
        else c.tool_proficiencies.push(p)
    }
  } else if (base === 'Musician' || base === 'Crafter') {
    const pool = base === 'Musician' ? INSTRUMENTS : ARTISAN_TOOLS
    const chosen = ask(
      `${where}.tools`,
      base === 'Musician'
        ? 'Musician: three instruments'
        : 'Crafter: three tools',
      pool.filter((t) => !c.tool_proficiencies.some((p) => same(p, t))),
      picks.tools,
      { count: 3 }
    )
    if (chosen) {
      feature.choices = { tools: chosen }
      c.tool_proficiencies.push(...chosen)
    }
  }
  c.features.push(feature)
}

// ── species ───────────────────────────────────────────────────────────────────────────────────

function applySpecies(c, speciesName, picks, ask, warn) {
  const homebrew = homebrewSpecies().find((s) => same(s.name, speciesName))
  const species = homebrew ?? loadSpecies(speciesName, '2024')
  const spec = SPECIES_CHOICES[speciesName] ?? { choices: [], lineages: {} }
  c.genus = species.name
  c.speed = species.speed
  if (homebrew?.size) c.size = homebrew.size
  const picked = {}
  for (const ch of spec.choices) {
    if (ch.kind === 'option')
      picked[ch.id] = ask(
        `species.${ch.id}`,
        ch.title,
        ch.options,
        picks[ch.id]
      )
    else if (ch.kind === 'ability')
      picked[ch.id] = ask(
        `species.${ch.id}`,
        ch.title,
        ch.options.map((a) => ({ value: a, label: abilityLabel(a) })),
        picks[ch.id]
      )
    else if (ch.kind === 'skill')
      picked[ch.id] = ask(
        `species.${ch.id}`,
        ch.title,
        (ch.options === 'any' ? SKILL_NAMES() : ch.options).filter(
          (s) => !c.skill_proficiencies.some((p) => same(p, s))
        ),
        picks[ch.id]
      )
  }
  const lineage = spec.lineageChoice ? picked[spec.lineageChoice] : null
  const grants = lineage ? spec.lineages?.[lineage] ?? {} : {}
  if (lineage) c.subgenus = lineage

  // The species' traits as features. The options of a lineage/ancestry choice are not traits of their
  // own: only the one picked is added, below.
  const optionNames = new Set(
    spec.choices.find((x) => x.id === spec.lineageChoice)?.options ?? []
  )
  for (const t of species.traits)
    if (!optionNames.has(t.name) && !isGoliathBoon(speciesName, t.name))
      c.features.push({
        name: t.name,
        id: t.id ?? null,
        type: 'speciesTrait',
        _source: species.name,
        level_gained: 1,
        // a homebrew trait has no book text to look up, so its text travels with it like the book's
        // species traits do; what it DOES is its feature-mechanics entry, read by id
        ...(homebrew ? { description: t.description } : {}),
      })
  if (lineage) {
    const kind = spec.choices.find((x) => x.id === spec.lineageChoice).title
    const pickName = `${kind}: ${lineage}`
    c.features.push({
      name: pickName,
      id: pickFeatureId({ name: pickName }),
      type: 'speciesTrait',
      _source: species.name,
      level_gained: 1,
      ...(picked[spec.spellAbilityChoice]
        ? { ability_choice: picked[spec.spellAbilityChoice] }
        : {}),
      ...(grants.spellsAtLevel
        ? { spells_at_level: grants.spellsAtLevel }
        : {}),
    })
  }
  // Darkvision, resistances and advantages are not stored: featureGrants.characterGrants derives them
  // from the features and the lineage (a feature's grants_* in feature-mechanics.json).
  if (grants.speed) c.speed = grants.speed
  const addSpell = (name, level, extra = {}) => {
    if (!findSpellRecord(name, '2024')) {
      warn(`${name} is not in the 2024 spell data.`)
      return
    }
    if (c.spells.some((s) => same(s.name, name))) return
    c.spells.push({
      name,
      level,
      prepared: true,
      ...(level === 0 ? { type: 'cantrip' } : {}),
      featureGranted: true,
      _source: `${species.name}${lineage ? `: ${lineage}` : ''}`,
      ...extra,
    })
  }
  for (const n of [...(grants.cantrips ?? []), ...(spec.fixedCantrips ?? [])])
    addSpell(n, 0)
  for (const n of grants.alwaysPrepared ?? []) addSpell(n, 1, { always: true })

  // What each trait grants outright, read from its feature-mechanics entry (featureGrants.js): the
  // spells it casts (with their free casts), and the proficiencies it gives. A skill already held is
  // replaced by one of the player's choice, as the rules say for any duplicate proficiency.
  for (const f of c.features.filter((x) => x.type === 'speciesTrait')) {
    const g = effectiveGrants(f)
    for (const spellName of g.grants_spells?.fixed ?? []) {
      const free = g.grants_spells.free_cast?.[spellName]
      // a free cast "a number of times equal to your Proficiency Bonus" keeps its formula on the
      // spell, so the count follows the level
      const count = free ? resolveAmount(free.count, c).value : 0
      addSpell(
        spellName,
        findSpellRecord(spellName, '2024')?.level ?? 1,
        free
          ? {
              uses_max: count,
              uses_current: count,
              recharge: free.recharge,
              ...(typeof free.count === 'object'
                ? { uses_formula: free.count }
                : {}),
            }
          : { always: true }
      )
      f.spells_granted = [spellName]
      // the ability the trait casts with: its own (Light Bearer: Charisma), or the one picked with
      // the lineage (Otherworldly Presence uses the Fiendish Legacy's)
      const ability =
        g.grants_spells.ability ??
        (g.grants_spells.ability_from === 'lineage' ||
        picked[spec.spellAbilityChoice]
          ? picked[spec.spellAbilityChoice]
          : null)
      if (ability && !f.ability_choice) f.ability_choice = ability
    }
    const pg = proficiencyGrants(f)
    const heldSkill = (x) => c.skill_proficiencies.some((p) => same(p, x))
    const freeSkills = () => SKILL_NAMES().filter((x) => !heldSkill(x))
    for (const sk of pg.skills) {
      if (!heldSkill(sk)) c.skill_proficiencies.push(sk)
      else {
        const alt = ask(
          'species.skillAlt',
          `${species.name}: ${sk} (already known), another skill`,
          freeSkills(),
          picks.skillAlt
        )
        if (alt) c.skill_proficiencies.push(alt)
      }
    }
    if (pg.skillChoice) {
      const pool =
        pg.skillChoice.options === 'any'
          ? freeSkills()
          : pg.skillChoice.options.filter((x) => !heldSkill(x))
      const chosen = ask(
        'species.skillChoice',
        `${f.name}: skill`,
        pool,
        picks.skillChoice,
        { count: pg.skillChoice.count }
      )
      if (chosen) c.skill_proficiencies.push(...[].concat(chosen))
    }
    for (const [list, held] of [
      [pg.weapons, c.weapon_proficiencies],
      [pg.armor, c.armor_proficiencies],
      [pg.tools, c.tool_proficiencies],
    ])
      for (const x of list) if (!held.some((p) => same(p, x))) held.push(x)
  }

  // the languages a homebrew species lists as its own
  for (const l of homebrew?.languages ?? [])
    if (!c.languages.some((x) => same(x, l))) c.languages.push(l)

  if (speciesName === 'Elf' && picked.keenSenses)
    c.skill_proficiencies.push(picked.keenSenses)
  if (speciesName === 'Human')
    return { versatile: picks.versatile, skillful: picked.skillful }
  return {}
}

const GOLIATH_BOONS = [
  "Cloud's Jaunt",
  "Fire's Burn",
  "Frost's Chill",
  "Hill's Tumble",
  "Stone's Endurance",
  "Storm's Thunder",
]
const isGoliathBoon = (species, trait) =>
  species === 'Goliath' && GOLIATH_BOONS.some((b) => trait.startsWith(b))

// ── the whole character ───────────────────────────────────────────────────────────────────────

function createCharacter2024(answers = {}) {
  const choices = []
  const warnings = []
  const ask = makeAsker(choices)
  const warn = (m) => warnings.push(m)
  const a = answers
  const picks = a.speciesPicks ?? {}

  const c = {
    name: a.name?.trim() || 'New Character',
    ruleset: '2024',
    level: 0,
    ability_base: {},
    ability_score_history: [],
    hp_max: 0,
    hp_current: 0,
    hit_dice_current: 0,
    features: [],
    spells: [],
    skill_proficiencies: [],
    skill_expertise: [],
    tool_proficiencies: [],
    languages: ['Common'],
    saving_throws: [],
    armor_proficiencies: [],
    weapon_proficiencies: [],
    classes: [],
  }

  // species
  const speciesNames = listNewCharacterSpecies()
  const speciesName = ask('species', 'Species', speciesNames, a.species, {
    prompt: 'Choose a species.',
  })

  // background (before the species picks so a chosen skill is not offered twice)
  const bgNames = listBackgrounds('2024').map((b) => b.name)
  const bgPick = ask('background', 'Background', bgNames, a.background, {
    prompt: 'Choose a background.',
  })
  const bg = bgPick ? loadBackground(bgPick, '2024') : null
  let backgroundTool = null // the tool the background gave, which its equipment may name again
  if (bg) {
    c.background = bg.name
    for (const id of bg.skill_proficiencies ?? []) {
      const n = skillNameOf(id)
      if (n && !c.skill_proficiencies.includes(n)) c.skill_proficiencies.push(n)
    }
    const tp = bg.tool_proficiency ?? {}
    for (const t of tp.fixed ?? []) c.tool_proficiencies.push(t)
    backgroundTool = tp.fixed?.[0] ?? null
    if (tp.choose) {
      const pool = TOOL_CATEGORIES[tp.choose.replace(/’/g, "'")] ?? []
      const t = ask(
        'background.tool',
        `${bg.name}: ${tp.choose}`,
        pool.filter((x) => !c.tool_proficiencies.some((p) => same(p, x))),
        a.backgroundTool
      )
      if (t) {
        c.tool_proficiencies.push(t)
        backgroundTool = t
      }
    }
  }

  const speciesExtra = speciesName
    ? applySpecies(c, speciesName, picks, ask, warn)
    : {}
  if (speciesName === 'Human' && speciesExtra.skillful)
    c.skill_proficiencies.push(speciesExtra.skillful)

  // origin feats: the background's, then Human's Versatile
  if (bg?.feat) {
    const list = /\(([^)]*)\)$/.exec(bg.feat)?.[1] ?? null
    addOriginFeat(
      c,
      bg.feat,
      'origin',
      bg.name,
      a.featPicks?.background ?? {},
      list,
      ask,
      warn
    )
  }
  if (speciesName === 'Human') {
    const origin = listFeats('2024')
      .filter((f) => f.category === 'origin')
      .map((f) => f.name)
      .filter(
        (n) => !c.features.some((f) => f.type === 'feat' && same(f.name, n))
      )
    const feat = ask(
      'species.versatile',
      'Human: Versatile (Origin feat)',
      origin,
      picks.versatile,
      {
        prompt:
          'Humans gain an Origin feat of their choice (Skilled is suggested).',
      }
    )
    if (feat)
      addOriginFeat(
        c,
        feat,
        'species',
        'Human',
        a.featPicks?.versatile ?? {},
        null,
        ask,
        warn
      )
  }

  // languages: Common and two more
  const standard = listLanguages()
    .filter((l) => l.type === 'standard' && l.name !== 'Common')
    .map((l) => l.name)
  const langs = ask('languages', 'Languages', standard, a.languages, {
    count: 2,
    prompt: 'You know Common and two other standard languages.',
  })
  if (langs) c.languages.push(...langs)

  // ability scores
  const scores = a.scores
  const method = a.scoreMethod
  let base = null
  if (scores && ABILITIES.every((k) => Number.isInteger(scores[k]))) {
    if (method === 'pointBuy') {
      try {
        const v = validatePointBuy(scores)
        if (v.valid) base = { ...scores }
        else warn(`Point buy costs ${v.cost}; the budget is ${v.budget}.`)
      } catch (err) {
        warn(err.message)
      }
    } else if (method === 'standardArray') {
      const sorted = ABILITIES.map((k) => scores[k]).sort((x, y) => y - x)
      if (sorted.join() === STANDARD_ARRAY.join()) base = { ...scores }
      else warn('Standard array scores must be 15, 14, 13, 12, 10 and 8.')
    } else if (method === 'rolled') {
      if (ABILITIES.every((k) => scores[k] >= 3 && scores[k] <= 18))
        base = { ...scores }
      else warn('Rolled scores must be between 3 and 18.')
    }
  }
  choices.push({
    id: 'scores',
    section: 'scores',
    title: 'Ability scores',
    prompt:
      'Set the six scores by point buy (27 points, 8 to 15), the standard array, or a roll.',
    kind: 'scores',
    answered: Boolean(base),
    answer: base ? { method, scores: base } : null,
  })

  // background ability bonus
  let bonus = null
  if (bg) {
    const options = bg.ability_scores ?? []
    const b = a.backgroundBonus ?? {}
    if (b.mode === 'oneOneOne') bonus = options.map((ab) => [ab, 1])
    else if (
      b.mode === 'twoOne' &&
      options.includes(b.plus2) &&
      options.includes(b.plus1) &&
      b.plus2 !== b.plus1
    )
      bonus = [
        [b.plus2, 2],
        [b.plus1, 1],
      ]
    choices.push({
      id: 'backgroundBonus',
      section: 'background',
      title: `${bg.name}: ability score bonus`,
      prompt: `Add +2 to one and +1 to another of ${options
        .map(abilityLabel)
        .join(', ')}, or +1 to all three.`,
      kind: 'abilityBonus',
      options: options.map((value) => ({ value, label: abilityLabel(value) })),
      answered: Boolean(bonus),
      answer: bonus ? a.backgroundBonus : null,
    })
  }
  if (base) {
    c.ability_base = { ...base }
    for (const k of ABILITIES) c[`stat_${k}`] = base[k]
    c.ability_score_method = {
      pointBuy: 'point buy',
      standardArray: 'standard array',
      rolled: 'rolled',
    }[method]
    for (const [ab, amount] of bonus ?? []) {
      c[`stat_${ab}`] += amount
      c.ability_score_history.push({
        ability: ab,
        amount,
        source: bg.name,
        level_gained: 1,
      })
    }
  }

  // starting class
  const classNames = listClasses('2024').map((x) => x.name ?? x)
  const cls = ask('className', 'Class', classNames, a.className, {
    prompt: 'Choose a class.',
  })
  const equipment = [] // the chosen packages
  let classTool = null // the tool the class gave (the Monk's equipment names it)
  let startingEquipment = { items: [], gold: 0 }
  if (cls) {
    const data = loadClass(cls, '2024')
    c.classes = [{ name: cls, level: 0, started: true }]
    c.saving_throws = [...(data.saving_throw_proficiencies ?? [])]
    c.armor_proficiencies = [...(data.armor_proficiencies ?? [])]
    c.weapon_proficiencies = [...(data.weapon_proficiencies ?? [])]
    const sc = data.skill_choices ?? { count: 0, options: [] }
    if (sc.count) {
      // 'any' (the Bard) is every skill
      const options = (
        Array.isArray(sc.options) ? sc.options.map(skillNameOf) : SKILL_NAMES()
      )
        .filter(Boolean)
        .filter((s) => !c.skill_proficiencies.some((p) => same(p, s)))
      const chosen = ask(
        'classSkills',
        `${cls}: skills`,
        options,
        a.classSkills,
        {
          count: sc.count,
          prompt: `Choose ${sc.count} skills from the ${cls} list (skills you already have are left out).`,
        }
      )
      if (chosen) c.skill_proficiencies.push(...chosen)
    }

    // The class's tool proficiencies: fixed ones, then a pick for each "choose" (Bard 3 instruments, Monk
    // 1 artisan's tool or instrument, Artificer 1 artisan's tool). A tool already held is not offered twice.
    const tools = data.tool_proficiencies ?? {}
    for (const t of tools.fixed ?? [])
      if (!c.tool_proficiencies.some((p) => same(p, t)))
        c.tool_proficiencies.push(t)
    for (const [i, ch] of (tools.choose ?? []).entries()) {
      const pool = [
        ...new Set(ch.from.flatMap((k) => TOOL_CATEGORIES[k] ?? [])),
      ]
      const given = ask(
        i === 0 ? 'classTools' : `classTools${i}`,
        `${cls}: tool proficiency`,
        pool.filter((x) => !c.tool_proficiencies.some((p) => same(p, x))),
        a.classTools,
        {
          count: ch.count,
          prompt: `Choose ${ch.count} (${ch.from.join(' or ')}).`,
        }
      )
      if (given) {
        const list = [].concat(given)
        c.tool_proficiencies.push(...list)
        classTool = list[0]
      }
    }

    // Starting equipment: one class package and one background package (the last is gold only).
    const equipmentAnswers = a.equipment ?? {}
    const named = { backgroundTool, classTool }
    const pickPackage = (id, title, source, given) => {
      const keys = ['A', 'B', 'C'].filter((k) => source?.[k])
      const key = ask(
        id,
        title,
        keys.map((k) => ({
          value: k,
          label: `${k}: ${
            source[k].items?.length ? '' : 'Gold only, '
          }${describePackage(source[k])}`,
        })),
        given,
        { prompt: 'Take one package.' }
      )
      if (!key) return
      equipment.push(source[key])
      // a package may name an item the player supplies (an instrument, a gaming set)
      for (const entry of source[key].items ?? []) {
        const ph = placeholder(entry.name)
        if (ph?.pool) {
          named[ph.key] = ask(
            `equipment.${ph.key}`,
            entry.name,
            TOOL_CATEGORIES[ph.pool],
            equipmentAnswers[ph.key]
          )
        }
      }
    }
    pickPackage(
      'equipment.class',
      `${cls}: starting equipment`,
      data.starting_equipment,
      equipmentAnswers.class
    )
    if (bg)
      pickPackage(
        'equipment.background',
        `${bg.name}: starting equipment`,
        bg.equipment,
        equipmentAnswers.background
      )
    const bought = equipment.map((pkg) => packageToItems(pkg, c.name, named))
    startingEquipment = {
      items: bought.flatMap((x) => x.items),
      gold: bought.reduce((n, x) => n + x.gold, 0),
    }
  }

  c.level_history = [
    {
      kind: 'origin',
      recorded: 'level-up',
      species: c.subgenus ? `${c.genus} (${c.subgenus})` : c.genus,
      background: c.background,
      ability_scores: c.ability_score_method,
      feats: c.features.filter((f) => f.type === 'feat').map((f) => f.name),
    },
  ]
  return {
    character: c,
    grants: characterGrants(c),
    equipment: startingEquipment,
    choices,
    pending: choices.filter((x) => !x.answered),
    warnings,
  }
}

module.exports = { createCharacter2024, listNewCharacterSpecies }
