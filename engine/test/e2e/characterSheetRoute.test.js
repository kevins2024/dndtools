// End to end: start the real data server and check its engine routes over HTTP. No test here
// reads a real character: sheets, items and level-ups are checked with simulated characters.
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const net = require('node:net')

const ROOT = path.join(__dirname, '..', '..', '..')
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

test('an unknown character is a 404', async () => {
  assert.equal(
    (await get(port, '/api/engine/character-sheet/Nobody%20At%20All')).status,
    404
  )
})

const post = (port, url, body) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request(
      {
        port,
        host: '127.0.0.1',
        path: url,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let out = ''
        res.on('data', (d) => (out += d))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            json: out ? JSON.parse(out) : null,
          })
        )
      }
    )
    req.on('error', reject)
    req.end(data)
  })

test('POST /api/engine/level-up describes the questions, then takes the answers back', async () => {
  const { blank } = require('../helpers/autoLevel')
  const character = blank('Wizard', 'Evoker', '2024')
  const body = {
    character,
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
  }
  const first = await post(port, '/api/engine/level-up', body)
  assert.equal(first.status, 200)
  assert.equal(first.json.complete, false)
  const types = first.json.choices.map((c) => c.type)
  assert.ok(
    types.includes('newCantrips') && types.includes('spellbookAdditions')
  )
  // Answer every question from the options the server offered.
  const answers = {}
  for (const c of first.json.choices)
    answers[c.id] = c.options
      .filter((o) => !o.disabled)
      .slice(0, c.max)
      .map((o) => o.value)
  const second = await post(port, '/api/engine/level-up', { ...body, answers })
  assert.equal(second.json.complete, true)
  assert.deepEqual(second.json.problems, [])
  assert.equal(second.json.patch.classes[0].level, 1)
  // The same call made directly in the engine gives the same patch.
  const direct = engine.previewLevelUp(
    character,
    { className: 'Wizard', toLevel: 1, hpMethod: 'average', equippedItems: [] },
    answers
  )
  assert.deepEqual(second.json.patch, JSON.parse(JSON.stringify(direct.patch)))
})

test('POST /api/engine/level-up rejects a request with no character', async () => {
  const r = await post(port, '/api/engine/level-up', {
    className: 'Wizard',
    toLevel: 1,
  })
  assert.equal(r.status, 400)
})
