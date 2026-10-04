// Rebuilds engine/data/5e/magic-items.json — the local copy of the official
// 5e magic-item catalog (every book dnd5e.wikidot.com carries, with each
// item's own source citation) — by reading the item pages listed in the
// wiki's public sitemap. Same idea as build-srd-cache.js: this is a
// committed local copy, not a runtime cache; re-run only to pick up upstream
// corrections or newly added items. Day to day nothing touches the network.
//
//   node scripts/build-item-cache.js            # full rebuild
//   node scripts/build-item-cache.js --limit 40 # first 40 pages, to try the parser
//
// Why wikidot and not the Open5e API: Open5e's 2014 data is the SRD 5.1
// only (about 500 entries) plus third-party books; it has none of the
// non-SRD WotC items (Belt of Giant Strength, Ioun Stone of Mastery, ...).
// This project's own standing rule (CLAUDE.md) already treats
// dnd5e.wikidot.com as the reference for 2014 rules text. robots.txt allows
// crawling these pages; this script is deliberately gentle (4 at a time, a
// short pause between requests) since it's a one-off.
//
// Output entry shape (see parseItemPage): { id, name, source, sources,
// category, subtype, rarity, rarity_note, requires_attunement,
// attunement_note, desc, tags, url }. `desc` is plain text, paragraphs
// separated by blank lines, tables flattened to "a | b | c" rows. Nothing
// here is interpreted into game mechanics — that layer (stat bonuses,
// charges, spells granted) belongs to the item records themselves and to the
// engine, not to a scrape.

const fs = require('fs')
const path = require('path')

const BASE = 'https://dnd5e.wikidot.com'
const OUT_FILE = path.join(
  __dirname,
  '..',
  'engine',
  'data',
  '5e',
  'magic-items.json'
)
const CONCURRENCY = 4
const PAUSE_MS = 150

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ')
}

// Turns the page-content HTML into plain text: paragraphs/headings/list
// items on their own lines, table rows flattened to "a | b | c".
function htmlToText(html) {
  let s = html
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map((c) => stripTags(c[1]).replace(/\s+/g, ' ').trim())
        .join(' | ')
    )
    return '\n\n' + rows.join('\n') + '\n\n'
  })
  s = s.replace(/<li[^>]*>/gi, '\n• ')
  s = s.replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, '\n\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = stripTags(s)
  return s
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const RARITY_WORDS = [
  'very rare',
  'uncommon',
  'common',
  'rare',
  'legendary',
  'artifact',
]
const RARITY_RE =
  /\b(very rare|uncommon|common|rare|legendary|artifact)\b|rarity (?:varies|by [a-z ]+)|unknown rarity|\bunique\b|\bvaries\b|\?\?\?/gi

// Index of the first rarity word that sits OUTSIDE any parentheses (a
// subtype like "(any sword)" or "(+1)" must not be mistaken for the rarity).
function firstTopLevelRarity(text) {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (depth === 0) {
      RARITY_RE.lastIndex = 0
      const m = RARITY_RE.exec(text.slice(i))
      if (m && m.index === 0 && (i === 0 || /[\s,]/.test(text[i - 1]))) return i
    }
  }
  return -1
}

// "Wondrous item, rare (requires attunement by a cleric)" ->
//   { category: 'wondrous item', subtype: null, rarityText: 'rare',
//     requires_attunement: true, attunement_note: 'by a cleric' }
// "Weapon (any sword), very rare (requires attunement)"
// "Armor (light, medium, or heavy), rarity varies"
// "Wondrous item, uncommon (+1), rare (+2)"
// Returns null if the line has no rarity at all (so it isn't a type line).
function parseTypeLine(line) {
  let text = line.replace(/\s+/g, ' ').trim()
  let requires = false
  let attunementNote = null
  const att = text.match(/\(\s*requires attunement([^)]*)\)/i)
  if (att) {
    requires = true
    attunementNote = att[1].trim() || null
    text = text.replace(att[0], '').replace(/\s+/g, ' ').trim()
  }
  const idx = firstTopLevelRarity(text)
  if (idx < 0) return null
  const head = text
    .slice(0, idx)
    .replace(/[,\s]+$/, '')
    .trim()
  const rarityText = text.slice(idx).trim()
  const sub = head.match(/^([^(]+?)\s*\(([^)]*)\)\s*$/)
  return {
    category: (sub ? sub[1] : head).trim().toLowerCase(),
    subtype: sub ? sub[2].trim() : null,
    rarityText,
    requires_attunement: requires,
    attunement_note: attunementNote,
  }
}

function normalizeRarity(rarityText) {
  if (!rarityText) return { rarity: null, rarity_note: null }
  const lower = rarityText.toLowerCase().trim()
  const exact = RARITY_WORDS.find((r) => lower === r)
  if (exact) return { rarity: exact, rarity_note: null }
  if (/^\?+$|^unknown rarity$/.test(lower))
    return { rarity: 'unknown', rarity_note: null }
  if (lower === 'unique') return { rarity: 'unique', rarity_note: null }
  const found = new Set(
    [...lower.matchAll(RARITY_RE)]
      .map((m) => m[0].toLowerCase())
      .filter((w) => RARITY_WORDS.includes(w))
  )
  // One rarity word with a trailing note ("rare (silver)") keeps that
  // rarity; several (a +1/+2/+3 family) or "rarity varies" is 'varies'.
  if (found.size === 1 && !/varies|rarity by/.test(lower)) {
    return { rarity: [...found][0], rarity_note: rarityText }
  }
  return { rarity: 'varies', rarity_note: rarityText }
}

