// One uniform description of the choices a level-up asks for, and one way to answer them.
//
// diffLevelUp reports what is still undecided as `pendingChoices` (about 26 differently
// shaped objects) and takes the answers as about 26 differently named parameters. This
// module sits on top of it so that nothing outside the engine has to know that:
//
//   const r = previewLevelUp(character, { className, toLevel, hpMethod }, answers)
//   r.choices   -> [{ id, type, level, title, prompt, kind, min, max, options, answered, answer }]
//   r.complete  -> true when every choice has an answer
//   r.patch     -> what the character becomes (as diffLevelUp's patch, with the answers applied)
//
// A UI renders `choices` generically and sends back `answers = { [choice.id]: answer }`:
//   kind 'pick'       answer = array of option values (exactly `min`..`max` of them)
//   kind 'pickEach'   answer = array with one option value per entry of `slots`
//   kind 'asiOrFeat'  answer = { type:'asi', increases:{str:2} }
//                           or { type:'feat', featName, abilityChoice?, choices? }
//   kind 'subclass'   answer = [subclass name]   (same as 'pick')
// The NPC builder and the tests answer with `autoAnswers` (a policy over the same
// descriptions), so there is one answering path for people and for scripts.
//
// Server/engine side only (reads the spell lists, feats and invocation tables).

const { diffLevelUp } = require('./diffLevelUp')
const { listSpellsForClass, effectiveMaxSpellLevel } = require('./spellLists')
const { listFeats } = require('./grants')
const { meetsFeatPrerequisites } = require('./featPrerequisites')
const {
  listInvocations,
  meetsInvocationPrerequisite,
} = require('./invocations')
const { listSubclasses } = require('./subclasses')
const { loadClass } = require('./classFeatures')
const { loadSkill } = require('./skills')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const titleCase = (s) =>
  String(s)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
const norm = (s) => String(s).toLowerCase()
const opt = (value, label = value, extra = {}) => ({ value, label, ...extra })
const plain = (list = []) =>
  list.map((o) =>
    typeof o === 'string' ? opt(o) : opt(o.value ?? o.name, o.label ?? o.name)
  )
const spellOpt = (s, known) =>
  opt(s.name, s.name, {
    level: s.level,
    school: s.school,
    ...(known.has(norm(s.name))
      ? { disabled: true, reason: 'already known' }
      : {}),
  })

// ── option sources the engine has to look up ──────────────────────────────

function knownSpellNames(character) {
  return new Set((character.spells || []).map((s) => norm(s.name)))
}
function classSpellContext(ctx) {
  const { character, className, toLevel } = ctx
  const entry = (character.classes || []).find((c) => c.name === className)
  const subclassName = entry?.subclass
  const thirdCaster = ['Eldritch Knight', 'Arcane Trickster'].includes(
    subclassName
  )
  const maxLevel =
    effectiveMaxSpellLevel({
      className,
      subclassName,
      level: toLevel,
      otherClasses: (character.classes || [])
        .filter((c) => c.name !== className)
        .map((c) => ({ name: c.name, level: c.level, subclass: c.subclass })),
    }) || 1
  return { listClass: thirdCaster ? 'Wizard' : className, maxLevel }
}
const spells = (listClass, o, known) =>
  listSpellsForClass(listClass, { extraFilter: (r) => !r.homebrew, ...o }).map(
    (s) => spellOpt(s, known)
  )

// ── what each kind of pending choice looks like and where its answer goes ──
// `apply(inputs, p, values)` folds the answer into diffLevelUp's own parameters.

const setIn = (inputs, key, v) => {
  inputs[key] = v
}
const concatIn = (inputs, key, values) => {
  inputs[key] = [...(inputs[key] || []), ...values]
}
const c24 = (inputs) => (inputs.choices2024 ||= {})
const c24Add = (inputs, key, values) => {
  const o = c24(inputs)
  o[key] = [...(o[key] || []), ...values]
}

