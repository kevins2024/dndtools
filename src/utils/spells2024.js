// The spells the app shows, under the 2024 rules: what the 2024 books rewrote (src/data/spells_2024.json)
// over the 2014 spells they did not (tagged `legacy: true`), with published and homebrew spells over the
// 2014 SRD. The merge is engine/rules/5e/spellIndex.js, the same one the server's spell lists use, so the
// browser and the engine never disagree about which text and which class list a spell has.
import srd from '@/data/api_data_cache/srd_spells_full.json'
import published from '@/data/published_spells.json'
import spells2024 from '@/data/spells_2024.json'

const spellIndex = require('../../engine/rules/5e/spellIndex')

const { index2024 } = spellIndex.buildSpellIndexes(srd, published, spells2024)

export const allSpells2024 = () => [...index2024.values()]
export const findSpell2024 = (name) =>
  index2024.get(String(name).toLowerCase().trim()) ?? null
// [{ index, name, level }] for a class, by level then name
export const classSpellList2024 = (className) =>
  spellIndex.classSpellList(index2024, className)

// Which bucket a spell belongs to in the browser's source filter.
export function spellSource(spell) {
  if (spell.homebrew) return { key: 'homebrew', book: 'Homebrew' }
  if (spell.ruleset === '2024' && !spell.legacy)
    return { key: 'core', book: spell.source ?? '2024 rules' }
  if (spell.legacy && spell.index) return { key: 'legacy', book: 'SRD (2014)' }
  return { key: 'published', book: spell.source ?? 'Published' }
}
