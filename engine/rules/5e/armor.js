const armorTable = require('../../data/5e/armor.json')

// { base, category } for a real armor type, or undefined for an unknown one
// (homebrew armor supplies its own base/category directly on the item —
// see armorClass.js).
function armorBaseData(armorType) {
  return armorTable[armorType]
}

module.exports = { armorBaseData }
