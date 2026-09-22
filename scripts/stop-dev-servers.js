#!/usr/bin/env node
/**
 * Kills whatever's listening on the frontend/backend dev ports (8080, 8081,
 * 3001 — 8081 is vue-cli-service's fallback when 8080 is already taken).
 * Replaces the old `lsof -ti:... | xargs -r kill` version of this script —
 * lsof isn't installed by default in Git Bash on Windows, so that version
 * silently did nothing on a plain Windows/Git Bash setup, leaving old
 * `npm run serve` processes running forever every time someone closed the
 * terminal instead of Ctrl+C-ing cleanly. This uses `netstat` (built into
 * Windows) + `taskkill` on Windows, or `lsof` + `kill` everywhere else
 * (Mac/Linux dev machines, actual CI), auto-detected at runtime.
 */

const { execSync } = require('child_process')

const PORTS = [8080, 8081, 3001]

function killWindows() {
  let out
  try {
    out = execSync('netstat -ano', { encoding: 'utf8' })
  } catch {
    return
  }
  const pids = new Set()
  for (const line of out.split('\n')) {
    if (!/LISTENING/.test(line)) continue
    const portMatch = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/)
    if (!portMatch) continue
    const [, port, pid] = portMatch
    if (PORTS.includes(Number(port))) pids.add(pid)
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
      console.log(`Killed PID ${pid}`)
    } catch {
      // Already gone, or needs elevation — either way, nothing more to do here.
    }
  }
  if (!pids.size) console.log('Nothing listening on', PORTS.join(', '))
}

function killUnix() {
  try {
    const pids = execSync(`lsof -ti:${PORTS.join(',')} -sTCP:LISTEN`, {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
    if (!pids.length) {
      console.log('Nothing listening on', PORTS.join(', '))
      return
    }
    execSync(`kill ${pids.join(' ')}`)
    pids.forEach((pid) => console.log(`Killed PID ${pid}`))
  } catch {
    // lsof exits non-zero when nothing matches — that's the common case, not an error.
    console.log('Nothing listening on', PORTS.join(', '))
  }
}

if (process.platform === 'win32') {
  killWindows()
} else {
  killUnix()
}
