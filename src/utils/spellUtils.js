/**
 * spellUtils.js — the UI-side half of "what spells does this character have?"
 *
 * The aggregation itself (getCharacterSpells, the subclass bonus-spell table,
 * item-granted spell normalization, prepared-caster rules) lives in
 * engine/rules/5e/ — moved there 2026-10-01 — and is re-exported below so
 * existing imports keep working. What stays here is the one part that can't
 * move: the per-class cached spell LISTS, which live in src/data/ (engine/
 * doesn't read src/data).
 */

import clericSpells from '@/data/api_data_cache/cleric_spells.json'
import druidSpells from '@/data/api_data_cache/druid_spells.json'
import wizardSpells from '@/data/api_data_cache/wizard_spells.json'
import paladinSpells from '@/data/api_data_cache/paladin_spells.json'
import rangerSpells from '@/data/api_data_cache/ranger_spells.json'
import bardSpells from '@/data/api_data_cache/bard_spells.json'
import sorcererSpells from '@/data/api_data_cache/sorcerer_spells.json'
import warlockSpells from '@/data/api_data_cache/warlock_spells.json'
import artificerSpells from '@/data/api_data_cache/artificer_spells.json'

const CLASS_SPELL_LISTS = {
  cleric: clericSpells,
  druid: druidSpells,
  wizard: wizardSpells,
  paladin: paladinSpells,
  ranger: rangerSpells,
  bard: bardSpells,
  sorcerer: sorcererSpells,
  warlock: warlockSpells,
  artificer: artificerSpells,
}

/**
 * Returns the official class spell list for a character's class, or null if none is available.
 * Each entry: { index, name, level }
 */
export function getClassSpellList(character) {
  for (const cc of character?.classes ?? []) {
    const cls = cc.name.toLowerCase()
    for (const [key, list] of Object.entries(CLASS_SPELL_LISTS)) {
      if (cls.includes(key)) return list
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
