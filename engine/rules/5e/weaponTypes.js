const weaponTypes = require('../../data/5e/weapon-types.json')

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

// Names are already lowercase in the catalog (matching this app's
// weapon_proficiencies convention) — returned as-is, no case conversion.
function listOneHandedMeleeWeapons() {
  return weaponTypes.one_handed_melee
}

function isOneHandedMeleeWeapon(name) {
  return weaponTypes.one_handed_melee.some(
    (w) => normalizeName(w.name) === normalizeName(name)
  )
}

module.exports = { listOneHandedMeleeWeapons, isOneHandedMeleeWeapon }
