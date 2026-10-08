// "What spells does this character have?" — the single source of truth the
// spellbook, the combat panel, the level-up tool and the character-details
// tab all read. Extracted 2026-10-01 from src/utils/spellUtils.js, which
// held this aggregation (and the subclass bonus-spell field table that
// drives it) next to a UI import of cached spell-list JSON. The aggregation
// itself is pure data-merging over arguments, so it belongs here; only the
// per-class cached spell LISTS (src/data/api_data_cache/*.json) stay behind,
// since engine/ doesn't read src/data.
//
// Sources collected (in priority order for deduplication):
//   1. character.spells[]                  — main class list; homebrew spells live here too (homebrew: true)
//      EXCEPT for a Wizard with `spellbook_id` set — see below, source 1 is
//      replaced entirely for those characters.
//   1'. Wizard spellbook (character.spellbook_id -> spellbooks[]) — every
//      Wizard has one (see src/data/spellbooks.json). Two or more Wizards
//      can point at the SAME spellbook_id, which is the entire mechanism
//      behind a shared/linked spellbook (Lenn/Lyria/Kessara, Iyani's
//      mother's gift) — there's no separate "shared spellbook" concept, the
//      id being shared IS the sharing. What's "prepared" always comes from
//      the character's OWN character.prepared_spells (a plain list of
//      names), never from the spellbook entry itself, so preparing a spell
//      never affects anyone else who shares the same spellbook_id.
//   2. getBonusSpells(character, subclasses) — subclass always-prepared spells
//      (Artillerist Bonus Spells, Cleric domain spells, Paladin oath spells,
//      Druid circle spells, Sorcerer psionic/clockwork spells, etc.), derived
//      live from the subclass's own data rather than stored on the
//      character — see BONUS_SPELL_FIELDS/getBonusSpells's own comments.
//   3. character.features[].spells_granted — feats / race / class features
//   4. partyItems[].spells_granted         — equipped + attuned magic items
//
// Each returned spell object has the original fields plus:
//   _source      {string}  — human-readable origin label
//   bonusSpell   {bool}    — true if from getBonusSpells
//   featureGranted {bool}  — true if from a feature's spells_granted
//   itemGranted  {bool}    — true if from an equipped item's spells_granted
//   homebrew     {bool}    — true if spell is homebrew (set on the spell entry in character.spells)
//
// Deduplication: sources 1/1'-3 deduplicate by spell name (first wins).
// Item-granted spells (source 4) are always added alongside class/feature
// versions — if a character knows a spell AND an item grants it, both appear
// with distinct _source labels so the player can see which is always-prepared
// vs. counted against their limit.
//
// Zero dependencies — browser code require()s this directly; see
// src/utils/spellUtils.js.

// Classes whose spell list lets them prepare ANY listed spell daily (not
// just ones they've "learned"). Wizards prepare from their spellbook — a
// separate concept.
//
// NOT Ranger: 2014 Rangers KNOW a fixed list (engine/rules/5e/spellcasting.js,
// preparedSpells.js) rather than preparing from the whole class list, so
// their spellbook is just the spells recorded on the character.
const FULL_CLASS_LIST_CLASSES = ['cleric', 'druid', 'paladin', 'artificer']

// True if this character's class can prepare from the full class spell list
// (as opposed to only from spells they've explicitly added to their
// spellbook).
function usesFullClassList(character) {
  return (character?.classes ?? []).some((cc) =>
    FULL_CLASS_LIST_CLASSES.some((c) => cc.name.toLowerCase().includes(c))
  )
}

// Normalizes one entry of an item's `spells_granted` array to a common
// shape, regardless of which authoring style it uses:
//   - a bare string (legacy/simple grant — exactly one spell, no
//     differentiated cost, item-level action_type applies)
//   - an object:
//       name                          — spell name
//       action_type                   — 'action'|'bonus_action'|'reaction'|'free',
//                                       the REAL cost of casting THIS spell via
//                                       this item (may differ from the spell's
//                                       own casting_time, and from other spells
//                                       on the same item)
//       charge_cost                   — number, or {min,max} when the player
//                                       chooses how many of the item's own
//                                       charges_current/charges_max pool to
//                                       spend at cast time (e.g. a wand's
//                                       variable-level upcast)
//       uses_max / uses_current       — an independent per-spell use count,
//                                       NOT drawn from the item's shared
//                                       charge pool (same shape as
//                                       weapon_effects' uses_max/uses_current)
//       recharge                      — when this spell's own uses_current
//                                       resets — only meaningful alongside
//                                       uses_max
//       material_component_required   — true if the wielder must still
//                                       provide/consume the spell's own real
//                                       material component even when cast
//                                       via the item; omitted/false means the
//                                       item itself substitutes, per the DMG's
//                                       general "no separate components
//                                       needed" rule for magic item casting
//       choice_group                  — links 2+ entries that share ONE use
//                                       or charge; casting any one of them
//                                       spends the shared resource (e.g. a
//                                       Necklace of Prayer Beads' Curing bead
//                                       offering a choice of Cure Wounds or
//                                       Lesser Restoration from the same use)
function normalizeItemSpellGrant(entry, item) {
  if (typeof entry === 'string') {
    return {
      name: entry,
      actionType: item?.action_type ?? null,
      chargeCost: null,
      usesMax: null,
      usesCurrent: null,
      recharge: null,
      materialComponentRequired: false,
      choiceGroup: null,
    }
  }
  return {
    name: entry.name,
    actionType: entry.action_type ?? item?.action_type ?? null,
    chargeCost: entry.charge_cost ?? null,
    usesMax: entry.uses_max ?? null,
    usesCurrent: entry.uses_current ?? null,
    recharge: entry.recharge ?? null,
    materialComponentRequired: entry.material_component_required === true,
    choiceGroup: entry.choice_group ?? null,
  }
}