const SPECS = {
  newCantrips: {
    title: 'New cantrips',
    prompt: (p) => `Choose ${p.count} cantrip${p.count === 1 ? '' : 's'}.`,
    options: (p, ctx) =>
      spells(
        classSpellContext(ctx).listClass,
        { cantripsOnly: true },
        knownSpellNames(ctx.character)
      ),
    apply: (i, p, v) =>
      ((i.spellChoices ||= {}).cantrips = [
        ...((i.spellChoices || {}).cantrips || []),
        ...v,
      ]),
  },
  newKnownSpells: {
    title: 'Spells',
    prompt: (p) => `Choose ${p.count} spell${p.count === 1 ? '' : 's'}.`,
    options: (p, ctx) => {
      const { listClass, maxLevel } = classSpellContext(ctx)
      return spells(listClass, { maxLevel }, knownSpellNames(ctx.character))
    },
    apply: (i, p, v) =>
      ((i.spellChoices ||= {}).spells = [
        ...((i.spellChoices || {}).spells || []),
        ...v,
      ]),
  },
  spellbookAdditions: {
    title: 'Add to your spellbook',
    prompt: (p) => `Add ${p.count ?? 2} Wizard spells to your spellbook.`,
    options: (p, ctx) =>
      spells(
        'Wizard',
        { maxLevel: classSpellContext(ctx).maxLevel },
        knownSpellNames(ctx.character)
      ),
    apply: (i, p, v) => concatIn(i, 'spellbookChoices', v),
  },
  magicalSecretsChoice: {
    title: 'Magical Secrets',
    prompt: (p) => `Choose ${p.count ?? 2} spells from any class's list.`,
    options: (p, ctx) =>
      spells(
        'Bard',
        { maxLevel: classSpellContext(ctx).maxLevel, pool: 'any' },
        knownSpellNames(ctx.character)
      ),
    apply: (i, p, v) => concatIn(i, 'magicalSecretsChoice', v),
  },
  invocationChoice: {
    title: 'Eldritch Invocations',
    prompt: (p) => `Choose ${p.count} invocation${p.count === 1 ? '' : 's'}.`,
    options: (p, ctx) => {
      const have = new Set(
        (ctx.character.features || []).map((f) => norm(f.name))
      )
      return listInvocations()
        .filter((o) => (o.level ?? 1) <= ctx.toLevel)
        .map((o) => {
          const met = meetsInvocationPrerequisite(ctx.character, o.name)
          const owned = have.has(norm(o.name))
          return opt(o.name, o.name, {
            description: o.description ?? null,
            legacy: o.legacy === true,
            ...(owned
              ? { disabled: true, reason: 'already known' }
              : met && met.met === false
              ? { disabled: true, reason: met.reason ?? 'prerequisite not met' }
              : {}),
          })
        })
    },
    apply: (i, p, v) => concatIn(i, 'invocationChoices', v),
  },
  pactBoonChoice: {
    title: 'Pact Boon',
    prompt: () => 'Choose a Pact Boon.',
    options: () =>
      plain(['Pact of the Blade', 'Pact of the Chain', 'Pact of the Tome']),
    apply: (i, p, v) => setIn(i, 'pactBoonChoice', v[0]),
  },
  fightingStyleChoice: {
    title: 'Fighting Style',
    prompt: (p) =>
      `Choose ${p.count ?? 1} Fighting Style feat${
        (p.count ?? 1) === 1 ? '' : 's'
      }.`,
    apply: (i, p, v) => c24Add(i, 'fightingStyle', v),
  },
  weaponMasteryChoice: {
    title: 'Weapon Mastery',
    prompt: (p) =>
      `Choose ${p.count} weapons whose Mastery property you can use.`,
    label: titleCase,
    apply: (i, p, v) => c24Add(i, 'weaponMastery', v),
  },
  divineOrderChoice: {
    title: 'Divine Order',
    prompt: () => 'Choose a Divine Order.',
    apply: (i, p, v) => (c24(i).divineOrder = v[0]),
  },
  primalOrderChoice: {
    title: 'Primal Order',
    prompt: () => 'Choose a Primal Order.',
    apply: (i, p, v) => (c24(i).primalOrder = v[0]),
  },
  skillChoice: {
    title: (p) => p.source ?? 'Skill',
    prompt: (p) =>
      `Choose ${p.count ?? 1} skill${(p.count ?? 1) === 1 ? '' : 's'}${
        p.source ? ` for ${p.source}` : ''
      }.`,
    label: (o) => loadSkill(o)?.name ?? titleCase(o),
    apply: (i, p, v) => (c24(i).primalKnowledgeSkill = v[0]),
  },
  expertiseChoice: {
    title: 'Expertise',
    prompt: (p) => `Choose ${p.count ?? 2} skills to gain Expertise in.`,
    apply: (i, p, v) => ((c24(i).expertise ||= {})[p.level] = v),
  },
  metamagicChoice: {
    title: 'Metamagic',
    prompt: (p) =>
      `Choose ${p.count} Metamagic option${p.count === 1 ? '' : 's'}.`,
    apply: (i, p, v) => c24Add(i, 'metamagic', v),
  },
  maneuverChoice: {
    title: 'Maneuvers',
    prompt: (p) => `Choose ${p.count} maneuver${p.count === 1 ? '' : 's'}.`,
    apply: (i, p, v) => ((i.maneuverChoices ||= {})[p.level] = v),
  },
  bonusProficienciesChoice: {
    title: 'Bonus proficiencies',
    prompt: (p) => `Choose ${p.count} proficiencies.`,
    apply: (i, p, v) => setIn(i, 'bonusProficienciesChoice', v),
  },
  favoredEnemyChoice: {
    title: 'Favored Enemy',
    prompt: () => 'Choose a Favored Enemy.',
    apply: (i, p, v) => setIn(i, 'favoredEnemyChoice', v[0]),
  },
  naturalExplorerChoice: {
    title: 'Natural Explorer',
    prompt: () => 'Choose a favored terrain.',
    apply: (i, p, v) => setIn(i, 'naturalExplorerChoice', v[0]),
  },
  ironMindChoice: {
    title: 'Iron Mind',
    prompt: () => 'Choose a saving throw proficiency.',
    apply: (i, p, v) => setIn(i, 'ironMindChoice', v[0]),
  },
  bladesingerWeaponChoice: {
    title: 'Bladesong weapon',
    prompt: () => 'Choose a one-handed melee weapon.',
    apply: (i, p, v) => setIn(i, 'bladesingerWeaponChoice', v[0]),
  },
  divineMagicChoice: {
    title: 'Divine Magic',
    prompt: () => 'Choose an alignment affinity.',
    label: titleCase,
    apply: (i, p, v) => setIn(i, 'divineMagicChoice', v[0]),
  },
  dragonAncestorChoice: {
    title: 'Dragon Ancestor',
    prompt: () => 'Choose a dragon ancestor.',
    apply: (i, p, v) => setIn(i, 'dragonAncestorChoice', v[0]),
  },
  mysticArcanumChoice: {
    title: 'Mystic Arcanum',
    prompt: () => 'Choose a spell for your Mystic Arcanum.',
    apply: (i, p, v) => setIn(i, 'mysticArcanumChoice', v[0]),
  },
  masterOfIntrigueGamingSetChoice: {
    title: 'Gaming set',
    prompt: () => 'Choose a gaming set.',
    apply: (i, p, v) => setIn(i, 'masterOfIntrigueGamingSetChoice', v[0]),
  },
  masterOfIntrigueLanguageChoice: {
    title: 'Languages',
    prompt: (p) => `Choose ${p.count ?? 2} languages.`,
    apply: (i, p, v) => setIn(i, 'masterOfIntrigueLanguageChoices', v),
  },
  multiclassSkillChoice: {
    title: 'Multiclass skill',
    prompt: () => 'Choose a skill proficiency from your new class.',
    options: (p, ctx) => {
      const owned = new Set(
        (ctx.character.skill_proficiencies || []).map((s) =>
          norm(s).replace(/ /g, '_')
        )
      )
      const ids = p.options?.length
        ? p.options
        : loadClass(p.className || ctx.className)?.skill_choices?.options || []
      return ids
        .map((o) => (typeof o === 'string' ? o : o.id || o.name))
        .map((id) =>
          opt(
            id,
            loadSkill(id)?.name ?? titleCase(id),
            owned.has(norm(id))
              ? { disabled: true, reason: 'already proficient' }
              : {}
          )
        )
    },
    apply: (i, p, v) => setIn(i, 'multiclassSkillChoice', v[0]),
  },
  subclassChoice: {
    kind: 'subclass',
    title: 'Subclass',
    prompt: (p, ctx) => `Choose your ${ctx.className} subclass.`,
    options: (p, ctx) =>
      listSubclasses()
        .filter((s) => s.class === ctx.className)
        .map((s) => opt(s.name, s.name, { legacy: s.legacy === true })),
    // The subclass lives on the character record, not in diffLevelUp's parameters.
    character: (character, p, v, ctx) => ({
      ...character,
      classes: character.classes.map((c) =>
        c.name === ctx.className && !c.subclass ? { ...c, subclass: v[0] } : c
      ),
    }),
  },
}

