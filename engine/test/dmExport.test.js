const test = require('node:test')
const assert = require('node:assert/strict')
const {
  partyItemBundle,
  characterItems,
  characterForExport,
  relationshipsFor,
  buildExport,
} = require('../rules/dmExport')
const { passivePerception } = require('../rules/5e/checks')

const party = { id: 'p1', members: ['Ana', 'Bo'] }
const items = [
  { id: 1, carried_by: 'Ana' },
  { id: 2, carried_by: null, equipped_by: 'Bo' },
  { id: 3, carried_by: 'Cy' },
  { id: 4, carried_by: 'party', party_id: 'p1' },
  { id: 5, carried_by: 'party', party_id: 'p2' },
]

test("partyItemBundle: members' items plus this party's own pool, nothing else", () => {
  assert.deepEqual(
    partyItemBundle(items, party).map((i) => i.id),
    [1, 2, 4]
  )
  assert.deepEqual(partyItemBundle(items, null), [])
})

test('characterItems: what one character carries or has equipped', () => {
  assert.deepEqual(
    characterItems(items, 'Bo').map((i) => i.id),
    [2]
  )
})

const wisChar = {
  name: 'Ana',
  level: 1,
  proficiency_bonus: 2,
  stat_str: 10,
  stat_dex: 10,
  stat_con: 10,
  stat_int: 10,
  stat_wis: 14, // +2
  stat_cha: 10,
  skill_proficiencies: ['Perception'],
  features: [],
  classes: [],
}

test("characterForExport: adds the engine's passive perception and keeps the record", () => {
  const out = characterForExport(wisChar, [])
  assert.equal(out.passive_perception, passivePerception(wisChar, []))
  assert.equal(out.passive_perception, 10 + 2 + 2) // base + WIS + proficiency
  assert.equal(out.name, 'Ana')
  assert.equal(wisChar.passive_perception, undefined) // original not mutated
})

test('characterForExport: an item counts only while attuned if it needs attunement', () => {
  const amulet = (attuned) => ({
    name: 'Amulet',
    equipped_by: 'Ana',
    needs_attunement: true,
    attuned,
    stat_bonuses: { passive_perception: 5 },
  })
  const off = characterForExport(wisChar, [amulet(false)]).passive_perception
  const on = characterForExport(wisChar, [amulet(true)]).passive_perception
  assert.equal(off, 14) // 10 + WIS 2 + proficiency 2: unattuned adds nothing
  assert.equal(on, 19) // attuned: +5
  // an item equipped by someone else never counts
  const theirs = { ...amulet(true), equipped_by: 'Bo' }
  assert.equal(characterForExport(wisChar, [theirs]).passive_perception, off)
})

const mk = (name) => ({
  ...wisChar,
  name,
  stat_wis: 10,
  skill_proficiencies: [],
})
const world = {
  parties: [
    { id: 'p1', name: 'East B', members: ['Ana', 'Bo'], game_day: 304 },
    { id: 'p2', name: 'Homefront', members: ['Cy'], game_day: 298 },
  ],
  characters: [mk('Ana'), mk('Bo'), mk('Cy'), mk('Di')],
  party_items: [
    { id: 'i1', carried_by: 'Ana' },
    { id: 'i2', carried_by: 'Ana', equipped_by: 'Ana' },
    { id: 'i3', carried_by: 'party', party_id: 'p1' },
    { id: 'i4', carried_by: 'party', party_id: 'p2' },
  ],
  npcs: [{ name: 'Zed' }, { name: 'Abe' }],
  places: [{ name: 'Ravenquay' }],
  lore: [
    { id: 'l1', title: 'Zebra' },
    { id: 'l2', title: 'Apple' },
  ],
  house_rules: [{ name: 'Falling' }],
  religions: [{ name: 'Solmir' }],
  assets: [{ name: 'Dawn Rose' }],
  features: [{ id: 'hb1', name: 'Wild Symbiosis' }],
  relationships: [
    { id: 'r1', people: ['ana', 'zed'] },
    { id: 'r2', people: ['bo', 'cy'] },
    { id: 'r3', people: ['di', 'abe'] },
  ],
  finances: { party_purse: { gold: 100 } },
}

test('buildExport: a character picked alone and via a picked party is written once', () => {
  const out = buildExport(
    { partyIds: ['p1'], characterNames: ['Ana', 'Di'], include: {} },
    world,
    '2026-10-22'
  )
  assert.deepEqual(
    out.characters.map((c) => c.name),
    ['Ana', 'Bo', 'Di']
  )
  assert.equal(out.parties.length, 1)
  assert.equal(
    out.characters.every((c) => c.passive_perception != null),
    true
  )
})

test('buildExport: item toggles split character items from the party pool, no duplicates', () => {
  const sel = {
    partyIds: ['p1'],
    characterNames: ['Ana'],
    include: { characterItems: true, partyItems: true },
  }
  const out = buildExport(sel, world, 'x')
  assert.deepEqual(
    out.character_items.map((i) => i.id),
    ['i1', 'i2']
  )
  assert.deepEqual(
    out.party_items.map((i) => i.id),
    ['i3']
  )
  const off = buildExport({ ...sel, include: {} }, world, 'x')
  assert.equal(off.character_items, undefined)
  assert.equal(off.party_items, undefined)
})

test('buildExport: the date comes from the furthest-ahead party that applies, and each party carries its own', () => {
  const out = buildExport(
    { partyIds: ['p1', 'p2'], include: { date: true } },
    world,
    'x'
  )
  assert.equal(out.date.day_count, 304)
  assert.deepEqual(
    out.parties.map((p) => p.date.day_count),
    [304, 298]
  )
  // a lone character brings their live party's date
  const lone = buildExport(
    { characterNames: ['Cy'], include: { date: true } },
    world,
    'x'
  )
  assert.equal(lone.date.day_count, 298)
  assert.equal(
    buildExport({ partyIds: ['p1'], include: {} }, world, 'x').date,
    undefined
  )
})

test('buildExport: purse toggle, alphabetized lists, homebrew grouping and empty sections left out', () => {
  const out = buildExport(
    {
      npcNames: ['Zed', 'Abe'],
      loreIds: ['l1', 'l2'],
      locationNames: ['Ravenquay'],
      religionNames: ['Solmir'],
      assetNames: ['Dawn Rose'],
      houseRuleNames: ['Falling'],
      featureIds: ['hb1'],
      include: { purse: true },
    },
    world,
    'x'
  )
  assert.deepEqual(
    out.npcs.map((n) => n.name),
    ['Abe', 'Zed']
  )
  assert.deepEqual(
    out.lore.map((l) => l.title),
    ['Apple', 'Zebra']
  )
  assert.equal(out.party_purse.gold, 100)
  assert.deepEqual(
    out.homebrew.features.map((f) => f.id),
    ['hb1']
  )
  assert.equal(out.homebrew.spells, undefined)
  assert.equal(out.characters, undefined)
  assert.equal(out.relationships, undefined)
})

test('buildExport: relationships toggle includes any relationship touching a selected character or NPC', () => {
  const out = buildExport(
    {
      characterNames: ['Ana'],
      npcNames: ['Abe'],
      include: { relationships: true },
    },
    world,
    'x'
  )
  assert.deepEqual(
    out.relationships.map((r) => r.id),
    ['r1', 'r3']
  )
  assert.deepEqual(
    relationshipsFor(world.relationships, ['BO']).map((r) => r.id),
    ['r2']
  )
})
