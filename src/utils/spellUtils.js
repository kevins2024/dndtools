/**
 * spellUtils.js — the UI-side half of "what spells does this character have?"
 *
 * The aggregation itself (getCharacterSpells, the subclass bonus-spell table,
 * item-granted spell normalization, prepared-caster rules) lives in
 * engine/rules/5e/ — moved there 2026-10-01 — and is re-exported below so
 * existing imports keep working. What stays here is the one part that can't
 * move: the per-class spell LISTS, built from the merged 2024 spell data in src/data/
 * (utils/spells2024.js).
 */

import { classSpellList2024 } from '@/utils/spells2024'

const CLASS_NAMES = {
  cleric: 'Cleric',
  druid: 'Druid',
  wizard: 'Wizard',
  paladin: 'Paladin',
  ranger: 'Ranger',
  bard: 'Bard',
  sorcerer: 'Sorcerer',
  warlock: 'Warlock',
  artificer: 'Artificer',
}

/**
 * Returns the class spell list (2024 lists, utils/spells2024.js) for a character's class, or null if the
 * class casts no spells from a list. Each entry: { index, name, level }
 */
export function getClassSpellList(character) {
  for (const cc of character?.classes ?? []) {
    const cls = cc.name.toLowerCase()
    for (const [key, name] of Object.entries(CLASS_NAMES)) {
      if (cls.includes(key)) return classSpellList2024(name)
    }
  }
  return null
}

export {
  usesFullClassList,
  getBonusSpellsAtLevel,
  getCharacterSpells,
  characterHasSpells,
} from '@/utils/characterSpells.js'

// Whether a character has a class that prepares spells daily (Cleric, Druid,
// Wizard, Paladin, Artificer) rather than a fixed known-spell list (Bard,
// Sorcerer, Warlock, 2014 Ranger). The rule — and the prepared-spell limit
// itself — lives in engine/rules/5e/preparedSpells.js.
export { isPreparedCaster } from '@/utils/preparedSpells.js'
