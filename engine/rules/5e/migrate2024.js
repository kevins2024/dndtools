// Moves a character built under the 2014 rules onto the 2024 rules.
//
//   const { character, changes, questions, warnings } =
//     migrateCharacterTo2024(oldCharacter, { answers, equippedWeapons })
//
// Pure: returns a new character, never mutates the input and writes nothing.
// What it does for you:
//   - keeps level, HP, hit dice, ability scores, spells, items and every
//     custom/homebrew feature exactly as they were;
//   - swaps each class's and (rewritten) subclass's 2014 features for the 2024
//     ones, species traits for the 2024 species, and converts typed picks
//     (Fighting Style -> feat, Pact Boon -> invocation);
//   - leaves content the 2024 rules did not rewrite (legacy subclasses, species,
//     feats, invocations) untouched and says so;
//   - turns every NEW 2024 choice (Weapon Mastery, Divine/Primal Order, an extra
//     Expertise, the origin feat...) into a `question` instead of guessing. A
//     question's id is the key to pass back in `answers` on the next call.
//
// Idempotent: a character already on 2024 comes back unchanged.

const { loadClass, allFeaturesUpToLevel } = require('./classFeatures')
const { loadSubclass } = require('./subclasses')
const { loadSpecies } = require('./species')
const { loadBackground } = require('./backgrounds')
const { listFeats, loadFeat } = require('./grants')
const { loadInvocation, listInvocations } = require('./invocations')
const { applyFeatureMechanics } = require('./diffLevelUp')
const { resolveChoices2024, masteryPool } = require('./choices2024')
const { loadRulesetJson } = require('./ruleset')
const { findSpellRecord } = require('./spellLists')
const { resolveSpellcasting } = require('./spellcasting')

const key = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

// 2014 backgrounds -> the 2024 background that plays the same part. The campaign
// owner confirms or overrides these through `answers.background`.
const BACKGROUND_MAP = {
  Sage: 'Sage',
  Noble: 'Noble',
  Criminal: 'Criminal',
  Entertainer: 'Entertainer',
  'Mercenary Veteran': 'Soldier',
  'Far Traveler': 'Wayfarer',
  Laborer: 'Farmer',
  Soldier: 'Soldier',
  Acolyte: 'Acolyte',
  Charlatan: 'Charlatan',
  Hermit: 'Hermit',
  Sailor: 'Sailor',
  'Folk Hero': 'Farmer',
  'Guild Artisan': 'Artisan',
  Outlander: 'Wayfarer',
  Urchin: 'Wayfarer',
}

// Fighting Style names on a 2014 sheet ("Fighting Style: Two-Weapon Fighting")
// -> the 2024 feat of that name, matched on letters only.
function fightingStyleFeat(name) {
  const base = key(String(name).replace(/^Fighting Style:\s*/i, ''))
  return listFeats('2024').find(
    (f) =>
      f.ruleset === '2024' &&
      f.category === 'fighting_style' &&
      key(f.name) === base
  )
}

// Tiefling legacy names on 2014 sheets -> the 2024 legacy.
const TIEFLING_LEGACY = {
  asmodeus: 'Infernal',
  infernal: 'Infernal',
  devil: 'Infernal',
  abyssal: 'Abyssal',
  demon: 'Abyssal',
  chthonic: 'Chthonic',
}
const ELF_LINEAGES = ['Drow', 'High Elf', 'Wood Elf']

function darkvisionOf(species) {
  const t = (species.traits || []).find((x) => x.name === 'Darkvision')
  const m = t && /range of (\d+) feet/i.exec(t.description || '')
  return m ? Number(m[1]) : null
}

