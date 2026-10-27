// Fetches a page from dnd2024.wikidot.com (the 2024 / 5.5e rules reference the
// project verifies against — see 2024_CONVERSION_PLAN.md) and prints it as plain
// text with each table row kept on one line ("a | b | c"). Used on its own for
// reading rules text, and as a module by scripts/ingest-2024-class.js.
//
//   node scripts/fetch-2024-wikidot.js barbarian:main
//
// Only the page body is kept; navigation, scripts and tags are dropped.

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&ndash;': '–',
  '&mdash;': '—',
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
}

const squash = (s) => s.replace(/\s+/g, ' ').trim()

// HTML -> array of text lines. Block elements end a line; a <tr> becomes one
// " | "-joined line. Wikidot pages are regular enough that a small tokenizer is
// all this needs (no HTML parser dependency, per CLAUDE.md's no-new-deps rule).
function htmlToLines(html) {
  const start = html.indexOf('<div id="page-content">')
  let body =
    start >= 0 ? html.slice(start + '<div id="page-content">'.length) : html
  const end = body.indexOf('<div class="page-tags"')
  if (end >= 0) body = body.slice(0, end)
  body = body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')

  const lines = []
  let cur = ''
  let row = null
  let cell = null
  const flush = () => {
    const t = squash(cur)
    if (t) lines.push(t)
    cur = ''
  }
  const tokens = body.split(/(<[^>]+>)/)
  for (const tok of tokens) {
    if (!tok) continue
    if (tok[0] !== '<') {
      if (cell !== null) cell += tok
      else cur += tok
      continue
    }
    const m = /^<\s*(\/?)\s*([a-z0-9]+)/i.exec(tok)
    if (!m) continue
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    if (tag === 'td' || tag === 'th') {
      if (!closing) cell = ''
      else if (cell !== null) {
        if (row) row.push(squash(cell))
        cell = null
      }
    } else if (tag === 'tr') {
      if (!closing) row = []
      else if (row) {
        lines.push(row.join(' | '))
        row = null
      }
    } else if (tag === 'br') {
      if (cell !== null) cell += ' '
      else flush()
    } else if (
      ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol'].includes(tag)
    ) {
      if (cell !== null) cell += ' '
      else flush()
    }
  }
  flush()
  return lines.map(decode).map(squash).filter(Boolean)
}

// { title, source, lines } — `source` is the book named on the page's first
// line ("Source: Player's Handbook"); the site mixes official books with
// Unearthed Arcana and third-party material, so callers check it.
async function fetchPage(slug) {
  const res = await fetch(`https://dnd2024.wikidot.com/${slug}`, {
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${slug}`)
  const html = await res.text()
  const t = /<title>([\s\S]*?)<\/title>/i.exec(html)
  const title = t
    ? decode(squash(t[1])).replace(/\s*-\s*D&D 5e \(2024\)\s*$/i, '')
    : null
  const lines = htmlToLines(html)
  const source = /^Source:\s*(.*)$/.exec(lines[0] ?? '')?.[1] ?? null
  return { title, source, lines }
}

async function fetchPageLines(slug) {
  return (await fetchPage(slug)).lines
}

module.exports = { fetchPage, fetchPageLines, htmlToLines }

if (require.main === module) {
  const slug = process.argv[2]
  if (!slug) {
    console.error(
      'usage: node scripts/fetch-2024-wikidot.js <slug>   e.g. barbarian:main'
    )
    process.exit(1)
  }
  fetchPageLines(slug)
    .then((lines) => console.log(lines.join('\n')))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}
