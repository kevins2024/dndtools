// A deep legality audit of one saved character, for its own ruleset ("2014" or
// "2024"). validateCharacter.js is the quick save-time check (saves, proficiency
// bonus, known-spell cap); this is the slower "is this sheet actually what the
// rules would have produced" pass: HP inside the legal range, ASI/feat slots,
// skills and Expertise, every class and subclass feature present for the level,
// cantrips / known / prepared counts against the class tables, spell levels
// against slots, spells against class lists, slots against the multiclass table,
// and the per-class choices (invocations, Metamagic, Maneuvers, Fighting Style,
// Weapon Mastery).
//
// Pure data in, plain objects out. Each issue is
//   { severity: 'error' | 'warn' | 'info', code, message }
// 'error' = the sheet breaks a rule; 'warn' = a hole or something that needs a
// human look (the sheet may be fine); 'info' = context.

const { loadClass, allFeaturesUpToLevel } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')
const {
  proficiencyBonus,
  hitDieForClass,
  asiLevelsForClass,
} = require('./progression')
const {
  resolveSpellcasting,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
  pactMagicForLevel,
} = require('./spellcasting')
const { multiclassSpellSlots } = require('./multiclass')
const { findSpellRecord } = require('./spellLists')
const { rulesetOf } = require('./rulesetId')
const { extraCantrips } = require('./cantripAllowance')
const { deriveCharacter, hasRecordedBase } = require('./derive')

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const key = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
const mod = (score) => Math.floor((score - 10) / 2)

const PLACEHOLDER = /subclass$|^ability score improvement$|^epic boon$/i
const SUBCLASS_SPELL_ACCESS =
  /Magical Secrets|Divine Magic|Book of Ancient Secrets|Pact of the Tome|Mystic Arcanum|Spell Mastery|Signature Spells|Lunar|Weave|Wild Magic/i
// Classes that re-choose prepared spells after every Long Rest, so a short list is a choice, not a hole.
const DAILY_PREPARERS = new Set([
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Wizard',
  'Artificer',
])
const FULL_PREPARED = new Set(['Cleric', 'Druid', 'Wizard'])
const HALF_PREPARED = new Set(['Paladin', 'Artificer'])
const SKILL_PICKS_ON_MULTICLASS = new Set(['Bard', 'Ranger', 'Rogue'])

const isCantrip = (s) => s.level === 0 || s.type === 'cantrip'
const isBonusSpell = (s) =>
  Boolean(
    s.featureGranted ||
      s.domain ||
      s.oath ||
      s.racial ||
      ['oath', 'domain', 'racial', 'patron'].includes(s.type)
  )

// Level at which `cls`'s table reaches `level` (greatest key <= level).
const atLevel = (table, level) => {
  let best = -Infinity
  let v = 0
  for (const [k, n] of Object.entries(table || {}))
    if (Number(k) <= level && Number(k) > best && typeof n === 'number') {
      best = Number(k)
      v = n
    }
  return v
}

