// 5e SRD condition definitions. Each entry has a summary line and bullet rules.
// Used for hover tooltips on condition chips throughout the app.

export const CONDITIONS = {
  Blinded: {
    summary:
      'Cannot see. Attacks against it have advantage; its attacks have disadvantage.',
    rules: [
      'Automatically fails any ability check requiring sight.',
      'Attack rolls against it have advantage.',
      'Its own attack rolls have disadvantage.',
    ],
  },
  Charmed: {
    summary:
      'Cannot attack the charmer. Charmer has advantage on social checks against it.',
    rules: [
      'Cannot attack the charmer or target them with harmful abilities or spells.',
      'The charmer has advantage on Charisma checks made against it.',
    ],
  },
  Deafened: {
    summary: 'Cannot hear. Automatically fails hearing-based checks.',
    rules: [
      'Cannot hear.',
      'Automatically fails any ability check requiring hearing.',
    ],
  },
  Exhaustion: {
    summary: 'Stacking debuff (1–6). Level 6 = death.',
    rules: [
      'Level 1 — Disadvantage on ability checks.',
      'Level 2 — Speed halved.',
      'Level 3 — Disadvantage on attack rolls and saving throws.',
      'Level 4 — Hit point maximum halved.',
      'Level 5 — Speed reduced to 0.',
      'Level 6 — Death.',
      'Each level removed by a long rest (with food and water).',
    ],
  },
  Frightened: {
    summary:
      'Disadvantage on checks and attacks while source of fear is in sight. Cannot move closer.',
    rules: [
      'Disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.',
      'Cannot willingly move closer to the source of its fear.',
    ],
  },
  Grappled: {
    summary:
      'Speed 0. Ends if grappler is incapacitated or creature is moved out of reach.',
    rules: [
      'Speed becomes 0 and cannot benefit from bonuses to speed.',
      'Condition ends if the grappler is incapacitated.',
      "Condition ends if an effect moves the grappled creature out of the grappler's reach.",
    ],
  },
  Incapacitated: {
    summary: 'Cannot take actions or reactions.',
    rules: ['Cannot take actions.', 'Cannot take reactions.'],
  },
  Invisible: {
    summary:
      'Cannot be seen without special sense. Attacks against it have disadvantage; its attacks have advantage.',
    rules: [
      'Impossible to see without special sense (tremorsense, truesight, etc.).',
      'For attack purposes it is heavily obscured.',
      'Attack rolls against it have disadvantage.',
      'Its own attack rolls have advantage.',
      'It can still be detected by noise, tracks, or other means.',
    ],
  },
  Paralyzed: {
    summary:
      'Incapacitated, speed 0. Auto-fail STR/DEX saves. Attacks have advantage; hits within 5 ft are critical.',
    rules: [
      'Is incapacitated and cannot move or speak.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against it have advantage.',
      'Any attack that hits it is a critical hit if the attacker is within 5 feet.',
    ],
  },
  Petrified: {
    summary:
      'Transformed to stone. Incapacitated, auto-fail STR/DEX saves, resistance to all damage, immune to poison/disease.',
    rules: [
      'Is transformed into solid inanimate substance (along with nonmagical gear).',
      'Weight increases by a factor of ten and ceases aging.',
      'Is incapacitated, cannot move or speak, and is unaware of its surroundings.',
      'Attack rolls against it have advantage.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Resistance to all damage.',
      'Immune to poison and disease; existing poison/disease are suspended.',
    ],
  },
  Poisoned: {
    summary: 'Disadvantage on attack rolls and ability checks.',
    rules: ['Disadvantage on attack rolls.', 'Disadvantage on ability checks.'],
  },
  Prone: {
    summary:
      'Disadvantage on attacks. Attacks within 5 ft have advantage; ranged have disadvantage. Costs half speed to stand.',
    rules: [
      'Only movement option is crawling, unless it stands up.',
      'Standing up costs half its speed.',
      'Its attack rolls have disadvantage.',
      'Melee attack rolls against it have advantage.',
      'Ranged attack rolls against it have disadvantage.',
    ],
  },
  Restrained: {
    summary:
      'Speed 0. Its attacks have disadvantage; attacks against it have advantage. Disadvantage on DEX saves.',
    rules: [
      'Speed becomes 0 and cannot benefit from bonuses to speed.',
      'Attack rolls against it have advantage.',
      'Its own attack rolls have disadvantage.',
      'Disadvantage on Dexterity saving throws.',
    ],
  },
  Stunned: {
    summary:
      'Incapacitated, speed 0. Auto-fail STR/DEX saves. Attacks against it have advantage.',
    rules: [
      'Is incapacitated and cannot move.',
      'Can speak only falteringly.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against it have advantage.',
    ],
  },
  Unconscious: {
    summary:
      'Incapacitated, prone, drops held items. Auto-fail STR/DEX saves. Attacks have advantage; hits within 5 ft are critical.',
    rules: [
      'Is incapacitated, cannot move or speak, and is unaware of its surroundings.',
      'Drops anything held and falls prone.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against it have advantage.',
      'Any attack that hits it is a critical hit if the attacker is within 5 feet.',
    ],
  },
  Concentrating: {
    summary:
      'Maintaining a concentration spell. Taking damage requires a CON save (DC 10 or half damage) or spell drops.',
    rules: [
      'Taking damage requires a Constitution saving throw (DC 10 or half the damage taken, whichever is higher).',
      'On a failed save the concentration spell ends.',
      'Only one concentration spell can be active at a time.',
      'Being incapacitated or killed also ends concentration.',
    ],
  },
  Blessed: {
    summary: '+1d4 to attack rolls and saving throws.',
    rules: ['Add 1d4 to attack rolls.', 'Add 1d4 to saving throws.'],
  },
  Hexed: {
    summary:
      'Caster deals +1d6 necrotic to chosen target; disadvantage on chosen ability checks.',
    rules: [
      'The caster deals an extra 1d6 necrotic damage to it on each hit.',
      'Disadvantage on ability checks using the ability chosen by the caster.',
    ],
  },
}

// Ordered list for display (matches existing chip order in the app)
export const CONDITION_NAMES = [
  'Concentrating',
  'Blessed',
  'Hexed',
  'Poisoned',
  'Prone',
  'Frightened',
  'Charmed',
  'Stunned',
  'Paralyzed',
  'Grappled',
  'Restrained',
  'Blinded',
  'Deafened',
  'Invisible',
  'Incapacitated',
  'Exhaustion',
  'Unconscious',
  'Petrified',
]

export function conditionTooltip(name) {
  const c = CONDITIONS[name]
  if (!c) return name
  return `${c.summary}\n\n${c.rules.map((r) => `• ${r}`).join('\n')}`
}