// Roster `genus` strings are not always a species name: "Silver Dragonborn",
// "Wood Elf", "Eladrin Elf", "Hill Dwarf". Returns { species, hint } where
// species is a species name (2014 or 2024) and hint is the leftover qualifier.
const BASE_SPECIES = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Dragonborn',
  'Gnome',
  'Goliath',
  'Tiefling',
  'Aasimar',
  'Orc',
]
function resolveSpeciesName(genus, subgenus) {
  if (!genus) return { species: null, hint: subgenus || '' }
  const exact = loadSpecies(genus, '2024')
  if (exact) return { species: exact.name, hint: subgenus || '' }
  const base = BASE_SPECIES.find((b) => new RegExp(`\\b${b}$`, 'i').test(genus))
  if (base) {
    const lead = genus.replace(new RegExp(`\\s*${base}$`, 'i'), '').trim()
    return { species: base, hint: [lead, subgenus].filter(Boolean).join(' ') }
  }
  return { species: genus, hint: subgenus || '' }
}

function oldSpeciesTraitKeys(genus, subgenus) {
  const sp = loadSpecies(genus)
  if (!sp) return { ids: new Set(), names: new Set() }
  const traits = [...(sp.traits || [])]
  for (const sub of sp.subraces || []) traits.push(...(sub.traits || []))
  return {
    ids: new Set(traits.map((t) => t.id).filter(Boolean)),
    names: new Set(traits.map((t) => key(t.name))),
  }
}

const SKILL_NAMES = require('../../data/5e/skills.json').map((x) => x.name)
const skillName = (raw) => SKILL_NAMES.find((n) => key(n) === key(raw)) ?? null

