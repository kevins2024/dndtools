const feats = require('../../data/5e/feats.json')
const { normalizeRuleset, loadRulesetJson } = require('./ruleset')

// Under '2024' a rewritten feat comes from data/5e2024/feats.json; any other
// 2014 feat (Metamagic Adept, Mobile...) is still usable and is returned tagged
// `legacy: true`. A 2014 request is exactly what it always was.
function loadFeat(featName, ruleset) {
  if (normalizeRuleset(ruleset) === '2024') {
    const own = loadRulesetJson('2024', 'feats.json')?.[featName]
    if (own) return own
    const old = feats[featName]
    return old ? { ...old, legacy: true } : null
  }
  return feats[featName] || null
}

// [{ name, ...feat }] — the 2024 feats plus (under 2024) the 2014 feats that
// were not rewritten.
function listFeats(ruleset) {
  const old = Object.entries(feats).filter(([k]) => !k.startsWith('_'))
  if (normalizeRuleset(ruleset) !== '2024') {
    return old.map(([name, f]) => ({ name, ...f }))
  }
  const rewritten = loadRulesetJson('2024', 'feats.json') ?? {}
  return [
    ...Object.entries(rewritten).map(([name, f]) => ({ name, ...f })),
    ...old
      .filter(([name]) => !rewritten[name])
      .map(([name, f]) => ({ name, ...f, legacy: true })),
  ]
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

module.exports = { loadFeat, listFeats, isFeatGrantedSpell }
