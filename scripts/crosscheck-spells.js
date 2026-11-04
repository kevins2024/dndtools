#!/usr/bin/env node
// Spell accuracy and writing quality, for src/data/spells_2024.json.
//
//   node scripts/crosscheck-spells.js            report only
//   node scripts/crosscheck-spells.js --write    record the spells that agree in engine/data/5e/rule-sources.json
//   node scripts/crosscheck-spells.js --lint     only the writing-quality lint over all spells
//
// Accuracy: every spell the SRD 5.2 API (dnd5eapi.co/api/2024/spells) also has is compared field by field
// (level, school, casting time, range, duration, concentration, ritual, components, material, class list)
// and word for word in the description and the higher-level text. A spell agrees only when everything
// matches after the formatting differences that do not matter (curly or straight quotes, whitespace,
// markdown bold, dash kinds). Anything else is printed, never written.
//
// Writing quality: a lint over all spells for mechanical problems (doubled spaces or words, missing space
// after a full stop, leftover markup, odd characters, unbalanced brackets, a description that stops mid-
// sentence, empty fields).

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const API = 'https://www.dnd5eapi.co'
const LEDGER = path.join(ROOT, 'engine', 'data', '5e', 'rule-sources.json')
const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const LINT_ONLY = args.includes('--lint')
const TODAY = new Date().toISOString().slice(0, 10)

const spells = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'data', 'spells_2024.json'), 'utf8')
)

// ── writing-quality lint ────────────────────────────────────────────────────────────────────────
function lint(spell) {
  const problems = []
  const fields = {
    description: spell.description,
    higher_level: spell.higher_level,
    material: spell.material,
  }
  for (const [field, text] of Object.entries(fields)) {
    if (text == null || text === '') {
      if (field === 'description') problems.push('empty description')
      continue
    }
    const t = String(text)
    const at = (re) => (re.exec(t) ? re.exec(t)[0] : null)
    if (/ {2,}/.test(t)) problems.push(`${field}: doubled spaces`)
    if (/\s+$|^\s+/.test(t))
      problems.push(`${field}: leading or trailing whitespace`)
    if (/[a-z]\.[A-Z][a-z]/.test(t))
      problems.push(
        `${field}: no space after full stop ("${at(/[a-z]\.[A-Z][a-z]/)}")`
      )
    if (/[a-z],[A-Za-z]/.test(t))
      problems.push(
        `${field}: no space after comma ("${at(/[a-z],[A-Za-z]/)}")`
      )
    if (/\s[,.;:!?]/.test(t))
      problems.push(
        `${field}: space before punctuation ("${at(/\s[,.;:!?]/)}")`
      )
    if (/\*\*|__|^#|<[a-z/][^>]*>|&[a-z]+;|\[\[|\]\]/i.test(t))
      problems.push(`${field}: leftover markup`)
    if (/[ ​‌‍﻿�]/.test(t)) problems.push(`${field}: odd character`)
    if (/Ã|â€|Â/.test(t)) problems.push(`${field}: garbled encoding`)
    if (/\b(\w{2,})\s+\1\b/i.test(t) && !/\b(that that|had had)\b/i.test(t))
      problems.push(`${field}: repeated word ("${at(/\b(\w{2,})\s+\1\b/i)}")`)
    const open = (t.match(/\(/g) || []).length
    const close = (t.match(/\)/g) || []).length
    if (open !== close) problems.push(`${field}: unbalanced parentheses`)
    if ((t.match(/"/g) || []).length % 2 === 1)
      problems.push(`${field}: odd number of straight quotes`)
    if ((t.match(/“/g) || []).length !== (t.match(/”/g) || []).length)
      problems.push(`${field}: unbalanced curly quotes`)
    if (field !== 'material' && !/[.)”"!?:]$/.test(t.trim()))
      problems.push(
        `${field}: does not end like a sentence ("…${t.trim().slice(-25)}")`
      )
    if (
      /[.!?]\s+[a-z]/.test(t.replace(/\b(e\.g|i\.e|etc|vs|Lv|No)\./g, '')) &&
      field === 'description'
    )
      problems.push(
        `${field}: sentence starts in lower case ("${at(/[.!?]\s+[a-z]\w*/)}")`
      )
  }
  if (!spell.casting_time) problems.push('missing casting time')
  if (!spell.range) problems.push('missing range')
  if (!spell.duration) problems.push('missing duration')
  if (!Array.isArray(spell.components) || !spell.components.length)
    problems.push('missing components')
  if (spell.components?.includes('M') && !spell.material)
    problems.push('M component but no material text')
  if (!spell.components?.includes('M') && spell.material)
    problems.push('material text but no M component')
  // the ritual flag and the casting time ("1 minute or Ritual") must say the same thing
  if (/ritual/i.test(spell.casting_time ?? '') !== !!spell.ritual)
    problems.push('ritual flag and casting time disagree')
  // "for each spell slot level above N": N is the spell's own level
  const up = /(?:slot level|slot) above (\d)/i.exec(spell.higher_level ?? '')
  if (up && Number(up[1]) !== spell.level)
    problems.push(
      `upcast says "above ${up[1]}" but the spell is level ${spell.level}`
    )
  if (
    spell.level === 0 &&
    spell.higher_level &&
    !/^Cantrip Upgrade/i.test(spell.higher_level)
  )
    problems.push('cantrip whose higher-level text is not a Cantrip Upgrade')
  if (!Array.isArray(spell.classes) || !spell.classes.length)
    problems.push('no class list')
  if (spell.concentration && !/concentration/i.test(spell.duration))
    problems.push('concentration flag but the duration does not say so')
  if (!spell.concentration && /concentration/i.test(spell.duration))
    problems.push('duration says concentration but the flag is off')
  return problems
}

// ── comparison with the SRD ─────────────────────────────────────────────────────────────────────
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[‘’']/g, "'")
    .replace(/[“”"]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
const words = (s) =>
  norm(s)
    .replace(/[^a-z0-9'+\- ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
const stripUpcast = (s) =>
  String(s ?? '').replace(
    /^(Using a Higher-Level Spell Slot|Cantrip Upgrade|At Higher Levels)\.?\s*/i,
    ''
  )

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(API + url)
      if (res.ok) return res.json()
      if (res.status === 404) return null
    } catch (e) {
      /* retry */
    }
  }
  return null
}
async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k])
      }
    })
  )
  return out
}

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const timeKey = (s) => norm(s).replace(/^1 /, '').replace(/^an? /, '')

