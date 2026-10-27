// Independent check of the ingested 2024 data against WotC's SRD 5.2 as served by
// dnd5eapi.co/api/2024 — a second source, so a wikidot parsing mistake shows up as
// a disagreement instead of silently becoming "the rules".
//
//   node scripts/audit-2024-vs-srd.js                # full report
//   node scripts/audit-2024-vs-srd.js classes spells # just those sections
//   AUDIT_CACHE=/some/dir node scripts/audit-2024-vs-srd.js
//
// Network access is only needed the first time (responses are cached). The SRD
// covers 12 classes, 12 subclasses, 9 species, 4 backgrounds, 17 feats, 339
// spells and the weapon table; everything else (Artificer, the other 57
// subclasses, the remaining PHB spells and feats) has no second source and is
// covered by the offline invariant tests in engine/test/audit2024.test.js.
//
// Exit code 1 if any section reports a mismatch.

const fs = require('fs')
const os = require('os')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CACHE =
  process.env.AUDIT_CACHE || path.join(os.tmpdir(), 'dndtools-srd2024')
const BASE = 'https://www.dnd5eapi.co'
fs.mkdirSync(CACHE, { recursive: true })

const { loadClass } = require('../engine/rules/5e/classFeatures')
const { loadSubclass } = require('../engine/rules/5e/subclasses')
const { loadSpecies } = require('../engine/rules/5e/species')
const { loadBackground } = require('../engine/rules/5e/backgrounds')
const { loadFeat } = require('../engine/rules/5e/grants')
const { findSpellRecord } = require('../engine/rules/5e/spellLists')
const { proficiencyBonus } = require('../engine/rules/5e/progression')
const { hitDieForClass } = require('../engine/rules/5e/progression')
const weapons = require('../engine/data/5e2024/weapons.json')
const published = require('../src/data/published_features.json')

async function get(url) {
  const file = path.join(CACHE, url.replace(/[^a-z0-9]+/gi, '_') + '.json')
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(BASE + url)
    if (res.ok) {
      const data = await res.json()
      fs.writeFileSync(file, JSON.stringify(data))
      return data
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
  }
  throw new Error(`GET ${url} failed`)
}
async function all(urls, limit = 8) {
  const out = new Array(urls.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < urls.length) {
        const i = next++
        out[i] = await get(urls[i])
      }
    })
  )
  return out
}

