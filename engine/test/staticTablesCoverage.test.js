const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

// Bug 2.13: store.loadAll asks dataService for 'spellbooks' and 'mounts', but
// the static (production / server-down) fallback didn't have them, so those
// builds crashed on load. Guard: every table the store loads has a static
// fallback import.
const root = path.join(__dirname, '..', '..')
const storeSrc = fs.readFileSync(path.join(root, 'src/store/index.js'), 'utf8')
const dataServiceSrc = fs.readFileSync(
  path.join(root, 'src/utils/dataService.js'),
  'utf8'
)

test('every table store.loadAll loads has a static fallback in dataService', () => {
  const list = storeSrc.match(/const tables = \[([\s\S]*?)\]/)[1]
  const loaded = [...list.matchAll(/'(\w+)'/g)].map((m) => m[1])
  const staticBlock = dataServiceSrc.match(
    /const staticTables = \{([\s\S]*?)\n\}/
  )[1]
  const staticNames = staticBlock.split(/[\s,]+/).filter((w) => /^\w+$/.test(w))
  const missing = loaded.filter((t) => !staticNames.includes(t))
  assert.deepStrictEqual(missing, [])
  assert.ok(loaded.includes('spellbooks') && loaded.includes('mounts'))
})
