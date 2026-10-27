// Drafts engine/data/5e/feature-mechanics.json entries (action type, uses,
// recharge) for the 2024 class/subclass features, from their rules text plus
// the explicit OVERRIDES below for resources that come out of a class table.
//
//   node scripts/draft-2024-mechanics.js            # prints the table for review
//   node scripts/draft-2024-mechanics.js --write    # replaces every pub24_* entry
//
// The text heuristics are a starting point, not the authority: anything wrong
// gets an OVERRIDES line (or `null` to say "passive, no mechanics") and the
// review output below is how that was checked. See 2024_CONVERSION_PLAN.md.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MECH_FILE = path.join(
  ROOT,
  'engine',
  'data',
  '5e',
  'feature-mechanics.json'
)
const ABILITY = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

const classTable = (cls, table) => ({ type: 'class_table', class: cls, table })

// id -> mechanics (merged over the heuristic), or null for "no mechanics".
// Resources whose pool is a class-table column or a level formula are listed
// here because the prose just points at the table.
const OVERRIDES = {
  'pub24_barbarian-rage': {
    action_type: 'bonus_action',
    recharge: 'long_rest',
    short_rest_regain: 1,
    uses_formula: classTable('Barbarian', 'rages_by_level'),
  },
  'pub24_barbarian-instinctive-pounce': null,
  'pub24_barbarian-brutal-strike': null,
  'pub24_barbarian-relentless-rage': { recharge: 'short_rest', uses_max: 1 },
  'pub24_barbarian-persistent-rage': { recharge: 'long_rest', uses_max: 1 },
  'pub24_bard-bardic-inspiration': {
    action_type: 'bonus_action',
    recharge: 'long_rest',
    uses_formula: { type: 'ability_mod', ability: 'cha', base: 0, min: 1 },
  },
  'pub24_cleric-channel-divinity': {
    recharge: 'long_rest',
    short_rest_regain: 1,
    uses_formula: classTable('Cleric', 'channel_divinity_by_level'),
  },
  'pub24_druid-wild-shape': {
    action_type: 'bonus_action',
    recharge: 'long_rest',
    short_rest_regain: 1,
    uses_formula: classTable('Druid', 'wild_shape_by_level'),
  },
  'pub24_fighter-second-wind': {
    action_type: 'bonus_action',
    recharge: 'long_rest',
    short_rest_regain: 1,
    uses_formula: classTable('Fighter', 'second_wind_by_level'),
  },
  'pub24_fighter-action-surge-one-use': {
    action_type: 'free',
    recharge: 'short_rest',
    uses_max: 1,
    per_turn_cap: true,
    tier_family: 'pub24-fighter-action-surge',
    name: 'Action Surge',
  },
  'pub24_fighter-action-surge-two-uses-l17': {
    action_type: 'free',
    recharge: 'short_rest',
    uses_max: 2,
    per_turn_cap: true,
    tier_family: 'pub24-fighter-action-surge',
    name: 'Action Surge',
  },
  'pub24_fighter-indomitable-one-use': {
    recharge: 'long_rest',
    uses_max: 1,
    tier_family: 'pub24-fighter-indomitable',
    name: 'Indomitable',
  },
  'pub24_fighter-indomitable-two-uses-l13': {
    recharge: 'long_rest',
    uses_max: 2,
    tier_family: 'pub24-fighter-indomitable',
    name: 'Indomitable',
  },
  'pub24_fighter-indomitable-three-uses-l17': {
    recharge: 'long_rest',
    uses_max: 3,
    tier_family: 'pub24-fighter-indomitable',
    name: 'Indomitable',
  },
  'pub24_monk-monks-focus': {
    recharge: 'short_rest',
    uses_formula: classTable('Monk', 'focus_points_by_level'),
  },
  'pub24_paladin-lay-on-hands': {
    action_type: 'bonus_action',
    recharge: 'long_rest',
    uses_formula: { type: 'level_multiple', class: 'Paladin', multiplier: 5 },
  },
  'pub24_paladin-channel-divinity': {
    recharge: 'long_rest',
    short_rest_regain: 1,
    uses_formula: classTable('Paladin', 'channel_divinity_by_level'),
  },
  'pub24_ranger-favored-enemy': {
    recharge: 'long_rest',
    uses_formula: classTable('Ranger', 'favored_enemy_by_level'),
  },
  'pub24_rogue-sneak-attack': { per_turn_cap: true },
  'pub24_sorcerer-font-of-magic': {
    recharge: 'long_rest',
    uses_formula: classTable('Sorcerer', 'sorcery_points_by_level'),
  },
  'pub24_sorcerer-innate-sorcery': {
    action_type: 'bonus_action',
    recharge: 'long_rest',
    uses_max: 2,
  },
  'pub24_warlock-magical-cunning': { recharge: 'long_rest', uses_max: 1 },
  'pub24_wizard-arcane-recovery': { recharge: 'long_rest', uses_max: 1 },
  // Corrections found reviewing the heuristic output:
  'pub24_rogue-devious-strikes': null,
  'pub24_ranger-tireless': { action_type: 'action', recharge: 'long_rest', uses_formula: { type: 'ability_mod', ability: 'wis', base: 0, min: 1 } },
  'pub24_sorcerer-sorcerous-restoration': { recharge: 'long_rest', uses_max: 1 },
  'pub24_cleric-divine-intervention': { action_type: 'action', recharge: 'long_rest', uses_max: 1 },
  'pub24_sub_ranger-hunter-hunters-prey': null,
  'pub24_sub_wizard-diviner-portent': { recharge: 'long_rest', uses_max: 2 },
  'pub24_species_gnome-rock-gnome': null,
  'pub24_feat-ritual-caster': null,
}

