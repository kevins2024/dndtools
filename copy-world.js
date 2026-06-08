// copy-world.js
// Copies all campaign data files to the clipboard as a single JSON object.
// Usage: node copy-world.js

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const DATA_DIR = path.join(__dirname, 'src/data')

const FILES = [
  'assets',
  'companions',
  'events',
  'locations',
  'npcs',
  'party_items',
  'religions',
  'world',
]

const BOM = Buffer.from([0xef, 0xbb, 0xbf])
function readJSON(fp) {
  let buf = fs.readFileSync(fp)
  while (buf.slice(0, 3).equals(BOM)) buf = buf.slice(3)
  return JSON.parse(buf.toString('utf8'))
}

const result = {}
for (const name of FILES) {
  const fp = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(fp)) {
    console.warn(`Skipping ${name}.json — not found`)
    continue
  }
  try {
    result[name] = readJSON(fp)
  } catch (e) {
    console.error(`ERROR reading ${name}.json: ${e.message}`)
    process.exit(1)
  }
}

const text = JSON.stringify(result, null, 2)

// Cross-platform clipboard copy
const platform = process.platform
try {
  if (platform === 'win32') {
    execSync('clip', { input: text })
  } else if (platform === 'darwin') {
    execSync('pbcopy', { input: text })
  } else {
    execSync('xclip -selection clipboard', { input: text })
  }
  const kb = (Buffer.byteLength(text) / 1024).toFixed(1)
  console.log(`Copied ${kb} KB to clipboard (${FILES.length} files).`)
} catch (err) {
  console.error('Clipboard copy failed:', err.message)
  process.exit(1)
}
