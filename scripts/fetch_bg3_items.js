#!/usr/bin/env node
/**
 * Fetches BG3 magic items from bg3.wiki by rarity category and saves to src/data/bg3_items.json
 * Uses the MediaWiki API: categorymembers for titles, extracts for descriptions
 * Run once: node scripts/fetch_bg3_items.js
 */

const fs = require('fs')
const path = require('path')

const BASE = 'https://bg3.wiki/w/api.php'
const OUTPUT = path.resolve(__dirname, '../src/data/bg3_items.json')

const RARITIES = [
  { key: 'uncommon', category: 'Uncommon_items', label: 'uncommon' },
  { key: 'rare', category: 'Rare_items', label: 'rare' },
  { key: 'very rare', category: 'Very_rare_items', label: 'very rare' },
  { key: 'legendary', category: 'Legendary_items', label: 'legendary' },
]

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchCategoryMembers(category) {
  const titles = []
  let continueToken = null

  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      cmnamespace: '0',
      format: 'json',
    })
    if (continueToken) params.set('cmcontinue', continueToken)

    const res = await fetch(`${BASE}?${params}`)
    const data = await res.json()

    const members = data.query?.categorymembers ?? []
    titles.push(...members.map((m) => m.title))

    continueToken = data.continue?.cmcontinue ?? null
    if (continueToken) await sleep(100)
  } while (continueToken)

  return titles
}

async function fetchExtracts(titles) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: '6',
    titles: titles.join('|'),
    format: 'json',
  })

  const res = await fetch(`${BASE}?${params}`)
  const data = await res.json()

  const pages = data.query?.pages ?? {}
  return Object.values(pages).map((p) => ({
    title: p.title,
    extract: (p.extract ?? '').trim(),
  }))
}

async function main() {
  const results = []

  for (const { category, label } of RARITIES) {
    process.stdout.write(`Fetching ${label} items...`)
    const titles = await fetchCategoryMembers(category)
    process.stdout.write(` ${titles.length} found. Fetching descriptions`)

    for (let i = 0; i < titles.length; i += 50) {
      const batch = titles.slice(i, i + 50)
      const extracts = await fetchExtracts(batch)

      for (const item of extracts) {
        results.push({
          name: item.title,
          rarity: label,
          desc: item.extract,
        })
      }

      process.stdout.write('.')
      await sleep(150)
    }

    console.log(` done`)
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} items to ${OUTPUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