const FIRST = (d) => d.split('\n').slice(0, 3).join(' ').slice(0, 520)

function detectAction(d) {
  const t = FIRST(d)
  // "As part of the Bonus Action you take to enter your Rage" mentions an action
  // without being one; likewise "no action required".
  if (/As part of the (Bonus )?Action/i.test(t)) return null
  const hits = [
    [
      'bonus_action',
      /\b(as|take|using|use) an? Bonus Action\b|\bBonus Action to\b|\ba Bonus Action,? you can\b|\bBonus Action\b/i,
    ],
    ['reaction', /\b(take|use|using|as) an? Reaction\b|\bReaction to\b/i],
    [
      'action',
      /\bMagic action\b|\bUtilize action\b|\bas an action\b|\btake an action\b|\bStudy action\b|\bInfluence action\b/i,
    ],
  ]
  let best = null
  for (const [type, re] of hits) {
    const m = re.exec(t)
    if (m && (best === null || m.index < best.index))
      best = { type, index: m.index }
  }
  return best?.type ?? null
}

function detectUses(d) {
  const t = d.slice(0, 900)
  const m = {}
  if (
    /regain (?:all )?expended uses? when you finish a (?:Short or )?Long Rest|until you finish a Long Rest|finish a Long Rest/i.test(
      t
    )
  )
    m.recharge = 'long_rest'
  if (
    /finish a Short or Long Rest|until you finish a Short or Long Rest|finish a Short Rest/i.test(
      t
    )
  )
    m.recharge = 'short_rest'
  if (
    /Proficiency Bonus times|number of times equal to your Proficiency Bonus|a number of times equal to your Proficiency Bonus/i.test(
      t
    )
  ) {
    m.uses_formula = { type: 'proficiency_bonus' }
  }
  const mod =
    /number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier \(minimum of (?:once|1)\)/i.exec(
      t
    )
  if (mod)
    m.uses_formula = {
      type: 'ability_mod',
      ability: ABILITY[mod[1].toLowerCase()],
      base: 0,
      min: 1,
    }
  if (!m.uses_formula && m.recharge) {
    if (/\btwice\b|\btwo times\b/i.test(t)) m.uses_max = 2
    else if (/\bthree times\b/i.test(t)) m.uses_max = 3
    else if (/\bonce\b|can't (?:do so|use (?:it|this feature)) again/i.test(t))
      m.uses_max = 1
  }
  return m
}

function draft(entry) {
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, entry.id)) {
    const o = OVERRIDES[entry.id]
    return o === null ? null : { name: entry.name, ...o }
  }
  const out = { name: entry.name }
  const action = detectAction(entry.description)
  if (action) out.action_type = action
  Object.assign(out, detectUses(entry.description))
  // A recharge with no pool size is meaningless; drop it rather than guess.
  if (out.recharge && out.uses_max == null && !out.uses_formula)
    delete out.recharge
  return Object.keys(out).length > 1 ? out : null
}

const pub = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'src', 'data', 'published_features.json'),
    'utf8'
  )
)
const features = pub.filter(
  (e) =>
    (e.id ?? '').startsWith('pub24_') &&
    ['class_feature', 'subclass_feature', 'speciesTrait', 'feat'].includes(e.category)
)
const result = {}
for (const f of features) {
  const m = draft(f)
  if (m) result[f.id] = m
}

const fmt = (m) =>
  [
    m.action_type ?? '-',
    m.recharge ?? '-',
    m.uses_max ??
      (m.uses_formula ? JSON.stringify(m.uses_formula).replace(/"/g, '') : '-'),
    m.short_rest_regain ? `+${m.short_rest_regain}/SR` : '',
    m.per_turn_cap ? 'per-turn' : '',
  ].join(' | ')

if (!process.argv.includes('--write')) {
  for (const f of features) {
    const m = result[f.id]
    console.log(
      `${f.id.replace('pub24_', '').padEnd(58)} ${m ? fmt(m) : '(passive)'}`
    )
  }
  console.log(
    `\n${Object.keys(result).length} of ${features.length} features have mechanics`
  )
} else {
  const mech = JSON.parse(fs.readFileSync(MECH_FILE, 'utf8'))
  for (const k of Object.keys(mech)) if (k.startsWith('pub24_')) delete mech[k]
  Object.assign(mech, result)
  fs.writeFileSync(MECH_FILE, JSON.stringify(mech, null, 2) + '\n')
  console.log(`wrote ${Object.keys(result).length} entries`)
}