const key = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
// The SRD text carries PDF-extraction damage ("ex- pended", "Blud- geoning") and
// Markdown asterisks; compare as bags of alphanumeric words with those repaired.
const words = (s) =>
  String(s ?? '')
    .replace(/(\w)- (\w)/g, '$1$2')
    .replace(/[*_]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .match(/[a-z0-9]+/g) ?? []
// Fraction of the SRD's words that our text also contains. Ours may legitimately
// have MORE (the SRD API truncates some features); it must never have LESS.
function similarity(srdText, ourText) {
  const A = words(srdText)
  const B = words(ourText)
  if (!A.length) return 1
  const count = new Map()
  for (const w of B) count.set(w, (count.get(w) ?? 0) + 1)
  let hit = 0
  for (const w of A)
    if (count.get(w) > 0) {
      hit++
      count.set(w, count.get(w) - 1)
    }
  return hit / A.length
}

const sections = {}
// dnd5eapi.co's 2024 data has errors of its own. Each entry below was checked against
// the official SRD 5.2 text on D&D Beyond (or the spell's own text) and our value is
// the correct one; they are suppressed from the report but counted and listed with
// the reason, so nothing is hidden silently.
const KNOWN_SRD_API_ERRORS = [
  {
    re: /^Druid 7: cantrips 3 vs SRD 4$/,
    why: 'API: 4 cantrips at 7, back to 3 at 8 (non-monotonic)',
  },
  {
    re: /^Druid 16: cantrips 4 vs SRD 5$/,
    why: 'API: 5 at 16, back to 4 at 17 (non-monotonic)',
  },
  {
    re: /^Wizard (1[4-9]|20): prepared spells \d+ vs SRD \d+$/,
    why: 'API Wizard prepared-spells column is off; SRD 5.2 on D&D Beyond reads 18/19/21/22/23/24/25 for levels 14-20, matching ours',
  },
  {
    re: /^Control Water: only \d+% of the SRD description is present$/,
    why: "API text has Control Weather's table appended",
  },
  {
    re: /^Protection from Evil and Good: concentration true\/false$/,
    why: 'API flag is false but its own duration text reads "Concentration up to 10 minutes"',
  },
  {
    re: /^Tiefling: size .* vs SRD undefined$/,
    why: 'API has no size for Tiefling (the book says Medium or Small)',
  },
  {
    re: /^Boon of (Irresistible Offense|Spell Recall): (text similarity|only \d+%)/,
    why: 'API generalises the ability increase to "one ability of your choice"; SRD 5.2 on D&D Beyond restricts it (Strength or Dexterity / Intelligence, Wisdom, or Charisma) like ours',
  },
  {
    re: /^Sling: type bludgeoning\/piercing$/,
    why: 'API says piercing; SRD 5.2 table: Sling 1d4 Bludgeoning',
  },
  {
    re: /^(Fighter \/ Fighting Style|Paladin \/ Paladin's Smite|Rogue \/ (Slippery Mind|Thieves' Cant)): text only/,
    why: 'wording differs between the PHB (what the wiki has) and the SRD edit — e.g. "see chapter 5" vs "see Feats"; same mechanics',
  },
  {
    re: /^Warlock \/ Mystic Arcanum: in the SRD but not/,
    why: 'we list Mystic Arcanum as one feature per spell level ("Mystic Arcanum (Level 6 Spell)"); the SRD has a single feature',
  },
  {
    re: /^Oath of Devotion \/ Oath of Devotion Spells: text similarity/,
    why: 'API text for the spell table is garbled ("Shielf of Faith", a spell-school grid); ours matches the book',
  },
  {
    re: /^Trident: damage 1d8\/1d6$/,
    why: 'API still has the 2014 die; SRD 5.2 table: Trident 1d8 Piercing, Versatile (1d10)',
  },
]
const suppressed = []
const report = (name, problems, checked) => {
  const kept = []
  for (const p of problems) {
    const hit = KNOWN_SRD_API_ERRORS.find((k) => k.re.test(p))
    if (hit) suppressed.push({ problem: p, why: hit.why })
    else kept.push(p)
  }
  sections[name] = { checked, problems: kept }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const IGNORED_FEATURES =
  /(Ability Score Improvement|Epic Boon|Subclass|Subclass Feature)$/i
const PLACEHOLDER = (n) => IGNORED_FEATURES.test(n)

// ── classes ───────────────────────────────────────────────────────────

const CLASS_SPECIFIC_MAP = {
  rage_count: 'rages_by_level',
  rage_damage_bonus: 'rage_damage_by_level',
  weapon_mastery: 'weapon_mastery_by_level',
  second_wind: 'second_wind_by_level',
  channel_divinity: 'channel_divinity_by_level',
  wild_shape: 'wild_shape_by_level',
  focus_points: 'focus_points_by_level',
  martial_arts_die: 'martial_arts_by_level',
  unarmored_movement: 'unarmored_movement_by_level',
  sorcery_points: 'sorcery_points_by_level',
  bardic_die: 'bardic_die_by_level',
  bardic_inspiration_die: 'bardic_die_by_level',
  favored_enemy: 'favored_enemy_by_level',
  sneak_attack: 'sneak_attack_by_level',
  invocations_known: 'eldritch_invocations_by_level',
  eldritch_invocations: 'eldritch_invocations_by_level',
  channel_divinity_charges: 'channel_divinity_by_level',
  wild_shape_uses: 'wild_shape_by_level',
  second_wind_uses: 'second_wind_by_level',
  unarmored_movement_bonus: 'unarmored_movement_by_level',
  favored_enemies: 'favored_enemy_by_level',
}

// "D6" / "1d6" / "+2" / "-" / undefined -> a comparable string.
const plain = (x) => {
  if (x === undefined || x === null || x === '-' || x === '—') return '0'
  return String(x)
    .replace(/ ?ft\.?$/i, '')
    .replace(/^\+/, '')
    .replace(/^1?d/i, '')
}

async function classes() {
  const problems = []
  let checked = 0
  const list = await get('/api/2024/classes')
  const specificKeysSeen = new Set()
  for (const { index, name } of list.results) {
    const api = await get(`/api/2024/classes/${index}`)
    const levels = await get(`/api/2024/classes/${index}/levels`)
    const ours = loadClass(name, '2024')
    if (!ours) {
      problems.push(`${name}: no 2024 class data`)
      continue
    }
    checked++
    if (api.hit_die !== hitDieForClass(name))
      problems.push(
        `${name}: hit die ${hitDieForClass(name)} vs SRD ${api.hit_die}`
      )
    const saves = api.proficiencies
      .filter((p) => /^saving-throw/.test(p.index))
      .map((p) => p.index.replace('saving-throw-', ''))
    if (!eq([...saves].sort(), [...ours.saving_throw_proficiencies].sort()))
      problems.push(
        `${name}: saves ${ours.saving_throw_proficiencies} vs SRD ${saves}`
      )
    let apiArmor = api.proficiencies
      .filter((p) => /armor$|shields/.test(p.index))
      .map((p) => p.index.replace('-armor', ''))
    // The SRD tags "all armor" for Fighter/Paladin; ours lists the three weights.
    if (apiArmor.includes('all'))
      apiArmor = [
        ...apiArmor.filter((a) => a !== 'all'),
        'light',
        'medium',
        'heavy',
      ]
    for (const a of apiArmor)
      if (!ours.armor_proficiencies.includes(a))
        problems.push(`${name}: armor "${a}" in SRD, missing here`)
    for (const a of ours.armor_proficiencies)
      if (!apiArmor.includes(a))
        problems.push(`${name}: armor "${a}" here, not in SRD`)
    const primary = api.primary_ability.ability_scores
      .map((a) => a.index)
      .join('+')
    void primary

    for (const lv of levels) {
      checked++
      const L = lv.level
      if (lv.prof_bonus !== proficiencyBonus(L))
        problems.push(
          `${name} ${L}: proficiency bonus ${proficiencyBonus(L)} vs SRD ${
            lv.prof_bonus
          }`
        )
      // Ours spell out tiers ("Action Surge (One Use)"); the SRD has one name.
      const untier = (n) =>
        key(n)
          .replace(/ (one|two|three) uses?$/, '')
          .replace(/ level \d spell$/, '')
      const apiNames = (lv.features ?? [])
        .map((f) => f.name)
        .filter((n) => !PLACEHOLDER(n))
        .map(untier)
        .sort()
      const ourNames = (ours.features_by_level[String(L)] ?? [])
        .map(untier)
        .sort()
      if (!eq(apiNames, ourNames))
        problems.push(
          `${name} ${L}: features ${JSON.stringify(
            ourNames
          )} vs SRD ${JSON.stringify(apiNames)}`
        )
      const at = (table) => {
        let v
        let best = -1
        for (const [k, val] of Object.entries(table ?? {}))
          if (Number(k) <= L && Number(k) > best) {
            best = Number(k)
            v = val
          }
        return v
      }
      for (const [k, v] of Object.entries(lv.class_specific ?? {})) {
        specificKeysSeen.add(`${name}.${k}`)
        const col = CLASS_SPECIFIC_MAP[k]
        if (!col || !ours[col]) continue
        const mine = at(ours[col])
        const apiVal =
          typeof v === 'object' && v !== null
            ? v.dice_count
              ? `${v.dice_count}d${v.dice_value}`
              : JSON.stringify(v)
            : v
        if (plain(mine) !== plain(apiVal)) {
          problems.push(
            `${name} ${L}: ${col} ${JSON.stringify(
              mine
            )} vs SRD ${k}=${JSON.stringify(apiVal)}`
          )
        }
      }
      const sc = lv.spellcasting
      if (sc) {
        const cantrips = at(ours.cantrips_by_level) ?? 0
        if (sc.cantrips_known != null && cantrips !== sc.cantrips_known)
          problems.push(
            `${name} ${L}: cantrips ${cantrips} vs SRD ${sc.cantrips_known}`
          )
        const prepared = at(ours.prepared_spells_by_level)
        if (sc.spells_prepared != null || sc.prepared_spells != null) {
          const v = sc.spells_prepared ?? sc.prepared_spells
          if (prepared !== v)
            problems.push(
              `${name} ${L}: prepared spells ${prepared} vs SRD ${v}`
            )
        }
        for (let n = 1; n <= 9; n++) {
          const apiSlots = sc[`spell_slots_level_${n}`]
          if (apiSlots == null) continue
          // Warlock Pact Magic is one pool at one level: slots at `slot_level`, none elsewhere.
          const mine =
            name === 'Warlock'
              ? at(ours.slot_level_by_level) === n
                ? at(ours.spell_slots_by_level)
                : 0
              : at(ours[`spell_slots_level_${n}_by_level`]) ?? 0
          if (mine !== apiSlots)
            problems.push(
              `${name} ${L}: level-${n} slots ${mine} vs SRD ${apiSlots}`
            )
        }
      }
    }
  }
  report(
    'classes (hit die, saves, armor, proficiency bonus, features and tables for all 12 SRD classes x 20 levels)',
    problems,
    checked
  )
  const unmapped = [...specificKeysSeen].filter(
    (k) => !CLASS_SPECIFIC_MAP[k.split('.')[1]]
  )
  if (unmapped.length)
    sections[
      'classes (hit die, saves, armor, proficiency bonus, features and tables for all 12 SRD classes x 20 levels)'
    ].note = `class_specific keys not compared: ${[
      ...new Set(unmapped.map((k) => k.split('.')[1])),
    ].join(', ')}`
}

// ── subclasses ────────────────────────────────────────────────────────

async function subclasses() {
  const problems = []
  let checked = 0
  const list = await get('/api/2024/subclasses')
  for (const { index } of list.results) {
    const api = await get(`/api/2024/subclasses/${index}`)
    const ours = loadSubclass(api.class.name, api.name, '2024')
    if (!ours || ours.legacy) {
      problems.push(`${api.name}: not in the 2024 subclass data`)
      continue
    }
    checked++
    const apiByLevel = {}
    for (const f of api.features ?? [])
      (apiByLevel[f.level] ??= []).push(key(f.name))
    const ourByLevel = {}
    for (const [l, names] of Object.entries(ours.features_by_level))
      ourByLevel[l] = names.map(key).sort()
    for (const l of Object.keys(apiByLevel)) apiByLevel[l].sort()
    if (!eq(apiByLevel, ourByLevel))
      problems.push(
        `${api.name}: features by level ${JSON.stringify(
          ourByLevel
        )} vs SRD ${JSON.stringify(apiByLevel)}`
      )
    for (const f of api.features ?? []) {
      const id = (ours.features_by_level_ids[f.level] ?? [])[
        (ours.features_by_level[f.level] ?? []).findIndex(
          (n) => key(n) === key(f.name)
        )
      ]
      const pub = published.find((e) => e.id === id)
      const sim = pub ? similarity(f.description, pub.description) : 0
      checked++
      if (sim < 0.95)
        problems.push(
          `${api.name} / ${f.name}: text similarity ${sim.toFixed(2)} to SRD`
        )
    }
  }
  // The API folds Circle of the Land's land tables into one feature named with its own
  // first sentence, so by-level names and that one text can't be compared directly.
  for (let k = problems.length - 1; k >= 0; k--)
    if (
      /^Circle of the Land( \/ Circle of the Land Spells)?[: ]/.test(
        problems[k]
      )
    )
      problems.splice(k, 1)
  report(
    'subclasses (the 12 SRD subclasses: features by level and their text)',
    problems,
    checked
  )
}

// ── class feature text ────────────────────────────────────────────────

async function featureText() {
  const problems = []
  let checked = 0
  const list = await get('/api/2024/features')
  const urls = list.results.map((r) => `/api/2024/features/${r.index}`)
  const feats = await all(urls)
  const byClass = new Map()
  const untier = (n) => key(n).replace(/ (one|two|three) uses?$/, '')
  for (const e of published) {
    if (
      e.ruleset !== '2024' ||
      !['class_feature', 'subclass_feature'].includes(e.category)
    )
      continue
    // subclass entries are filed as "Barbarian (Path of the Berserker)"
    byClass.set(
      `${key(String(e.class).split('(')[0])}|${untier(e.name)}|${
        e.level_gained
      }|${e.id}`,
      e
    )
  }
  for (const f of feats) {
    if (!f.class) continue
    const k = `${key(f.class.name)}|${untier(f.name)}`
    const cands = [...byClass.entries()]
      .filter(([kk]) => kk.startsWith(k + '|'))
      .map(([, v]) => v)
    if (!cands.length) {
      if (!PLACEHOLDER(f.name))
        problems.push(
          `${f.class.name} / ${f.name}: in the SRD but not in our class features`
        )
      continue
    }
    checked++
    const best = Math.max(
      ...cands.map((c) => similarity(f.description, c.description))
    )
    if (best < 0.95)
      problems.push(
        `${f.class.name} / ${f.name}: text only ${(best * 100).toFixed(
          0
        )}% of the SRD text is present`
      )
  }
  report(
    'class feature text (SRD 5.2 vs the wiki text we ingested)',
    problems,
    checked
  )
}

// ── spells ────────────────────────────────────────────────────────────

// The SRD drops the eponymous wizard names (Melf's Acid Arrow -> Acid Arrow); the
// Player's Handbook keeps them, and so does the wiki.
const SRD_SPELL_ALIASES = {
  'Acid Arrow': "Melf's Acid Arrow",
  'Arcane Hand': "Bigby's Hand",
  'Arcane Sword': "Mordenkainen's Sword",
  "Arcanist's Magic Aura": "Nystul's Magic Aura",
  'Black Tentacles': "Evard's Black Tentacles",
  'Faithful Hound': "Mordenkainen's Faithful Hound",
  'Floating Disk': "Tenser's Floating Disk",
  'Freezing Sphere': "Otiluke's Freezing Sphere",
  'Hideous Laughter': "Tasha's Hideous Laughter",
  'Instant Summons': "Drawmij's Instant Summons",
  'Irresistible Dance': "Otto's Irresistible Dance",
  'Magnificent Mansion': "Mordenkainen's Magnificent Mansion",
  'Private Sanctum': "Mordenkainen's Private Sanctum",
  'Resilient Sphere': "Otiluke's Resilient Sphere",
  'Secret Chest': "Leomund's Secret Chest",
  'Telepathic Bond': "Rary's Telepathic Bond",
  'Tiny Hut': "Leomund's Tiny Hut",
}

async function spells() {
  const problems = []
  let checked = 0
  const list = await get('/api/2024/spells')
  const urls = list.results.map((r) => `/api/2024/spells/${r.index}`)
  const api = await all(urls)
  for (const s of api) {
    const ourName = SRD_SPELL_ALIASES[s.name] ?? s.name
    const mine = findSpellRecord(ourName, '2024')
    if (!mine || mine.ruleset !== '2024') {
      problems.push(`${s.name}: in the SRD but not in the 2024 spell data`)
      continue
    }
    checked++
    const bad = []
    // Exact capitalisation matters for display, so compare the name itself too.
    if (mine.name !== ourName) bad.push(`name "${mine.name}" vs "${ourName}"`)
    if (mine.level !== s.level) bad.push(`level ${mine.level}/${s.level}`)
    if (key(mine.school) !== key(s.school?.name ?? s.school))
      bad.push(`school ${mine.school}/${s.school?.name}`)
    // "Action or Ritual" is "Action" + ritual:true in the API.
    const ct = (t) => key(String(t).replace(/ or Ritual$/i, ''))
    if (ct(mine.casting_time) !== ct(s.casting_time))
      bad.push(`casting time "${mine.casting_time}"/"${s.casting_time}"`)
    // Two API records carry the first component line inside `range`.
    const apiRange = String(s.range).replace(/ Component:.*$/, '')
    if (key(mine.range) !== key(apiRange))
      bad.push(`range "${mine.range}"/"${s.range}"`)
    const apiComps = (s.components ?? []).filter(Boolean)
    if (
      apiComps.length &&
      !eq([...mine.components].sort(), [...apiComps].sort())
    )
      bad.push(`components ${mine.components}/${apiComps}`)
    if (!!mine.concentration !== !!s.concentration)
      bad.push(`concentration ${mine.concentration}/${s.concentration}`)
    if (!!mine.ritual !== !!s.ritual)
      bad.push(`ritual ${mine.ritual}/${s.ritual}`)
    // The SRD has no Artificer, so compare the other classes.
    const apiClasses = (s.classes ?? []).map((c) => c.name).sort()
    const ours = mine.classes.filter((c) => c !== 'Artificer').sort()
    if (!eq(ours, apiClasses)) bad.push(`classes ${ours}/${apiClasses}`)
    if (
      key(mine.duration.replace(/^Concentration, /, '')) !==
      key(s.duration.replace(/^Concentration, /, ''))
    )
      bad.push(`duration "${mine.duration}"/"${s.duration}"`)
    // The API keeps "Cantrip Upgrade"/"Higher-Level Spell Slot" text in different places.
    const sim = similarity(
      `${s.description} ${s.higher_level ?? ''}`,
      `${mine.description} ${mine.higher_level ?? ''}`
    )
    if (sim < 0.95)
      bad.push(
        `only ${(sim * 100).toFixed(0)}% of the SRD description is present`
      )
    if (bad.length) problems.push(`${s.name}: ${bad.join('; ')}`)
  }
  report(
    `spells (all ${api.length} SRD spells: name, level, school, casting time, range, components, duration, classes, text)`,
    problems,
    checked
  )
}

// ── species / feats / backgrounds ─────────────────────────────────────

async function origins() {
  const problems = []
  let checked = 0
  const sp = await get('/api/2024/species')
  for (const { index } of sp.results) {
    const api = await get(`/api/2024/species/${index}`)
    const mine = loadSpecies(api.name, '2024')
    if (!mine || mine.legacy) {
      problems.push(`${api.name}: not in 2024 species data`)
      continue
    }
    checked++
    if (mine.speed !== api.speed)
      problems.push(`${api.name}: speed ${mine.speed} vs SRD ${api.speed}`)
    if (!(mine.size ?? '').startsWith(api.size))
      problems.push(`${api.name}: size "${mine.size}" vs SRD ${api.size}`)
    if (key(mine.creature_type) !== key(api.type))
      problems.push(
        `${api.name}: type ${mine.creature_type} vs SRD ${api.type}`
      )
    const apiTraits = api.traits
      .map((t) => key(t.name.replace(/\s*\(.*\)$/, '')))
      .sort()
    const ours = mine.traits
      .map((t) => key(t.name))
      .filter((n) => !/gnome$/.test(n) || n === 'gnomish lineage')
      .sort()
    for (const t of apiTraits)
      if (!mine.traits.some((x) => key(x.name) === t))
        problems.push(`${api.name}: SRD trait "${t}" missing here`)
    void ours
  }
  const feats = await get('/api/2024/feats')
  for (const { index } of feats.results) {
    const api = await get(`/api/2024/feats/${index}`)
    const mine = loadFeat(api.name, '2024')
    if (!mine || mine.legacy) {
      problems.push(`${api.name}: not in 2024 feat data`)
      continue
    }
    checked++
    const apiCat =
      {
        origin: 'origin',
        general: 'general',
        'fighting-style': 'fighting_style',
        'epic-boon': 'epic_boon',
      }[api.type] ?? api.type
    if (mine.category !== apiCat)
      problems.push(`${api.name}: category ${mine.category} vs SRD ${api.type}`)
    const sim = similarity(api.description, mine.description)
    if (sim < 0.95)
      problems.push(`${api.name}: text similarity ${sim.toFixed(2)}`)
  }
  const bgs = await get('/api/2024/backgrounds')
  for (const { index } of bgs.results) {
    const api = await get(`/api/2024/backgrounds/${index}`)
    const mine = loadBackground(api.name, '2024')
    if (!mine || mine.legacy) {
      problems.push(`${api.name}: not in 2024 background data`)
      continue
    }
    checked++
    if (
      !eq(
        mine.ability_scores,
        api.ability_scores.map((a) => a.index)
      )
    )
      problems.push(
        `${api.name}: ability scores ${
          mine.ability_scores
        } vs SRD ${api.ability_scores.map((a) => a.index)}`
      )
    if (key(mine.feat.replace(/\s*\(.*\)$/, '')) !== key(api.feat.name))
      problems.push(`${api.name}: feat ${mine.feat} vs SRD ${api.feat.name}`)
    const skills = api.proficiencies
      .filter((p) => /^skill-/.test(p.index))
      .map((p) => p.index.replace('skill-', '').replace(/-/g, '_'))
      .sort()
    if (!eq([...mine.skill_proficiencies].sort(), skills))
      problems.push(
        `${api.name}: skills ${mine.skill_proficiencies} vs SRD ${skills}`
      )
  }
  report(
    'species, feats and backgrounds (the SRD 9 species, 17 feats, 4 backgrounds)',
    problems,
    checked
  )
}

// ── weapons ───────────────────────────────────────────────────────────

async function weaponTable() {
  const problems = []
  let checked = 0
  const cat = await get('/api/2024/equipment-categories/weapons')
  const items = await all(
    cat.equipment.map((e) => `/api/2024/equipment/${e.index}`)
  )
  for (const w of items) {
    const mine = weapons[w.name.toLowerCase()]
    if (!mine) {
      problems.push(`${w.name}: in the SRD weapon list, not in ours`)
      continue
    }
    checked++
    const bad = []
    if (w.damage?.damage_dice && w.damage.damage_dice !== mine.damage_dice)
      bad.push(`damage ${mine.damage_dice}/${w.damage.damage_dice}`)
    if (
      w.damage?.damage_type &&
      w.damage.damage_type.index !== mine.damage_type
    )
      bad.push(`type ${mine.damage_type}/${w.damage.damage_type.index}`)
    if (w.mastery && w.mastery.index !== mine.mastery)
      bad.push(`mastery ${mine.mastery}/${w.mastery.index}`)
    const apiProps = (w.properties ?? []).map((p) => p.index).sort()
    const mineProps = mine.properties
      .map((p) => key(p.replace(/\s*\(.*\)$/, '')).replace(/ /g, '-'))
      .sort()
    if (!eq(apiProps, mineProps))
      bad.push(`properties ${mineProps}/${apiProps}`)
    const cats = (w.equipment_categories ?? []).map((c) => c.index)
    if (!cats.includes(`${mine.category}-weapons`))
      bad.push(`category ${mine.category}`)
    if (bad.length) problems.push(`${w.name}: ${bad.join('; ')}`)
  }
  report(
    'weapons (damage, type, properties, Mastery, category)',
    problems,
    checked
  )
}

// ── class spell lists (the wiki's own <class>:spell-list pages) ─────────
// A second, independent route to "which class gets which spell at what level" for
// the spells the SRD doesn't cover: each class has a page listing its spells by
// level, separate from the tag on each spell's own page.

const { fetchPage } = require('./fetch-2024-wikidot')
const SMALL = new Set([
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
])
const fixCase = (n) =>
  n
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w.toLowerCase() : w))
    .join(' ')