// Adds an Origin feat to the sheet and applies the picks it asks for:
// Magic Initiate (two cantrips + a level 1 spell + a casting ability), Skilled
// (three skills/tools), Musician (three instruments), Crafter (three tools).
// `picks` is { cantrips, spell, ability, skills, tools }. Returns the question ids
// still open (empty when the feat needs nothing or every pick was given).
function addOriginFeat(character, featName, meta, picks, note) {
  const base = featName.replace(/\s*\(.*\)$/, '')
  const list = /\(([^)]*)\)$/.exec(featName)?.[1] ?? null
  const featData = loadFeat(base, '2024')
  const feature = {
    name: base,
    id: featData?.id ?? null,
    type: 'feat',
    _grant: meta.grant,
    _source: meta.source,
    level_gained: 1,
  }
  const open = []
  character.features = character.features || []
  character.tool_proficiencies = character.tool_proficiencies || []
  if (base === 'Magic Initiate') {
    feature.choices = { list }
    if (picks?.cantrips?.length === 2 && picks.spell && picks.ability) {
      feature.ability_choice = picks.ability
      feature.choices = { list, cantrips: picks.cantrips, spell: picks.spell }
      const known = new Set((character.spells || []).map((x) => key(x.name)))
      character.spells = character.spells || []
      for (const [name, level] of [
        ...picks.cantrips.map((n) => [n, 0]),
        [picks.spell, 1],
      ]) {
        const rec = findSpellRecord(name, '2024')
        if (!rec || rec.level !== level || !rec.classes?.includes(list))
          note(
            `${character.name}: ${name} is not a level ${level} ${list} spell — check the Magic Initiate pick.`
          )
        if (known.has(key(name))) {
          note(
            `${character.name} already knows ${name}; Magic Initiate pick is redundant.`
          )
          continue
        }
        character.spells.push({
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
    } else open.push(`originFeatChoices:${base}`)
  } else if (base === 'Skilled') {
    if (picks?.skills?.length || picks?.tools?.length) {
      feature.choices = { skills: picks.skills ?? [], tools: picks.tools ?? [] }
      if ((picks.skills?.length ?? 0) + (picks.tools?.length ?? 0) !== 3)
        note(`${character.name}: Skilled grants three skills or tools.`)
      for (const raw of picks.skills ?? []) {
        const n = skillName(raw)
        if (!n) note(`${character.name}: "${raw}" is not a skill.`)
        else if (
          (character.skill_proficiencies || []).some((x) => key(x) === key(n))
        )
          note(
            `${character.name} is already proficient in ${n}; Skilled pick is wasted.`
          )
        else
          character.skill_proficiencies = [
            ...(character.skill_proficiencies || []),
            n,
          ]
      }
      for (const t of picks.tools ?? [])
        if (!character.tool_proficiencies.includes(t))
          character.tool_proficiencies.push(t)
    } else open.push(`originFeatChoices:${base}`)
  } else if (base === 'Musician' || base === 'Crafter') {
    if (picks?.tools?.length === 3) {
      feature.choices = { tools: picks.tools }
      for (const t of picks.tools)
        if (!character.tool_proficiencies.includes(t))
          character.tool_proficiencies.push(t)
    } else open.push(`originFeatChoices:${base}`)
  }
  character.features.push(feature)
  return open
}

function migrateCharacterTo2024(
  source,
  { answers = {}, equippedWeapons = [] } = {}
) {
  const character = JSON.parse(JSON.stringify(source))
  const changes = []
  const questions = []
  const warnings = []
  const change = (kind, detail) => changes.push({ kind, detail })
  const ask = (id, question, extra = {}) => {
    if (answers[id] === undefined) questions.push({ id, question, ...extra })
  }

  if (character.ruleset === '2024') {
    return {
      character,
      changes,
      questions,
      warnings: ['Already on the 2024 rules — nothing to do.'],
    }
  }
  character.ruleset = '2024'
  change('ruleset', 'Set to 2024.')
  let features = character.features || []

  let humanVersatile = false
  // ── species ────────────────────────────────────────────────────────────
  const resolved = resolveSpeciesName(character.genus, character.subgenus)
  const speciesName = resolved.species
  const newSpecies = speciesName ? loadSpecies(speciesName, '2024') : null
  if (newSpecies && !newSpecies.legacy) {
    const sub = resolved.hint
    let lineage = null
    let keepLegacy = false
    if (newSpecies.name === 'Elf') {
      lineage = ELF_LINEAGES.find((l) =>
        key(sub).includes(key(l.replace(' Elf', '')))
      )
      if (!lineage) keepLegacy = true // Eladrin, Sea Elf, Shadar-kai...: not in the 2024 PHB
    } else if (newSpecies.name === 'Gnome') {
      lineage = /forest/i.test(sub || '')
        ? 'Forest Gnome'
        : /rock/i.test(sub || '')
        ? 'Rock Gnome'
        : null
      if (!lineage) keepLegacy = true
    } else if (newSpecies.name === 'Tiefling') {
      lineage = TIEFLING_LEGACY[key(sub)] ?? null
      if (!lineage) {
        const infernal = features.some((f) => /Infernal Legacy/i.test(f.name))
        lineage = infernal ? 'Infernal' : null
      }
    }
    if (keepLegacy) {
      warnings.push(
        `${speciesName} (${sub}) has no 2024 version of that lineage — kept as the 2014 ${speciesName}.`
      )
    } else {
      const old = oldSpeciesTraitKeys(speciesName, sub)
      const before = features.length
      features = features.filter((f) => {
        const gone =
          (f.id && old.ids.has(f.id)) ||
          (old.names.has(key(f.name)) &&
            (f.type === 'speciesTrait' || !f._source))
        return !gone
      })
      const removed = before - features.length
      const traits = newSpecies.traits.filter(
        (t) => !/^(Forest Gnome|Rock Gnome)$/.test(t.name)
      )
      for (const t of traits) {
        features.push({
          name: t.name,
          id: t.id,
          type: 'speciesTrait',
          level_gained: 1,
          _source: newSpecies.name,
        })
      }
      if (lineage) {
        const row = newSpecies.tables
          .flatMap((tb) => tb.rows)
          .find(
            (r) =>
              key(r[0]) === key(lineage) || key(r[0]) === key(lineage + ' elf')
          )
        if (row) {
          features.push({
            name: `${newSpecies.name} Lineage: ${lineage}`,
            id: null,
            type: 'speciesTrait',
            level_gained: 1,
            _source: newSpecies.name,
            description: row[1],
          })
        }
        if (newSpecies.name === 'Gnome') {
          const t = newSpecies.traits.find((x) => x.name === lineage)
          if (t)
            features.push({
              name: t.name,
              id: t.id,
              type: 'speciesTrait',
              level_gained: 1,
              _source: 'Gnome',
            })
        }
      } else if (['Elf', 'Gnome', 'Tiefling'].includes(newSpecies.name)) {
        ask(
          `lineage:${newSpecies.name}`,
          `Which 2024 ${newSpecies.name} lineage/legacy does ${character.name} have?`,
          {
            options:
              newSpecies.name === 'Elf'
                ? ELF_LINEAGES
                : newSpecies.name === 'Gnome'
                ? ['Forest Gnome', 'Rock Gnome']
                : ['Abyssal', 'Chthonic', 'Infernal'],
          }
        )
      }
      const dv = darkvisionOf(newSpecies)
      if (dv != null)
        character.darkvision = Math.max(dv, lineage === 'Drow' ? 120 : 0)
      change(
        'species',
        `${speciesName}${
          sub ? ` (${sub})` : ''
        }: replaced ${removed} 2014 trait(s) with the 2024 ${
          newSpecies.name
        } traits${
          lineage ? ` + ${lineage}` : ''
        }. Ability bonuses are not re-applied — stat_* is unchanged.`
      )
      if (newSpecies.name === 'Human') {
        // Skillful: one skill of your choice.
        const sk = answers.humanSkillful
          ? skillName(answers.humanSkillful)
          : null
        if (sk) {
          if (
            (character.skill_proficiencies || []).some(
              (x) => key(x) === key(sk)
            )
          )
            warnings.push(
              `${character.name} is already proficient in ${sk}; Human Skillful pick is wasted.`
            )
          else
            character.skill_proficiencies = [
              ...(character.skill_proficiencies || []),
              sk,
            ]
        } else
          ask(
            'human:skillful',
            `${character.name}'s Human trait Skillful grants proficiency in one skill of your choice.`,
            { options: SKILL_NAMES }
          )
        humanVersatile = true
      }
    }
  } else if (speciesName) {
    warnings.push(
      `${speciesName} has no 2024 version — kept as legacy 2014 content (its traits are unchanged).`
    )
  }

  // ── classes & subclasses ───────────────────────────────────────────────
  const aliases = loadRulesetJson('2024', 'subclass-aliases.json') || {}
  const classEntries = character.classes || []
  for (const entry of classEntries) {
    const oldClass = loadClass(entry.name, '2014')
    const newClass = loadClass(entry.name, '2024')
    if (!oldClass || !newClass) {
      warnings.push(`No class data for ${entry.name}.`)
      continue
    }
    const oldIds = new Set(Object.values(oldClass.features_by_level_ids).flat())
    const oldNames = new Set(
      Object.values(oldClass.features_by_level).flat().map(key)
    )

    // Subclass: rewritten (renamed or not) or legacy.
    let newSub = null
    let oldSub = null
    if (entry.subclass) {
      oldSub = loadSubclass(entry.name, entry.subclass, '2014')
      const aliased = aliases[entry.name]?.[entry.subclass]
      const cand = loadSubclass(entry.name, aliased || entry.subclass, '2024')
      if (cand && !cand.legacy) newSub = cand
    }
    const oldSubIds =
      newSub && oldSub
        ? new Set(Object.values(oldSub.features_by_level_ids).flat())
        : new Set()

    // Drop 2014 class/rewritten-subclass features (they come back as 2024 ones).
    const dropped = []
    features = features.filter((f) => {
      // Typed picks (expertise, fighting style, metamagic...) carry the player's
      // choice and are handled below; only plain class/subclass grants are dropped.
      const plain = !f.type || f.type === 'feature'
      const byId = plain && f.id && (oldIds.has(f.id) || oldSubIds.has(f.id))
      const byName =
        !f.id &&
        oldNames.has(key(f.name)) &&
        (!f._source || f._source === entry.name) &&
        f.type === 'feature'
      const obsolete =
        entry.name === 'Ranger' &&
        /^(Favored Enemy|Natural Explorer)/.test(f.name) &&
        f.type !== 'feat'
      if (byId || byName || obsolete) {
        // A feature carrying the character's own state (Jaygar's infusions)
        // is data we can't regenerate — keep it and say so.
        if (f.infusions_known || f.current_infusions || f.infusions_active) {
          warnings.push(
            `${f.name} has character-specific data (infusions) and has no 2024 equivalent — kept as is.`
          )
          return true
        }
        dropped.push(f.name)
        return false
      }
      return true
    })

    // Grant the 2024 class features up to this level, then subclass features.
    const have = new Set(features.map((f) => f.id).filter(Boolean))
    const added = []
    for (const g of allFeaturesUpToLevel(entry.name, entry.level, '2024')) {
      if (g.id && have.has(g.id)) continue
      features.push({
        name: g.name,
        id: g.id,
        type: 'feature',
        level_gained: g.level,
        _source: entry.name,
      })
      added.push(g.name)
    }
    if (newSub) {
      for (const [lvl, ids] of Object.entries(newSub.features_by_level_ids)) {
        if (Number(lvl) > entry.level) continue
        ids.forEach((id, i) => {
          if (have.has(id)) return
          features.push({
            name: newSub.features_by_level[lvl][i],
            id,
            type: 'feature',
            level_gained: Number(lvl),
            _source: entry.name,
          })
          added.push(newSub.features_by_level[lvl][i])
        })
      }
      if (newSub.name !== entry.subclass)
        change(
          'subclass',
          `${entry.name}: ${entry.subclass} is now ${newSub.name}.`
        )
      entry.subclass = newSub.name
    } else if (entry.subclass) {
      warnings.push(
        `${entry.name} / ${entry.subclass} has no 2024 version — kept as a legacy 2014 subclass (features unchanged).`
      )
    }
    change(
      'class',
      `${entry.name} ${entry.level}: dropped ${dropped.length} 2014 feature(s), added ${added.length} 2024 feature(s).`
    )
  }

  // ── typed picks ────────────────────────────────────────────────────────
  features = features.map((f) => {
    if (f.type === 'fightingStyle') {
      const feat = fightingStyleFeat(f.name)
      if (feat) {
        change('fighting-style', `${f.name} -> the ${feat.name} feat.`)
        return {
          name: feat.name,
          id: feat.id,
          type: 'feat',
          _grant: 'fightingStyle',
          _source: f._source || classEntries[0]?.name,
          level_gained: f.level_gained,
        }
      }
      warnings.push(`${f.name} has no 2024 Fighting Style feat — kept as is.`)
    }
    if (f.type === 'pactBoon') {
      const inv = loadInvocation(f.name, '2024')
      if (inv) {
        change('pact', `${f.name} (Pact Boon) -> the ${f.name} invocation.`)
        return {
          name: f.name,
          id: inv.id,
          type: 'invocation',
          level_gained: f.level_gained,
          _source: 'Warlock',
        }
      }
    }
    return f
  })
  // Obsolete Pact Boon spells etc. are left alone.

  // Re-seat recorded Expertise / Metamagic picks onto the 2024 grant levels, in
  // order, so level-gated "already chosen" checks see them.
  const reseat = (type, source, levels) => {
    const mine = features.filter(
      (f) => f.type === type && (!source || f._source === source || !f._source)
    )
    mine.sort((a, b) => (a.level_gained ?? 0) - (b.level_gained ?? 0))
    mine.forEach((f, i) => {
      if (type === 'metamagic')
        f.level_gained = levels[Math.floor(i / 2)] ?? f.level_gained
      else f.level_gained = levels[i] ?? f.level_gained
      if (source) f._source = source
    })
  }
  for (const entry of classEntries) {
    if (entry.name === 'Bard') reseat('expertise', 'Bard', [2, 9])
    if (entry.name === 'Rogue') reseat('expertise', 'Rogue', [1, 6])
    if (entry.name === 'Sorcerer') reseat('metamagic', null, [2, 10, 17])
  }
  // A sheet can list doubled skills in skill_expertise without a typed Expertise
  // feature saying where they came from (Siv, Torrin...). Attribute them, in order,
  // to the 2024 Expertise grants so they aren't asked for again.
  {
    const GRANTS = {
      Rogue: [
        { name: 'Expertise', level: 1, count: 2 },
        { name: 'Expertise', level: 6, count: 2 },
      ],
      Bard: [
        { name: 'Expertise', level: 2, count: 2 },
        { name: 'Expertise', level: 9, count: 2 },
      ],
      Ranger: [{ name: 'Deft Explorer', level: 2, count: 1 }],
    }
    const attributed = new Set(
      features
        .filter((f) => f.type === 'expertise')
        .flatMap((f) =>
          String(f.name)
            .replace(/^Expertise:\s*/, '')
            .split(/,\s*/)
        )
        .map(key)
    )
    const loose = (character.skill_expertise || []).filter(
      (sk) => !attributed.has(key(sk))
    )
    for (const entry of classEntries) {
      for (const g of GRANTS[entry.name] || []) {
        if (g.level > entry.level || !loose.length) continue
        if (
          features.some(
            (f) =>
              f.type === 'expertise' &&
              f._source === entry.name &&
              f.level_gained === g.level
          )
        )
          continue
        const take = loose.splice(0, g.count)
        features.push({
          name: `Expertise: ${take.join(', ')}`,
          id: null,
          type: 'expertise',
          level_gained: g.level,
          _source: entry.name,
        })
        change(
          'expertise',
          `${entry.name} ${
            g.level
          }: recorded the existing Expertise (${take.join(
            ', '
          )}) as that class's grant.`
        )
      }
    }
  }
  character.features = features

  if (humanVersatile) {
    // Versatile: an Origin feat of your choice. A 2014 Variant Human's level 1
    // feat plays that part, so an origin feat taken at level 1 is kept as it.
    const originFeats = listFeats('2024')
      .filter((f) => f.category === 'origin')
      .map((f) => f.name)
    const taken = (character.features || []).find(
      (f) =>
        f.type === 'feat' &&
        f.level_gained === 1 &&
        !f._grant &&
        originFeats.some((n) => key(n) === key(f.name))
    )
    if (taken) {
      taken._grant = 'species'
      taken._source = 'Human'
      change(
        'species',
        `Human Versatile: the level 1 feat ${taken.name} is kept as the Origin feat.`
      )
    } else if (answers.versatileFeat) {
      const open = addOriginFeat(
        character,
        answers.versatileFeat,
        { grant: 'species', source: 'Human' },
        answers.versatileChoices,
        (m) => warnings.push(m)
      )
      change(
        'species',
        `Human Versatile: origin feat ${answers.versatileFeat} added.`
      )
      for (const id of open)
        ask(
          id,
          `${character.name}'s Versatile feat ${answers.versatileFeat} needs choices.`
        )
    } else
      ask(
        'human:versatile',
        `${character.name}'s Human trait Versatile grants an Origin feat of your choice (Skilled is the book's suggestion).`,
        { options: originFeats }
      )
  }

  // ── background & origin feat ───────────────────────────────────────────
  const bgAnswer = answers.background
  const oldBg = character.background
  const target = bgAnswer ?? (oldBg ? BACKGROUND_MAP[oldBg] ?? null : null)
  if (target) {
    const bg = loadBackground(target, '2024')
    if (bg && !bg.legacy) {
      // A homebrew background reskinned onto a 2024 one keeps its own name.
      if (oldBg && key(oldBg) !== key(bg.name) && !BACKGROUND_MAP[oldBg])
        character.background_flavor = oldBg
      character.background = bg.name
      const featName = bg.feat
      const base = featName.replace(/\s*\(.*\)$/, '')
      const has = (character.features || []).some(
        (f) => f.type === 'feat' && key(f.name) === key(base)
      )
      if (answers.originFeat === 'none') {
        change(
          'background',
          `Background ${bg.name}; origin feat skipped by request.`
        )
      } else if (has) {
        change(
          'background',
          `Background ${bg.name}; ${base} already on the sheet.`
        )
      } else {
        change(
          'background',
          `Background ${oldBg || '(none)'} -> ${
            bg.name
          }; origin feat ${featName} added.`
        )
        const open = addOriginFeat(
          character,
          featName,
          { grant: 'origin', source: bg.name },
          answers.originFeatChoices?.[base],
          (m) => warnings.push(m)
        )
        for (const id of open)
          ask(
            id,
            `${character.name}'s origin feat ${featName} needs choices (spells/skills/instruments).`
          )
      }
    }
  } else if (oldBg) {
    ask(
      'background',
      `${character.name}'s background "${oldBg}" has no 2024 equivalent — which 2024 background (or "none")?`,
      {
        options: (loadRulesetJson('2024', 'backgrounds.json') || []).map(
          (b) => b.name
        ),
      }
    )
  } else {
    ask(
      'background',
      `${character.name} has no background recorded. Pick a 2024 background (it grants an origin feat), or "none".`,
      {
        options: (loadRulesetJson('2024', 'backgrounds.json') || []).map(
          (b) => b.name
        ),
      }
    )
  }

  // ── new 2024 choices per class (mastery, orders, expertise, ...) ───────
  for (const entry of classEntries) {
    const r = resolveChoices2024({
      character,
      className: entry.name,
      subclassName: entry.subclass,
      fromLevel: 0,
      toLevel: entry.level,
      choices: answers.choices2024?.[entry.name] ?? {},
    })
    character.features.push(...r.features)
    if (r.expertiseSkills.length)
      character.skill_expertise = [
        ...new Set([
          ...(character.skill_expertise || []),
          ...r.expertiseSkills,
        ]),
      ]
    if (r.extraWeaponProficiencies.length)
      character.weapon_proficiencies = [
        ...new Set([
          ...(character.weapon_proficiencies || []),
          ...r.extraWeaponProficiencies,
        ]),
      ]
    if (r.extraArmorProficiencies.length)
      character.armor_proficiencies = [
        ...new Set([
          ...(character.armor_proficiencies || []),
          ...r.extraArmorProficiencies,
        ]),
      ]
    if (r.extraSkillProficiencies.length)
      character.skill_proficiencies = [
        ...new Set([
          ...(character.skill_proficiencies || []),
          ...r.extraSkillProficiencies,
        ]),
      ]
    warnings.push(...r.notes)
    for (const p of r.pendingChoices) {
      let pending = p
      if (p.type === 'weaponMasteryChoice') {
        // Offer what the character actually wields as the proposed answer.
        const pool = new Set(p.options)
        const guess = [
          ...new Set(equippedWeapons.map((w) => String(w).toLowerCase())),
        ]
          .filter((w) => pool.has(w))
          .slice(0, p.count)
        pending = { ...p, suggested: guess }
      }
      ask(
        `${entry.name}:${p.type}${p.level != null ? `@${p.level}` : ''}`,
        `${entry.name}: ${p.type} (${p.count ?? 1} to pick)`,
        { pending }
      )
    }
    if (r.extraCantrips)
      ask(
        `${entry.name}:extraCantrip`,
        `${entry.name} gains ${r.extraCantrips} extra cantrip from its Order.`
      )
  }

  // ── invocation count (Warlock) ─────────────────────────────────────────
  const warlock = classEntries.find((c) => c.name === 'Warlock')
  if (warlock) {
    const want = loadClass('Warlock', '2024').eldritch_invocations_by_level
    const owed = (() => {
      let v = 0
      for (const [k, n] of Object.entries(want))
        if (Number(k) <= warlock.level) v = n
      return v
    })()
    let have = character.features.filter((f) => f.type === 'invocation').length
    const picked = [].concat(answers['Warlock:invocationChoice'] ?? [])
    for (const raw of picked) {
      const inv = listInvocations('2024').find((i) => key(i.name) === key(raw))
      if (!inv) {
        warnings.push(
          `"${raw}" isn't a 2024 Eldritch Invocation — not applied.`
        )
        continue
      }
      if (
        character.features.some(
          (f) => f.type === 'invocation' && key(f.name) === key(inv.name)
        )
      ) {
        warnings.push(
          `${inv.name} is already known — pick a different invocation.`
        )
        continue
      }
      character.features.push({
        name: inv.name,
        id: inv.id,
        type: 'invocation',
        level_gained: warlock.level,
        _source: 'Warlock',
      })
      have++
    }
    if (have < owed) {
      ask(
        'Warlock:invocationChoice',
        `Warlock ${warlock.level} has ${owed} invocations under 2024; ${
          character.name
        } has ${have}. Pick ${owed - have} more.`,
        {
          options: listInvocations('2024').map((i) => i.name),
        }
      )
    }
  }

  // ── spellcasting shape ─────────────────────────────────────────────────
  for (const entry of classEntries) {
    const nc = loadClass(entry.name, '2024')
    if (nc?.prepared_spells_by_level) {
      let want = 0
      for (const [k, n] of Object.entries(nc.prepared_spells_by_level))
        if (Number(k) <= entry.level) want = n
      // Spells the owner picked to fill the 2024 prepared-spell count.
      for (const raw of [].concat(
        answers[`${entry.name}:preparedSpells`] ?? []
      )) {
        const rec = findSpellRecord(raw, '2024')
        if (!rec || rec.legacy || !(rec.level > 0)) {
          warnings.push(
            `${raw} isn't a 2024 spell of level 1 or higher — not added.`
          )
          continue
        }
        if (!rec.classes?.includes(entry.name))
          warnings.push(
            `${rec.name} is not on the ${entry.name} 2024 list — added anyway.`
          )
        if (
          (character.spells || []).some((x) => key(x.name) === key(rec.name))
        ) {
          warnings.push(
            `${character.name} already has ${rec.name}; pick another.`
          )
          continue
        }
        character.spells = character.spells || []
        character.spells.push({
          name: rec.name,
          level: rec.level,
          prepared: true,
        })
      }
      const have = (character.spells || []).filter(
        (s) =>
          s.level > 0 &&
          s.prepared !== false &&
          !s.featureGranted &&
          s.type !== 'oath' &&
          !s.domain
      ).length
      if (
        ['Bard', 'Sorcerer', 'Warlock', 'Ranger'].includes(entry.name) &&
        have !== want
      ) {
        ask(
          `${entry.name}:preparedSpells`,
          `${entry.name} ${entry.level}: 2024 prepared-spell count is ${want}, ${character.name} has ${have} level 1+ spells marked prepared. Review.`,
          { want, have }
        )
      }
    }
  }

  // ── spells vs. the 2024 lists ──────────────────────────────────────────
  {
    const listNames = classEntries
      .map((e) =>
        ['Eldritch Knight', 'Arcane Trickster'].includes(e.subclass)
          ? 'Wizard'
          : resolveSpellcasting(e.name, e.subclass, '2024')
          ? e.name
          : null
      )
      .filter(Boolean)
    const legacy = []
    const offList = []
    for (const sp of character.spells || []) {
      if (
        sp.featureGranted ||
        sp.type === 'oath' ||
        sp.domain ||
        sp.type === 'patron'
      )
        continue
      const rec = findSpellRecord(sp.name, '2024')
      if (!rec) legacy.push(`${sp.name} (not found)`)
      else if (rec.legacy) legacy.push(sp.name)
      else if (
        listNames.length &&
        !listNames.some((c) => rec.classes?.includes(c))
      )
        offList.push(sp.name)
    }
    if (legacy.length)
      warnings.push(
        `Legacy 2014 spells kept (not in the 2024 Player's Handbook): ${legacy.join(
          ', '
        )}.`
      )
    if (offList.length)
      warnings.push(
        `Spells no longer on ${[...new Set(listNames)].join(
          '/'
        )}'s 2024 list (kept; review): ${offList.join(', ')}.`
      )
  }

  // ── mechanics stamp + bookkeeping ──────────────────────────────────────
  const prevUses = new Map(
    source.features
      .filter((f) => f.id && f.uses_current != null)
      .map((f) => [f.id, f.uses_current])
  )
  character.features = applyFeatureMechanics(character.features, character).map(
    (f) =>
      f.id && prevUses.has(f.id) && f.uses_max != null
        ? { ...f, uses_current: Math.min(prevUses.get(f.id), f.uses_max) }
        : f
  )
  character.migrated_to_2024 = true

  return { character, changes, questions, warnings }
}

module.exports = { migrateCharacterTo2024, BACKGROUND_MAP }
void masteryPool