const SOURCE_LINE_RE = /^Sources?\s*[:\-–—]\s*/i
const CATEGORY_START_RE =
  /^(wondrous item|weapon|armor|armour|shield|potion|ring|rod|staff|wand|scroll|ammunition|instrument|tattoo|spellwrought tattoo)\b/i

function parseItemPage(html, url) {
  const titleMatch = html.match(
    /<div class="page-title[^"]*">\s*<span>([\s\S]*?)<\/span>/
  )
  const name = titleMatch ? stripTags(titleMatch[1]).trim() : null
  const start = html.indexOf('id="page-content"')
  if (!name || start < 0) return null
  const end = html.indexOf('<div class="page-tags"', start)
  let contentHtml = html.slice(
    html.indexOf('>', start) + 1,
    end > 0 ? end : undefined
  )
  contentHtml = contentHtml.replace(
    /<div class="content-separator[\s\S]*$/i,
    ''
  )

  // Pull the source line(s) and the type line out of the paragraphs near the
  // top; whatever is left is the body. Pages vary: the source line may be
  // "Source: X" or "Source - X", the type line may or may not be italic.
  // Some pages have unclosed <p> tags, so split on <p> openings instead of
  // matching <p>...</p> pairs. `raw` is the chunk exactly as it appears after
  // splitting, so removing it from the joined body is exact.
  const chunks = contentHtml.replace(/<\/p>/gi, '').split(/<p>/i)
  const lead = chunks.shift()
  const paras = chunks.map((c) => ({
    raw: c,
    text: stripTags(c).replace(/\s+/g, ' ').trim(),
  }))
  const sourceParas = paras.filter((p) => SOURCE_LINE_RE.test(p.text))
  const sources = sourceParas
    .flatMap((p) =>
      p.text.replace(SOURCE_LINE_RE, '').split(/\s*[,;]\s*(?=[A-Z])/)
    )
    .map((s) => s.trim())
    .filter(Boolean)
  const typePara = paras.find(
    (p) =>
      !SOURCE_LINE_RE.test(p.text) &&
      p.text.length < 220 &&
      CATEGORY_START_RE.test(p.text) &&
      parseTypeLine(p.text)
  )
  const dropped = new Set([...sourceParas, ...(typePara ? [typePara] : [])])
  const body =
    lead +
    paras
      .filter((p) => !dropped.has(p))
      .map((p) => '<p>' + p.raw + '</p>')
      .join('')

  const tags = [
    ...html.slice(end > 0 ? end : 0).matchAll(/tag\/([a-z0-9-]+)#pages/g),
  ].map((m) => m[1])

  const type = typePara ? parseTypeLine(typePara.text) : null
  const { rarity, rarity_note } = normalizeRarity(type?.rarityText)
  return {
    id: slugify(name),
    name,
    source: sources[0] ?? null,
    sources,
    category: type?.category ?? null,
    subtype: type?.subtype ?? null,
    rarity,
    rarity_note,
    requires_attunement: type?.requires_attunement ?? false,
    attunement_note: type?.attunement_note ?? null,
    desc: htmlToText(body),
    tags: [...new Set(tags)],
    url,
  }
}

// Pages in the namespace that are navigation lists, not items.
const NOT_ITEMS = new Set(['All Items', 'Homebrew Items', 'Rune Magic'])
const isIndexPage = (name) => NOT_ITEMS.has(name) || /^Magic Items:/.test(name)

async function getText(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'dndtools-item-cache/1.0 (personal campaign tool)',
        },
      })
      if (res.ok) return await res.text()
      if (res.status === 404) return null
    } catch (e) {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500 * attempt))
  }
  throw new Error('failed: ' + url)
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
      await new Promise((r) => setTimeout(r, PAUSE_MS))
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

async function itemUrlsFromSitemap() {
  const xml = await getText(`${BASE}/sitemap_page_1.xml`)
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u.startsWith(`${BASE}/wondrous-items:`))
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : null
  let urls = await itemUrlsFromSitemap()
  console.log(`sitemap lists ${urls.length} item pages`)
  if (limit) urls = urls.slice(0, limit)

  const failures = []
  let done = 0
  const parsed = await mapLimit(urls, CONCURRENCY, async (url) => {
    try {
      const html = await getText(url)
      const item = html ? parseItemPage(html, url) : null
      if (!item) failures.push(url)
      return item
    } catch (e) {
      failures.push(url)
      return null
    } finally {
      if (++done % 100 === 0) console.log(`  ${done}/${urls.length}`)
    }
  })

  const items = parsed.filter((i) => i && !isIndexPage(i.name))
  // Ids are name slugs; two pages can slugify the same (different books'
  // versions of one name). Disambiguate with the source so ids stay unique
  // and stable.
  const seen = new Map()
  for (const item of items) {
    const n = seen.get(item.id) ?? 0
    seen.set(item.id, n + 1)
  }
  for (const item of items) {
    if (seen.get(item.id) > 1) {
      item.id = `${item.id}--${slugify(item.source ?? 'unknown')}`
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  if (!limit) {
    fs.writeFileSync(OUT_FILE, JSON.stringify(items, null, 2) + '\n')
    console.log(
      `wrote ${path.relative(process.cwd(), OUT_FILE)} (${items.length} items)`
    )
  } else {
    console.log(JSON.stringify(items.slice(0, 3), null, 2))
  }
  if (failures.length) {
    console.log(`${failures.length} page(s) failed/unparseable:`)
    failures.forEach((u) => console.log('  ' + u))
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { parseItemPage, parseTypeLine, normalizeRarity, htmlToText }
