// Heroic Inspiration (2024 Player's Handbook, "Playing the Game"). A character either has it or does not
// (`character.heroic_inspiration`). The DM awards it for something heroic, in character or entertaining; a
// rule can give it too (Human Resourceful: every Long Rest).
//
//   - Spend it to reroll any die immediately after rolling it, and use the new roll.
//   - Never more than one. If something gives it to you and you already have it, you can give it to a
//     player character in your group who lacks it.
//
// Pure, no fs/path: browser code requires this leaf file directly (src/utils/heroicInspiration.js).

const RULE = {
  name: 'Heroic Inspiration',
  source: "Player's Handbook (2024), Playing the Game",
  summary:
    'Spend it to reroll any die right after rolling it, and use the new roll. You can only have one.',
  text: [
    'Sometimes the DM or a rule gives you Heroic Inspiration. If you have it, you can expend it to reroll any die immediately after rolling it, and you must use the new roll.',
    'You can never have more than one instance of Heroic Inspiration. If something gives you Heroic Inspiration and you already have it, you can give it to a player character in your group who lacks it.',
    'Your DM can give you Heroic Inspiration, typically when you do something particularly heroic, in character, or entertaining. Other rules can give it to you too: Human characters start each day with Heroic Inspiration.',
  ],
}

const hasHeroicInspiration = (character) =>
  character.heroic_inspiration === true

// Give a character Heroic Inspiration. { granted, patch, reason }: when they already have it nothing
// changes and `recipients` names the party members who lack it, who the extra one can go to instead.
function grantHeroicInspiration(character, party = []) {
  if (!hasHeroicInspiration(character))
    return { granted: true, patch: { heroic_inspiration: true } }
  return {
    granted: false,
    patch: {},
    reason: `${character.name} already has Heroic Inspiration (never more than one).`,
    recipients: party
      .filter((c) => c.name !== character.name && !hasHeroicInspiration(c))
      .map((c) => c.name),
  }
}

// Expend it. { spent, patch }.
function spendHeroicInspiration(character) {
  if (!hasHeroicInspiration(character))
    return {
      spent: false,
      patch: {},
      reason: `${character.name} has no Heroic Inspiration.`,
    }
  return { spent: true, patch: { heroic_inspiration: false } }
}

module.exports = {
  RULE,
  hasHeroicInspiration,
  grantHeroicInspiration,
  spendHeroicInspiration,
}
