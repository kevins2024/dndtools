const backgrounds = require('../data/backgrounds.json')

// A deliberately curated subset (40, see engine/CHECKLIST.md) of the ~360
// unique backgrounds across all published sourcebooks — each real, verified
// against a reference skill-proficiency table (not guessed from memory; an
// earlier pass mis-attributed a couple of these to the wrong sourcebook from
// memory alone, caught and corrected before this file was written), each with
// a clean fixed two-skill grant. Backgrounds whose RAW skill list involves a
// player choice (e.g. Cloistered Scholar, Faction Agent) are deliberately
// left out rather than guessed at with an arbitrary default pick.
//
// Plus one deliberate homebrew exception: "Born Adventurer" — no real
// background lets you freely pick any two of the 18 skills (every published
// one has a fixed or narrowly-choice-limited list), so it's flagged
// `homebrew: true` with an empty `skill_proficiencies` and a `free_choice`
// marker instead. No RAW rule restricts which skills a background can grant
// — a real-data tally across ~150 published background instances shows every
// skill appears at least a handful of times (Medicine rarest, Athletics/
// Persuasion/Insight most common) — so no skill is excluded from the choice.
function listBackgrounds() {
  return backgrounds
}

function loadBackground(name) {
  return (
    backgrounds.find(
      (b) => b.name.toLowerCase() === String(name).toLowerCase()
    ) || null
  )
}

module.exports = { listBackgrounds, loadBackground }
