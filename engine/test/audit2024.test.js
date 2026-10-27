// Offline sanity checks over ALL the 2024 data — including the content that has no
// second source to cross-check against (57 subclasses, Artificer, PHB feats and
// spells beyond the SRD). These catch scraping damage and internal contradictions;
// scripts/audit-2024-vs-srd.js is the cross-source check for the SRD part.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { listClasses, loadClass } = require('../rules/5e/classFeatures')
const { listSubclasses, loadSubclass } = require('../rules/5e/subclasses')
const { listFeats } = require('../rules/5e/grants')
const { listInvocations } = require('../rules/5e/invocations')
const { listMetamagicOptions } = require('../rules/5e/metamagic')
const { listManeuvers } = require('../rules/5e/maneuvers')
const { featureMechanics } = require('../rules/5e/featureMechanics')

const ROOT = path.join(__dirname, '..', '..')
const published = require(path.join(
  ROOT,
  'src',
  'data',
  'published_features.json'
))
const spells = require(path.join(ROOT, 'src', 'data', 'spells_2024.json'))
const catalog = require('../data/5e/feature-catalog.json')
const weapons = require('../data/5e2024/weapons.json')
const species = require('../data/5e2024/species.json')
const backgrounds = require('../data/5e2024/backgrounds.json')
const pub24 = published.filter((e) => e.ruleset === '2024')

// ── text integrity ──────────────────────────────────────────────────────

