/* --------------------------- script to update IDs on fields
const fs = require('fs')
const path = require('path')

// data files
const config = {
  npcs: './npcs.json',
  items: './party_items.json',
  characters: './characters.json',
  assets: './assets.json',
}

for (const [fileId, filePath] of Object.entries(config)) {
  const fullPath = path.join(__dirname, filePath)

  const raw = fs.readFileSync(fullPath, 'utf-8')
  const data = JSON.parse(raw)

  if (!Array.isArray(data)) {
    console.log(`${filePath} is not an array, skipping`)
    continue
  }

  const updated = data.map((item, index) => ({
    ...item,
    id: `${fileId}_${index}`,
  }))

  fs.writeFileSync(fullPath, JSON.stringify(updated, null, 2))

  console.log(`Updated ${filePath}`)
}
----------------------------------------- */

/* --------------------------- script to build relationships.json from character/npc data
const fs = require('fs')
const path = require('path')

// ---- CONFIG ----
const characterFile = './characters.json'
const npcFile = './npcs.json'
const outputFile = './relationships.json'

// ---- LOAD ----
const characters = JSON.parse(
  fs.readFileSync(path.join(__dirname, characterFile))
)
const npcs = JSON.parse(fs.readFileSync(path.join(__dirname, npcFile)))

const allEntities = [...characters, ...npcs]

// ---- BUILD NAME → ID MAP ----
const nameToId = {}
for (const e of allEntities) {
  nameToId[e.name.toLowerCase()] = e.id
}

// ---- HELPERS ----
const normalizePair = (a, b) => {
  return [a, b].sort() // ensures A-B == B-A
}

const makeKey = (a, b) => normalizePair(a, b).join('|')

// ---- COLLECT RELATIONSHIPS ----
const relMap = {}

for (const entity of allEntities) {
  if (!entity.relationships) continue

  for (const rel of entity.relationships) {
    const targetName = rel.character?.toLowerCase()
    const targetId = nameToId[targetName]

    if (!targetId) continue // skip unknowns

    const clean = (str) => str.trim().toLowerCase()

    const pair = normalizePair(clean(entity.name), clean(rel.character))
    const key = makeKey(entity.name, clean(rel.character))

    if (!relMap[key]) {
      relMap[key] = {
        people: pair,
        type: rel.type || '',
        notes: rel.notes || '',
      }
    } else {
      // merge logic

      // prefer longer type
      if ((rel.type || '').length > relMap[key].type.length) {
        relMap[key].type = rel.type
      }

      // prefer longer notes
      if ((rel.notes || '').length > relMap[key].notes.length) {
        relMap[key].notes = rel.notes
      }
    }
  }
}

// ---- OUTPUT ----
const relationships = Object.values(relMap).map((r, i) => ({
  id: `rel_${i}`,
  ...r,
}))

fs.writeFileSync(
  path.join(__dirname, outputFile),
  JSON.stringify(relationships, null, 2)
)

console.log('relationships.json created!')
----------------------------------------- */

const fs = require('fs')
const path = require('path')

// ---- CONFIG ----
const files = ['./characters.json', './npcs.json']

for (const file of files) {
  const fullPath = path.join(__dirname, file)

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))

  const cleaned = data.map((obj) => {
    const { relationships, ...rest } = obj
    return rest
  })

  fs.writeFileSync(fullPath, JSON.stringify(cleaned, null, 2))

  console.log(`Cleaned ${file}`)
}