// spellMasteryChoice / signatureSpellsChoice: fixed spell levels, taken from the Wizard list.
SPECS.spellMasteryChoice = {
  kind: 'pickEach',
  title: 'Spell Mastery',
  prompt: () =>
    'Choose one 1st-level and one 2nd-level Wizard spell you can cast without a slot.',
  slots: (p, ctx) => {
    const known = knownSpellNames(ctx.character)
    return [1, 2].map((lvl) => ({
      label: `${lvl === 1 ? '1st' : '2nd'}-level spell`,
      options: spells(
        'Wizard',
        { maxLevel: lvl, extraFilter: (r) => r.level === lvl && !r.homebrew },
        known
      ),
    }))
  },
  apply: (i, p, v) => setIn(i, 'spellMasteryChoice', v),
}
SPECS.signatureSpellsChoice = {
  title: 'Signature Spells',
  prompt: () => 'Choose two 3rd-level Wizard spells.',
  count: () => 2,
  options: (p, ctx) =>
    spells(
      'Wizard',
      { maxLevel: 3, extraFilter: (r) => r.level === 3 && !r.homebrew },
      knownSpellNames(ctx.character)
    ),
  apply: (i, p, v) => setIn(i, 'signatureSpellsChoice', v),
}

// ── the ability score improvement / feat choice ───────────────────────────

