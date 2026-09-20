/**
 * spellUtils.js — single source of truth for "what spells does this character have?"
 *
 * Add new spell sources here; Spellbook and CombatPanel pick them up automatically.
 *
 * Sources collected (in priority order for deduplication):
 *   1. character.spells[]                  — main class list; homebrew spells live here too (homebrew: true)
 *      EXCEPT for a Wizard with `spellbook_id` set — see below, source 1 is
 *      replaced entirely for those characters.
 *   1'. Wizard spellbook (character.spellbook_id -> spellbooks[]) — every
 *      Wizard has one (see src/data/spellbooks.json). Two or more Wizards
 *      can point at the SAME spellbook_id, which is the entire mechanism
 *      behind a shared/linked spellbook (Lenn/Lyria/Kessara, Iyani's
 *      mother's gift) — there's no separate "shared spellbook" concept, the
 *      id being shared IS the sharing. What's "prepared" always comes from
 *      the character's OWN character.prepared_spells (a plain list of
 *      names), never from the spellbook entry itself, so preparing a spell
 *      never affects anyone else who shares the same spellbook_id.
 *   2. getBonusSpells(character, subclasses) — subclass always-prepared spells
 *      (Artillerist Bonus Spells, Cleric domain spells, Paladin oath spells,
 *      Druid circle spells, Sorcerer psionic/clockwork spells, etc.), derived
 *      live from the subclass's own data (store.state.subclasses, loaded
 *      once from GET /api/engine/subclasses) rather than stored on the
 *      character — see BONUS_SPELL_FIELDS/getBonusSpells's own comments for
 *      the full field list and why.
 *   3. character.features[].spells_granted — feats / race / class features
 *   4. partyItems[].spells_granted         — equipped + attuned magic items
 *
 * Each returned spell object has the original fields plus:
 *   _source      {string}  — human-readable origin label
 *   bonusSpell   {bool}    — true if from getBonusSpells
 *   featureGranted {bool}  — true if from a feature's spells_granted
 *   itemGranted  {bool}    — true if from an equipped item's spells_granted
 *   homebrew     {bool}    — true if spell is homebrew (set on the spell entry in character.spells)
 *
 * Deduplication: sources 1/1'-3 deduplicate by spell name (first wins).
 * Item-granted spells (source 4) are always added alongside class/feature versions —
 * if a character knows a spell AND an item grants it, both appear with distinct _source labels
 * so the player can see which is always-prepared vs. counted against their limit.
 */

import { dnd } from '@/utils/dnd_utils.js'
import clericSpells from '@/data/api_data_cache/cleric_spells.json'
import druidSpells from '@/data/api_data_cache/druid_spells.json'
import wizardSpells from '@/data/api_data_cache/wizard_spells.json'
import paladinSpells from '@/data/api_data_cache/paladin_spells.json'
import rangerSpells from '@/data/api_data_cache/ranger_spells.json'
import bardSpells from '@/data/api_data_cache/bard_spells.json'
import sorcererSpells from '@/data/api_data_cache/sorcerer_spells.json'
import warlockSpells from '@/data/api_data_cache/warlock_spells.json'
import artificerSpells from '@/data/api_data_cache/artificer_spells.json'

// Classes whose spell list lets them prepare ANY listed spell daily (not just ones they've "learned").
// Wizards prepare from their spellbook (character.spells) — a separate concept.
// Artificer works the same as Cleric/Druid/Paladin/Ranger here (RAW: no
// "known spells" list, no spellbook requirement — prepares from the whole
// class list each long rest) — added 2026-09-19, see TODO_ARCHIVE.md for
// the full story of why it was missing (dnd5eapi.co's SRD API, which
// artificer_spells.json's siblings are all built from, doesn't know
// Artificer exists at all; artificer_spells.json is instead derived from
// this project's own `classes` tagging on srd_spells_full.json/
// published_spells.json).
const FULL_CLASS_LIST_CLASSES = [
  'cleric',
  'druid',
  'paladin',
  'ranger',
  'artificer',
]

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

/**
 * Returns true if this character's class can prepare from the full class spell list
 * (as opposed to only from spells they've explicitly added to their spellbook).
 */
export function usesFullClassList(character) {
  return (character?.classes ?? []).some((cc) =>
    FULL_CLASS_LIST_CLASSES.some((c) => cc.name.toLowerCase().includes(c))
  )
}

// Classes that choose prepared spells daily rather than having a fixed
// "known spells" list that's always ready (Bard/Sorcerer/Warlock/Ranger's
// known-spell variant, etc.). Single source of truth for this — CLASS_SPELL_LISTS/
// FULL_CLASS_LIST_CLASSES above intentionally excludes Wizard (spellbook
// model, not full-list) but Wizard still belongs here since they re-choose
// prepared spells each long rest too, just from their own known list.
export const PREPARED_CASTER_CLASSES = [
  'cleric',
  'druid',
  'wizard',
  'artificer',
  'paladin',
  'ranger',
]
// Half-casters: preparation limit uses ability mod + floor(level / 2).
export const HALF_CASTER_PREPARED_CLASSES = ['paladin', 'ranger', 'artificer']