function wordDiff(a, b) {
  // words only on one side, in order of appearance, using a simple LCS so a moved or changed word shows up once
  const A = words(a)
  const B = words(b)
  const dp = Array.from({ length: A.length + 1 }, () =>
    new Array(B.length + 1).fill(0)
  )
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] =
        A[i] === B[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out = []
  let i = 0
  let j = 0
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) i++, j++
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`-${A[i++]}`)
    else out.push(`+${B[j++]}`)
  }
  while (i < A.length) out.push(`-${A[i++]}`)
  while (j < B.length) out.push(`+${B[j++]}`)
  return out // "-" is in ours only, "+" is in the SRD only
}

// The same book text printed with different wording of the editorial bits: the SRD says "GM" where the
// Player's Handbook says "DM", and points at "Monsters" where the Handbook points at "Appendix B".
const BENIGN = [
  [/\bgm\b/g, 'dm'],
  [/appendix b/g, 'monsters'],
  [/cantrip upgrade|using a higher-level spell slot|at higher levels/g, ''],
]
function bodyText(description, higherLevel) {
  let s = norm(`${description ?? ''} ${higherLevel ?? ''}`)
  for (const [re, to] of BENIGN) s = s.replace(re, to)
  return s
}
// letters and digits only: equal means the same text up to spacing, dashes and punctuation (the SRD API
// drops some hyphens, "10foot", and spaces around dashes)
const squish = (s) => s.replace(/[^a-z0-9+]/g, '')