const JUNK = [
  /Help \| Terms of Service/,
  /Powered by Wikidot/,
  /Click here to edit/,
  /^Source:/m,
  /^Level \d+: /m, // an unconsumed section heading inside a body
  /&(amp|lt|gt|quot|nbsp|rsquo);/,
  /\[\[|\]\]/,
  /\bundefined\b|\bNaN\b|\[object /,
]
const textFields = (e) =>
  [e.description, e.higher_level, e.name].filter((t) => typeof t === 'string')

test('no 2024 feature, feat, spell or species text carries scraping junk', () => {
  const bad = []
  const check = (label, text) => {
    for (const re of JUNK)
      if (re.test(text)) bad.push(`${label}: matches ${re}`)
  }
  for (const e of pub24)
    for (const t of textFields(e)) check(`feature ${e.id}`, t)
  for (const s of spells)
    for (const t of textFields(s)) check(`spell ${s.name}`, t)
  for (const f of listFeats('2024').filter((x) => x.ruleset === '2024'))
    check(`feat ${f.name}`, f.description)
  for (const sp of species)
    for (const t of sp.traits)
      check(`species ${sp.name}/${t.name}`, t.description)
  assert.deepEqual(bad, [])
})

test('every 2024 published feature has real text', () => {
  const thin = pub24
    .filter((e) => !e.description || e.description.trim().length < 25)
    .map((e) => e.id)
  // A handful of features are genuinely one short sentence; anything under 25 chars is a dropped body.
  assert.deepEqual(thin, [])
})

test('2024 feature ids are unique, namespaced, and have a catalog name equal to the published name', () => {
  const ids = pub24.map((e) => e.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate published ids')
  for (const e of pub24) {
    assert.match(e.id, /^pub24_/, e.id)
    assert.equal(catalog[e.id], e.name, `${e.id} catalog name`)
  }
})

// ── classes ─────────────────────────────────────────────────────────────

const MONOTONIC =
  /^(rages|rage_damage|weapon_mastery|second_wind|channel_divinity|wild_shape|focus_points|sorcery_points|cantrips|prepared_spells|spell_slots(_level_\d)?|eldritch_invocations|favored_enemy|plans_known|magic_items)_by_level$/

test('every class table is defined for levels 1-20 and never goes down', () => {
  const problems = []
  for (const name of listClasses('2024')) {
    const c = loadClass(name, '2024')
    for (const [field, table] of Object.entries(c)) {
      if (!field.endsWith('_by_level') || field === 'features_by_level')
        continue
      for (let l = 1; l <= 20; l++)
        if (table[String(l)] === undefined)
          problems.push(`${name}.${field} missing level ${l}`)
      if (MONOTONIC.test(field)) {
        let prev = -Infinity
        for (let l = 1; l <= 20; l++) {
          const v = table[String(l)]
          if (typeof v !== 'number') continue
          if (v < prev)
            problems.push(
              `${name}.${field} drops from ${prev} to ${v} at level ${l}`
            )
          prev = v
        }
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('class chassis: 13 classes, each with a hit die, two saves, a primary ability, and a subclass level of 3', () => {
  const names = listClasses('2024')
  assert.equal(names.length, 13)
  const dice = { Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10 }
  const { hitDieForClass } = require('../rules/5e/progression')
  for (const n of names) {
    const c = loadClass(n, '2024')
    assert.equal(c.saving_throw_proficiencies.length, 2, n)
    assert.ok(c.primary_ability, n)
    assert.equal(c.subclass_choice_level, 3, n)
    assert.ok(
      c.subclass_feature_levels.every((l) => l >= 3),
      n
    )
    if (dice[n]) assert.equal(hitDieForClass(n), dice[n], n)
    assert.ok(c.skill_choices?.count >= 2, `${n} skills`)
  }
})

test('every full caster shares one slot table, every half caster another; Warlock Pact Magic slots never exceed 4', () => {
  const slots = (n, l) =>
    Array.from(
      { length: 9 },
      (_, i) =>
        loadClass(n, '2024')[`spell_slots_level_${i + 1}_by_level`]?.[
          String(l)
        ] ?? 0
    )
  for (let l = 1; l <= 20; l++) {
    const full = JSON.stringify(slots('Wizard', l))
    for (const n of ['Bard', 'Cleric', 'Druid', 'Sorcerer'])
      assert.equal(JSON.stringify(slots(n, l)), full, `${n} ${l}`)
    const half = JSON.stringify(slots('Paladin', l))
    for (const n of ['Ranger', 'Artificer'])
      assert.equal(JSON.stringify(slots(n, l)), half, `${n} ${l}`)
  }
  const w = loadClass('Warlock', '2024')
  for (let l = 1; l <= 20; l++)
    assert.ok(
      w.spell_slots_by_level[String(l)] <= 4 &&
        w.slot_level_by_level[String(l)] <= 5
    )
  assert.equal(slots('Wizard', 20).join(), '4,3,3,3,3,2,2,1,1')
})

test('every spellcasting class ends with 9 (full) / 5 (half) / pact 5 spell levels, and no non-caster has spell columns', () => {
  for (const n of listClasses('2024')) {
    const c = loadClass(n, '2024')
    const top = Math.max(
      0,
      ...Array.from({ length: 9 }, (_, i) =>
        c[`spell_slots_level_${i + 1}_by_level`]?.['20'] ? i + 1 : 0
      )
    )
    const expected = { full: 9, half: 5, artificer: 5, pact: 0, none: 0 }[
      c.spellcasting.type
    ]
    assert.equal(top, expected, `${n} (${c.spellcasting.type})`)
  }
})

// ── subclasses ──────────────────────────────────────────────────────────

test("every 2024 subclass has features at exactly its class's subclass levels, each with text", () => {
  const problems = []
  for (const s of listSubclasses('2024').filter((x) => x.ruleset === '2024')) {
    const data = loadSubclass(s.class, s.name, '2024')
    const cls = loadClass(s.class, '2024')
    const have = Object.keys(data.features_by_level)
      .map(Number)
      .sort((a, b) => a - b)
    const need = cls.subclass_feature_levels
    for (const l of need)
      if (!have.includes(l))
        problems.push(`${s.class}/${s.name}: no feature at level ${l}`)
    for (const l of have)
      if (!need.includes(l))
        problems.push(
          `${s.class}/${s.name}: feature at level ${l}, not a ${s.class} subclass level`
        )
    for (const ids of Object.values(data.features_by_level_ids)) {
      for (const id of ids) {
        const e = published.find((x) => x.id === id)
        if (!e || e.description.trim().length < 25)
          problems.push(`${s.class}/${s.name}: ${id} has no text`)
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('the 68 ingested subclasses have unique names per class', () => {
  const list = listSubclasses('2024').filter((x) => x.ruleset === '2024')
  assert.equal(list.length, 68)
  const seen = new Set()
  for (const s of list) {
    const k = `${s.class}|${s.name}`
    assert.ok(!seen.has(k), k)
    seen.add(k)
  }
  for (const c of [
    'Barbarian',
    'Bard',
    'Cleric',
    'Druid',
    'Fighter',
    'Monk',
    'Paladin',
    'Ranger',
    'Rogue',
    'Sorcerer',
    'Warlock',
    'Wizard',
  ]) {
    assert.ok(
      list.filter((s) => s.class === c).length >= 4,
      `${c} has its four PHB subclasses`
    )
  }
})

test('third-caster subclasses carry a complete 3-20 table; Eldritch Knight and Arcane Trickster agree on slots', () => {
  const ek = loadSubclass('Fighter', 'Eldritch Knight', '2024')
  const at = loadSubclass('Rogue', 'Arcane Trickster', '2024')
  for (let l = 3; l <= 20; l++) {
    assert.ok(ek.prepared_spells_by_level[String(l)] > 0, `EK ${l}`)
    for (let n = 1; n <= 4; n++)
      assert.equal(
        ek[`spell_slots_level_${n}_by_level`][String(l)],
        at[`spell_slots_level_${n}_by_level`][String(l)]
      )
  }
  assert.equal(ek.spell_slots_level_4_by_level['20'], 1)
})

test('always-prepared subclass spells exist as 2024 (or legacy) spells and are in range for their level', () => {
  const { findSpellRecord } = require('../rules/5e/spellLists')
  const problems = []
  for (const s of listSubclasses('2024').filter((x) => x.ruleset === '2024')) {
    const data = loadSubclass(s.class, s.name, '2024')
    for (const field of Object.keys(data).filter(
      (k) => /_spells_by_level$/.test(k) && k !== 'prepared_spells_by_level'
    )) {
      for (const [lvl, names] of Object.entries(data[field])) {
        for (const n of names) {
          const rec = findSpellRecord(n, '2024')
          if (!rec)
            problems.push(
              `${s.name}: ${n} (${field} ${lvl}) is not a known spell`
            )
          else if (rec.level > Math.ceil(Number(lvl) / 2))
            problems.push(
              `${s.name}: ${n} is level ${rec.level}, too high for class level ${lvl}`
            )
        }
      }
    }
  }
  assert.deepEqual(problems, [])
})

// ── spells ──────────────────────────────────────────────────────────────

const SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
]
const CLASSES = [
  'Artificer',
  'Bard',
  'Cleric',
  'Druid',
  'Paladin',
  'Ranger',
  'Sorcerer',
  'Warlock',
  'Wizard',
]

test('all 391 spell records are internally consistent', () => {
  assert.equal(spells.length, 391)
  const names = new Set()
  const problems = []
  for (const s of spells) {
    if (names.has(s.name.toLowerCase())) problems.push(`duplicate ${s.name}`)
    names.add(s.name.toLowerCase())
    if (!(s.level >= 0 && s.level <= 9))
      problems.push(`${s.name}: level ${s.level}`)
    if (!SCHOOLS.includes(s.school))
      problems.push(`${s.name}: school ${s.school}`)
    if (
      !s.components.length ||
      s.components.some((c) => !['V', 'S', 'M'].includes(c))
    )
      problems.push(`${s.name}: components ${s.components}`)
    if (s.components.includes('M') !== !!s.material)
      problems.push(`${s.name}: M component vs material text`)
    if (!s.classes.length || s.classes.some((c) => !CLASSES.includes(c)))
      problems.push(`${s.name}: classes ${s.classes}`)
    if (s.concentration !== /^Concentration/.test(s.duration))
      problems.push(`${s.name}: concentration flag vs duration "${s.duration}"`)
    if (s.ritual !== /Ritual/.test(s.casting_time))
      problems.push(
        `${s.name}: ritual flag vs casting time "${s.casting_time}"`
      )
    if (
      !/^(Action|Bonus Action|Reaction|\d+ (minute|hour)s?)/.test(
        s.casting_time
      )
    )
      problems.push(`${s.name}: casting time "${s.casting_time}"`)
    if (!s.range) problems.push(`${s.name}: no range`)
    if ((s.description || '').length < 25)
      problems.push(`${s.name}: short description`)
    if (
      s.level === 0 &&
      s.higher_level &&
      !/^Cantrip Upgrade/.test(s.higher_level)
    )
      problems.push(`${s.name}: cantrip with slot-level text`)
    if (
      s.level > 0 &&
      s.higher_level &&
      !/^Using a Higher-Level Spell Slot/.test(s.higher_level)
    )
      problems.push(`${s.name}: leveled spell with cantrip text`)
    if (s.ruleset !== '2024') problems.push(`${s.name}: ruleset`)
  }
  assert.deepEqual(problems, [])
})

test('spell names use title case with lowercase small words (Cone of Cold, not Cone Of Cold)', () => {
  const bad = spells.filter((s) =>
    s.name
      .split(' ')
      .slice(1)
      .some((w) =>
        [
          'Of',
          'And',
          'With',
          'The',
          'To',
          'In',
          'From',
          'For',
          'On',
          'At',
          'By',
          'Or',
        ].includes(w)
      )
  )
  assert.deepEqual(
    bad.map((s) => s.name),
    []
  )
})

test('Cleric/Paladin/etc. get no spell above what their slots allow: no 6th-level+ Paladin/Ranger/Artificer spells', () => {
  for (const s of spells) {
    if (
      s.classes.includes('Paladin') ||
      s.classes.includes('Ranger') ||
      s.classes.includes('Artificer')
    ) {
      const limited = s.classes.some((c) =>
        ['Paladin', 'Ranger', 'Artificer'].includes(c)
      )
      if (limited)
        assert.ok(
          s.level <= 5,
          `${s.name} (${s.level}) is on a half-caster list`
        )
    }
  }
})

// ── feats, options, weapons, species, backgrounds ───────────────────────

test('feat catalog: categories add up, prerequisites parsed or explicitly unknown, repeatables identified', () => {
  const feats = listFeats('2024').filter((f) => f.ruleset === '2024')
  assert.equal(feats.length, 75)
  const unknown = feats.filter((f) => f.prerequisite?.type === 'unknown')
  assert.deepEqual(
    unknown.map((f) => f.name),
    [],
    'every prerequisite is understood'
  )
  assert.ok(
    feats
      .filter((f) => f.category === 'general')
      .every(
        (f) =>
          f.name === 'Ability Score Improvement' || f.ability_score_increase
      ),
    'every general feat that raises an ability says which'
  )
  assert.ok(
    feats
      .filter((f) => f.category === 'epic_boon')
      .every((f) => f.prerequisite?.min === 19),
    'epic boons need level 19'
  )
  assert.ok(
    feats.filter((f) => f.category === 'origin').every((f) => !f.prerequisite),
    'origin feats have no prerequisite'
  )
  assert.ok(
    feats
      .filter((f) => f.category === 'fighting_style')
      .every((f) => f.prerequisite?.type === 'fighting_style_feature')
  )
  for (const n of ['Ability Score Improvement', 'Magic Initiate', 'Skilled'])
    assert.ok(feats.find((f) => f.name === n).repeatable, `${n} is repeatable`)
})

test('option lists are the right size and every option has text', () => {
  assert.equal(listInvocations('2024').length, 28)
  assert.equal(listMetamagicOptions('Sorcerer', '2024').length, 10)
  assert.equal(listManeuvers('Fighter', '2024').length, 20)
  for (const o of [
    ...listInvocations('2024'),
    ...listMetamagicOptions('Sorcerer', '2024'),
    ...listManeuvers('Fighter', '2024'),
  ]) {
    assert.ok(o.description.length > 25, o.name)
  }
})

test('every invocation prerequisite refers to an invocation or feature that exists', () => {
  const names = new Set(listInvocations('2024').map((i) => i.name))
  const walk = (p, inv) => {
    if (!p) return
    if (p.type === 'all_of') return p.all.forEach((x) => walk(x, inv))
    if (p.type === 'feature')
      assert.ok(
        names.has(p.feature),
        `${inv}: needs unknown invocation ${p.feature}`
      )
    assert.notEqual(p.type, 'unknown', `${inv}: unparsed prerequisite`)
  }
  for (const i of listInvocations('2024')) walk(i.prerequisite, i.name)
})

test('weapon table: 38 weapons, each with a mastery from the eight, dice, a damage type, and consistent property flags', () => {
  const MASTERY = [
    'cleave',
    'graze',
    'nick',
    'push',
    'sap',
    'slow',
    'topple',
    'vex',
  ]
  const entries = Object.entries(weapons).filter(([k]) => !k.startsWith('_'))
  assert.equal(entries.length, 38)
  for (const [n, w] of entries) {
    assert.ok(MASTERY.includes(w.mastery), `${n}: mastery ${w.mastery}`)
    assert.match(w.damage_dice, /^(\d+d\d+|\d+)$/, n)
    assert.ok(
      ['bludgeoning', 'piercing', 'slashing'].includes(w.damage_type),
      n
    )
    assert.ok(['simple', 'martial'].includes(w.category), n)
    assert.ok(['melee', 'ranged'].includes(w.weapon_type), n)
    assert.equal(
      w.finesse,
      w.properties.some((p) => /^Finesse/.test(p)),
      `${n} finesse flag`
    )
    assert.equal(
      !!w.light,
      w.properties.some((p) => /^Light/.test(p)),
      `${n} light flag`
    )
    assert.equal(
      !!w.heavy,
      w.properties.some((p) => /^Heavy/.test(p)),
      `${n} heavy flag`
    )
    assert.equal(
      w.versatile,
      w.properties.some((p) => /^Versatile/.test(p)),
      `${n} versatile flag`
    )
    if (w.versatile) assert.ok(w.damage_dice_2h, `${n} two-handed die`)
    if (
      w.weapon_type === 'ranged' &&
      w.properties.some((p) => /^Ammunition/.test(p))
    )
      assert.ok(w.range, `${n} range`)
  }
  assert.equal(weapons.dagger.mastery, 'nick')
  assert.equal(weapons.greatsword.mastery, 'graze')
  assert.equal(weapons.greataxe.mastery, 'cleave')
})

test('species: the 10 PHB species each have a type, size, speed and traits with text; Darkvision ranges are stated', () => {
  assert.equal(species.length, 10)
  for (const sp of species) {
    assert.ok(sp.creature_type && sp.size && sp.speed >= 25, sp.name)
    assert.ok(sp.traits.length >= 3, sp.name)
    for (const t of sp.traits)
      assert.ok(t.description.length > 15, `${sp.name}/${t.name}`)
    const dv = sp.traits.find((t) => t.name === 'Darkvision')
    if (dv) assert.match(dv.description, /range of \d+ feet/, sp.name)
  }
  assert.equal(species.find((s) => s.name === 'Goliath').speed, 35)
})

test('backgrounds: 16, each with 3 abilities, an origin feat that exists, 2 skills, a tool and an A/B equipment choice', () => {
  assert.equal(backgrounds.length, 16)
  const feats = new Set(listFeats('2024').map((f) => f.name))
  for (const b of backgrounds) {
    assert.equal(b.ability_scores.length, 3, b.name)
    assert.equal(new Set(b.ability_scores).size, 3, b.name)
    assert.ok(
      feats.has(b.feat.replace(/\s*\(.*\)$/, '')),
      `${b.name}: feat ${b.feat}`
    )
    assert.equal(b.skill_proficiencies.length, 2, b.name)
    assert.ok(b.tool_proficiency.fixed || b.tool_proficiency.choose, b.name)
    assert.equal(b.equipment.B.gold, 50, `${b.name}: option B is 50 GP`)
  }
  const originFeats = new Set(
    listFeats('2024')
      .filter((f) => f.category === 'origin')
      .map((f) => f.name)
  )
  for (const b of backgrounds)
    assert.ok(
      originFeats.has(b.feat.replace(/\s*\(.*\)$/, '')),
      `${b.name}'s feat is an origin feat`
    )
})

// ── feature mechanics ───────────────────────────────────────────────────

test('feature mechanics: every entry points at a real 2024 feature, with a legal action type and a resolvable pool', () => {
  const mech = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'data', '5e', 'feature-mechanics.json'),
      'utf8'
    )
  )
  const ids = new Set(pub24.map((e) => e.id))
  const ACTIONS = ['action', 'bonus_action', 'reaction', 'free']
  const problems = []
  for (const [id, m] of Object.entries(mech)) {
    if (!id.startsWith('pub24_')) continue
    if (!ids.has(id)) problems.push(`${id}: no published feature`)
    if (m.action_type && !ACTIONS.includes(m.action_type))
      problems.push(`${id}: action_type ${m.action_type}`)
    if (m.recharge && !['short_rest', 'long_rest'].includes(m.recharge))
      problems.push(`${id}: recharge ${m.recharge}`)
    if (m.recharge && m.uses_max == null && !m.uses_formula)
      problems.push(`${id}: recharge without a pool`)
    if (m.short_rest_regain != null && m.recharge !== 'long_rest')
      problems.push(`${id}: short_rest_regain needs recharge long_rest`)
    const f = m.uses_formula
    if (f?.type === 'class_table') {
      const c = loadClass(f.class, '2024')
      if (!c?.[f.table])
        problems.push(`${id}: class table ${f.class}.${f.table} missing`)
      else
        for (let l = 1; l <= 20; l++)
          if (c[f.table][String(l)] === undefined)
            problems.push(`${id}: ${f.table} undefined at ${l}`)
    }
    if (
      f &&
      ![
        'class_table',
        'ability_mod',
        'level_multiple',
        'proficiency_bonus',
      ].includes(f.type)
    )
      problems.push(`${id}: formula ${f.type}`)
  }
  assert.deepEqual(problems, [])
  assert.ok(featureMechanics('pub24_barbarian-rage'))
})