const ORD = { cantrip: 0, '1st': 1, '2nd': 2, '3rd': 3 }

async function spellLists() {
  const problems = []
  let checked = 0
  const spellsFile = require('../src/data/spells_2024.json')
  const byName = new Map(spellsFile.map((sp) => [key(sp.name), sp]))
  for (const cls of [
    'Artificer',
    'Bard',
    'Cleric',
    'Druid',
    'Paladin',
    'Ranger',
    'Sorcerer',
    'Warlock',
    'Wizard',
  ]) {
    const { lines } = await fetchPage(`${cls.toLowerCase()}:spell-list`)
    const levels = []
    for (const l of lines) {
      const m = /^(Cantrip|(\d)(?:st|nd|rd|th) Level)$/.exec(l)
      if (m) levels.push(m[1] === 'Cantrip' ? 0 : Number(m[2]))
    }
    let table = -1
    const listed = new Map()
    for (const l of lines) {
      if (/^Name \| School \|/.test(l)) {
        table++
        continue
      }
      if (table < 0 || !l.includes(' | ')) continue
      const cells = l.split(' | ')
      listed.set(key(fixCase(cells[0])), {
        name: fixCase(cells[0]),
        level: levels[table],
        lists: cells[2],
      })
    }
    // everything our data puts on this class's list must be on its page at the same level
    for (const sp of spellsFile.filter((x) => x.classes.includes(cls))) {
      checked++
      const l = listed.get(key(sp.name))
      if (!l)
        problems.push(
          `${cls}: ${sp.name} is tagged for ${cls} here but is not on the ${cls} spell-list page`
        )
      else if (l.level !== sp.level)
        problems.push(
          `${cls}: ${sp.name} is level ${sp.level} here but level ${l.level} on the ${cls} page`
        )
    }
    // ...and everything on the page that is a PHB spell must be tagged for the class here
    for (const [k, l] of listed) {
      const sp = byName.get(k)
      if (!sp) continue // another book's spell
      if (!sp.classes.includes(cls))
        problems.push(
          `${cls}: ${l.name} is on the ${cls} page but not tagged for ${cls} here`
        )
    }
  }
  report(
    "class spell lists (our per-spell class tags vs the wiki's <class>:spell-list pages, both directions)",
    problems,
    checked
  )
}

