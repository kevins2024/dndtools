// Webpack bundles any engine/rules module that src/ requires directly (see
// CLAUDE.md, "Browser use of engine/"). A module reachable from those entry
// points must not touch fs/path — `npm run build` fails with "Can't resolve
// 'fs'". This walks the require graph statically so the rule is checked by
// `node --test` too, without needing the frontend's node_modules.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'data') walk(full, out)
    } else if (/\.(js|vue)$/.test(e.name)) out.push(full)
  }
  return out
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function requires(code) {
  return [...stripComments(code).matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
}

function resolveRelative(from, spec) {
  const base = path.resolve(path.dirname(from), spec)
  for (const cand of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
  }
  return null
}

// Entry points: engine modules src/ requires by relative path.
function entryModules() {
  const entries = new Set()
  for (const file of walk(SRC)) {
    for (const spec of requires(fs.readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) continue
      const resolved = resolveRelative(file, spec)
      if (resolved && resolved.startsWith(path.join(ROOT, 'engine') + path.sep)) entries.add(resolved)
    }
  }
  return [...entries]
}

test('every engine module the browser bundles is free of fs/path, transitively', () => {
  const offenders = []
  const seen = new Set()
  const visit = (file, chain) => {
    if (seen.has(file) || !file.endsWith('.js')) return
    seen.add(file)
    const specs = requires(fs.readFileSync(file, 'utf8'))
    if (specs.some((s) => s === 'fs' || s === 'path' || s === 'node:fs' || s === 'node:path')) {
      offenders.push(`${path.relative(ROOT, file)}  (via ${chain.map((c) => path.basename(c)).join(' -> ')})`)
    }
    for (const spec of specs) {
      if (!spec.startsWith('.')) continue
      const next = resolveRelative(file, spec)
      if (next) visit(next, [...chain, next])
    }
  }
  const entries = entryModules()
  assert.ok(entries.length > 10, 'expected to find the browser-imported engine modules')
  for (const e of entries) visit(e, [e])
  assert.deepEqual(offenders, [])
})
