// What a DM-facing export contains, kept in one place so every export (the
// party panel's Copy JSON and the DM Export tool) builds it the same way and
// the screen only has to say WHAT to include.
//
// Three layers of helpers:
//   - item filters: which items go with a party or with one character;
//   - characterForExport: a stored record plus the derived numbers a DM needs
//     that are not stored on it (passive perception today), worked out by the
//     same engine function the sheet uses, attunement applied;
//   - buildExport: the whole payload for a selection of parties, characters,
//     NPCs, places, lore, rules, homebrew, assets and a few include-toggles.
//
// Pure; no fs/path, so browser code require()s this directly — see
// src/utils/dmExport.js.

const { applyAttunement } = require('./5e/attunement')
const { passivePerception } = require('./5e/checks')
const { describeGameDate } = require('./calendar')
const { livePartyOf } = require('./partyMembership')

// Items that travel with `party`: anything a member carries or has equipped,
// plus the party's own pool (carried_by 'party', tied to this party's id).
function partyItemBundle(items, party) {
  if (!party) return []
  const members = new Set(party.members ?? [])
  return items.filter(
    (item) =>
      members.has(item.carried_by) ||
      members.has(item.equipped_by) ||
      (item.carried_by === 'party' && item.party_id === party.id)
  )
}

// Items one character carries or has equipped.
function characterItems(items, characterName) {
  return items.filter(
    (item) =>
      item.carried_by === characterName || item.equipped_by === characterName
  )
}

// The party's own held pool (what is carried_by 'party' for this party).
function partyPoolItems(items, party) {
  return items.filter(
    (item) => item.carried_by === 'party' && item.party_id === party.id
  )
}

// The stored record plus the derived values a DM wants alongside it.
function characterForExport(character, partyItems = []) {
  const equipped = applyAttunement(
    [...(character.items ?? []), ...partyItems].filter(
      (item) => item.equipped_by === character.name
    )
  )
  return {
    ...character,
    passive_perception: passivePerception(character, equipped),
  }
}

// Relationships that involve anyone in `names` (case-insensitive).
function relationshipsFor(relationships, names) {
  const wanted = new Set(names.map((n) => n.toLowerCase()))
  return relationships.filter((r) =>
    (r.people ?? []).some((p) => wanted.has(p.toLowerCase()))
  )
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name))
const pickBy = (list, key, wanted) => {
  const set = new Set(wanted ?? [])
  return list.filter((entry) => set.has(entry[key]))
}
// First occurrence of each key wins.
const uniqueBy = (list, key) => {
  const seen = new Set()
  return list.filter((entry) => {
    const k = entry[key]
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// The whole export for one selection.
//
// selection: {
//   partyIds, characterNames, npcNames, locationNames, religionNames,
//   loreIds, houseRuleNames, assetNames,
//   featureIds, spellNames, monsterNames, itemIds,        // homebrew
//   include: { date, purse, characterItems, partyItems, relationships },
// }
// data: { parties, characters, party_items, npcs, places, religions, lore,
//   house_rules, features, spells, monsters, items, assets, relationships,
//   finances }  (every key optional; a missing list is treated as empty)
//
// A character picked on their own AND as a member of a picked party is
// written once. A section with nothing selected is left out.
function buildExport(selection, data, exportedOn) {
  const sel = selection ?? {}
  const include = sel.include ?? {}
  const d = (key) => data[key] ?? []

  const parties = pickBy(d('parties'), 'id', sel.partyIds).sort(byName)
  const names = new Set(sel.characterNames ?? [])
  for (const party of parties)
    (party.members ?? []).forEach((m) => names.add(m))
  const characters = d('characters')
    .filter((c) => names.has(c.name))
    .sort(byName)
  const allItems = d('party_items')

  const out = { exported_on: exportedOn }

  // The parties whose dates matter: the ones picked, plus the live party of
  // each picked character who is not in a picked party.
  const dated = [...parties]
  for (const c of characters) {
    const live = livePartyOf(d('parties'), c.name)
    if (live && !dated.some((p) => p.id === live.id)) dated.push(live)
  }

  if (parties.length) {
    out.parties = parties.map((p) =>
      include.date && p.game_day != null
        ? { ...p, date: describeGameDate(p.game_day) }
        : p
    )
  }
  if (include.date) {
    const days = dated.map((p) => p.game_day).filter((n) => n != null)
    if (days.length) out.date = describeGameDate(Math.max(...days))
  }
  if (characters.length) {
    out.characters = characters.map((c) => characterForExport(c, allItems))
  }
  if (include.purse && data.finances?.party_purse) {
    out.party_purse = data.finances.party_purse
  }
  if (include.characterItems && characters.length) {
    const mine = uniqueBy(
      characters.flatMap((c) => characterItems(allItems, c.name)),
      'id'
    )
    if (mine.length) out.character_items = mine
  }
  if (include.partyItems && parties.length) {
    const pool = uniqueBy(
      parties.flatMap((p) => partyPoolItems(allItems, p)),
      'id'
    )
    if (pool.length) out.party_items = pool
  }

  const npcs = pickBy(d('npcs'), 'name', sel.npcNames).sort(byName)
  if (npcs.length) out.npcs = npcs
  const locations = pickBy(d('places'), 'name', sel.locationNames).sort(byName)
  if (locations.length) out.locations = locations
  const religions = pickBy(d('religions'), 'name', sel.religionNames).sort(
    byName
  )
  if (religions.length) out.religions = religions
  const lore = pickBy(d('lore'), 'id', sel.loreIds).sort((a, b) =>
    String(a.title ?? a.id).localeCompare(String(b.title ?? b.id))
  )
  if (lore.length) out.lore = lore
  const assets = pickBy(d('assets'), 'name', sel.assetNames).sort(byName)
  if (assets.length) out.assets = assets
  const rules = pickBy(d('house_rules'), 'name', sel.houseRuleNames).sort(
    byName
  )
  if (rules.length) out.house_rules = rules

  const homebrew = {}
  const features = pickBy(d('features'), 'id', sel.featureIds).sort(byName)
  if (features.length) homebrew.features = features
  const spells = pickBy(d('spells'), 'name', sel.spellNames).sort(byName)
  if (spells.length) homebrew.spells = spells
  const monsters = pickBy(d('monsters'), 'name', sel.monsterNames).sort(byName)
  if (monsters.length) homebrew.monsters = monsters
  const items = pickBy(d('items'), 'id', sel.itemIds).sort(byName)
  if (items.length) homebrew.items = items
  if (Object.keys(homebrew).length) out.homebrew = homebrew

  if (include.relationships) {
    const involved = [
      ...characters.map((c) => c.name),
      ...npcs.map((n) => n.name),
    ]
    const rels = relationshipsFor(d('relationships'), involved)
    if (rels.length) out.relationships = rels
  }

  return out
}

module.exports = {
  partyItemBundle,
  characterItems,
  partyPoolItems,
  characterForExport,
  relationshipsFor,
  buildExport,
}
