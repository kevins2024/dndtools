// copy-world.js
// Copies all campaign data files to the clipboard as a single JSON object.
// Usage: node copy-world.js

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const DATA_DIR = path.join(__dirname, 'src/data')

const FILES = [
  'assets',
  'characters',
  'companions',
  'events',
  'locations',
  'npcs',
  'party_items',
  'religions',
  'world',
]

const result = {}
for (const name of FILES) {
  const fp = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(fp)) {
    console.warn(`Skipping ${name}.json — not found`)
    continue
  }
  result[name] = JSON.parse(fs.readFileSync(fp, 'utf8'))
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