// Every subclass field shape this app uses for "you always have these
// spells prepared, they don't count against your limit" — one entry per
// field name, each real subclass field having grown its own name over time
// rather than converging on one (expanded_spell_list predates the others;
// see engine/CHECKLIST.md's per-class build-out entries for
// domain_spells_by_level/oath_spells_by_level/circle_spells_by_level/
// psionic_spells_by_level/clockwork_spells_by_level). `classOnly` scopes a
// field to the one class it actually means this for — critical for
// expanded_spell_list specifically, which Warlock's Great Old One patron
// ALSO uses for a genuinely different mechanic (spells added to the pool a
// warlock can choose to LEARN, never automatic). `deriveLevel` is only true
// for expanded_spell_list: Artificer's own real per-4-level slot-access
// schedule happens to make ceil(atLevel/4) exactly right (verified in
// engine/test/artificerSubclasses.test.js) — no such universal formula holds
// for the other fields (e.g. Circle of Spores grants a CANTRIP at 2nd level
// alongside real leveled spells at other breakpoints), so those are left
// level:null and resolved asynchronously the same way feature/item-granted
// spells already are (CharacterSpellbook.vue's loadMeta() calls lookupSpell
// for any spell with level === null).
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
  // classes sharing a field name is safe, not a collision).
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
// sync. `subclasses` is the full list of subclass records.
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
// character level — used by the level-up tool to show "you just gained
// these" at a breakpoint that doesn't re-grant any named feature. Checks the
// same BONUS_SPELL_FIELDS list/class-gating getBonusSpells uses, so a
// Warlock's Great Old One never matches here either. `subclassData` is one
// entry of the subclass list (already resolved by class+subclass name), not
// the whole array.
function getBonusSpellsAtLevel(subclassData, className, level) {
  const cls = className?.toLowerCase()
  for (const { field, classOnly } of BONUS_SPELL_FIELDS) {
    if (cls !== classOnly) continue
    const names = subclassData?.[field]?.[String(level)]
    if (Array.isArray(names) && names.length) return names
  }
  return []
}

function getCharacterSpells(
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
  // shared spellbook table instead of character.spells. "Prepared" always
  // comes from the character's OWN prepared_spells list, never from the
  // spellbook entry, so sharing a spellbook_id can never leak one
  // character's daily prepared state into another's. Every other class (and
  // any Wizard somehow missing spellbook_id — shouldn't happen, but fails
  // safe) falls back to the original character.spells-with-embedded-prepared
  // shape unchanged.
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
  // derived from the subclass's own data, not stored per-character.
  for (const s of getBonusSpells(character, subclasses)) {
    add({
      name: s.name,
      level: s.level,
      prepared: true,
      bonusSpell: true,
      _source: 'Bonus Spells',
    })
  }

  // 3. Feature / feat / race-granted spells. Requires features to have a
  // `spells_granted: ["SpellName", ...]` array (Shadow Touched, Fey Touched,
  // Drow Magic, Tiefling Legacy, etc.).
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

  // 4. Equipped item-granted spells. Items with `spells_granted` contribute
  // when equipped by this character (entries can be bare strings or the
  // richer per-spell grant objects — see normalizeItemSpellGrant). If the
  // item requires attunement it must also be attuned. Item grants are NOT
  // deduplicated against sources 1-3 — if a character knows a spell through
  // their class AND an item grants it, both entries appear so the player can
  // distinguish always-prepared (item) from their preparation-limited
  // version.
  const equippedItems = partyItems.filter(
    (i) =>
      i.equipped_by === character.name && (!i.needs_attunement || i.attuned)
  )
  for (const item of equippedItems) {
    for (const entry of item.spells_granted ?? []) {
      const grant = normalizeItemSpellGrant(entry, item)
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

// Quick boolean — used by tab visibility checks without building the full
// list.
function characterHasSpells(character, partyItems = [], subclasses = []) {
  if (!character) return false
  // A Wizard's known spells live in the spellbook table, not on the
  // character. Every Wizard has spellbook_id set, so its mere presence is
  // enough; no need to also thread the spellbooks table through just to
  // check a length.
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

module.exports = {
  usesFullClassList,
  normalizeItemSpellGrant,
  BONUS_SPELL_FIELDS,
  getBonusSpells,
  getBonusSpellsAtLevel,
  getCharacterSpells,
  characterHasSpells,
}