function compare(ours, srd) {
  const diffs = []
  const eq = (field, a, b) => {
    if (norm(a) !== norm(b)) diffs.push(`${field}: ours "${a}" / srd "${b}"`)
  }
  if (ours.level !== srd.level)
    diffs.push(`level: ours ${ours.level} / srd ${srd.level}`)
  eq('school', ours.school, srd.school?.name)
  // our casting time carries "or Ritual" (as the book prints it); the SRD has the ritual flag instead
  if (
    timeKey(ours.casting_time.replace(/ or ritual$/i, '')) !==
    timeKey(srd.casting_time)
  )
    diffs.push(
      `casting time: ours "${ours.casting_time}" / srd "${srd.casting_time}"`
    )
  // the SRD's range field sometimes has the components glued on ("Touch Component: V, S")
  if (
    norm(ours.range) !== norm(srd.range) &&
    !norm(srd.range).startsWith(norm(ours.range) + ' component:')
  )
    diffs.push(`range: ours "${ours.range}" / srd "${srd.range}"`)
  const srdDuration = srd.duration
  if (
    norm(ours.duration).replace(/^concentration, /, '') !==
    norm(srdDuration).replace(/^concentration, /, '')
  )
    diffs.push(`duration: ours "${ours.duration}" / srd "${srdDuration}"`)
  if (!!ours.concentration !== !!srd.concentration)
    diffs.push(
      `concentration: ours ${ours.concentration} / srd ${srd.concentration}`
    )
  if (!!ours.ritual !== !!srd.ritual)
    diffs.push(`ritual: ours ${ours.ritual} / srd ${srd.ritual}`)
  // an SRD record with no components at all is its own data gap (the cantrips whose range field has them)
  if (
    (srd.components ?? []).length &&
    [...(ours.components ?? [])].sort().join() !==
      [...(srd.components ?? [])].sort().join()
  )
    diffs.push(`components: ours ${ours.components} / srd ${srd.components}`)
  // material text compared as words: the SRD has stray commas and brackets in some ("worth 25+, GP")
  const matWords = (s) => squish(norm(s))
  if (matWords(ours.material) !== matWords(srd.material))
    diffs.push(`material: ours "${ours.material}" / srd "${srd.material}"`)
  // the Artificer is not in the SRD: our class list adds it (Forge of the Artificer), so it is left out here
  const oc = [...(ours.classes ?? [])]
    .filter((c) => c !== 'Artificer')
    .sort()
    .join(', ')
  const sc = (srd.classes ?? [])
    .map((c) => c.name)
    .sort()
    .join(', ')
  if (oc !== sc) diffs.push(`classes: ours [${oc}] / srd [${sc}]`)
  // description and upcast text together: the SRD folds "Cantrip Upgrade" and "Using a Higher-Level Spell
  // Slot" into the description while ours keeps them in higher_level, so only the combined text is compared
  const ourText = bodyText(ours.description, ours.higher_level)
  const srdText = bodyText(srd.description, srd.higher_level)
  if (squish(ourText) !== squish(srdText)) {
    const d = wordDiff(ourText, srdText)
    diffs.push(`text words: ${d.join(' ')}`)
  }
  return diffs
}

async function main() {
  // writing quality over every spell
  const flagged = spells
    .map((s) => [s.name, lint(s)])
    .filter(([, p]) => p.length)
  console.log(
    `LINT: ${flagged.length} of ${spells.length} spells have a writing problem`
  )
  const kinds = {}
  for (const [, ps] of flagged)
    for (const p of ps)
      kinds[p.replace(/\(.*$/, '').replace(/^\w+: /, '')] =
        (kinds[p.replace(/\(.*$/, '').replace(/^\w+: /, '')] ?? 0) + 1
  console.log(kinds)
  for (const [name, ps] of flagged)
    console.log(`  LINT ${name}: ${ps.join(' | ')}`)
  if (LINT_ONLY) return

  const list = (await get('/api/2024/spells'))?.results ?? []
  const details = await pool(list, 8, (s) => get(s.url))
  const bySlug = new Map(list.map((s, i) => [s.index, details[i]]))
  const agree = []
  const differ = []
  const notInSrd = []
  for (const s of spells) {
    const d = bySlug.get(slug(s.name))
    if (!d) {
      notInSrd.push(s.name)
      continue
    }
    const diffs = compare(s, d)
    if (diffs.length) differ.push({ name: s.name, diffs })
    else agree.push(s)
  }
  console.log(
    `\nSRD: ${spells.length - notInSrd.length} of our ${
      spells.length
    } spells are in the SRD: ${agree.length} agree on everything, ${
      differ.length
    } differ; ${
      notInSrd.length
    } are not in the SRD (cannot be checked this way)`
  )
  for (const d of differ) {
    console.log(`DIFF ${d.name}`)
    for (const x of d.diffs) console.log(`    ${x.slice(0, 400)}`)
  }

  if (WRITE) {
    const raw = fs.readFileSync(LEDGER, 'utf8')
    const crlf = raw.includes('\r\n')
    const ledger = JSON.parse(raw)
    for (const s of agree) {
      const id = `spell:${slug(s.name)}`
      const ref = `srd52:spells/${slug(s.name)}`
      const have = ledger[id] ?? []
      if (!have.some((e) => e.startsWith(ref + '@')))
        ledger[id] = [...have, `${ref}@${TODAY}`]
    }
    let out = JSON.stringify(ledger, null, 2) + '\n'
    if (crlf) out = out.replace(/\n/g, '\r\n')
    fs.writeFileSync(LEDGER, out)
    console.log(`ledger updated (${agree.length} spells)`)
  }
}

module.exports = { lint }
if (require.main === module) main()
