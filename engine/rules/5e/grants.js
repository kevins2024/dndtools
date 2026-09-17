const feats = require('../../data/5e/feats.json')

function loadFeat(featName) {
  return feats[featName] || null
}

// True if `spellName` is a spell that `featName` legitimately grants outside
// the character's normal known-spell budget (a "fixed" grant, or a name that
// appears in the feat's own list of already-chosen "choice" picks — choice
// picks are recorded on the character, not the feat, since they're a player
// decision, not a class rule).
function isFeatGrantedSpell(featName, spellName) {
  const feat = loadFeat(featName)
  if (!feat || !feat.grants_spells) return false
  return feat.grants_spells.fixed.includes(spellName)
}

module.exports = { loadFeat, isFeatGrantedSpell }