export function isPreparedCaster(character) {
  return (character?.classes ?? []).some((cc) =>
    PREPARED_CASTER_CLASSES.some((p) => cc.name.toLowerCase().includes(p))
  )
}

// Every subclass field shape this app uses for "you always have these
// spells prepared, they don't count against your limit" — one entry per
// field name, each real subclasses.js field having grown its own name over
// time rather than converging on one (expanded_spell_list predates the
// others; see engine/CHECKLIST.md's per-class build-out entries for
// domain_spells_by_level/oath_spells_by_level/circle_spells_by_level/
// psionic_spells_by_level/clockwork_spells_by_level). `classOnly` scopes a
// field to the one class it actually means this for — critical for
// expanded_spell_list specifically, which Warlock's Great Old One patron
// ALSO uses for a genuinely different mechanic (spells added to the pool a
// warlock can choose to LEARN, never automatic — see the note below).
// `deriveLevel` is only true for expanded_spell_list: Artificer's own real
// per-4-level slot-access schedule happens to make ceil(atLevel/4) exactly
// right (verified in engine/test/artificerSubclasses.test.js) — no such
// universal formula holds for the other fields (e.g. Circle of Spores
// grants a CANTRIP at 2nd level alongside real leveled spells at other
// breakpoints), so those are left level:null and resolved asynchronously
// the same way feature/item-granted spells already are elsewhere in this
// file (CharacterSpellbook.vue's loadMeta() calls lookupSpell for any
// spell with level === null).
const BONUS_SPELL_FIELDS = [
  { field: 'expanded_spell_list', classOnly: 'artificer', deriveLevel: true },
  { field: 'domain_spells_by_level', classOnly: 'cleric', deriveLevel: false },
  { field: 'oath_spells_by_level', classOnly: 'paladin', deriveLevel: false },
  { field: 'circle_spells_by_level', classOnly: 'druid', deriveLevel: false },
  {
    field: 'psionic_spells_by_level',
    classOnly: 'sorcerer',
    deriveLevel: false,
  },
  {
    field: 'clockwork_spells_by_level',
    classOnly: 'sorcerer',
    deriveLevel: false,
  },
  // bonus_spells_by_level: a shared field name across multiple subclasses/
  // classes (Ranger's Gloom Stalker/Fey Wanderer/Swarmkeeper, Sorcerer's
  // Shadow Magic) that never had a swap mechanic or multi-spell-per-tier
  // shape to justify their own flavor-named field the way psionic/clockwork
  // did — one shared name, one entry per class here (getBonusSpells already
  // resolves the character's own specific subclass object first, so two
  // classes sharing a field name is safe, not a collision). Found and wired
  // 2026-09-17 — these 4 subclasses each grant fixed always-prepared spells
  // at real levels but had no BONUS_SPELL_FIELDS entry at all, so none of
  // them ever showed up in a spellbook or a Level Up "you just gained
  // these" breakpoint. See TODO.md and each subclass file's own _notes.
  { field: 'bonus_spells_by_level', classOnly: 'ranger', deriveLevel: false },
  {
    field: 'bonus_spells_by_level',
    classOnly: 'sorcerer',
    deriveLevel: false,
  },
  // NOT included: land_spells_by_type (Circle of the Land) — keyed by land
  // TYPE, not level, so it needs the character's chosen type recorded
  // somewhere first. No character on the roster has picked this circle yet
  // and no such field exists on the character schema — add it here once one
  // does, rather than inventing a schema field with no real example to
  // build it against.
]

// Derives a character's subclass-granted bonus spells (Artillerist Bonus
// Spells, Cleric domain spells, Paladin oath spells, etc.) straight from the
// subclass's own data (see BONUS_SPELL_FIELDS above), rather than trusting a
// per-character copy that has to be hand-maintained and can drift out of
// sync (e.g. holding stale entries after a rebuild, or simply never getting
// backfilled on a new character). `subclasses` is the full list from GET
// /api/engine/subclasses (store.state.subclasses).
function getBonusSpells(character, subclasses = []) {
  const result = []
  for (const cc of character.classes ?? []) {
    if (!cc.subclass) continue
    const sub = subclasses.find(
      (s) =>
        s.class?.toLowerCase() === cc.name?.toLowerCase() &&
        s.name?.toLowerCase() === cc.subclass?.toLowerCase()
    )
    if (!sub) continue
    const className = cc.name?.toLowerCase()
    for (const { field, classOnly, deriveLevel } of BONUS_SPELL_FIELDS) {
      if (className !== classOnly) continue
      const table = sub[field]
      if (!table) continue
      for (const [atLevel, names] of Object.entries(table)) {
        if (!Array.isArray(names)) continue // defensive: a mis-shaped table entry shouldn't crash the whole spellbook
        if (Number(atLevel) > (cc.level ?? 0)) continue
        const spellLevel = deriveLevel ? Math.ceil(Number(atLevel) / 4) : null
        for (const name of names) {
          result.push({ name, level: spellLevel })
        }
      }
    }
  }
  return result
}

