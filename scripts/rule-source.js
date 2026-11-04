#!/usr/bin/env node
// Look up where a rule came from, on demand (nothing loads this at runtime, it costs nothing until you ask):
//
//   node scripts/rule-source.js "halfling luck"        a feature by name or id fragment
//   node scripts/rule-source.js pub24_monk-evasion
//
// Prints the feature's book text, the structured rule the engine has for it, and the second sources that
// agreed with the text (engine/data/5e/rule-sources.json, written by scripts/crosscheck-srd.js), with links.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = (...p) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'))
const published = read('src', 'data', 'published_features.json')
const mechanics = read('engine', 'data', '5e', 'feature-mechanics.json')
const ledgerFile = path.join(ROOT, 'engine', 'data', '5e', 'rule-sources.json')
const ledger = fs.existsSync(ledgerFile)
  ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
  : {}

const LINKS = {
  srd52: (p) => `https://www.dnd5eapi.co/api/2024/${p}`,
  wd: (p) => `https://dnd2024.wikidot.com/${p}`,
  ddb: (p) => `https://www.dndbeyond.com/${p}`,
}
const link = (ref) => {
  const [kind, ...rest] = ref.split(':')
  return LINKS[kind] ? LINKS[kind](rest.join(':')) : ref
}

const query = process.argv.slice(2).join(' ').toLowerCase().trim()
if (!query) {
  console.log(
    'usage: node scripts/rule-source.js "<feature name or id fragment>"'
  )
  process.exit(1)
}
const hits = published
  .filter((f) => {
    // every word of the query appears in the id, name or species ("halfling luck" finds pub24_species_halfling-luck)
    const hay = `${f.id} ${f.name} ${f.species ?? ''}`
      .toLowerCase()
      .replace(/[-_]/g, ' ')
    return query.split(/\s+/).every((w) => hay.includes(w))
  })
  .slice(0, 6)
// spells too: the 2024 text, its fields, and any second source ("fireball", "cure wounds")
const spellFile = path.join(ROOT, 'src', 'data', 'spells_2024.json')
const spellHits = fs.existsSync(spellFile)
  ? JSON.parse(fs.readFileSync(spellFile, 'utf8'))
      .filter((s) => s.name.toLowerCase().includes(query))
      .slice(0, 6)
  : []
for (const s of spellHits) {
  const id = `spell:${s.name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
  console.log(`\n${s.name}  —  level ${s.level} ${s.school}  (${s.source})`)
  console.log(
    `${s.casting_time} | ${s.range} | ${(s.components ?? []).join(', ')}${
      s.material ? ` (${s.material})` : ''
    } | ${s.duration} | classes: ${(s.classes ?? []).join(', ')}`
  )
  console.log(s.description)
  if (s.higher_level) console.log(s.higher_level)
  const checks = ledger[id] ?? []
  if (!checks.length) console.log('\nsecond source: none recorded')
  for (const c of checks) {
    const [ref, date] = c.split('@')
    console.log(`\nsecond source: ${ref} (${date})  ${link(ref)}`)
  }
}
if (!hits.length && !spellHits.length)
  console.log(`no feature or spell matches "${query}"`)
for (const f of hits) {
  console.log(
    `\n${f.id}  —  ${f.name}  (${f.source ?? '?'}${f.legacy ? ', legacy' : ''}${
      f.homebrew ? ', homebrew' : ''
    })`
  )
  console.log(f.description ?? '(no text)')
  const m = mechanics[f.id]
  console.log('\nengine rule: ' + (m ? JSON.stringify(m) : 'none (text only)'))
  const checks = ledger[f.id] ?? []
  if (!checks.length) console.log('second source: none recorded')
  for (const c of checks) {
    const [ref, date] = c.split('@')
    console.log(`second source: ${ref} (${date})  ${link(ref)}`)
  }
}
