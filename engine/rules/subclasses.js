const fs = require('fs')
const path = require('path')

const SUBCLASSES_DIR = path.join(__dirname, '..', 'data', 'subclasses')

function slugify(className, subclassName) {
  const clean = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  return `${clean(className)}-${clean(subclassName)}`
}

const subclassCache = new Map()

function loadSubclass(className, subclassName) {
  const key = slugify(className, subclassName)
  if (subclassCache.has(key)) return subclassCache.get(key)
  const file = path.join(SUBCLASSES_DIR, `${key}.json`)
  if (!fs.existsSync(file)) return null
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  subclassCache.set(key, data)
  return data
}

function listSubclasses() {
  return fs
    .readdirSync(SUBCLASSES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(
        fs.readFileSync(path.join(SUBCLASSES_DIR, f), 'utf8')
      )
      return { class: data.class, name: data.name }
    })
}

function subclassFeaturesGainedAtLevel(className, subclassName, level) {
  const sub = loadSubclass(className, subclassName)
  if (!sub) return []
  return sub.features_by_level[String(level)] || []
}

module.exports = {
  slugify,
  loadSubclass,
  listSubclasses,
  subclassFeaturesGainedAtLevel,
}
