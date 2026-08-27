#!/usr/bin/env node
// Reads the Inkscape SVG map files under public/maps/ and lets you look up a
// place or region by name, or compute the distance between two of them.
//
// Each named thing on the map (city, town, POI, region) is drawn in Inkscape
// as a <g inkscape:label="..."> layer. A city typically appears as TWO
// sibling layers sharing the same label — one holding its <circle> marker
// (under a group like "cities_large"), another holding its <text> label
// (under "cities_large_labels"). This tool indexes every labeled layer by
// name and merges same-named layers together, so a lookup returns whatever
// geometry + text exists for that name, wherever it lives in the file.
//
// Region containment (which named region a point falls inside) is a rough
// bounding-box check against the region's path data, not true point-in-
// polygon — good enough to answer "which region is this in" without a full
// SVG path rasterizer. Treat it as a strong hint, not ground truth.
//
// Usage:
//   node scripts/map_lookup.js <name>                        look up by name (all maps)
//   node scripts/map_lookup.js <name> --map <mapId>           restrict to one map
//   node scripts/map_lookup.js --distance <nameA> <nameB>     distance in miles between two places
//   node scripts/map_lookup.js --distance <nameA> <nameB> --map <mapId>
//   node scripts/map_lookup.js --dump <mapId>                 dump every indexed label (debug)
//
// Can also be required as a module — see exports at the bottom.

'use strict'

const fs = require('fs')
const path = require('path')
const { XMLParser } = require('fast-xml-parser')

const ROOT = path.join(__dirname, '..')
const MAPS_JSON = path.join(ROOT, 'src/data/maps.json')
const MAPS_DIR = path.join(ROOT, 'public/maps')
const PLACES_JSON = path.join(ROOT, 'src/data/places.json')

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
})

function attrs(node) {
  const out = {}
  for (const k of Object.keys(node)) {
    if (k.startsWith('@_')) out[k.slice(2)] = node[k]
  }
  return out
}

function asArray(v) {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

function textContent(node) {
  const parts = []
  if (node['#text'] !== undefined) parts.push(String(node['#text']))
  for (const t of asArray(node.tspan)) parts.push(textContent(t))
  return parts.join(' ').trim()
}

// Rough bbox from every number found in a path's `d` attribute. Not a real
// path parser — relative commands and curve control points get thrown in
// alongside real vertices, so this over-estimates rather than under-estimates.
function pathBBox(d) {
  if (!d) return null
  const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number)
  if (nums.length < 2) return null
  const xs = [],
    ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i])
    ys.push(nums[i + 1])
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function addEntry(index, label, ancestry, data) {
  const key = (label || '(unlabeled)').toLowerCase()
  if (!index.has(key))
    index.set(key, { label: label || '(unlabeled)', items: [] })
  index.get(key).items.push({ ancestry, ...data })
}

function walk(node, ancestry, index) {
  const a = attrs(node)
  const ownLabel = a['inkscape:label'] || a.id || null
  const childAncestry = ownLabel ? ancestry.concat(ownLabel) : ancestry

  // Leaf elements (circle/text/path) carry their OWN inkscape:label in these
  // files — e.g. a <circle inkscape:label="khemrise"> inside the
  // "cities_large" group — so a leaf's label always wins over its parent
  // group's label. Only unlabeled leaves fall back to the group label.
  for (const c of asArray(node.circle)) {
    const ca = attrs(c)
    const label = ca['inkscape:label'] || ownLabel || null
    addEntry(index, label, label === ownLabel ? ancestry : childAncestry, {
      tag: 'circle',
      cx: parseFloat(ca.cx),
      cy: parseFloat(ca.cy),
      r: ca.r !== undefined ? parseFloat(ca.r) : null,
    })
  }
  for (const t of asArray(node.text)) {
    const ta = attrs(t)
    const label = ta['inkscape:label'] || ownLabel || null
    addEntry(index, label, label === ownLabel ? ancestry : childAncestry, {
      tag: 'text',
      x: ta.x !== undefined ? parseFloat(ta.x) : null,
      y: ta.y !== undefined ? parseFloat(ta.y) : null,
      content: textContent(t),
    })
  }
  for (const p of asArray(node.path)) {
    const pa = attrs(p)
    const label = pa['inkscape:label'] || ownLabel || pa.id || null
    addEntry(index, label, label === ownLabel ? ancestry : childAncestry, {
      tag: 'path',
      id: pa.id || null,
      bbox: pathBBox(pa.d),
    })
  }

  // The child's own label is read fresh at the top of its own walk() call;
  // here we only extend the ancestry chain with this node's label.
  for (const g of asArray(node.g)) {
    walk(g, childAncestry, index)
  }
}

