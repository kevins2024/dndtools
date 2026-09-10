#!/usr/bin/env node
// Symlinks scripts/pre-commit into .git/hooks/pre-commit so every checkout
// (this one, and any future clone) gets the Prettier-on-commit hook without
// manual setup. Runs automatically via package.json's "postinstall" script.
// Safe to run repeatedly — it only touches its own symlink.

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const gitDir = path.join(repoRoot, '.git')
const hooksDir = path.join(gitDir, 'hooks')
const hookTarget = path.join(hooksDir, 'pre-commit')
const hookSource = path.relative(
  hooksDir,
  path.join(repoRoot, 'scripts', 'pre-commit')
)

if (!fs.existsSync(gitDir)) {
  // Not a git checkout (e.g. installed as a dependency somewhere) — nothing to do.
  process.exit(0)
}

try {
  fs.mkdirSync(hooksDir, { recursive: true })

  if (fs.existsSync(hookTarget)) {
    const stat = fs.lstatSync(hookTarget)
    if (stat.isSymbolicLink() && fs.readlinkSync(hookTarget) === hookSource) {
      process.exit(0) // already installed correctly
    }
    // Something else is already there (a real file, or a different hook) —
    // don't clobber someone's existing setup silently.
    console.warn(
      `[install-hooks] .git/hooks/pre-commit already exists and isn't our symlink — leaving it alone. ` +
        `To use the Prettier pre-commit hook, symlink or merge scripts/pre-commit into it yourself.`
    )
    process.exit(0)
  }

  fs.symlinkSync(hookSource, hookTarget)
  fs.chmodSync(path.join(repoRoot, 'scripts', 'pre-commit'), 0o755)
  console.log(
    '[install-hooks] Installed scripts/pre-commit as .git/hooks/pre-commit'
  )
} catch (err) {
  console.warn(
    `[install-hooks] Could not install pre-commit hook: ${err.message}`
  )
}
