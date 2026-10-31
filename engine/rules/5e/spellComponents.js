// Material components, classified — and the one place the "V, S, M" string is
// built for display.
//
// RAW (PHB p.203): a component pouch or spellcasting focus can stand in for a
// spell's material components, EXCEPT where the spell indicates a cost (you
// need that specific component) or says the spell consumes it. Few players
// notice that rule, so the campaign marks it in the components line:
//
// The "f" is an ADDITION to the M, never a replacement — every spell with a
// Material component keeps its M:
//
//   M, f a focus works (plain material, or priced under the house limit
//        below)                                          (V, S, M, f)
//   M    you must supply the real component             (V, S, M)
//
// HOUSE RULE: RAW has no price threshold — any listed cost needs the real
// component. This campaign lets a focus cover a priced component cheaper than
// FOCUS_COST_LIMIT_GP. Consumed components always need the real thing (RAW
// and house agree). Change the constant to retune; to follow RAW exactly set
// it to 0.
//
// `kind` is one of:
//   null       no material component
//   'focus'    plain material, no price, not consumed
//   'cheap'    priced under the limit, not consumed (house: a focus works)
//   'costly'   priced at/over the limit, or consumed: provide the real thing
//   'unknown'  has an M but no material text on record (data gap)
//
// Pure and dependency-free: the browser may require() this file directly.

const FOCUS_COST_LIMIT_GP = 300

const PRICE = /(\d[\d,]*(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)\b/gi
const GP_PER = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 }

function hasMaterial(spell) {
  const c = spell?.components
  if (Array.isArray(c)) return c.includes('M')
  return typeof c === 'string' ? /\bM\b/.test(c) : false
}

// The largest single price in the text, in gp (0 when none is listed).
function materialCostGp(material) {
  let best = 0
  for (const m of (material ?? '').matchAll(PRICE)) {
    const gp = parseFloat(m[1].replace(/,/g, '')) * GP_PER[m[2].toLowerCase()]
    best = Math.max(best, gp)
  }
  return best
}

function materialInfo(spell) {
  if (!hasMaterial(spell)) return { kind: null, costGp: 0, consumed: false }
  const text = spell.material
  if (!text) return { kind: 'unknown', costGp: 0, consumed: false }
  const costGp = materialCostGp(text)
  const consumed = /consum/i.test(text)
  let kind = 'focus'
  if (consumed || costGp >= FOCUS_COST_LIMIT_GP) kind = 'costly'
  else if (costGp > 0) kind = 'cheap'
  return { kind, costGp, consumed }
}

// 'focus' and 'cheap' differ in the data (priced or not) but not on screen.
const MARK = { focus: 'M, f', cheap: 'M, f' }

// "V, S, M" -> "V, S, M, f" (a focus works) or "V, S, M" (it doesn't). `spell` needs
// `components` (array or "V, S, M" string) and, for the marking, `material`.
function componentsLabel(spell) {
  const parts = Array.isArray(spell?.components)
    ? spell.components
    : String(spell?.components ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
  const mark = MARK[materialInfo(spell).kind]
  if (!mark) return parts.join(', ')
  return parts.map((p) => (p === 'M' ? mark : p)).join(', ')
}

module.exports = {
  FOCUS_COST_LIMIT_GP,
  materialInfo,
  materialCostGp,
  componentsLabel,
}
