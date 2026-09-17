function abilityModifier(score) {
  return Math.floor((score - 10) / 2)
}

module.exports = { abilityModifier }