// The character as they will be once this level is gained (a feat taken at level 19 asks for
// level 19, which the sheet does not have yet).
function atNewLevel(ctx) {
  const classes = (ctx.character.classes || []).map((c) =>
    c.name === ctx.className ? { ...c, level: ctx.toLevel } : c
  )
  return {
    ...ctx.character,
    classes,
    level: classes.reduce((n, c) => n + (c.level || 0), 0),
  }
}

function featOptions(ctx) {
  const after = atNewLevel(ctx)
  return listFeats()
    .filter((f) =>
      ctx.epicBoon
        ? f.category === 'epic_boon'
        : f.category !== 'epic_boon' &&
          f.category !== 'origin' &&
          f.category !== 'fighting_style'
    )
    .map((f) => {
      const met = meetsFeatPrerequisites(after, f.name)
      const asi = f.ability_score_increase ?? null
      return {
        name: f.name,
        category: f.category ?? null,
        legacy: f.legacy === true,
        repeatable: f.repeatable === true,
        eligible: !met || met.met !== false,
        reason: met && met.met === false ? met.reason ?? null : null,
        abilityChoices: asi?.choice_of ?? null,
        abilityAmount: asi?.amount ?? null,
        abilityCap: asi?.max_score ?? null,
        choices: f.choices ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function describeAsiOrFeat(p, ctx) {
  const scores = Object.fromEntries(
    ABILITIES.map((a) => [a, ctx.character[`stat_${a}`] ?? 10])
  )
  return {
    kind: 'asiOrFeat',
    title: p.epicBoon ? 'Epic Boon' : 'Ability Score Improvement',
    prompt: p.epicBoon
      ? 'Choose an Epic Boon feat.'
      : 'Increase one ability score by 2, or two by 1 each (maximum 20), or take a feat.',
    epicBoon: p.epicBoon === true,
    points: 2,
    cap: 20,
    scores,
    feats: featOptions({ ...ctx, epicBoon: p.epicBoon }),
    allowAsi: !p.epicBoon,
  }
}

// ── building descriptors ──────────────────────────────────────────────────

function describeChoice(p, ctx, id) {
  if (p.type === 'asiOrFeat')
    return { id, type: p.type, level: p.level, ...describeAsiOrFeat(p, ctx) }
  const spec = SPECS[p.type]
  if (!spec) {
    // A pending choice this module has no description for: still reported, never silently dropped.
    return {
      id,
      type: p.type,
      level: p.level ?? null,
      kind: 'unknown',
      title: p.type,
      prompt: 'This choice has no description yet.',
      options: [],
      min: 0,
      max: 0,
      raw: p,
    }
  }
  const title =
    typeof spec.title === 'function' ? spec.title(p, ctx) : spec.title
  const base = {
    id,
    type: p.type,
    level: p.level ?? null,
    title,
    prompt: spec.prompt(p, ctx),
    kind: spec.kind ?? 'pick',
    source: p.source ?? null,
  }
  if (spec.slots) {
    const slots = spec.slots(p, ctx)
    return { ...base, slots, min: slots.length, max: slots.length }
  }
  const options = spec.options
    ? spec.options(p, ctx)
    : (p.options || []).map((o) =>
        typeof o === 'string'
          ? opt(o, spec.label ? spec.label(o) : o)
          : opt(o.value ?? o.name, o.label ?? o.name)
      )
  const count = spec.count ? spec.count(p) : p.count ?? 1
  return { ...base, min: count, max: count, options }
}

function choiceIds(pending) {
  const seen = {}
  return pending.map((p) => {
    const base = `${p.type}@${p.level ?? ''}${p.source ? `:${p.source}` : ''}`
    seen[base] = (seen[base] ?? 0) + 1
    return seen[base] === 1 ? base : `${base}#${seen[base]}`
  })
}

// Is `answer` a well-formed answer to this description? Returns an error string or null.
function checkAnswer(d, answer) {
  if (d.kind === 'asiOrFeat') {
    if (!answer || !answer.type)
      return 'answer { type: "asi" | "feat" } required'
    return null
  }
  if (!Array.isArray(answer)) return 'answer must be an array of option values'
  if (answer.length < d.min || answer.length > d.max)
    return `choose ${d.min === d.max ? d.min : `${d.min}-${d.max}`}, got ${
      answer.length
    }`
  const allowed = d.slots
    ? d.slots.map((s) => new Set(s.options.map((o) => o.value)))
    : new Set(d.options.map((o) => o.value))
  for (let i = 0; i < answer.length; i++) {
    const set = d.slots ? allowed[i] : allowed
    if (set.size && !set.has(answer[i]))
      return `"${answer[i]}" is not one of the options`
  }
  if (new Set(answer).size !== answer.length)
    return 'the same option was chosen twice'
  return null
}

// Fold the valid answers into diffLevelUp's parameters. An answer that does not fit its
// description is left out (and reported by previewLevelUp), never half-applied.
function applyAnswers(seen, answers, character, ctx) {
  const inputs = {}
  let nextCharacter = character
  for (const { d, p } of seen) {
    const a = answers[d.id]
    if (a === undefined || a === null || checkAnswer(d, a)) continue
    if (d.kind === 'asiOrFeat') {
      ;(inputs.asiOrFeatResolutions ||= {})[p.level] = a
      continue
    }
    const spec = SPECS[d.type]
    if (!spec) continue
    if (spec.character) nextCharacter = spec.character(nextCharacter, p, a, ctx)
    if (spec.apply) spec.apply(inputs, p, a)
  }
  return { inputs, character: nextCharacter }
}

// Level a class once, with whatever answers have been given so far. New questions can appear
// once others are answered (a subclass unlocks its own picks), so this settles by repeating.
// Every question seen along the way is reported, answered or not, as it was first asked.
function previewLevelUp(character, opts, answers = {}) {
  const { className, toLevel } = opts
  let current = character
  let inputs = {}
  let result
  const seen = [] // { d: description, p: the pending choice it came from }
  for (let pass = 0; pass < 8; pass++) {
    result = diffLevelUp(current, { ...opts, ...inputs })
    const pending = result.pendingChoices || []
    const ctx = { character: current, className, toLevel }
    const ids = choiceIds(pending)
    pending.forEach((p, i) => {
      if (!seen.some((s) => s.d.id === ids[i]))
        seen.push({ d: describeChoice(p, ctx, ids[i]), p })
    })
    const applied = applyAnswers(seen, answers, current, ctx)
    const same =
      JSON.stringify(applied.inputs) === JSON.stringify(inputs) &&
      applied.character === current
    inputs = applied.inputs
    current = applied.character
    if (same) break
  }
  const problems = []
  const choices = seen.map(({ d }) => {
    const answer = answers[d.id]
    if (answer === undefined || answer === null)
      return { ...d, answered: false, answer: null }
    const err = checkAnswer(d, answer)
    if (err) problems.push({ id: d.id, error: err })
    return { ...d, answered: !err, answer, ...(err ? { error: err } : {}) }
  })
  const { pendingChoices, ...rest } = result
  return {
    ...rest,
    choices,
    complete: choices.every((c) => c.answered),
    problems,
  }
}

// ── answering by policy (NPC builder, tests, migrations) ─────────────────

const orderBy = (options, preferred = []) => {
  const rank = (o) => {
    const i = preferred.findIndex((p) => norm(p) === norm(o.value))
    return i < 0 ? Infinity : i
  }
  return [...options].sort((a, b) => rank(a) - rank(b))
}

// An answer for one description. `prefs.prefer[type]` = values to take first;
// `prefs.abilityOrder` = ability keys, most wanted first, for score increases.
function autoAnswer(d, prefs = {}) {
  if (d.kind === 'asiOrFeat') {
    if (d.epicBoon) {
      const boon =
        d.feats.find(
          (f) => f.eligible && /Combat Prowess|Boon of/.test(f.name)
        ) ?? d.feats.find((f) => f.eligible)
      return {
        type: 'feat',
        featName: boon.name,
        abilityChoice: (boon.abilityChoices || ['con']).includes('con')
          ? 'con'
          : boon.abilityChoices[0],
      }
    }
    const order =
      prefs.abilityOrder ??
      [...ABILITIES].sort((a, b) => d.scores[b] - d.scores[a])
    const increases = {}
    let left = d.points
    for (const a of order) {
      const spend = Math.min(Math.max(0, d.cap - d.scores[a]), left)
      if (spend > 0) increases[a] = spend
      left -= spend
      if (left <= 0) break
    }
    if (left > 0) increases.con = (increases.con ?? 0) + left
    return { type: 'asi', increases }
  }
  const prefer = prefs.prefer?.[d.type] ?? []
  if (d.slots)
    return d.slots.map(
      (s) =>
        orderBy(
          s.options.filter((o) => !o.disabled),
          prefer
        )[0]?.value
    )
  if (d.kind === 'subclass' && prefs.subclassName) return [prefs.subclassName]
  const open = orderBy(
    d.options.filter((o) => !o.disabled),
    prefer
  )
  return open.slice(0, d.max).map((o) => o.value)
}

// Level a class once, answering every choice by policy. Returns the final preview.
function autoLevelUp(character, opts, prefs = {}) {
  const answers = {}
  let r = null
  for (let i = 0; i < 8; i++) {
    r = previewLevelUp(character, opts, answers)
    const open = r.choices.filter((c) => !c.answered)
    if (!open.length) break
    for (const c of open) {
      if (c.kind === 'unknown')
        throw new Error(`No description for the "${c.type}" choice.`)
      answers[c.id] = autoAnswer(c, prefs)
    }
  }
  return { ...r, answers }
}

module.exports = {
  previewLevelUp,
  autoAnswer,
  autoLevelUp,
  describeChoice,
  SPECS,
}
