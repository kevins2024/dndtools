// A short history of the choices made at each level, kept on the character as
// `level_history` so a sheet can answer "why is this character how they are?" and
// a level-up that went wrong can be spotted afterwards.
//
// Entries are plain objects, newest last:
//   { kind: 'origin',    ... }  species, background, how the scores were made (level 0)
//   { kind: 'level',     class, level, hp, subclass?, features, choices, pending?, recorded }
//   { kind: 'migration', from, to, date, notes }  a ruleset migration
//   { kind: 'audit',     date, notes }            a correction made by hand or by an audit
//
// `recorded` says where an entry came from: 'level-up' = written by diffLevelUp at
// the moment of the level-up (exact); 'reconstructed' = rebuilt later from what the
// sheet records (class tables + the features, feats and score increases on the
// sheet), which cannot know dice rolls or the order a multiclass character took its
// levels — those parts are marked unrecorded rather than guessed.
//
// buildLevelEntry is pure; reconstructLevelHistory reads the class/subclass data
// through the usual loaders (fs), so it is for the server and scripts, not the browser.

const { hitDieForClass, asiLevelsForClass } = require('./progression')
const { loadClass, allFeaturesUpToLevel } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')
const { rulesetOf } = require('./rulesetId')

const mod = (score) => Math.floor((score - 10) / 2)
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const PLACEHOLDER = /subclass$|^ability score improvement$|^epic boon$/i

// The entry diffLevelUp appends. All arguments are things it already computed.
function buildLevelEntry({
  className,
  fromLevel,
  toLevel,
  characterLevel,
  firstEverLevel,
  hp,
  hpMethod,
  hpRolls,
  subclass,
  newFeatures,
  abilityScoreHistory,
  chosenSpells,
  spellbookAdditions,
  spellSwap,
  expertiseSkills,
  pendingChoices,
}) {
  const choices = []
  for (const h of abilityScoreHistory || [])
    choices.push({
      type: 'ability',
      detail: `+${h.amount} ${String(h.ability).toUpperCase()}`,
      source: h.source,
    })
  for (const f of newFeatures || [])
    if (f.type && !['feature', 'speciesTrait'].includes(f.type))
      choices.push({ type: f.type, detail: f.name })
  if (chosenSpells?.length)
    choices.push({ type: 'spells', detail: chosenSpells.join(', ') })
  if (spellbookAdditions?.length)
    choices.push({ type: 'spellbook', detail: spellbookAdditions.join(', ') })
  if (spellSwap)
    choices.push({
      type: 'spell-swap',
      detail: `${spellSwap.from} -> ${spellSwap.to}`,
    })
  if (expertiseSkills?.length)
    choices.push({ type: 'expertise', detail: expertiseSkills.join(', ') })
  const entry = {
    kind: 'level',
    class: className,
    level: toLevel,
    ...(toLevel - fromLevel > 1 ? { from_level: fromLevel + 1 } : {}),
    character_level: characterLevel,
    hp: {
      gain: hp.total,
      method: firstEverLevel ? 'max' : hpMethod,
      ...(hp.die != null ? { die: hp.die } : {}),
      ...(hp.con ? { con: hp.con } : {}),
      ...(hp.bonus ? { bonus: hp.bonus } : {}),
      ...(!firstEverLevel && hpMethod === 'roll' && hpRolls?.length
        ? { rolls: hpRolls }
        : {}),
    },
    ...(subclass ? { subclass } : {}),
    features: (newFeatures || []).map((f) => f.name),
    choices,
    ...(pendingChoices?.length
      ? { pending: pendingChoices.map((p) => p.type) }
      : {}),
    recorded: 'level-up',
  }
  return entry
}

