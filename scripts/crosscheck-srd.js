#!/usr/bin/env node
// Second-source check of our 2024 feature text against the SRD 5.2 (dnd5eapi.co/api/2024), which is
// independent of dnd2024.wikidot.com, where our text was ingested from. For every feature the SRD also has
// (9 species, class/subclass features, feats), compares the NUMBERS and DICE in the two texts: digits,
// "2d10"-style dice, number words, twice/half. Agreement is recorded in engine/data/5e/rule-sources.json
// as "srd52:<path>@<date>"; a difference is printed for a person to look at and is never written.
//
//   node scripts/crosscheck-srd.js [--write] [--only species|class|feat]
//
// Without --write it only reports. Features the SRD does not contain (Aasimar, most subclasses, the
// homebrew species) cannot be checked this way; they stay unchecked in the ledger.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const API = 'https://www.dnd5eapi.co'
const LEDGER = path.join(ROOT, 'engine', 'data', '5e', 'rule-sources.json')
const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const TODAY = new Date().toISOString().slice(0, 10)

const published = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'src', 'data', 'published_features.json'),
    'utf8'
  )
)
const ours = new Map(
  published
    .filter((f) => String(f.id).startsWith('pub24'))
    .map((f) => [f.id, f])
)

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
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

// numbers, dice and number words, in order of appearance
const WORDS =
  'one two three four five six seven eight nine ten twelve twenty thirty forty fifty sixty ninety twice half double triple'.split(
    ' '
  )
function tokens(text) {
  const t = String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/(\d),(\d{3})/g, '$1$2')
  const out = []
  const re = new RegExp(`\\d+d\\d+|\\d+|\\b(?:${WORDS.join('|')})\\b`, 'g')
  for (const m of t.match(re) ?? []) out.push(m)
  return out.sort()
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function main() {
  const jobs = [] // { id, refPath, srdText }

  if (!ONLY || ONLY === 'species') {
    const species = (await get('/api/2024/species'))?.results ?? []
    const traitLists = await pool(species, 4, (s) => get(s.url))
    const traits = []
    for (const sp of traitLists.filter(Boolean))
      for (const t of sp.traits ?? [])
        traits.push({ species: sp.name, index: t.index, name: t.name })
    const details = await pool(traits, 8, (t) =>
      get(`/api/2024/traits/${t.index}`)
    )
    traits.forEach((t, i) => {
      const d = details[i]
      if (!d) return
      // our id: pub24_species_<species>-<trait slug>; SRD trait names may carry a range ("Darkvision (120 ft.)")
      const base = slug(t.name.replace(/\s*\(.*\)\s*$/, ''))
      const id = `pub24_species_${slug(t.species)}-${base}`
      if (ours.has(id))
        jobs.push({
          id,
          ref: `srd52:traits/${t.index}`,
          srd: d.description ?? d.desc,
        })
    })
  }

  if (!ONLY || ONLY === 'class') {
    const list = (await get('/api/2024/features'))?.results ?? []
    const details = await pool(list, 8, (f) => get(f.url))
    list.forEach((f, i) => {
      const d = details[i]
      if (!d) return
      const id = `pub24_${f.index}`
      const sub = [...ours.keys()].find(
        (k) =>
          k.startsWith('pub24_sub_') &&
          k.endsWith(`-${slug(f.name)}`) &&
          k.includes(slug(d.subclass?.name ?? d.class?.name ?? '#'))
      )
      const target = ours.has(id) ? id : sub
      if (target)
        jobs.push({
          id: target,
          ref: `srd52:features/${f.index}`,
          srd:
            d.description ??
            (Array.isArray(d.desc) ? d.desc.join('\n') : d.desc),
        })
    })
  }

  if (!ONLY || ONLY === 'feat') {
    const list = (await get('/api/2024/feats'))?.results ?? []
    const details = await pool(list, 8, (f) => get(f.url))
    list.forEach((f, i) => {
      const d = details[i]
      const id = `pub24_feat-${f.index}`
      if (d && ours.has(id))
        jobs.push({
          id,
          ref: `srd52:feats/${f.index}`,
          srd: d.description ?? d.desc,
        })
    })
  }

  const agree = []
  const differ = []
  for (const j of jobs) {
    const a = tokens(ours.get(j.id).description)
    const b = tokens(Array.isArray(j.srd) ? j.srd.join(' ') : j.srd)
    if (same(a, b)) agree.push(j)
    else differ.push({ ...j, ours: a, theirs: b })
  }

  console.log(
    `checked ${jobs.length}: ${agree.length} agree, ${differ.length} differ`
  )
  for (const d of differ) {
    const onlyOurs = d.ours.filter((t) => !d.theirs.includes(t))
    const onlyTheirs = d.theirs.filter((t) => !d.ours.includes(t))
    console.log(
      `DIFF ${d.id}  ours-only [${onlyOurs}]  srd-only [${onlyTheirs}]  ${d.ref}`
    )
  }

  if (WRITE) {
    const raw = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : '{}'
    const crlf = raw.includes('\r\n')
    const ledger = JSON.parse(raw)
    for (const j of agree) {
      const have = ledger[j.id] ?? []
      const entry = `${j.ref}@${TODAY}`
      if (!have.some((e) => e.startsWith(j.ref + '@')))
        ledger[j.id] = [...have, entry]
    }
    let out = JSON.stringify(ledger, null, 2) + '\n'
    if (crlf) out = out.replace(/\n/g, '\r\n')
    fs.writeFileSync(LEDGER, out)
    console.log(
      `ledger updated: ${
        Object.keys(ledger).filter((k) => !k.startsWith('_')).length
      } features`
    )
  }
}

main()