function auditCharacter(character, ctx = {}) {
  const issues = []
  const add = (severity, code, message) =>
    issues.push({ severity, code, message })
  const ruleset = rulesetOf(character)
  const classes = character.classes || []
  const features = character.features || []
  // A Wizard linked to a shared spellbook reads known spells from the book and
  // the daily-prepared set from `prepared_spells`; `character.spells` is not used.
  const book = (ctx.spellbooks || []).find(
    (b) => b.id === character.spellbook_id
  )
  const preparedNames = new Set(character.prepared_spells || [])
  const spells = book
    ? (book.spells || []).map((sp) => ({
        ...sp,
        prepared: preparedNames.has(sp.name),
        ...(sp.level === 0 ? { type: 'cantrip' } : {}),
      }))
    : character.spells || []
  if (!classes.length) {
    add('error', 'no-classes', 'No classes listed.')
    return issues
  }

  // ── stored numbers vs the ones calculated from the recorded facts ─────
  if (hasRecordedBase(character)) {
    const d = deriveCharacter(character)
    for (const k of [
      'stat_str',
      'stat_dex',
      'stat_con',
      'stat_int',
      'stat_wis',
      'stat_cha',
      'hp_max',
      'proficiency_bonus',
    ])
      if (character[k] !== d[k])
        add(
          'error',
          'derived-mismatch',
          `${k} is ${character[k]} on the sheet but ${d[k]} when calculated from the recorded base scores, history and hit dice.`
        )
    if (character.hp_unrecorded_dice)
      add(
        'info',
        'hp-dice-unrecorded',
        `${character.hp_unrecorded_dice} HP of hit-die results were never recorded per level.`
      )
  } else {
    add(
      'info',
      'base-not-recorded',
      'Base ability scores are not recorded, so scores and HP cannot be calculated from their sources.'
    )
  }

  // ── level, proficiency bonus, hit dice ─────────────────────────────────
  const total = classes.reduce((n, c) => n + (c.level || 0), 0)
  if (total !== character.level)
    add(
      'error',
      'level-sum',
      `Character level ${character.level} but class levels add to ${total}.`
    )
  if (character.proficiency_bonus !== proficiencyBonus(total))
    add(
      'error',
      'proficiency-bonus',
      `Proficiency bonus +${
        character.proficiency_bonus
      }, expected +${proficiencyBonus(total)}.`
    )
  if (character.hit_dice_current != null && character.hit_dice_current > total)
    add(
      'error',
      'hit-dice',
      `Hit dice remaining ${character.hit_dice_current} exceeds level ${total}.`
    )
  const started = classes.find((c) => c.started) || classes[0]

  // ── hit points: must fall in the range the rules allow ─────────────────
  {
    const con = mod(character.stat_con)
    let low = 0
    let high = 0
    let first = true
    const ordered = [started, ...classes.filter((c) => c !== started)]
    for (const c of ordered) {
      const die = hitDieForClass(c.name)
      if (!die) continue
      for (let lvl = 1; lvl <= c.level; lvl++) {
        if (first) {
          low += die + con
          high += die + con
          first = false
        } else {
          low += Math.max(1, 1 + con)
          high += Math.max(1, die + con)
        }
      }
    }
    let perLevel = 0
    if (features.some((f) => f.type === 'feat' && key(f.name) === 'tough'))
      perLevel += 2
    if (
      features.some(
        (f) =>
          /^dwarven toughness$/i.test(f.name) ||
          /dwarven toughness/i.test(f.name)
      )
    )
      perLevel += 1
    if (features.some((f) => /^draconic resilience$/i.test(f.name))) {
      const sorc = classes.find((c) => c.name === 'Sorcerer')
      perLevel += 0
      low += sorc ? sorc.level : 0
      high += sorc ? sorc.level : 0
    }
    low += perLevel * total
    high += perLevel * total
    if (character.hp_max < low || character.hp_max > high)
      add(
        'error',
        'hp-range',
        `Max HP ${
          character.hp_max
        } is outside the legal range ${low}-${high} (CON ${
          mod(character.stat_con) >= 0 ? '+' : ''
        }${con}, level ${total}${
          perLevel ? `, +${perLevel}/level from features` : ''
        }).`
      )
  }

  // ── ability scores and ASI / feat slots ────────────────────────────────
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    const v = character[`stat_${a}`]
    const cap = features.some((f) => /^boon of /i.test(f.name)) ? 30 : 20
    if (!(v >= 1 && v <= cap + 4))
      add('warn', 'ability-range', `${a.toUpperCase()} is ${v}.`)
  }
  {
    let slots = 0
    for (const c of classes) {
      const data = loadClass(c.name, ruleset)
      const levels = Object.entries(data?.features_by_level || {})
        .filter(([, names]) =>
          names.some((n) => /^Ability Score Improvement|^Epic Boon/i.test(n))
        )
        .map(([lvl]) => Number(lvl))
      const fromData = levels.length ? levels : asiLevelsForClass(c.name)
      slots += fromData.filter((l) => l <= c.level).length
    }
    const history = (character.ability_score_history || []).filter((h) =>
      /Ability Score Improvement/i.test(h.source || '')
    )
    // Two classes can have an ASI at the same class level, so count points (2 per
    // improvement) rather than distinct levels, never fewer than the distinct levels.
    const distinct = new Set(history.map((h) => `${h.level_gained}`)).size
    const points = history.reduce((n, h) => n + (h.amount || 0), 0)
    const histLevels = { size: Math.max(distinct, Math.ceil(points / 2)) }
    const isVariantHuman =
      /human/i.test(character.genus || '') && ruleset === '2014'
    const featSlots = features.filter(
      (f) =>
        f.type === 'feat' &&
        !f._grant &&
        !(isVariantHuman && f.level_gained === 1) &&
        !/^boon of /i.test(f.name)
    )
    const boons = features.filter(
      (f) => f.type === 'feat' && /^boon of /i.test(f.name)
    )
    const used = histLevels.size + featSlots.length + boons.length
    if (used > slots)
      add(
        'error',
        'asi-overspent',
        `${used} ASI/feat choices on the sheet but only ${slots} available (${
          histLevels.size
        } score increases, ${featSlots.length} feats${
          boons.length ? `, ${boons.length} boons` : ''
        }).`
      )
    else if (used < slots)
      add(
        'warn',
        'asi-unspent',
        `${
          slots - used
        } ASI/feat slot(s) with no recorded choice (${slots} available, ${
          histLevels.size
        } score increases + ${featSlots.length} feats recorded).`
      )
    const unknown = featSlots.filter((f) => f.level_gained == null)
    if (unknown.length)
      add(
        'info',
        'feat-level-unknown',
        `Feat(s) with no level recorded: ${unknown
          .map((f) => f.name)
          .join(', ')}.`
      )
  }

  // ── skills and Expertise ───────────────────────────────────────────────
  {
    const skills = character.skill_proficiencies || []
    const dupes = skills.map(key).filter((k, i, a) => a.indexOf(k) !== i)
    if (dupes.length)
      add(
        'error',
        'skills-duplicate',
        `Duplicate skill(s): ${[...new Set(dupes)].join(', ')}.`
      )
    const startData = loadClass(started.name, ruleset)
    let min = (startData?.skill_choices?.count ?? 0) + 2 // class picks + a background's two
    for (const c of classes)
      if (c !== started && SKILL_PICKS_ON_MULTICLASS.has(c.name)) min += 1
    if (skills.length < min)
      add(
        'warn',
        'skills-few',
        `${skills.length} skill proficiencies; a ${started.name} with a background has at least ${min}.`
      )
    const exp = character.skill_expertise || []
    for (const e of exp)
      if (!skills.some((s) => key(s) === key(e)))
        add(
          'error',
          'expertise-not-proficient',
          `Expertise in ${e} without proficiency.`
        )
    let owed = 0
    for (const c of classes) {
      for (const f of allFeaturesUpToLevel(c.name, c.level, ruleset)) {
        if (/^Expertise$/i.test(norm(f.name)) && /^expertise/i.test(f.name))
          owed += 2
        if (
          ruleset === '2024' &&
          c.name === 'Wizard' &&
          /^Scholar$/i.test(f.name)
        )
          owed += 1
      }
    }
    const extraFeats = features.filter(
      (f) => f.type === 'feat' && /^skill expert$/i.test(f.name)
    ).length
    owed += extraFeats
    if (exp.length < owed)
      add(
        'warn',
        'expertise-few',
        `${exp.length} Expertise skills recorded, ${owed} owed by class features.`
      )
    if (exp.length > owed + 1 && owed > 0)
      add(
        'info',
        'expertise-many',
        `${exp.length} Expertise skills recorded vs ${owed} from class tables (feats/species may add more).`
      )
  }

  // ── class and subclass features present, none from the future ──────────
  const sheetNames = features.map((f) => norm(f.name))
  const has = (expected) => {
    // "Favored Enemy improvement" is satisfied by the sheet's "Favored Enemy: Beasts" etc.
    const e = norm(expected).replace(/ improvement$/, '')
    return sheetNames.some(
      (n) =>
        n === e ||
        n.startsWith(`${e} `) ||
        e.startsWith(`${n} `) ||
        n.includes(e) ||
        (n.length > 4 && e.includes(n))
    )
  }
  for (const c of classes) {
    const data = loadClass(c.name, ruleset)
    if (!data) {
      add('info', 'no-class-data', `No data for ${c.name}.`)
      continue
    }
    const missing = []
    for (const f of allFeaturesUpToLevel(c.name, c.level, ruleset))
      if (
        !PLACEHOLDER.test(f.name) &&
        !/fighting style$/i.test(f.name) && // counted by the fighting-style check
        !(/^spellcasting$/i.test(f.name) && spells.length) &&
        !has(f.name)
      )
        missing.push(`${f.name} (L${f.level})`)
    const sub = c.subclass ? loadSubclass(c.name, c.subclass, ruleset) : null
    if (c.subclass && !sub)
      add(
        'warn',
        'subclass-unknown',
        `${c.name} subclass "${c.subclass}" has no data.`
      )
    if (!c.subclass && c.level >= (data.subclass_choice_level ?? 99))
      add(
        'error',
        'subclass-missing',
        `${c.name} ${c.level} should have a subclass (chosen at ${data.subclass_choice_level}).`
      )
    if (sub)
      for (const [lvl, names] of Object.entries(sub.features_by_level || {}))
        if (Number(lvl) <= c.level)
          for (const n of names)
            if (!PLACEHOLDER.test(n) && !/fighting style$/i.test(n) && !has(n))
              missing.push(`${n} (subclass L${lvl})`)
    if (missing.length)
      add(
        'error',
        'features-missing',
        `${c.name} ${c.level} is missing: ${missing.join('; ')}.`
      )
    for (const f of features)
      if (f._source === c.name && f.level_gained > c.level)
        add(
          'error',
          'feature-from-future',
          `${f.name} gained at level ${f.level_gained} but ${c.name} is level ${c.level}.`
        )
  }

  // ── spellcasting ───────────────────────────────────────────────────────
  const casters = classes
    .map((c) => ({ c, sc: resolveSpellcasting(c.name, c.subclass, ruleset) }))
    .filter((x) => x.sc)
  if (casters.length) {
    // A shared spellbook lists every cantrip in the book; `prepared: false` marks ones this wizard does not have.
    const cantrips = spells.filter(
      (s) => isCantrip(s) && !isBonusSpell(s) && s.prepared !== false
    )
    const leveled = spells.filter((s) => !isCantrip(s) && !isBonusSpell(s))
    const wantCantrips =
      casters.reduce(
        (n, { c }) =>
          n + cantripsKnownForClass(c.name, c.level, c.subclass, ruleset),
        0
      ) + extraCantrips(character)
    if (cantrips.length < wantCantrips)
      add(
        'warn',
        'cantrips-few',
        `${cantrips.length} cantrips, class tables give ${wantCantrips}.`
      )
    if (cantrips.length > wantCantrips)
      add(
        'error',
        'cantrips-many',
        `${cantrips.length} cantrips, class tables give ${wantCantrips} (extras need a feature/feat source).`
      )

    // known / prepared counts
    const knownCasters = casters.filter(
      ({ c }) =>
        spellsKnownForClass(c.name, c.level, c.subclass, ruleset) !== null
    )
    const preparedCasters = casters.filter(
      ({ c }) =>
        spellsKnownForClass(c.name, c.level, c.subclass, ruleset) === null
    )
    if (knownCasters.length) {
      const want = knownCasters.reduce(
        (n, { c }) =>
          n + spellsKnownForClass(c.name, c.level, c.subclass, ruleset),
        0
      )
      const arcanum = leveled.filter(
        (s) => s.level >= 6 && casters.some(({ c }) => c.name === 'Warlock')
      ).length
      const have =
        leveled.length - (knownCasters.length === casters.length ? arcanum : 0)
      if (preparedCasters.length === 0 && have > want)
        add(
          'error',
          'known-many',
          `${have} spells known, the class table allows ${want}.`
        )
      if (preparedCasters.length === 0 && have < want)
        add(
          'warn',
          'known-few',
          `${have} spells known, the class table gives ${want}.`
        )
    }
    if (preparedCasters.length && ruleset === '2024') {
      const want = preparedCasters
        .concat(knownCasters)
        .reduce(
          (n, { c }) =>
            n +
            (preparedSpellCount(c.name, c.level, 0, c.subclass, ruleset) ?? 0),
          0
        )
      const have = leveled.filter((s) => s.prepared !== false).length
      // Picks that can only change on a level-up (Bard, Sorcerer, Warlock, third
      // casters) must be filled; the rest are re-prepared after a Long Rest.
      const mustFill = preparedCasters
        .concat(knownCasters)
        .filter(({ c }) => !DAILY_PREPARERS.has(c.name))
        .reduce(
          (n, { c }) =>
            n +
            (preparedSpellCount(c.name, c.level, 0, c.subclass, ruleset) ?? 0),
          0
        )
      if (have !== want)
        add(
          have > want ? 'error' : have >= mustFill ? 'info' : 'warn',
          'prepared-count',
          `${have} spells prepared, the 2024 class tables give ${want}.`
        )
    }
    if (preparedCasters.length && ruleset === '2014') {
      const want = preparedCasters.reduce((n, { c }) => {
        const sc = resolveSpellcasting(c.name, c.subclass, ruleset)
        const abil =
          sc?.ability ||
          ({
            Cleric: 'wis',
            Druid: 'wis',
            Paladin: 'cha',
            Wizard: 'int',
            Artificer: 'int',
          }[c.name] ??
            'int')
        const m = mod(character[`stat_${abil}`])
        const lvl = FULL_PREPARED.has(c.name)
          ? c.level
          : HALF_PREPARED.has(c.name)
          ? c.name === 'Artificer'
            ? Math.floor(c.level / 2)
            : Math.floor(c.level / 2)
          : 0
        return n + Math.max(1, m + lvl)
      }, 0)
      // Known-style casters (Bard, Sorcerer, Warlock...) learn spells outside the
      // prepared allowance, so take their share off before comparing.
      const knownShare = knownCasters.reduce(
        (n, { c }) =>
          n + (spellsKnownForClass(c.name, c.level, c.subclass, ruleset) ?? 0),
        0
      )
      const have = Math.max(
        0,
        leveled.filter((s) => s.prepared !== false).length - knownShare
      )
      if (have > want)
        add(
          'error',
          'prepared-many',
          `${have} spells prepared, 2014 allows ${want}.`
        )
    }

    // spell level vs slots
    const sorted = classes.map((c) => ({
      name: c.name,
      level: c.level,
      subclass: c.subclass,
    }))
    const slots = multiclassSpellSlots(sorted, ruleset)
    const pactCls = classes.find((c) => c.name === 'Warlock')
    const pact = pactCls ? pactMagicForLevel(pactCls.level, ruleset) : null
    let maxLevel = 0
    for (let i = slots.length - 1; i >= 0; i--)
      if (slots[i] > 0) {
        maxLevel = i + 1
        break
      }
    if (pact) maxLevel = Math.max(maxLevel, pact.slot_level)
    for (const s of spells)
      if (!isCantrip(s) && s.level > maxLevel && !(pact && s.level >= 6))
        add(
          'error',
          'spell-too-high',
          `${s.name} is level ${s.level} but the highest slot is level ${maxLevel}.`
        )
    if (character.spell_slots && slots.length) {
      for (let i = 0; i < 9; i++) {
        const got = character.spell_slots[`level_${i + 1}`]?.max ?? 0
        const want = slots[i] ?? 0
        if (got !== want)
          add(
            'error',
            'slots-mismatch',
            `Level ${i + 1} slots: sheet ${got}, table ${want}.`
          )
      }
    } else if (slots.length)
      add('warn', 'slots-missing', 'No spell_slots recorded.')
    if (
      pact &&
      (character.pact_magic?.max !== pact.slots ||
        character.pact_magic?.slot_level !== pact.slot_level)
    )
      add(
        'error',
        'pact-mismatch',
        `Pact slots sheet ${character.pact_magic?.max}x L${character.pact_magic?.slot_level}, table ${pact.slots}x L${pact.slot_level}.`
      )

    // spells on the class list (or granted by a feature that widens it)
    const listClasses = casters.map(({ c }) =>
      ['Eldritch Knight', 'Arcane Trickster'].includes(c.subclass)
        ? 'Wizard'
        : c.name
    )
    const widened =
      features.some((f) => SUBCLASS_SPELL_ACCESS.test(f.name)) ||
      classes.some((c) => SUBCLASS_SPELL_ACCESS.test(c.subclass || ''))
    const off = []
    for (const s of spells) {
      if (isBonusSpell(s)) continue
      const rec =
        findSpellRecord(s.name, ruleset) ||
        (ruleset === '2024' ? findSpellRecord(s.name, '2014') : null)
      if (!rec) {
        add(
          'warn',
          'spell-unknown',
          `${s.name} was not found in the spell data.`
        )
        continue
      }
      if (ruleset === '2024' && rec.ruleset !== '2024') {
        // Legacy content stays usable: fine when the 2014 lists have it for this class.
        if (
          !Array.isArray(rec.classes) ||
          !listClasses.some((l) => rec.classes.includes(l))
        )
          off.push(
            `${s.name} (legacy 2014 spell, not on this class's 2014 list)`
          )
        continue
      }
      if (
        Array.isArray(rec.classes) &&
        !listClasses.some((l) => rec.classes.includes(l))
      )
        off.push(s.name)
    }
    if (off.length)
      add(
        widened ? 'info' : 'warn',
        'spell-off-list',
        `Not on the ${[...new Set(listClasses)].join('/')} list${
          widened ? ' (a feature may widen it)' : ''
        }: ${off.join(', ')}.`
      )
    const dup = spells
      .map((s) => key(s.name))
      .filter((k, i, a) => a.indexOf(k) !== i)
    if (dup.length)
      add(
        'error',
        'spell-duplicate',
        `Duplicate spell(s): ${[...new Set(dup)].join(', ')}.`
      )
  }

  // ── class choices ──────────────────────────────────────────────────────
  const warlock = classes.find((c) => c.name === 'Warlock')
  if (warlock) {
    const data = loadClass('Warlock', ruleset)
    const table = data?.eldritch_invocations_by_level
    const owed = table ? atLevel(table, warlock.level) : null
    const have =
      features.filter((f) => f.type === 'invocation').length +
      (ruleset === '2014' ? 0 : 0)
    if (owed != null && have !== owed)
      add(
        have > owed ? 'error' : 'warn',
        'invocations',
        `${have} Eldritch Invocations, the ${ruleset} table gives ${owed}.`
      )
    if (
      ruleset === '2014' &&
      warlock.level >= 3 &&
      !features.some(
        (f) => /^pact of the /i.test(f.name) || f.type === 'pactBoon'
      )
    )
      add('warn', 'pact-boon', 'No Pact Boon recorded.')
  }
  const sorc = classes.find((c) => c.name === 'Sorcerer')
  if (sorc) {
    const owed =
      ruleset === '2024'
        ? sorc.level >= 17
          ? 6
          : sorc.level >= 10
          ? 4
          : sorc.level >= 2
          ? 2
          : 0
        : sorc.level >= 17
        ? 4
        : sorc.level >= 10
        ? 3
        : sorc.level >= 3
        ? 2
        : 0
    const have = features.filter(
      (f) => f.type === 'metamagic' || /^metamagic: /i.test(f.name)
    ).length
    if (have !== owed)
      add(
        have > owed ? 'error' : 'warn',
        'metamagic',
        `${have} Metamagic options, ${owed} owed at Sorcerer ${sorc.level}.`
      )
  }
  const fighter = classes.find((c) => c.name === 'Fighter')
  if (fighter && fighter.subclass === 'Battle Master') {
    const owed =
      fighter.level >= 15
        ? 9
        : fighter.level >= 10
        ? 7
        : fighter.level >= 7
        ? 5
        : fighter.level >= 3
        ? 3
        : 0
    const have = features.filter(
      (f) => f.type === 'maneuver' || /^maneuver: /i.test(f.name)
    ).length
    if (have && have !== owed)
      add(
        have > owed ? 'error' : 'warn',
        'maneuvers',
        `${have} Maneuvers, ${owed} owed.`
      )
    if (!have && owed)
      add('warn', 'maneuvers', `No Maneuvers recorded (${owed} owed).`)
  }
  {
    let owed = 0
    for (const c of classes) {
      if (c.name === 'Fighter' && c.level >= 1) owed += 1
      if ((c.name === 'Paladin' || c.name === 'Ranger') && c.level >= 2)
        owed += 1
      if (
        c.name === 'Fighter' &&
        c.subclass === 'Champion' &&
        c.level >= (ruleset === '2024' ? 7 : 10)
      )
        owed += 1
    }
    const have = features.filter(
      (f) =>
        f.type === 'fightingStyle' ||
        /^fighting style: /i.test(f.name) ||
        f._grant === 'fightingStyle'
    ).length
    if (owed && have < owed)
      add(
        'warn',
        'fighting-style',
        `${have} Fighting Style(s) recorded, ${owed} owed.`
      )
    if (have > owed)
      add(
        'info',
        'fighting-style',
        `${have} Fighting Styles recorded vs ${owed} from class features (feats may add more).`
      )
  }
  if (ruleset === '2024') {
    let owed = 0
    for (const c of classes) {
      const d = loadClass(c.name, '2024')
      if (d?.weapon_mastery_by_level)
        owed += atLevel(d.weapon_mastery_by_level, c.level)
      else if (
        Object.entries(d?.features_by_level || {}).some(
          ([lvl, names]) =>
            Number(lvl) <= c.level && names.includes('Weapon Mastery')
        )
      )
        owed += 2
    }
    const have = features.filter((f) =>
      /^weapon mastery: /i.test(f.name)
    ).length
    if (owed && have !== owed)
      add(
        have > owed ? 'error' : 'warn',
        'weapon-mastery',
        `${have} Weapon Mastery picks, class tables give ${owed}.`
      )
  }

  // ── subclass-granted spells: stale copies and missing ones ─────────────
  {
    const FIELDS = [
      'domain_spells_by_level',
      'oath_spells_by_level',
      'circle_spells_by_level',
      'bonus_spells_by_level',
      'patron_spells_by_level',
      'subclass_spells_by_level',
    ]
    const granted = new Map() // normalised name -> subclass label
    for (const c of classes) {
      const sub = c.subclass ? loadSubclass(c.name, c.subclass, ruleset) : null
      if (!sub) continue
      for (const f of FIELDS)
        for (const [lvl, names] of Object.entries(sub[f] || {}))
          if (Array.isArray(names) && Number(lvl) <= c.level)
            for (const n of names)
              granted.set(key(n), `${c.subclass} (L${lvl})`)
      if (c.name === 'Artificer' && sub.expanded_spell_list)
        for (const [lvl, names] of Object.entries(sub.expanded_spell_list))
          if (Array.isArray(names) && Number(lvl) <= c.level)
            for (const n of names)
              granted.set(key(n), `${c.subclass} (L${lvl})`)
    }
    const flagged = spells.filter(
      (sp) => sp.domain || sp.oath || ['oath', 'domain'].includes(sp.type)
    )
    const stale = flagged.filter((sp) => !granted.has(key(sp.name)))
    if (stale.length)
      add(
        'error',
        'stale-bonus-spell',
        `Marked as subclass spells but not on the ${ruleset} subclass list at this level: ${stale
          .map((sp) => sp.name)
          .join(', ')}.`
      )
    const have = new Set(
      spells
        .filter(
          (sp) =>
            sp.domain ||
            sp.oath ||
            sp.featureGranted ||
            ['oath', 'domain', 'patron'].includes(sp.type)
        )
        .map((sp) => key(sp.name))
    )
    const featureNames = new Set(
      features.flatMap((f) => (f.spells_granted || []).map(key))
    )
    const absent = [...granted.keys()].filter(
      (k) => !have.has(k) && !featureNames.has(k)
    )
    if (absent.length)
      add(
        'info',
        'bonus-spell-not-on-sheet',
        `Subclass spells the app derives from the subclass but the sheet does not list: ${absent.join(
          ', '
        )}.`
      )
  }

  // ── ability score budget ───────────────────────────────────────────────
  {
    const sum = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce(
      (n, a) => n + (character[`stat_${a}`] || 0),
      0
    )
    let slots = 0
    for (const c of classes) {
      const data = loadClass(c.name, ruleset)
      const lv = Object.entries(data?.features_by_level || {})
        .filter(([, names]) =>
          names.some((n) => /^Ability Score Improvement|^Epic Boon/i.test(n))
        )
        .map(([l]) => Number(l))
      slots += (lv.length ? lv : asiLevelsForClass(c.name)).filter(
        (l) => l <= c.level
      ).length
    }
    const budget = 75 + 4 + 2 * slots
    if (sum > budget) {
      // Only a sheet that says it used a point buy can be over budget: random
      // generation (4d6, drop the lowest) is legal in both rulesets and can reach any total.
      const explicitPointBuy = /^point buy$/i.test(
        character.ability_score_method || ''
      )
      add(
        explicitPointBuy ? 'warn' : 'info',
        'ability-budget',
        `Ability scores total ${sum}; a 27-point buy (at most 75) + species/background bonuses (4) + ${slots} ASI slots (2 each) allows at most ${budget}. ${
          explicitPointBuy
            ? 'The sheet says point buy, so something is unrecorded.'
            : 'Legal if the scores were rolled or the DM awarded them; the method is not recorded.'
        }`
      )
    }
  }
  return issues
}

module.exports = { auditCharacter }
