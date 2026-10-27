// One-off (2026-10-27): for sheets with Ability Score Improvement slots that have no recorded
// choice, work out what was most likely taken from the final scores, and record it as history
// entries marked `inferred: true`. The final scores do not change.
//
//   node scripts/infer-asi-2024.js            # dry run
//   node scripts/infer-asi-2024.js --write
//
// Method. A standard build starts every score at 15 or less (point buy / standard array), then
// takes one +2 and one +1 from the species or background. So after the recorded history is taken
// off, the points a score has above 17 (for the highest), 16 (for the second) or 15 (for the rest)
// can only have come from Ability Score Improvements. Each missing slot is worth 2 points; they
// go to the scores with the most such excess, 2 at a time. Points left over when the slots run
// out are NOT invented away: they stay in the base (rolled stats, or an award nobody wrote down).
// If the slots outnumber the excess, the spare slots go to the highest score (a player almost
// always puts them there), never above 20.

const fs = require('fs')
const path = require('path')
const { loadClass } = require('../engine/rules/5e/classFeatures')
const { asiLevelsForClass } = require('../engine/rules/5e/progression')
const { reconstructLevelHistory } = require('../engine/rules/5e/levelHistory')
const { rulesetOf } = require('../engine/rules/5e/rulesetId')

const FILE = path.join(__dirname, '..', 'src', 'data', 'characters.json')
const KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const DATE = '2026-10-27'
const write = process.argv.includes('--write')

function slotsOf(c) {
  const ruleset = rulesetOf(c)
  const ordered = [
    c.classes.find((k) => k.started) || c.classes[0],
    ...c.classes.filter(
      (k) =>
        !k.started && k !== (c.classes.find((x) => x.started) || c.classes[0])
    ),
  ]
  const slots = []
  for (const k of ordered) {
    const data = loadClass(k.name, ruleset)
    const levels = Object.entries(data?.features_by_level || {})
      .filter(([, names]) =>
        names.some((n) => /^Ability Score Improvement|^Epic Boon/i.test(n))
      )
      .map(([l]) => Number(l))
    for (const l of (levels.length ? levels : asiLevelsForClass(k.name)).filter(
      (l) => l <= k.level
    ))
      slots.push({ class: k.name, level: l })
  }
  return slots
}

function infer(c) {
  const slots = slotsOf(c)
  const history = c.ability_score_history || []
  const recordedPoints = history
    .filter((h) => /Ability Score Improvement/i.test(h.source || ''))
    .reduce((n, h) => n + (h.amount || 0), 0)
  const featsTaken = c.features.filter(
    (f) =>
      f.type === 'feat' &&
      !f._grant &&
      !(
        /human/i.test(c.genus) &&
        rulesetOf(c) === '2014' &&
        f.level_gained === 1
      ) &&
      !/^boon of /i.test(f.name)
  ).length
  const unused =
    slots.length - Math.max(Math.ceil(recordedPoints / 2), 0) - featsTaken
  if (unused <= 0) return null
  // slots not covered by a recorded level: take the highest-level ones first matched by feat/history levels
  const taken = new Set([
    ...history
      .filter((h) => /Ability Score Improvement/i.test(h.source || ''))
      .map((h) => Number(h.level_gained)),
    ...c.features
      .filter((f) => f.type === 'feat' && !f._grant && f.level_gained > 1)
      .map((f) => Number(f.level_gained)),
  ])
  const free = slots.filter((s) => !taken.has(s.level))
  const targets = (free.length >= unused ? free : slots).slice(0, unused)

  const base0 = Object.fromEntries(
    KEYS.map((k) => [
      k,
      c[`stat_${k}`] -
        history
          .filter((h) => h.ability === k)
          .reduce((n, h) => n + (h.amount || 0), 0),
    ])
  )
  const rank = [...KEYS].sort((a, b) => base0[b] - base0[a])
  const threshold = Object.fromEntries(
    rank.map((k, i) => [k, i === 0 ? 17 : i === 1 ? 16 : 15])
  )
  const excess = Object.fromEntries(
    KEYS.map((k) => [k, Math.max(0, base0[k] - threshold[k])])
  )
  const entries = []
  const unplaced = []
  for (const slot of targets) {
    // The score furthest above what a standard build reaches must have taken an improvement.
    const pick = KEYS.filter((k) => excess[k] >= 1).sort(
      (a, b) => excess[b] - excess[a]
    )[0]
    if (!pick) {
      unplaced.push(slot)
      continue
    }
    excess[pick] = Math.max(0, excess[pick] - 2)
    entries.push({
      ability: pick,
      amount: 2,
      source: 'Ability Score Improvement',
      level_gained: slot.level,
      class: slot.class,
      inferred: true,
    })
  }
  return {
    entries,
    unplaced,
    slots: targets,
    leftoverExcess: Object.entries(excess).filter(([, v]) => v > 0),
  }
}

