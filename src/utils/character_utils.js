export const GENDERS = ['Male', 'Female']

export const GENERA = [
  'Human',
  'Yetgresian Human',
  'Halfling',
  'Elf',
  'Eladrin',
  'Drow',
  'Half-Elf',
  'Dwarf',
  'Duergar',
  'Gnome',
  'Deep Gnome',
  'Surface Deep Gnome',
  'Orc',
  'Half-Orc',
  'Dragonborn',
  'Tiefling',
  'Goliath',
  'Aasimar',
  'Aarakocra',
  'Genasi (Air)',
  'Genasi (Earth)',
  'Genasi (Fire)',
  'Genasi (Water)',
  'Drevani',
  'Oldwood Troll',
  'Satyr',
]

export const GENERA_DEFAULT_OFF = new Set(['Satyr'])

export const CLASSES = [
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
  'Artificer',
  'Hybrid',
]

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateCharacter(
  enabledGenders,
  enabledGenera,
  enabledClasses
) {
  const gender = pick(enabledGenders)
  const genus = pick(enabledGenera)
  let cls = pick(enabledClasses)

  if (cls === 'Hybrid') {
    const nonHybrid = enabledClasses.filter((c) => c !== 'Hybrid')
    if (nonHybrid.length >= 2) {
      const a = pick(nonHybrid)
      const b = pick(nonHybrid.filter((c) => c !== a))
      cls = `${a} / ${b}`
    }
  }

  return { gender, genus, cls }
}
