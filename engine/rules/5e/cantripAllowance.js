// Cantrips a character knows beyond the class table, from the sources that grant
// "extra" ones (not the fixed free cantrips that arrive as feature-granted spells):
//   - feature-mechanics `extra_cantrips` (e.g. a homebrew feature that adds some)
//   - High Elf: one cantrip of your choice from the Wizard list (2014 Cantrip trait;
//     2024 Elven Lineage, a replaceable Prestidigitation)
const mechanics = require('../../data/5e/feature-mechanics.json')

function extraCantrips(character) {
  let n = 0
  for (const f of character.features || [])
    n += mechanics[f.id]?.extra_cantrips || 0
  const highElf =
    /high elf/i.test(character.subgenus || '') ||
    /high elf/i.test(character.genus || '') ||
    (character.features || []).some((f) => /high elf/i.test(f.name))
  // A lineage cantrip the sheet already holds as a species-granted spell is counted as that spell,
  // not as one of the class's extra cantrips.
  const grantedByLineage = (character.spells || []).some(
    (s) => s.featureGranted && /high elf|elven lineage/i.test(s._source || '')
  )
  if (highElf && !grantedByLineage) n += 1
  return n
}

module.exports = { extraCantrips }
