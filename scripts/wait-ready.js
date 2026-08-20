#!/usr/bin/env node
/**
 * Polls the frontend (vue-cli-service serve) and backend (server.js) dev
 * servers and prints one combined "Ready!" message once both are actually
 * responding — the backend comes up almost instantly, the frontend can take
 * much longer for its first webpack compile, so this exists to answer
 * "can I open the browser yet?" with a single clear signal.
 * Run alongside them via `npm run serve` — see package.json.
 */

const http = require('http')

const TARGETS = [
  { name: 'backend', url: 'http://localhost:3001/hello' },
  // Vue CLI's default dev server port when none is set in vue.config.js.
  // If 8080 was taken, Vue CLI will have picked a different port — check
  // the [front] output above for the actual URL if this never reports ready.
  { name: 'frontend', url: 'http://localhost:8080' },
]

const TIMEOUT_MS = 120000
const POLL_MS = 400
const REQUEST_TIMEOUT_MS = 2000

function check(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume() // drain so the socket can close
      resolve(res.statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitFor(target) {
  const start = Date.now()
  while (Date.now() - start < TIMEOUT_MS) {
    if (await check(target.url)) return true
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
  return false
}

async function main() {
  const results = await Promise.all(TARGETS.map(waitFor))

  if (results.every(Boolean)) {
    console.log('')
    console.log('✅ Ready! Both servers are up:')
    TARGETS.forEach((t) =>
      console.log(`   ${t.name.padEnd(8)} ${t.url.replace('/hello', '')}`)
    )
    console.log('')
    process.exit(0)
  } else {
    const missing = TARGETS.filter((_, i) => !results[i]).map((t) => t.name)
    console.log('')
    console.log(
      `⚠ Timed out waiting for: ${missing.join(', ')}. Check the output ` +
        `above for errors — the frontend may also have started on a ` +
        `different port if 8080 was already taken.`
    )
    console.log('')
    process.exit(1)
  }
}

main()