// Spell names ONE of a subclass's bonus-spell fields grants at EXACTLY one
// character level — used by LevelUpTool.vue to show "you just gained these"
// at a breakpoint that doesn't re-grant any named feature (true for every
// field here except expanded_spell_list's own "Bonus Spells" feature, which
// LevelUpTool.vue handles separately via its own tooltip override). Checks
// the same BONUS_SPELL_FIELDS list/class-gating getBonusSpells uses, so a
// Warlock's Great Old One never matches here either. `subclassData` is one
// entry from store.state.subclasses (already resolved by class+subclass
// name), not the whole array.
export function getBonusSpellsAtLevel(subclassData, className, level) {
  const cls = className?.toLowerCase()
  for (const { field, classOnly } of BONUS_SPELL_FIELDS) {
    if (cls !== classOnly) continue
    const names = subclassData?.[field]?.[String(level)]
    if (Array.isArray(names) && names.length) return names
  }
  return []
}

export function getCharacterSpells(
  character,
  partyItems = [],
  subclasses = [],
  spellbooks = []
) {
  const seen = new Set()
  const result = []

  function add(spell) {
    if (seen.has(spell.name)) return
    seen.add(spell.name)
    result.push(spell)
  }

  // 1 / 1'. Known spells. A Wizard with spellbook_id set reads from the
  // shared spellbook table instead of character.spells — see this file's
  // header comment. "Prepared" always comes from the character's OWN
  // prepared_spells list, never from the spellbook entry, so sharing a
  // spellbook_id can never leak one character's daily prepared state into
  // another's. Every other class (and any Wizard somehow missing
  // spellbook_id — shouldn't happen, but fails safe) falls back to the
  // original character.spells-with-embedded-prepared shape unchanged.
  const spellbook = spellbooks.find((sb) => sb.id === character.spellbook_id)
  if (spellbook) {
    const prepared = new Set(character.prepared_spells ?? [])
    for (const s of spellbook.spells ?? []) {
      add({
        name: s.name,
        level: s.level,
        prepared: prepared.has(s.name),
        _source: 'class',
      })
    }
  } else {
    // 1. Main class spell list. Default _source to 'class', but respect a
    // source/featureGranted already set directly on the spell entry (e.g. a
    // feat-granted free-cast spell recorded inline rather than via a
    // feature's spells_granted array).
    for (const s of character.spells ?? []) {
      add({ _source: 'class', ...s })
    }
  }

  // 2. Subclass bonus spells (always prepared, don't count against limit) —
  // e.g. Artillerist Bonus Spells, Arbalist Bonus Spells — derived from the
  // subclass's own data, not stored per-character (see getBonusSpells above).
  for (const s of getBonusSpells(character, subclasses)) {
    add({
      name: s.name,
      level: s.level,
      prepared: true,
      bonusSpell: true,
      _source: 'Bonus Spells',
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
  //    Items with `spells_granted` contribute when equipped by this character
  //    (entries can be bare strings or the richer per-spell grant objects —
  //    see dnd.normalizeItemSpellGrant, e.g. Staff of Power's differing
  //    per-spell charge costs). If the item requires attunement it must also
  //    be attuned.
  //    Item grants are NOT deduplicated against sources 1-3 — if a character knows a
  //    spell through their class AND an item grants it, both entries appear so the player
  //    can distinguish always-prepared (item) from their preparation-limited version.
  const equippedItems = partyItems.filter(
    (i) =>
      i.equipped_by === character.name && (!i.needs_attunement || i.attuned)
  )
  for (const item of equippedItems) {
    for (const entry of item.spells_granted ?? []) {
      const grant = dnd.normalizeItemSpellGrant(entry, item)
      const key = `\0item\0${item.id}\0${grant.name}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        name: grant.name,
        level: null,
        prepared: true,
        itemGranted: true,
        _source: item.name,
        grant,
      })
    }
  }

  return result
}

/** Quick boolean — used by tab visibility checks without building the full list. */
export function characterHasSpells(
  character,
  partyItems = [],
  subclasses = []
) {
  if (!character) return false
  // A Wizard's known spells now live in the spellbook table, not here — see
  // getCharacterSpells's header comment. Every Wizard has spellbook_id set,
  // so its mere presence is enough; no need to also thread the spellbooks
  // table through just to check a length.
  if (character.spellbook_id) return true
  if ((character.spells ?? []).length > 0) return true
  if (getBonusSpells(character, subclasses).length > 0) return true
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
