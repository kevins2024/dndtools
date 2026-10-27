const fs = require('fs')
const path = require('path')
const { featureName } = require('./featureCatalog')
const {
  normalizeRuleset,
  dataFilePath,
  isLegacyFallback,
  loadRulesetJson,
} = require('./ruleset')

const SUBCLASSES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'data',
  '5e',
  'subclasses'
)

function slugify(className, subclassName) {
  const clean = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  return `${clean(className)}-${clean(subclassName)}`
}

// Same treatment as classFeatures.js's loadClass — features_by_level is
// stored on disk as feature IDs, resolved back to names at load time so
// every existing consumer keeps seeing name arrays. Raw ids kept alongside
// under features_by_level_ids.
function resolveFeatureIds(data) {
  const ids = data.features_by_level
  const names = {}
  for (const [level, levelIds] of Object.entries(ids)) {
    names[level] = levelIds.map(featureName)
  }
  return { ...data, features_by_level: names, features_by_level_ids: ids }
}

const subclassCache = new Map()

// 2024 gives every class its subclass at 3rd level; 2014 Clerics, Sorcerers and
// Warlocks chose at 1st and Wizards and Druids at 2nd. A legacy subclass played
// under 2024 therefore receives everything it would have given before 3rd level
// at 3rd instead — features, ids and its always-prepared spell tables alike.
// Any `<something>_by_level` map keyed by character level is folded the same way.
function shiftEarlyLevels(data, minLevel) {
  const out = { ...data }
  let shifted = false
  for (const [field, value] of Object.entries(data)) {
    if (!/_by_level(_ids)?$/.test(field) || !value || typeof value !== 'object')
      continue
    const early = Object.keys(value).filter(
      (k) => /^\d+$/.test(k) && Number(k) < minLevel
    )
    if (!early.length) continue
    shifted = true
    const next = {}
    const bucket = []
    for (const k of Object.keys(value).sort((a, b) => Number(a) - Number(b))) {
      if (/^\d+$/.test(k) && Number(k) < minLevel) {
        if (Array.isArray(value[k])) bucket.push(...value[k])
        else next[k] = value[k]
      } else next[k] = value[k]
    }
    if (bucket.length) {
      const own = Array.isArray(next[minLevel]) ? next[minLevel] : []
      next[minLevel] = [...bucket, ...own]
    }
    out[field] = next
  }
  if (shifted) out.level_shifted_to = minLevel
  return out
}
const SUBCLASSES_DIR_2024 = path.join(
  __dirname,
  '..',
  '..',
  'data',
  '5e2024',
  'subclasses'
)

// `ruleset` defaults to '2014'. Under '2024' a subclass the 2024 rules
// rewrote loads from data/5e2024/subclasses; any other is served from the
// 2014 tree tagged `legacy: true` (usable, just not rewritten).
// 2014 subclass name -> its 2024 rewrite's name (data/5e2024/subclass-aliases
// .json), so a character saved as "Berserker" resolves under 2024. Only
// consulted when that name has no file of its own in the 2024 tree.
function aliasedName(className, subclassName) {
  const aliases = loadRulesetJson('2024', 'subclass-aliases.json')
  return aliases?.[className]?.[subclassName] ?? null
}

function loadSubclass(className, subclassName, ruleset) {
  const rs = normalizeRuleset(ruleset)
  if (rs === '2024') {
    const own = path.join(
      SUBCLASSES_DIR_2024,
      `${slugify(className, subclassName)}.json`
    )
    const alias = !fs.existsSync(own) && aliasedName(className, subclassName)
    if (alias) return loadSubclass(className, alias, rs)
  }
  const slug = slugify(className, subclassName)
  const key = `${rs}:${slug}`
  if (subclassCache.has(key)) return subclassCache.get(key)
  const rel = path.join('subclasses', `${slug}.json`)
  const file = dataFilePath(rs, rel)
  if (!fs.existsSync(file)) return null
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  let data = resolveFeatureIds(raw)
  if (isLegacyFallback(rs, rel))
    data = { ...shiftEarlyLevels(data, 3), legacy: true }
  subclassCache.set(key, data)
  return data
}

// The bonus-spell tables are included so callers (e.g. the frontend's
// bonus-spell computation in characterSpells.js) can derive "what bonus spells
// does this character have at their current level" straight from the
// subclass data instead of a per-character copy that can drift out of sync.
// Same directory-scanning portability caveat as classFeatures.js's
// listClasses() — see the comment there and engine/CHECKLIST.md.
function listSubclasses(ruleset) {
  const files = new Map(
    fs
      .readdirSync(SUBCLASSES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [f, path.join(SUBCLASSES_DIR, f)])
  )
  if (
    normalizeRuleset(ruleset) === '2024' &&
    fs.existsSync(SUBCLASSES_DIR_2024)
  ) {
    for (const f of fs.readdirSync(SUBCLASSES_DIR_2024)) {
      if (f.endsWith('.json')) files.set(f, path.join(SUBCLASSES_DIR_2024, f))
    }
    // A renamed rewrite replaces its 2014 namesake instead of sitting beside it.
    const aliases = loadRulesetJson('2024', 'subclass-aliases.json') ?? {}
    for (const [cls, map] of Object.entries(aliases)) {
      if (cls.startsWith('_')) continue
      for (const [oldName, newName] of Object.entries(map)) {
        if (files.has(`${slugify(cls, newName)}.json`)) {
          files.delete(`${slugify(cls, oldName)}.json`)
        }
      }
    }
  }
  return [...files.values()].map((file) => {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    // Legacy subclasses start at 3rd level under 2024 (see shiftEarlyLevels).
    const data =
      normalizeRuleset(ruleset) === '2024' && raw.ruleset !== '2024'
        ? shiftEarlyLevels(raw, 3)
        : raw
    const entry = {
      class: data.class,
      name: data.name,
      expanded_spell_list: data.expanded_spell_list ?? null,
      // Under 2024: which tree this came from (a 2014 subclass the 2024 rules
      // did not rewrite is `legacy`).
      ...(normalizeRuleset(ruleset) === '2024'
        ? data.ruleset === '2024'
          ? { ruleset: '2024' }
          : { legacy: true }
        : {}),
    }
    // Every other always-prepared bonus-spell table (domain/oath/circle/
    // psionic/clockwork/bonus_spells_by_level — see characterSpells.js's
    // BONUS_SPELL_FIELDS). Before 2026-10-01 only expanded_spell_list made
    // it into this list, so characterSpells' getBonusSpells silently found
    // nothing for every one of those fields in the live app.
    for (const key of Object.keys(data)) {
      if (key.endsWith('_spells_by_level')) entry[key] = data[key]
    }
    return entry
  })
}

function subclassFeaturesGainedAtLevel(
  className,
  subclassName,
  level,
  ruleset
) {
  const sub = loadSubclass(className, subclassName, ruleset)
  if (!sub) return []
  return sub.features_by_level[String(level)] || []
}

function subclassFeatureIdsGainedAtLevel(
  className,
  subclassName,
  level,
  ruleset
) {
  const sub = loadSubclass(className, subclassName, ruleset)
  if (!sub) return []
  return sub.features_by_level_ids[String(level)] || []
}

module.exports = {
  slugify,
  loadSubclass,
  listSubclasses,
  subclassFeaturesGainedAtLevel,
  subclassFeatureIdsGainedAtLevel,
}