// Rebuilds the history of an existing character from its sheet. See the header
// for what that can and cannot know.
function reconstructLevelHistory(character) {
  const ruleset = rulesetOf(character)
  const classes = character.classes || []
  const features = character.features || []
  const history = []
  const sheetNames = features.map((f) => norm(f.name))
  const onSheet = (name) => {
    const e = norm(name)
    return sheetNames.some(
      (n) =>
        n === e ||
        n.startsWith(`${e} `) ||
        e.startsWith(`${n} `) ||
        n.includes(e) ||
        (n.length > 4 && e.includes(n))
    )
  }
  const con = mod(character.stat_con)
  const started = classes.find((c) => c.started) || classes[0]
  const ordered = started
    ? [started, ...classes.filter((c) => c !== started)]
    : []
  const singleClass = classes.length === 1

  // level 0: where the character came from
  const origin = { kind: 'origin', recorded: 'reconstructed' }
  if (character.genus)
    origin.species = character.subgenus
      ? `${character.genus} (${character.subgenus})`
      : character.genus
  if (character.background) origin.background = character.background
  if (character.background_flavor)
    origin.background_flavor = character.background_flavor
  if (character.ability_score_method)
    origin.ability_scores = character.ability_score_method
  const originFeats = features.filter(
    (f) => f.type === 'feat' && ['origin', 'species'].includes(f._grant)
  )
  if (originFeats.length) origin.feats = originFeats.map((f) => f.name)
  history.push(origin)

  // hit points: only the total is kept on a sheet. If it equals "maximum at 1st level,
  // average after", every level can be stated; otherwise they are unrecorded.
  let hpPerLevel = null
  {
    const total = classes.reduce((n, c) => n + c.level, 0)
    let avg = 0
    let first = true
    for (const c of ordered) {
      const die = hitDieForClass(c.name)
      if (!die) {
        avg = null
        break
      }
      for (let l = 1; l <= c.level; l++) {
        avg += first ? die + con : Math.floor(die / 2) + 1 + con
        first = false
      }
    }
    const bonusPerLevel = features.some(
      (f) => f.type === 'feat' && /^tough$/i.test(f.name)
    )
      ? 2
      : 0
    if (avg != null) {
      const expected = avg + bonusPerLevel * total
      hpPerLevel = {
        matchesAverage: character.hp_max === expected,
        expected,
        actual: character.hp_max,
      }
    }
  }

  let characterLevel = 0
  for (const c of ordered) {
    const data = loadClass(c.name, ruleset)
    const sub = c.subclass ? loadSubclass(c.name, c.subclass, ruleset) : null
    const asiLevels = new Set(
      Object.entries(data?.features_by_level || {})
        .filter(([, names]) =>
          names.some((n) => /^Ability Score Improvement|^Epic Boon/i.test(n))
        )
        .map(([l]) => Number(l))
    )
    if (!asiLevels.size)
      asiLevelsForClass(c.name).forEach((l) => asiLevels.add(l))
    const grantedAt = new Map()
    for (const f of allFeaturesUpToLevel(c.name, c.level, ruleset))
      if (!PLACEHOLDER.test(f.name) && onSheet(f.name))
        grantedAt.set(f.level, [...(grantedAt.get(f.level) || []), f.name])
    for (const [lvl, names] of Object.entries(sub?.features_by_level || {}))
      if (Number(lvl) <= c.level)
        for (const n of names)
          if (!PLACEHOLDER.test(n) && onSheet(n))
            grantedAt.set(Number(lvl), [
              ...(grantedAt.get(Number(lvl)) || []),
              n,
            ])
    const die = hitDieForClass(c.name)
    for (let lvl = 1; lvl <= c.level; lvl++) {
      characterLevel += 1
      const entry = {
        kind: 'level',
        class: c.name,
        level: lvl,
        character_level: singleClass ? lvl : null,
        hp: hpPerLevel?.matchesAverage
          ? {
              gain:
                (characterLevel === 1 ? die : Math.floor(die / 2) + 1) +
                con +
                (features.some(
                  (f) => f.type === 'feat' && /^tough$/i.test(f.name)
                )
                  ? 2
                  : 0),
              method: characterLevel === 1 && c === started ? 'max' : 'average',
              inferred: true,
            }
          : { gain: null, method: 'unrecorded' },
      }
      if (c.subclass && lvl === data?.subclass_choice_level)
        entry.subclass = c.subclass
      entry.features = grantedAt.get(lvl) || []
      const choices = []
      if (asiLevels.has(lvl)) {
        const inc = (character.ability_score_history || []).filter(
          (h) =>
            /Ability Score Improvement/i.test(h.source || '') &&
            Number(h.level_gained) === lvl
        )
        const feat = features.find(
          (f) =>
            f.type === 'feat' && !f._grant && Number(f.level_gained) === lvl
        )
        if (inc.length)
          choices.push({
            type: 'ability',
            detail: inc
              .map((h) => `+${h.amount} ${String(h.ability).toUpperCase()}`)
              .join(', '),
            source: 'Ability Score Improvement',
          })
        else if (feat) choices.push({ type: 'feat', detail: feat.name })
        else choices.push({ type: 'asi-or-feat', detail: 'unrecorded' })
      }
      for (const f of features)
        if (
          f._source === c.name &&
          Number(f.level_gained) === lvl &&
          f.type &&
          !['feature', 'speciesTrait', 'feat'].includes(f.type)
        )
          choices.push({ type: f.type, detail: f.name })
      entry.choices = choices
      entry.recorded = 'reconstructed'
      history.push(entry)
    }
  }
  if (!singleClass && history.length > 1)
    history[0].note =
      'Multiclass: the order the levels were taken in was not recorded; levels are listed class by class, starting class first.'
  if (hpPerLevel && !hpPerLevel.matchesAverage)
    history[0].hp_note = `Max HP ${hpPerLevel.actual} differs from the all-average total ${hpPerLevel.expected}; per-level HP gains were not recorded.`
  return history
}

module.exports = { buildLevelEntry, reconstructLevelHistory }
