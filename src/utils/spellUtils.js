/**
 * spellUtils.js — single source of truth for "what spells does this character have?"
 *
 * Add new spell sources here; Spellbook and CombatPanel pick them up automatically.
 *
 * Sources collected (in priority order for deduplication):
 *   1. character.spells[]                  — main class list; homebrew spells live here too (homebrew: true)
 *   2. character.artillerist_spells.spells — Artificer subclass always-prepared spells
 *   3. character.features[].spells_granted — feats / race / class features
 *   4. partyItems[].spells_granted         — equipped + attuned magic items
 *
 * Each returned spell object has the original fields plus:
 *   _source      {string}  — human-readable origin label
 *   artillerist  {bool}    — true if from artillerist_spells
 *   featureGranted {bool}  — true if from a feature's spells_granted
 *   itemGranted  {bool}    — true if from an equipped item's spells_granted
 *   homebrew     {bool}    — true if spell is homebrew (set on the spell entry in character.spells)
 *
 * Deduplication: sources 1-3 deduplicate by spell name (first wins).
 * Item-granted spells (source 4) are always added alongside class/feature versions —
 * if a character knows a spell AND an item grants it, both appear with distinct _source labels
 * so the player can see which is always-prepared vs. counted against their limit.
 */

import clericSpells from '@/data/api_data_cache/cleric_spells.json'
import druidSpells from '@/data/api_data_cache/druid_spells.json'
import wizardSpells from '@/data/api_data_cache/wizard_spells.json'
import paladinSpells from '@/data/api_data_cache/paladin_spells.json'
import rangerSpells from '@/data/api_data_cache/ranger_spells.json'
import bardSpells from '@/data/api_data_cache/bard_spells.json'
import sorcererSpells from '@/data/api_data_cache/sorcerer_spells.json'
import warlockSpells from '@/data/api_data_cache/warlock_spells.json'

// Classes whose spell list lets them prepare ANY listed spell daily (not just ones they've "learned").
// Wizards prepare from their spellbook (character.spells) — a separate concept.
const FULL_CLASS_LIST_CLASSES = ['cleric', 'druid', 'paladin', 'ranger']

const CLASS_SPELL_LISTS = {
  cleric: clericSpells,
  druid: druidSpells,
  wizard: wizardSpells,
  paladin: paladinSpells,
  ranger: rangerSpells,
  bard: bardSpells,
  sorcerer: sorcererSpells,
  warlock: warlockSpells,
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

/**
 * Returns true if this character's class can prepare from the full class spell list
 * (as opposed to only from spells they've explicitly added to their spellbook).
 */
export function usesFullClassList(character) {
  return (character?.classes ?? []).some((cc) =>
    FULL_CLASS_LIST_CLASSES.some((c) => cc.name.toLowerCase().includes(c))
  )
}

export function getCharacterSpells(character, partyItems = []) {
  const seen = new Set()
  const result = []

  function add(spell) {
    if (seen.has(spell.name)) return
    seen.add(spell.name)
    result.push(spell)
  }

  // 1. Main class spell list
  for (const s of character.spells ?? []) {
    add({ ...s, _source: 'class' })
  }

  // 2. Artillerist subclass spells (always prepared, don't count against limit)
  for (const s of character.artillerist_spells?.spells ?? []) {
    add({
      name: s.name,
      level: s.level,
      prepared: true,
      artillerist: true,
      _source: 'Artillerist Spells',
    })
  }

  // 3. Feature / feat / race-granted spells
  //    Requires features to have a `spells_granted: ["SpellName", ...]` array.
  //    Add that field to any feature that teaches spells (Shadow Touched, Fey Touched,
  //    Drow Magic, Tiefling Legacy, etc.).
  for (const feat of character.features ?? []) {
    for (const name of feat.spells_granted ?? []) {
      add({
        name,
        level: null, // resolved asynchronously via lookupSpell in loadMeta()
        prepared: true,
        featureGranted: true,
        _source: feat.name,
      })
    }
  }

  // 4. Equipped item-granted spells
  //    Items with `spells_granted: ["SpellName", ...]` contribute when equipped by this
  //    character. If the item requires attunement it must also be attuned.
  //    Item grants are NOT deduplicated against sources 1-3 — if a character knows a
  //    spell through their class AND an item grants it, both entries appear so the player
  //    can distinguish always-prepared (item) from their preparation-limited version.
  const equippedItems = partyItems.filter(
    (i) =>
      i.equipped_by === character.name && (!i.needs_attunement || i.attuned)
  )
  for (const item of equippedItems) {
    for (const name of item.spells_granted ?? []) {
      const key = `\0item\0${item.id}\0${name}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        name,
        level: null,
        prepared: true,
        itemGranted: true,
        _source: item.name,
      })
    }
  }

  return result
}

/** Quick boolean — used by tab visibility checks without building the full list. */
export function characterHasSpells(character, partyItems = []) {
  if (!character) return false
  if ((character.spells ?? []).length > 0) return true
  if ((character.artillerist_spells?.spells ?? []).length > 0) return true
  if (
    (character.features ?? []).some((f) => (f.spells_granted ?? []).length > 0)
  )
    return true
  return partyItems.some(
    (i) =>
      i.equipped_by === character.name &&
      (!i.needs_attunement || i.attuned) &&
      (i.spells_granted ?? []).length > 0
  )
}
