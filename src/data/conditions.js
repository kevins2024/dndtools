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
    summary:
      'Leveled 1-2 (homebrew, tracked like Exhaustion). Level 1: disadvantage on attack rolls and ability checks. Level 2: also 1d4 poison damage at the start of each of your turns, and the first attack against you each round has advantage.',
    rules: [
      'Level 1 — Disadvantage on attack rolls.',
      'Level 1 — Disadvantage on ability checks.',
      'Level 2 (homebrew) — Reached by failing a saving throw against a poison effect with a natural 1 on the die.',
      'Level 2 (homebrew) — All Level 1 effects, plus: take 1d4 poison damage at the start of each of your turns.',
      'Level 2 (homebrew) — The first attack roll made against you each round has advantage.',
    ],
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
  Muddled: {
    summary:
      'Synaptic Static: subtract 1d6 from attack rolls, ability checks, and CON saves to maintain concentration.',
    rules: [
      'Roll a d6 at the start of each affected action and subtract the result from attack rolls and ability checks.',
      'Also subtract the d6 from Constitution saving throws made to maintain concentration.',
      'At the end of each of its turns, the target may make an Intelligence saving throw to end this effect.',
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
  Bardic: {
    summary:
      'Holding a Bardic Inspiration die. Add it to one attack roll, ability check, or saving throw.',
    rules: [
      'Add the inspiration die to one ability check, attack roll, or saving throw made within the next 10 minutes (or longer with Font of Inspiration).',
      'Choose to add it after making the roll but before the result is announced.',
      'A creature can hold only one Bardic Inspiration die at a time.',
    ],
  },
  Haste: {
    summary:
      'Speed doubled, +2 AC, advantage on DEX saves, one extra action each turn.',
    rules: [
      'Speed is doubled.',
      '+2 bonus to AC.',
      'Advantage on Dexterity saving throws.',
      'Gains one additional action each turn: Attack (one weapon attack only), Dash, Disengage, Hide, or Use an Object.',
      "Can't cast spells with the extra action.",
      "When the effect ends, the target can't move or take actions or reactions until after its next turn (unless the haste was ended by the target being reduced to 0 HP or otherwise incapacitated).",
    ],
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

// Beneficial vs. detrimental classification, used to visually separate
// condition chips (pill = beneficial, pointed = detrimental) and to order
// them: beneficial first, then detrimental, alphabetical within each group.
export const POSITIVE_CONDITION_NAMES = [
  'Bardic',
  'Blessed',
  'Concentrating',
  'Haste',
]

export const NEGATIVE_CONDITION_NAMES = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Hexed',
  'Incapacitated',
  'Invisible',
  'Muddled',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
]

export function isPositiveCondition(name) {
  return POSITIVE_CONDITION_NAMES.includes(name)
}

// Sorts a list of condition names beneficial-first, alphabetically within
// each group. Unrecognized names (e.g. custom GM-typed conditions) sort as
// detrimental, last.
export function sortConditionNames(names) {
  return [...names].sort((a, b) => {
    const pa = isPositiveCondition(a)
    const pb = isPositiveCondition(b)
    if (pa !== pb) return pa ? -1 : 1
    return a.localeCompare(b)
  })
}

// Ordered list for display (beneficial first, alphabetical within each group)
export const CONDITION_NAMES = sortConditionNames([
  ...POSITIVE_CONDITION_NAMES,
  ...NEGATIVE_CONDITION_NAMES,
])

export function conditionTooltip(name) {
  const c = CONDITIONS[name]
  if (!c) return name
  return `${c.summary}\n\n${c.rules.map((r) => `• ${r}`).join('\n')}`
}
