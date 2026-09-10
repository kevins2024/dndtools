const fs = require('fs')
const path = require('path')
const { featureName } = require('./featureCatalog')

const SUBCLASSES_DIR = path.join(__dirname, '..', 'data', 'subclasses')

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

function loadSubclass(className, subclassName) {
  const key = slugify(className, subclassName)
  if (subclassCache.has(key)) return subclassCache.get(key)
  const file = path.join(SUBCLASSES_DIR, `${key}.json`)
  if (!fs.existsSync(file)) return null
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const data = resolveFeatureIds(raw)
  subclassCache.set(key, data)
  return data
}

// expanded_spell_list included so callers (e.g. the frontend's
// bonus-spell computation in spellUtils.js) can derive "what bonus spells
// does this character have at their current level" straight from the
// subclass data instead of a per-character copy that can drift out of sync.
// Same directory-scanning portability caveat as classFeatures.js's
// listClasses() — see the comment there and engine/CHECKLIST.md.
function listSubclasses() {
  return fs
    .readdirSync(SUBCLASSES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(
        fs.readFileSync(path.join(SUBCLASSES_DIR, f), 'utf8')
      )
      return {
        class: data.class,
        name: data.name,
        expanded_spell_list: data.expanded_spell_list ?? null,
      }
    })
}

function subclassFeaturesGainedAtLevel(className, subclassName, level) {
  const sub = loadSubclass(className, subclassName)
  if (!sub) return []
  return sub.features_by_level[String(level)] || []
}

function subclassFeatureIdsGainedAtLevel(className, subclassName, level) {
  const sub = loadSubclass(className, subclassName)
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
