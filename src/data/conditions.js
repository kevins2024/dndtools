// 2024 condition definitions (the 2024 glossary; spell and feature text from the 2024 data).
// Each entry has a summary line and bullet rules. Poisoned's level 2 is a house rule (see its entry).
// Used for hover tooltips on condition chips throughout the app.

export const CONDITIONS = {
  Blinded: {
    summary:
      "Can't see. Attacks against it have Advantage; its attacks have Disadvantage.",
    rules: [
      "Can't see, and automatically fails any ability check that requires sight.",
      'Attack rolls against it have Advantage.',
      'Its attack rolls have Disadvantage.',
    ],
  },
  Charmed: {
    summary:
      "Can't harm the charmer. The charmer has Advantage on social checks against it.",
    rules: [
      "Can't attack the charmer or target them with damaging abilities or magical effects.",
      'The charmer has Advantage on any ability check to interact with it socially.',
    ],
  },
  Deafened: {
    summary: "Can't hear.",
    rules: [
      "Can't hear, and automatically fails any ability check that requires hearing.",
    ],
  },
  Exhaustion: {
    summary: 'Each level: -2 to D20 Tests and -5 ft. Speed. Death at level 6.',
    rules: [
      'Levels stack. Reaching level 6 means death.',
      'D20 Tests (attack rolls, saving throws, ability checks) are reduced by 2 x the exhaustion level.',
      'Speed is reduced by 5 feet x the exhaustion level.',
      'Finishing a Long Rest removes 1 level; the condition ends at level 0.',
    ],
  },
  Frightened: {
    summary:
      'Disadvantage on checks and attacks while the source of fear is in sight. Cannot move closer.',
    rules: [
      'Disadvantage on ability checks and attack rolls while the source of its fear is in line of sight.',
      "Can't willingly move closer to the source of its fear.",
    ],
  },
  Grappled: {
    summary:
      'Speed 0. Disadvantage on attacks against anyone but the grappler.',
    rules: [
      'Speed is 0 and cannot increase.',
      'Disadvantage on attack rolls against any target other than the grappler.',
      'The grappler can drag or carry it; each foot of that movement costs the grappler 1 extra foot (unless the target is Tiny or two or more sizes smaller).',
      "Ends if the grappler is Incapacitated, or if an effect moves it out of the grappler's reach.",
    ],
  },
  Incapacitated: {
    summary:
      "Can't take actions, Bonus Actions or Reactions; can't speak; loses Concentration.",
    rules: [
      "Can't take any action, Bonus Action, or Reaction.",
      'Concentration is broken.',
      "Can't speak.",
      'If Incapacitated when it rolls Initiative, it has Disadvantage on that roll.',
    ],
  },
  Invisible: {
    summary:
      'Unseen unless a sense reveals it. Attacks against it have Disadvantage; its attacks have Advantage. Advantage on Initiative.',
    rules: [
      "Isn't affected by any effect that needs its target to be seen, unless the effect's creator can see it. Worn and carried gear is hidden too.",
      'Attack rolls against it have Disadvantage; its attack rolls have Advantage. This does not apply against a creature that can somehow see it.',
      'Advantage on Initiative rolls.',
    ],
  },
  Paralyzed: {
    summary:
      'Incapacitated, Speed 0. Auto-fail STR/DEX saves. Attacks against it have Advantage; hits within 5 ft. are critical.',
    rules: [
      'Incapacitated.',
      'Speed is 0 and cannot increase.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against it have Advantage.',
      'Any attack that hits it is a Critical Hit if the attacker is within 5 feet.',
    ],
  },
  Petrified: {
    summary:
      'Turned to stone. Incapacitated, Speed 0, auto-fail STR/DEX saves, resists all damage, immune to Poisoned.',
    rules: [
      'Turned into a solid inanimate substance (with its worn and carried nonmagical gear); weight x10; stops aging.',
      'Incapacitated, Speed 0 and cannot increase; unaware of its surroundings.',
      'Attack rolls against it have Advantage.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Resistance to all damage.',
      'Immune to the Poisoned condition.',
    ],
  },
  Poisoned: {
    summary:
      'Disadvantage on attack rolls and ability checks. Homebrew: leveled 1-2, tracked like Exhaustion.',
    rules: [
      'Level 1 (the 2024 Poisoned condition) — Disadvantage on attack rolls and on ability checks.',
      'Level 2 (homebrew) — Reached by failing a saving throw against a poison effect with a natural 1 on the die.',
      'Level 2 (homebrew) — All Level 1 effects, plus: take 1d4 poison damage at the start of each of your turns.',
      'Level 2 (homebrew) — The first attack roll made against you each round has Advantage.',
    ],
  },
  Prone: {
    summary:
      'Disadvantage on attacks. Attacks within 5 ft. have Advantage; farther ones have Disadvantage. Standing costs half Speed.',
    rules: [
      'Only movement options are crawling, or spending half its Speed (rounded down) to stand up.',
      'Its attack rolls have Disadvantage.',
      'An attack roll against it has Advantage if the attacker is within 5 feet; otherwise it has Disadvantage.',
    ],
  },
  Restrained: {
    summary:
      'Speed 0. Its attacks have Disadvantage; attacks against it have Advantage. Disadvantage on DEX saves.',
    rules: [
      'Speed is 0 and cannot increase.',
      'Attack rolls against it have Advantage.',
      'Its attack rolls have Disadvantage.',
      'Disadvantage on Dexterity saving throws.',
    ],
  },
  Stunned: {
    summary:
      'Incapacitated. Auto-fail STR/DEX saves. Attacks against it have Advantage.',
    rules: [
      'Incapacitated.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against it have Advantage.',
    ],
  },
  Unconscious: {
    summary:
      'Incapacitated and Prone, drops what it holds. Auto-fail STR/DEX saves. Attacks have Advantage; hits within 5 ft. are critical.',
    rules: [
      'Incapacitated and Prone; drops anything it is holding. Stays Prone after the condition ends.',
      'Speed is 0 and cannot increase.',
      'Attack rolls against it have Advantage.',
      'Automatically fails Strength and Dexterity saving throws.',
      'Any attack that hits it is a Critical Hit if the attacker is within 5 feet.',
      'Unaware of its surroundings.',
    ],
  },
  Muddled: {
    summary:
      'Synaptic Static (muddled thoughts): subtract 1d6 from attack rolls, ability checks, and CON saves to maintain Concentration.',
    rules: [
      'Lasts 1 minute, after a failed Intelligence save against Synaptic Static.',
      'Subtract 1d6 from all its attack rolls and ability checks.',
      'Also subtract 1d6 from Constitution saving throws made to maintain Concentration.',
      'At the end of each of its turns it makes an Intelligence saving throw, ending the effect on itself on a success.',
    ],
  },
  Concentrating: {
    summary:
      'Maintaining a concentration spell. Taking damage requires a CON save (DC 10 or half the damage, whichever is higher, max DC 30) or the spell ends.',
    rules: [
      'Taking damage requires a Constitution saving throw: DC 10 or half the damage taken (rounded down), whichever is higher, up to a maximum DC of 30.',
      'On a failed save the concentration spell ends.',
      'Only one concentration effect can be active at a time; casting another ends the first.',
      'Being Incapacitated or killed also ends concentration.',
    ],
  },
  Blessed: {
    summary: '+1d4 to attack rolls and saving throws (Bless).',
    rules: ['Add 1d4 to each attack roll.', 'Add 1d4 to each saving throw.'],
  },
  Bardic: {
    summary:
      'Holding a Bardic Inspiration die: once within the hour, add it to a D20 Test the creature fails.',
    rules: [
      'Once within the next hour, when the creature fails a D20 Test (attack roll, saving throw, or ability check), it can roll the die and add the result to the d20, possibly turning the failure into a success.',
      'The die is expended when rolled.',
      'A creature can hold only one Bardic Inspiration die at a time.',
    ],
  },
  Haste: {
    summary:
      'Speed doubled, +2 AC, Advantage on DEX saves, one extra action each turn.',
    rules: [
      'Speed is doubled.',
      '+2 bonus to AC.',
      'Advantage on Dexterity saving throws.',
      'One additional action each turn: Attack (one attack only), Dash, Disengage, Hide, or Utilize.',
      'When the spell ends the target is Incapacitated and has Speed 0 until the end of its next turn.',
    ],
  },
  Hexed: {
    summary:
      'The caster deals +1d6 Necrotic on each hit; Disadvantage on checks with one chosen ability.',
    rules: [
      'The caster deals an extra 1d6 Necrotic damage to it whenever they hit it with an attack roll.',
      'Disadvantage on ability checks made with the ability the caster chose.',
    ],
  },
  Raging: {
    summary:
      'Advantage on STR checks/saves, bonus Strength damage, resistance to bludgeoning/piercing/slashing. No spells or Concentration.',
    rules: [
      'Advantage on Strength checks and Strength saving throws.',
      'Bonus damage on attacks made with Strength (weapon or Unarmed Strike); it grows with Barbarian level.',
      'Resistance to Bludgeoning, Piercing, and Slashing damage.',
      "Can't maintain Concentration and can't cast spells.",
      "Lasts until the end of the barbarian's next turn; it can be extended each turn by attacking a creature, forcing a saving throw, or using a Bonus Action. It ends early in Heavy armor or when Incapacitated (maximum 10 minutes).",
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
  'Raging',
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