const chars = JSON.parse(fs.readFileSync(FILE, 'utf8'))
let changed = 0
const out = chars.map((c) => {
  if (
    c.level_history?.some(
      (e) =>
        e.kind === 'audit' && (e.notes || []).some((n) => /inferred/i.test(n))
    )
  )
    return c
  const r = infer(c)
  if (!r || !(r.entries.length || r.unplaced.length)) return c
  changed++
  const next = JSON.parse(JSON.stringify(c))
  next.ability_score_history = [
    ...(c.ability_score_history || []),
    ...r.entries,
  ]
  for (const k of KEYS)
    next.ability_base[k] =
      c[`stat_${k}`] -
      next.ability_score_history
        .filter((h) => h.ability === k)
        .reduce((n, h) => n + (h.amount || 0), 0)
  const rebuilt = reconstructLevelHistory(next).map((e) =>
    e.kind === 'level' ? { ...e, hp: { gain: null, method: 'unrecorded' } } : e
  )
  const keep = (c.level_history || []).filter(
    (e) => e.kind === 'migration' || e.kind === 'audit'
  )
  next.level_history = [
    ...rebuilt,
    ...keep,
    {
      kind: 'audit',
      date: DATE,
      notes: [
        `Ability Score Improvements with no recorded choice were inferred from the final scores: ${r.entries
          .map(
            (e) =>
              `+${e.amount} ${e.ability.toUpperCase()} (${e.class} ${
                e.level_gained
              })`
          )
          .join(
            ', '
          )}. Correct them if you remember differently; the final scores are unchanged.`,
        ...(r.unplaced.length
          ? [
              `${
                r.unplaced.length
              } more Ability Score Improvement slot(s) (${r.unplaced
                .map((u) => `${u.class} ${u.level}`)
                .join(
                  ', '
                )}) show no trace in the final scores, so what was taken there cannot be worked out and is left unrecorded.`,
            ]
          : []),
        ...(r.leftoverExcess.length
          ? [
              `After that, ${r.leftoverExcess
                .map(([k, v]) => `${k.toUpperCase()} still has ${v} point(s)`)
                .join(
                  ', '
                )} above a standard build. No feature, item or note on the sheet explains it; it is legal if the scores were rolled or awarded.`,
            ]
          : []),
      ],
    },
  ]
  console.log(
    `${c.name.padEnd(9)} ${
      r.unplaced.length ? `[${r.unplaced.length} slot(s) unrecorded] ` : ''
    }${r.entries
      .map(
        (e) =>
          `+${e.amount} ${e.ability.toUpperCase()}@${e.class[0]}${
            e.level_gained
          }`
      )
      .join('  ')}   ${
      r.leftoverExcess.length
        ? 'leftover: ' + r.leftoverExcess.map(([k, v]) => `${k}+${v}`).join(',')
        : ''
    }`
  )
  return next
})
console.log(`\n${changed} character(s) with inferred choices.`)
if (write) {
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n')
  console.log('characters.json written.')
} else console.log('(dry run; pass --write to save)')