function loadMapsConfig() {
  return JSON.parse(fs.readFileSync(MAPS_JSON, 'utf8'))
}

function loadPlaces() {
  try {
    return JSON.parse(fs.readFileSync(PLACES_JSON, 'utf8'))
  } catch {
    return []
  }
}

const _cache = new Map()

function loadMapIndex(mapConfig) {
  if (_cache.has(mapConfig.id)) return _cache.get(mapConfig.id)

  const svgPath = path.join(
    ROOT,
    'public',
    mapConfig.svgPath.replace(/^\//, '')
  )
  const xml = fs.readFileSync(svgPath, 'utf8')
  const doc = parser.parse(xml)
  const svgRoot = doc.svg
  const rootAttrs = attrs(svgRoot)
  const viewBox = rootAttrs.viewBox
    ? rootAttrs.viewBox.split(/\s+/).map(Number)
    : null

  const index = new Map()
  walk(svgRoot, [], index)

  const result = { mapConfig, viewBox, index }
  _cache.set(mapConfig.id, result)
  return result
}

function allMapIndexes(mapId) {
  const maps = loadMapsConfig()
  const wanted = mapId ? maps.filter((m) => m.id === mapId) : maps
  if (mapId && wanted.length === 0) {
    throw new Error(
      `No map with id "${mapId}". Known maps: ${maps
        .map((m) => m.id)
        .join(', ')}`
    )
  }
  return wanted.map(loadMapIndex)
}

// Merge a matched index entry into a flat summary: does it have a point
// (circle or text position), what layers/groups does it live under, and
// what region (if any) does that point fall inside.
function summarizeEntry(mapIndex, key) {
  const entry = mapIndex.index.get(key)
  if (!entry) return null

  const circle = entry.items.find((i) => i.tag === 'circle')
  const text = entry.items.find((i) => i.tag === 'text' && i.content)
  const point = circle ? { x: circle.cx, y: circle.cy } : null

  const categories = [
    ...new Set(
      entry.items.map((i) => i.ancestry[i.ancestry.length - 1]).filter(Boolean)
    ),
  ]

  let region = null
  if (point) {
    for (const [rKey, rEntry] of mapIndex.index) {
      if (rKey === key) continue
      const regionMatch = (mapIndex.mapConfig.regions || []).some(
        (r) => r.id.toLowerCase() === rKey || r.name.toLowerCase() === rKey
      )
      if (!regionMatch) continue
      const pathItem = rEntry.items.find((i) => i.tag === 'path' && i.bbox)
      if (!pathItem) continue
      const { minX, maxX, minY, maxY } = pathItem.bbox
      if (
        point.x >= minX &&
        point.x <= maxX &&
        point.y >= minY &&
        point.y <= maxY
      ) {
        region = rEntry.label
        break
      }
    }
  }

  return {
    map: mapIndex.mapConfig.name,
    mapId: mapIndex.mapConfig.id,
    label: entry.label,
    categories,
    point,
    displayText: text ? text.content : null,
    region,
    raw: entry.items,
  }
}

function findEntries(name, mapId) {
  const key = name.toLowerCase()
  const results = []
  for (const mapIndex of allMapIndexes(mapId)) {
    if (mapIndex.index.has(key)) {
      results.push(summarizeEntry(mapIndex, key))
    }
  }
  return results
}

function distanceBetween(nameA, nameB, mapId) {
  const key = (n) => n.toLowerCase()
  const results = []
  for (const mapIndex of allMapIndexes(mapId)) {
    const a = mapIndex.index.has(key(nameA))
      ? summarizeEntry(mapIndex, key(nameA))
      : null
    const b = mapIndex.index.has(key(nameB))
      ? summarizeEntry(mapIndex, key(nameB))
      : null
    if (!a || !b) continue
    if (!a.point || !b.point) {
      results.push({
        map: mapIndex.mapConfig.name,
        error: `Missing marker position for "${!a.point ? nameA : nameB}"`,
      })
      continue
    }
    const dx = a.point.x - b.point.x
    const dy = a.point.y - b.point.y
    const units = Math.sqrt(dx * dx + dy * dy)
    const milesPerUnit = mapIndex.mapConfig.milesPerUnit || null
    results.push({
      map: mapIndex.mapConfig.name,
      from: a.label,
      to: b.label,
      units: Math.round(units * 100) / 100,
      miles: milesPerUnit ? Math.round(units * milesPerUnit * 10) / 10 : null,
    })
  }
  return results
}

function findPlaceRecord(name) {
  const places = loadPlaces()
  const arr = Array.isArray(places) ? places : []
  const lower = name.toLowerCase()
  return arr.find((p) => p.name && p.name.toLowerCase() === lower) || null
}

// ---- CLI ----

function printLookup(name, mapId) {
  const matches = findEntries(name, mapId)
  if (matches.length === 0) {
    console.log(`No SVG match for "${name}".`)
  }
  for (const m of matches) {
    console.log(`\n${m.label}  —  ${m.map}`)
    if (m.categories.length)
      console.log(`  layer(s): ${m.categories.join(', ')}`)
    if (m.point)
      console.log(`  position: (${m.point.x}, ${m.point.y}) [svg units]`)
    if (
      m.displayText &&
      m.displayText.toLowerCase() !== m.label.toLowerCase()
    ) {
      console.log(`  label text: "${m.displayText}"`)
    }
    if (m.region) console.log(`  region (approx.): ${m.region}`)
  }

  const record = findPlaceRecord(name)
  if (record) {
    console.log(`\nplaces.json entry:`)
    console.log(`  type: ${record.type || '(none)'}`)
    if (record.description) console.log(`  description: ${record.description}`)
    if (record.notes) console.log(`  notes: ${record.notes}`)
  }
}

function printDistance(nameA, nameB, mapId) {
  const results = distanceBetween(nameA, nameB, mapId)
  if (results.length === 0) {
    console.log(`Couldn't find both "${nameA}" and "${nameB}" on the same map.`)
    return
  }
  for (const r of results) {
    if (r.error) {
      console.log(`${r.map}: ${r.error}`)
      continue
    }
    console.log(
      `${r.from} → ${r.to} (${r.map}): ${r.units} svg units` +
        (r.miles !== null
          ? ` ≈ ${r.miles} miles`
          : ' (no milesPerUnit set for this map)')
    )
  }
}

function printDump(mapId) {
  const [mapIndex] = allMapIndexes(mapId)
  const labels = [...mapIndex.index.keys()].sort()
  for (const key of labels) {
    const entry = mapIndex.index.get(key)
    const tags = entry.items.map((i) => i.tag).join('+')
    console.log(`${entry.label}  [${tags}]`)
  }
}

function main() {
  const args = process.argv.slice(2)
  const mapFlagIdx = args.indexOf('--map')
  let mapId = null
  if (mapFlagIdx !== -1) {
    mapId = args[mapFlagIdx + 1]
    args.splice(mapFlagIdx, 2)
  }

  if (args[0] === '--distance') {
    if (!args[1] || !args[2]) {
      console.error(
        'Usage: node scripts/map_lookup.js --distance <nameA> <nameB> [--map <mapId>]'
      )
      process.exit(1)
    }
    printDistance(args[1], args[2], mapId)
    return
  }

  if (args[0] === '--dump') {
    printDump(mapId || args[1])
    return
  }

  if (!args[0]) {
    console.error(
      'Usage:\n' +
        '  node scripts/map_lookup.js <name> [--map <mapId>]\n' +
        '  node scripts/map_lookup.js --distance <nameA> <nameB> [--map <mapId>]\n' +
        '  node scripts/map_lookup.js --dump <mapId>'
    )
    process.exit(1)
  }

  printLookup(args[0], mapId)
}

if (require.main === module) {
  main()
}

module.exports = {
  loadMapIndex,
  allMapIndexes,
  findEntries,
  distanceBetween,
  findPlaceRecord,
}
