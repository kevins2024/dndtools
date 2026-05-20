export const GENDERS = ['Male', 'Female', 'Nonbinary']

export const RACES = [
  'Aasimar', 'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Goliath',
  'Halfling', 'Human', 'Orc', 'Tiefling', 'Exotic',
]

export const CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
  'Artificer', 'Hybrid',
]

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateCharacter(enabledGenders, enabledRaces, enabledClasses) {
  const gender = pick(enabledGenders)
  const race   = pick(enabledRaces)
  let cls      = pick(enabledClasses)

  if (cls === 'Hybrid') {
    const nonHybrid = enabledClasses.filter((c) => c !== 'Hybrid')
    if (nonHybrid.length >= 2) {
      const a = pick(nonHybrid)
      const b = pick(nonHybrid.filter((c) => c !== a))
      cls = `${a} / ${b}`
    }
  }

  return { gender, race, cls }
}
