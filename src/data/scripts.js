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
