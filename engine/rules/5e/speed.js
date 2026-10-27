// Walking Speed, with the lines for a tooltip: { value, breakdown: [{ label, amount }] }.
//
//   base            the species' Speed (2024 species; 2014 species and subraces for 2014
//                   sheets; the 2024 Wood Elf lineage and the 2014 Wood Elf both give 35)
//   Barbarian       Fast Movement, +10 ft. from 5th level unless wearing Heavy armor
//   Monk            Unarmored Movement, +10/+15/+20/+25/+30 ft. at 2nd/6th/10th/14th/18th
//                   level while wearing no armor and no Shield
//   Mobile          the feat, +10 ft.
//   items           stat_bonuses.speed (Bracers of Swiftness, boots...)
//   Exhaustion      2024: -5 ft. per level. 2014: halved from level 2, zero from level 5.
//
// Not modeled: armor Strength requirements (2014 Heavy armor), encumbrance, and
// temporary effects such as Haste, Longstrider or Slow.

const { loadSpecies, resolveSpeciesName } = require('./species')
const { armorBaseData } = require('./armor')
const { bonusLines } = require('./breakdown')
const { resolveEffectiveStats } = require('./characterStats')
const { exhaustionEffects, speedAfterExhaustion } = require('./exhaustion')
const { rulesetOf } = require('./rulesetId')

const MONK_UNARMORED = [
  [18, 30],
  [14, 25],
  [10, 20],
  [6, 15],
  [2, 10],
]

const toFeet = (v) =>
  typeof v === 'number' ? v : parseInt(String(v), 10) || 30

function baseSpeed(character, ruleset) {
  const { species } = resolveSpeciesName(character.genus, character.subgenus)
  const data = species ? loadSpecies(species, ruleset) : null
  let feet = toFeet(data?.speed ?? 30)
  const text = `${character.genus || ''} ${character.subgenus || ''} ${(
    character.features || []
  )
    .map((f) => f.name)
    .join(' ')}`
  const sub = (data?.subraces || []).find((s) =>
    new RegExp(s.name.replace(/ \(.*\)/, ''), 'i').test(text)
  )
  if (sub?.speed) feet = toFeet(sub.speed)
  if (ruleset === '2024' && /wood elf/i.test(text)) feet = 35
  return { feet, label: `${species || 'Base'} Speed` }
}

function speedBreakdown(character, equippedItems = []) {
  const ruleset = rulesetOf(character)
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const classes = character.classes || []
  const levelOf = (name) => classes.find((c) => c.name === name)?.level ?? 0
  const body = equippedItems.find(
    (i) => i.type === 'armor' && i.slot === 'body'
  )
  const shield = equippedItems.some((i) => i.armor_type === 'shield')
  const category = body
    ? armorBaseData(body.armor_type)?.category ?? body.armor_category ?? null
    : null

  const base = baseSpeed(character, ruleset)
  const breakdown = [{ label: base.label, amount: base.feet }]

  if (levelOf('Barbarian') >= 5 && category !== 'heavy')
    breakdown.push({ label: 'Fast Movement', amount: 10 })
  if (levelOf('Monk') >= 2 && !body && !shield) {
    const bonus =
      MONK_UNARMORED.find(([lvl]) => levelOf('Monk') >= lvl)?.[1] ?? 0
    breakdown.push({ label: 'Unarmored Movement', amount: bonus })
  }
  if (
    (character.features || []).some(
      (f) => f.type === 'feat' && /^Mobile$/i.test(f.name)
    )
  )
    breakdown.push({ label: 'Mobile', amount: 10 })

  const named = [
    ...bonusLines(equippedItems, 'speed'),
    ...bonusLines(character.features, 'speed'),
  ]
  breakdown.push(...named)
  const unnamed = (bonuses.speed ?? 0) - named.reduce((n, l) => n + l.amount, 0)
  if (unnamed) breakdown.push({ label: 'Other bonuses', amount: unnamed })

  const beforeExhaustion = breakdown.reduce((n, l) => n + l.amount, 0)
  const level = character.exhaustion_level ?? 0
  if (level > 0) {
    const after = speedAfterExhaustion(beforeExhaustion, level, ruleset)
    const e = exhaustionEffects(level, ruleset)
    const label =
      ruleset === '2024'
        ? `Exhaustion level ${level} (-5 ft. per level)`
        : e.speedZero
        ? `Exhaustion level ${level} (Speed 0)`
        : `Exhaustion level ${level} (Speed halved)`
    if (after !== beforeExhaustion)
      breakdown.push({ label, amount: after - beforeExhaustion })
  }
  return { value: breakdown.reduce((n, l) => n + l.amount, 0), breakdown }
}

module.exports = { speedBreakdown }
