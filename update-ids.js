// update-ids.js
// Assigns sequential IDs to every item in the target data files.
// Usage: node update-ids.js  (or: npm run update-ids)

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'src/data')

const FILES = {
  characters: 'characters.json',
  npcs: 'npcs.json',
  items: 'party_items.json',
  assets: 'assets.json',
}

const BOM = Buffer.from([0xef, 0xbb, 0xbf])

function readJSON(fp) {
  let buf = fs.readFileSync(fp)
  while (buf.slice(0, 3).equals(BOM)) buf = buf.slice(3)
  return JSON.parse(buf.toString('utf8'))
}

for (const [prefix, filename] of Object.entries(FILES)) {
  const fp = path.join(DATA_DIR, filename)

  if (!fs.existsSync(fp)) {
    console.log(`Skipping ${filename} — not found`)
    continue
  }

  let data
  try {
    data = readJSON(fp)
  } catch (e) {
    console.error(`ERROR reading ${filename}: ${e.message}`)
    continue
  }

  if (!Array.isArray(data)) {
    console.log(`Skipping ${filename} — not an array`)
    continue
  }

  const updated = data.map((item, i) => ({ ...item, id: `${prefix}_${i}` }))
  fs.writeFileSync(fp, JSON.stringify(updated, null, 2))
  console.log(`Updated ${filename} (${updated.length} entries)`)
}
