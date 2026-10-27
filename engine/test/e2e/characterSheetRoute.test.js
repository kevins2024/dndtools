// End to end: start the real data server, ask it for each character's sheet over HTTP,
// and check what comes back. Read-only (it only does GETs); the server serves the real
// src/data files, so this also proves the stored data and the engine agree.
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const net = require('node:net')

const ROOT = path.join(__dirname, '..', '..', '..')
const roster = require(path.join(ROOT, 'src', 'data', 'characters.json'))
const engine = require('../../index')
const { eachLeaf, formatBreakdown } = require('../../rules/5e/sheet')

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
const get = (port, url) =>
  new Promise((resolve, reject) => {
    http
      .get({ port, path: url, host: '127.0.0.1' }, (res) => {
        let body = ''
        res.on('data', (d) => (body += d))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            json: body ? JSON.parse(body) : null,
          })
        )
      })
      .on('error', reject)
  })

let server
let port
test.before(async () => {
  port = await freePort()
  server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 15000)
    server.stdout.on('data', (d) => {
      if (String(d).includes('Data server running')) {
        clearTimeout(t)
        resolve()
      }
    })
  })
})
test.after(() => server?.kill())

test('GET /api/engine/character-sheet/:name returns a sheet for every character, every number explained', async () => {
  for (const c of roster) {
    const { status, json: sheet } = await get(
      port,
      `/api/engine/character-sheet/${encodeURIComponent(c.name)}`
    )
    assert.equal(status, 200, c.name)
    assert.equal(sheet.name, c.name)
    let leaves = 0
    eachLeaf(sheet, (leaf, p) => {
      leaves++
      assert.equal(
        leaf.breakdown.reduce((n, l) => n + l.amount, 0),
        leaf.value,
        `${c.name}: ${p}`
      )
      assert.equal(
        leaf.tooltip,
        formatBreakdown(leaf),
        `${c.name}: ${p} tooltip`
      )
    })
    assert.ok(leaves >= 40, `${c.name}: only ${leaves} explained numbers`)
    assert.equal(
      sheet.level,
      c.classes.reduce((n, k) => n + k.level, 0)
    )
  }
})

test('the route answers the same as calling the engine directly with the same items', async () => {
  const items = engine.hydrateItems(
    require(path.join(ROOT, 'src', 'data', 'party_items.json')).map(
      engine.autoLinkItem
    ),
    engine.itemLookup
  )
  for (const c of roster) {
    const direct = engine.characterSheet(engine.hydrateCharacter(c), {
      equippedItems: engine.equippedItemsFor(c, items),
    })
    const { json } = await get(
      port,
      `/api/engine/character-sheet/${encodeURIComponent(c.name)}`
    )
    assert.deepEqual(json, JSON.parse(JSON.stringify(direct)), c.name)
  }
})

test('Jaygar: the Amulet of Health raises max HP by the Constitution modifier change on every level (RAW)', async () => {
  const { json: s } = await get(port, '/api/engine/character-sheet/Jaygar')
  assert.equal(s.abilities.con.score.value, 19)
  assert.equal(s.hp.max.value, 67 + 2 * 9) // stored (no items) 67 + modifier +2 x 9 levels
  assert.match(s.hp.max.tooltip, /Amulet of Health: CON 14 -> 19/)
})

test('an unknown character is a 404, and GET /api/characters returns calculated scores and HP', async () => {
  assert.equal(
    (await get(port, '/api/engine/character-sheet/Nobody%20At%20All')).status,
    404
  )
  const { json: rows } = await get(port, '/api/characters')
  const vaz = rows.find((r) => r.name === 'Vaz')
  const derived = engine.deriveCharacter(roster.find((r) => r.name === 'Vaz'))
  assert.equal(vaz.stat_dex, derived.stat_dex)
  assert.equal(vaz.hp_max, derived.hp_max)
})
