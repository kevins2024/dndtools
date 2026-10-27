const fs = require('fs')
const path = require('path')
const { featureName } = require('./featureCatalog')
const { normalizeRuleset, dataFilePath, isLegacyFallback } = require('./ruleset')

const CLASSES_DIR = path.join(__dirname, '..', '..', 'data', '5e', 'classes')
const CLASSES_DIR_2024 = path.join(__dirname, '..', '..', 'data', '5e2024', 'classes')

const classCache = new Map()

// features_by_level is stored on disk as feature IDs, not names (originally
// migrated by scripts/assign-feature-ids.py, deleted 2026-09-26 — see
// engine/CHECKLIST.md's entry that day for why it's no longer safe to re-run)
// — resolved back to names right here at load time, so every existing
// consumer of loadClass(...).features_by_level keeps seeing exactly the
// familiar name arrays it always has. The original ids are kept alongside
// under features_by_level_ids for anything (like diffLevelUp's newFeatures)
// that wants the id, not just the display name.
function resolveFeatureIds(data) {
  const ids = data.features_by_level
  const names = {}
  for (const [level, levelIds] of Object.entries(ids)) {
    names[level] = levelIds.map(featureName)
  }
  return { ...data, features_by_level: names, features_by_level_ids: ids }
}

// `ruleset` defaults to '2014', so every existing caller is unchanged. For
// '2024' a class the 2024 rules rewrote loads from data/5e2024/; any other
// class is served from the 2014 tree and tagged `legacy: true` (it is still
// usable under the 2024 rules, it just hasn't been rewritten).
function loadClass(className, ruleset) {
  const rs = normalizeRuleset(ruleset)
  const key = `${rs}:${className}`
  if (classCache.has(key)) return classCache.get(key)
  const rel = path.join('classes', `${className.toLowerCase()}.json`)
  const file = dataFilePath(rs, rel)
  if (!fs.existsSync(file)) return null
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  let data = resolveFeatureIds(raw)
  if (isLegacyFallback(rs, rel)) data = { ...data, legacy: true }
  classCache.set(key, data)
  return data
}

// Directory-scanning (unlike loadClass's read-a-named-file-above) is the one
// real portability gap in this module — a non-Node host can't just "list a
// folder," it needs a static manifest instead. Not fixed here since it would
// mean either a generated index file kept in sync with data/classes/*.json or
// bundling every class into one JSON blob, either of which is a bigger call
// than this pass's "small/medium fix" scope — see engine/CHARACTER_SCHEMA.md's
// sibling note in CHECKLIST.md for the full writeup.
function listClasses(ruleset) {
  const read = (dir) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).name)
      : []
  const names = read(CLASSES_DIR)
  if (normalizeRuleset(ruleset) !== '2024') return names
  // 2024 rewrites replace their 2014 namesake; legacy classes stay listed.
  for (const n of read(CLASSES_DIR_2024)) if (!names.includes(n)) names.push(n)
  return names
}

function featuresGainedAtLevel(className, level, ruleset) {
  const cls = loadClass(className, ruleset)
  if (!cls) return []
  const named = cls.features_by_level[String(level)] || []
  const ids = cls.features_by_level_ids[String(level)] || []
  const isSubclassLevel = cls.subclass_feature_levels.includes(level)
  return {
    named: [...named],
    ids: [...ids],
    subclassFeatureSlot: isSubclassLevel,
    subclassChoice: level === cls.subclass_choice_level,
  }
}

function allFeaturesUpToLevel(className, level, ruleset) {
  const cls = loadClass(className, ruleset)
  if (!cls) return []
  const result = []
  for (let lvl = 1; lvl <= level; lvl++) {
    const named = cls.features_by_level[String(lvl)] || []
    const ids = cls.features_by_level_ids[String(lvl)] || []
    named.forEach((name, i) => result.push({ level: lvl, name, id: ids[i] }))
  }
  return result
}

module.exports = {
  loadClass,
  listClasses,
  featuresGainedAtLevel,
  allFeaturesUpToLevel,
}
