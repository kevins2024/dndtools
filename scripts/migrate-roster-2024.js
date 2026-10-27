// Dry-runs (or applies) the 2014 -> 2024 character migration over
// src/data/characters.json using engine/rules/5e/migrate2024.js.
//
//   node scripts/migrate-roster-2024.js                 # report only, writes nothing
//   node scripts/migrate-roster-2024.js Vaz Rhuna       # only these characters
//   node scripts/migrate-roster-2024.js --answers answers.json --write
//
// answers.json: { "<Character name>": { "<question id>": <answer>, ... }, ... }
// A character is only written when --write is given; questions still unanswered
// are listed and the character is still migrated (their picks stay pending).

const fs = require('fs')
const path = require('path')
const { migrateCharacterTo2024 } = require('../engine/rules/5e/migrate2024')

const ROOT = path.join(__dirname, '..')
const CHAR_FILE = path.join(ROOT, 'src', 'data', 'characters.json')
const ITEMS_FILE = path.join(ROOT, 'src', 'data', 'party_items.json')

const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const answersFile = args.includes('--answers') ? args[args.indexOf('--answers') + 1] : null
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--answers')
const answers = answersFile ? JSON.parse(fs.readFileSync(answersFile, 'utf8')) : {}

const chars = JSON.parse(fs.readFileSync(CHAR_FILE, 'utf8'))
const items = fs.existsSync(ITEMS_FILE) ? JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8')) : []
const weaponsOf = (name) =>
  items.filter((i) => i.equipped_by === name && i.weapon_category).map((i) => i.weapon_category)

const out = []
let migrated = 0
const result = chars.map((c) => {
  if (only.length && !only.includes(c.name)) return c
  const r = migrateCharacterTo2024(c, { answers: answers[c.name] ?? {}, equippedWeapons: weaponsOf(c.name) })
  migrated++
  out.push(`\n## ${c.name} (${c.classes.map((k) => `${k.name} ${k.level}${k.subclass ? ` / ${k.subclass}` : ''}`).join(', ')})`)
  r.changes.forEach((x) => out.push(`  - ${x.kind}: ${x.detail}`))
  r.warnings.forEach((w) => out.push(`  ! ${w}`))
  r.questions.forEach((q) => out.push(`  ? [${q.id}] ${q.question}${q.pending?.suggested?.length ? `  (suggested: ${q.pending.suggested.join(', ')})` : ''}`))
  return r.character
})
console.log(out.join('\n'))
console.log(`\n${migrated} character(s) processed.`)
if (flag('--write')) {
  fs.writeFileSync(CHAR_FILE, JSON.stringify(result, null, 2) + '\n')
  console.log('characters.json written.')
}
