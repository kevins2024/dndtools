// 2024 combat actions and the rules that go with them (the 2024 Basic Rules: Playing the Game and
// the Rules Glossary). Reference text only; any number a character's own sheet computes (attack
// bonus, save DC) comes from the engine, not from here.

export const ACTION_GROUPS = [
  {
    id: 'actions',
    label: 'Actions',
    blurb: 'One on your turn, unless a feature gives you more.',
    entries: [
      {
        name: 'Attack',
        text: 'Make one attack with a weapon or an Unarmed Strike.',
      },
      {
        name: 'Dash',
        text: 'Gain extra movement for the rest of the turn equal to your Speed.',
      },
      {
        name: 'Disengage',
        text: "Your movement doesn't provoke Opportunity Attacks for the rest of the turn.",
      },
      {
        name: 'Dodge',
        text: 'Until the start of your next turn, attack rolls against you have Disadvantage if you can see the attacker, and you make Dexterity saving throws with Advantage. You lose this if you are Incapacitated or your Speed is 0.',
      },
      {
        name: 'Help',
        text: 'Assist an ability check: choose one of your skill or tool proficiencies and an ally close enough to help; the ally has Advantage on its next check with it before the start of your next turn.\nAssist an attack: distract an enemy within 5 feet of you; your ally has Advantage on its next attack roll against that enemy before the start of your next turn.\nAdminister first aid: stabilizing a creature at 0 Hit Points takes a DC 10 Wisdom (Medicine) check.',
      },
      {
        name: 'Hide',
        text: "Make a DC 15 Dexterity (Stealth) check. You must be Heavily Obscured or behind Three-Quarters or Total Cover, and out of every enemy's line of sight. On a success you have the Invisible condition, and your check total is the DC for a creature to find you with a Wisdom (Perception) check.\nYou stop being hidden if you make a noise louder than a whisper, an enemy finds you, you make an attack roll, or you cast a spell with a Verbal component.",
      },
      {
        name: 'Influence',
        text: "Make a Charisma (Deception, Intimidation, Performance, or Persuasion) or Wisdom (Animal Handling) check to alter a creature's attitude.\nA willing monster does what you ask and an unwilling one refuses, with no check. A hesitant one needs a check against DC 15 or its Intelligence score, whichever is higher; on a failure you can't try the same approach for 24 hours. A Friendly attitude gives Advantage on the check, Hostile gives Disadvantage.",
      },
      {
        name: 'Magic',
        text: 'Cast a spell, use a magic item, or use a magical feature.',
      },
      {
        name: 'Ready',
        text: 'Choose a trigger and an action (or movement) to take in response to it. When the trigger happens before your next turn, you can use your Reaction to take that action.',
      },
      {
        name: 'Search',
        text: 'Make a Wisdom (Insight, Medicine, Perception, or Survival) check.',
      },
      {
        name: 'Study',
        text: 'Make an Intelligence (Arcana, History, Investigation, Nature, or Religion) check.',
      },
      {
        name: 'Utilize',
        text: 'Use a nonmagical object.',
      },
    ],
  },
  {
    id: 'unarmed',
    label: 'Unarmed Strike',
    blurb: 'Part of the Attack action. Grapple and Shove replace one attack.',
    entries: [
      {
        name: 'Damage',
        text: 'Make an attack roll (Strength modifier + Proficiency Bonus). On a hit it deals Bludgeoning damage equal to 1 + your Strength modifier.',
      },
      {
        name: 'Grapple',
        text: 'The target must be no more than one size larger than you, and you need a free hand. It makes a Strength or Dexterity saving throw (its choice) against DC 8 + your Strength modifier + your Proficiency Bonus. On a failure it has the Grappled condition.',
      },
      {
        name: 'Escaping a grapple',
        text: "A grappled creature can use its action to make a Strength (Athletics) or Dexterity (Acrobatics) check against the same DC. The condition also ends if the grappler is Incapacitated, if the distance between them exceeds the grapple's range, or if the grappler lets go (no action needed).",
      },
      {
        name: 'Shove',
        text: 'The target must be no more than one size larger than you. It makes a Strength or Dexterity saving throw (its choice) against DC 8 + your Strength modifier + your Proficiency Bonus. On a failure you either push it 5 feet away from you or knock it Prone.',
      },
    ],
  },
  {
    id: 'other',
    label: 'Other combat rules',
    blurb:
      'Bonus Actions, Reactions, and the attacks that happen outside your turn.',
    entries: [
      {
        name: 'Bonus Action',
        text: 'One per turn, and only when a feature, spell, or other effect says you can. If you have more than one, you choose which to use. Anything that stops you taking actions also stops Bonus Actions.',
      },
      {
        name: 'Reaction',
        text: "An instant response to a trigger, on your turn or someone else's. You get one, and it refreshes at the start of your next turn. It happens right after its trigger unless it says otherwise.",
      },
      {
        name: 'Opportunity Attack',
        text: 'When a creature you can see leaves your reach (using its action, Bonus Action, Reaction, or one of its Speeds), you can use your Reaction to make one melee attack with a weapon or an Unarmed Strike against it. The attack happens right before it leaves your reach. The Disengage action prevents it for the rest of the turn; teleporting never provokes it.',
      },
      {
        name: 'Improvised Weapon',
        text: "Don't add your Proficiency Bonus to the attack roll. On a hit it deals 1d4 damage of a type the DM thinks fits. Thrown range 20/60 feet. A weapon used against its design (a bow as a club, a melee weapon thrown without the Thrown property) counts as improvised.",
      },
      {
        name: 'Typical Difficulty Classes',
        text: '5 very easy · 10 easy · 15 medium · 20 hard · 25 very hard · 30 nearly impossible. The DM sets the DC for any check.',
      },
    ],
  },
]
