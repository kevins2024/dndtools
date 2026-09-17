const languages = require('../../data/5e/languages.json')

// The 16 real PHB "Standard"/"Exotic" languages a player can actually choose
// for a background's or species' "N languages of your choice" grant.
// Deliberately excludes Druidic and Thieves' Cant (secret, not chosen this
// way) and monster-only languages (e.g. Sphinx, Aarakocra) — same "real
// options a player would actually pick from" scoping as skills.json.
function listLanguages() {
  return languages
}

function loadLanguage(id) {
  return (
    languages.find(
      (l) => l.id === id || l.name.toLowerCase() === String(id).toLowerCase()
    ) || null
  )
}

module.exports = { listLanguages, loadLanguage }