const RUN = {
  spellLists,
  classes,
  subclasses,
  featureText,
  spells,
  origins,
  weapons: weaponTable,
}

;(async () => {
  const want = process.argv.slice(2)
  for (const [name, fn] of Object.entries(RUN)) {
    if (want.length && !want.includes(name)) continue
    process.stderr.write(`auditing ${name}...\n`)
    await fn()
  }
  let bad = 0
  for (const [name, { checked, problems, note }] of Object.entries(sections)) {
    console.log(
      `\n## ${name}\nchecked ${checked}; ${problems.length} mismatch(es)${
        note ? `\n(${note})` : ''
      }`
    )
    for (const p of problems.slice(0, 60)) console.log(`  - ${p}`)
    if (problems.length > 60)
      console.log(`  ... and ${problems.length - 60} more`)
    bad += problems.length
  }
  if (suppressed.length) {
    const reasons = new Map()
    for (const { problem, why } of suppressed)
      reasons.set(why, (reasons.get(why) ?? 0) + 1)
    console.log(
      `\n${suppressed.length} disagreement(s) are known dnd5eapi.co errors (our value matches the official SRD 5.2 text):`
    )
    for (const [why, n] of reasons) console.log(`  - ${n}x ${why}`)
  }
  console.log(`\nTOTAL mismatches: ${bad}`)
  process.exit(bad ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
