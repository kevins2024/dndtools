const fs = require('fs')
const path = require('path')
const { featureName } = require('./featureCatalog')

const CLASSES_DIR = path.join(__dirname, '..', 'data', 'classes')

const classCache = new Map()

// features_by_level is stored on disk as feature IDs, not names (see
// scripts/assign-feature-ids.py) — resolved back to names right here at
// load time, so every existing consumer of loadClass(...).features_by_level
// keeps seeing exactly the familiar name arrays it always has. The original
// ids are kept alongside under features_by_level_ids for anything (like
// diffLevelUp's newFeatures) that wants the id, not just the display name.
function resolveFeatureIds(data) {
  const ids = data.features_by_level
  const names = {}
  for (const [level, levelIds] of Object.entries(ids)) {
    names[level] = levelIds.map(featureName)
  }
  return { ...data, features_by_level: names, features_by_level_ids: ids }
}

function loadClass(className) {
  if (classCache.has(className)) return classCache.get(className)
  const file = path.join(CLASSES_DIR, `${className.toLowerCase()}.json`)
  if (!fs.existsSync(file)) return null
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const data = resolveFeatureIds(raw)
  classCache.set(className, data)
  return data
}

// Directory-scanning (unlike loadClass's read-a-named-file-above) is the one
// real portability gap in this module — a non-Node host can't just "list a
// folder," it needs a static manifest instead. Not fixed here since it would
// mean either a generated index file kept in sync with data/classes/*.json or
// bundling every class into one JSON blob, either of which is a bigger call
// than this pass's "small/medium fix" scope — see engine/CHARACTER_SCHEMA.md's
// sibling note in CHECKLIST.md for the full writeup.
function listClasses() {
  return fs
    .readdirSync(CLASSES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) => JSON.parse(fs.readFileSync(path.join(CLASSES_DIR, f), 'utf8')).name
    )
}

function featuresGainedAtLevel(className, level) {
  const cls = loadClass(className)
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

function allFeaturesUpToLevel(className, level) {
  const cls = loadClass(className)
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
