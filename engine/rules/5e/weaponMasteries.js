// Weapon Mastery (2024 Player's Handbook). A class with the Weapon Mastery feature (Barbarian, Fighter,
// Paladin, Ranger, Rogue) masters a number of kinds of weapon; with a mastered weapon it can use that
// weapon's Mastery property (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex). A character holds one
// feature per mastered kind: { type: 'weaponMastery', weapon: 'dagger', mastery: 'nick', _source: 'Rogue' }.
//
// Each of those classes also says: "Whenever you finish a Long Rest, you can change one kind of weapon you
// chose for this feature to another kind eligible for it." `changeMastery` is that.
//
// Pure, no fs/path (plain JSON requires): browser code requires this leaf file directly
// (src/utils/weaponMasteries.js).

const weaponTable = require('../../data/5e2024/weapons.json')
const masteryText = require('../../data/5e2024/weapon-masteries.json')

const titleCase = (s) =>
  String(s)
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const weapons = () =>
  Object.entries(weaponTable).filter(([k]) => !k.startsWith('_'))

// The kinds of weapon a class may master. Barbarian: Simple or Martial melee; Rogue: Simple, or Martial
// with the Finesse or Light property; Fighter, Paladin and Ranger: any Simple or Martial weapon.
function masteryPool(className) {
  const cls = String(className).toLowerCase()
  return weapons()
    .filter(([, w]) => {
      if (cls === 'barbarian') return w.weapon_type === 'melee'
      if (cls === 'rogue')
        return w.category === 'simple' || w.finesse || w.light
      return true
    })
    .map(([name]) => name)
}

// { name: 'Nick', description } for a mastery id ('nick'), or null
function masteryInfo(id) {
  const m = id ? masteryText[String(id).toLowerCase()] : null
  return m && !String(id).startsWith('_') ? m : null
}

// Every mastered weapon, with what its Mastery property does:
// [{ weapon: 'dagger', weaponName: 'Dagger', mastery: 'nick', masteryName: 'Nick', description, className }]
function masteredWeapons(character) {
  return (character.features ?? [])
    .filter((f) => f.type === 'weaponMastery')
    .map((f) => {
      const mastery = f.mastery ?? weaponTable[f.weapon]?.mastery ?? null
      const info = masteryInfo(mastery)
      return {
        weapon: f.weapon,
        weaponName: titleCase(f.weapon),
        mastery,
        masteryName: info?.name ?? (mastery ? titleCase(mastery) : null),
        description: info?.description ?? null,
        className: f._source,
      }
    })
}

// The Mastery property a kind of weapon has ('dagger' -> Nick), whether or not anyone has mastered it
function masteryOfKind(weapon) {
  const key = String(weapon ?? '').toLowerCase()
  const mastery = weaponTable[key]?.mastery
  const info = masteryInfo(mastery)
  return info
    ? { weapon: key, weaponName: titleCase(key), mastery, ...info }
    : null
}

// The mastery of one weapon, when the character has mastered that kind: for a weapon row on the combat panel
function masteryOfWeapon(character, weaponCategory) {
  const key = String(weaponCategory ?? '').toLowerCase()
  return masteredWeapons(character).find((m) => m.weapon === key) ?? null
}

// What a Long Rest lets this character change: for each class that has mastered weapons, the weapons it can
// swap out and the kinds it can swap in. [{ className, current: ['dagger', ...], options: [...] }]
function masteryChangeOptions(character) {
  const byClass = {}
  for (const f of character.features ?? [])
    if (f.type === 'weaponMastery' && f._source)
      (byClass[f._source] ??= []).push(f.weapon)
  return Object.entries(byClass).map(([className, current]) => ({
    className,
    current,
    options: masteryPool(className).filter((w) => !current.includes(w)),
  }))
}

// Swap one mastered kind of weapon for another. { changed, patch: { features }, reason }
function changeMastery(character, className, fromWeapon, toWeapon) {
  const from = String(fromWeapon).toLowerCase()
  const to = String(toWeapon).toLowerCase()
  const features = character.features ?? []
  const index = features.findIndex(
    (f) =>
      f.type === 'weaponMastery' && f._source === className && f.weapon === from
  )
  if (index < 0)
    return {
      changed: false,
      patch: {},
      reason: `${className} has not mastered ${titleCase(from)}.`,
    }
  if (!masteryPool(className).includes(to))
    return {
      changed: false,
      patch: {},
      reason: `${titleCase(to)} is not a weapon ${className} can master.`,
    }
  if (
    features.some(
      (f) =>
        f.type === 'weaponMastery' && f._source === className && f.weapon === to
    )
  )
    return {
      changed: false,
      patch: {},
      reason: `${className} has already mastered ${titleCase(to)}.`,
    }
  const next = features.slice()
  next[index] = {
    ...features[index],
    name: `Weapon Mastery: ${titleCase(to)}`,
    weapon: to,
    mastery: weaponTable[to].mastery,
  }
  return { changed: true, patch: { features: next } }
}

module.exports = {
  masteryPool,
  masteryInfo,
  masteryOfKind,
  masteredWeapons,
  masteryOfWeapon,
  masteryChangeOptions,
  changeMastery,
}
