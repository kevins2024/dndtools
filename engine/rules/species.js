const species = require('../data/species.json')

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function loadSpecies(name) {
  return (
    species.find((s) => s.name.toLowerCase() === String(name).toLowerCase()) ||
    null
  )
}

function listSpecies() {
  return species.map((s) => ({ name: s.name }))
}

// scores: {str,dex,con,int,wis,cha}. `choice`: { abilities: [...] } — required only
// when the species has a flexible bonus (e.g. Half-Elf's +1 to two of your choice).
function applySpeciesBonus(scores, speciesName, choice = {}) {
  const sp = loadSpecies(speciesName)
  if (!sp) {
    return {
      scores,
      notes: [
        `"${speciesName}" isn't in the species catalog — no bonus applied.`,
      ],
    }
  }

  const next = { ...scores }
  for (const [ability, amount] of Object.entries(
    sp.ability_score_bonus || {}
  )) {
    next[ability] = (next[ability] ?? 10) + amount
  }

  if (sp.choice) {
    const picks = choice.abilities || []
    if (picks.length !== sp.choice.count) {
      throw new Error(
        `${speciesName} requires choosing ${sp.choice.count} abilities for its flexible bonus, got ${picks.length}.`
      )
    }
    for (const ability of picks) {
      if (!ABILITIES.includes(ability))
        throw new Error(`Unknown ability "${ability}".`)
      if (sp.choice.exclude?.includes(ability)) {
        throw new Error(
          `${ability.toUpperCase()} can't be chosen for ${speciesName}'s flexible bonus — already fixed.`
        )
      }
      next[ability] = (next[ability] ?? 10) + sp.choice.amount
    }
  }

  return { scores: next, notes: [] }
}

module.exports = { loadSpecies, listSpecies, applySpeciesBonus }
