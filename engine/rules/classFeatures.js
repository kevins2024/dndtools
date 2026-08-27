const fs = require('fs')
const path = require('path')

const CLASSES_DIR = path.join(__dirname, '..', 'data', 'classes')

const classCache = new Map()

function loadClass(className) {
  if (classCache.has(className)) return classCache.get(className)
  const file = path.join(CLASSES_DIR, `${className.toLowerCase()}.json`)
  if (!fs.existsSync(file)) return null
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  classCache.set(className, data)
  return data
}

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
  const isSubclassLevel = cls.subclass_feature_levels.includes(level)
  return {
    named: [...named],
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
    for (const name of named) result.push({ level: lvl, name })
  }
  return result
}

module.exports = {
  loadClass,
  listClasses,
  featuresGainedAtLevel,
  allFeaturesUpToLevel,
}
