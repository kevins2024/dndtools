// Weapon Mastery (2024 PHB): the eight Mastery properties and the Long Rest change ("Whenever you finish a
// Long Rest, you can change one kind of weapon you chose for this feature to another kind eligible for it").
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  masteryPool,
  masteryInfo,
  masteryOfKind,
  masteredWeapons,
  masteryOfWeapon,
  masteryChangeOptions,
  changeMastery,
} = require('../rules/5e/weaponMasteries')
const weapons = require('../data/5e2024/weapons.json')

const mastered = (weapon, mastery, source) => ({
  name: `Weapon Mastery: ${weapon.replace(/\b\w/g, (c) => c.toUpperCase())}`,
  type: 'weaponMastery',
  weapon,
  mastery,
  _source: source,
})
const rogue = () => ({
  name: 'Denna',
  features: [
    mastered('dagger', 'nick', 'Rogue'),
    mastered('hand crossbow', 'vex', 'Rogue'),
  ],
})

test('all eight Mastery properties have their printed text, and every weapon uses one of them', () => {
  const ids = [
    'cleave',
    'graze',
    'nick',
    'push',
    'sap',
    'slow',
    'topple',
    'vex',
  ]
  for (const id of ids) {
    const m = masteryInfo(id)
    assert.ok(m && m.description.length > 40, id)
  }
  assert.match(masteryInfo('nick').description, /Light property/)
  assert.match(masteryInfo('sap').description, /Disadvantage/)
  for (const [name, w] of Object.entries(weapons)) {
    if (name.startsWith('_')) continue
    assert.ok(ids.includes(w.mastery), `${name}: mastery ${w.mastery}`)
  }
  assert.equal(masteryInfo('nonsense'), null)
})

test('a mastered weapon shows its Mastery property; an unmastered kind shows none', () => {
  const m = masteredWeapons(rogue())
  assert.deepEqual(
    m.map((x) => [x.weaponName, x.masteryName]),
    [
      ['Dagger', 'Nick'],
      ['Hand Crossbow', 'Vex'],
    ]
  )
  assert.equal(masteryOfWeapon(rogue(), 'dagger').masteryName, 'Nick')
  assert.equal(masteryOfWeapon(rogue(), 'longsword'), null)
  assert.equal(masteryOfKind('longsword').name, 'Sap')
})

test('who may master what: Barbarian melee only, Rogue Simple or Finesse/Light, Fighter anything', () => {
  assert.ok(!masteryPool('Barbarian').includes('longbow'))
  assert.ok(masteryPool('Barbarian').includes('greataxe'))
  assert.ok(masteryPool('Rogue').includes('rapier')) // martial, finesse
  assert.ok(!masteryPool('Rogue').includes('greatsword'))
  assert.ok(masteryPool('Fighter').includes('longbow'))
})

test('Long Rest change: swaps one mastered kind for another eligible kind and nothing else', () => {
  const c = rogue()
  const opts = masteryChangeOptions(c)
  assert.equal(opts.length, 1)
  assert.deepEqual(opts[0].current, ['dagger', 'hand crossbow'])
  assert.ok(opts[0].options.includes('rapier'))
  assert.ok(!opts[0].options.includes('dagger'))

  const r = changeMastery(c, 'Rogue', 'dagger', 'rapier')
  assert.equal(r.changed, true)
  assert.deepEqual(
    r.patch.features.map((f) => [f.weapon, f.mastery, f.name]),
    [
      ['rapier', 'vex', 'Weapon Mastery: Rapier'],
      ['hand crossbow', 'vex', 'Weapon Mastery: Hand Crossbow'],
    ]
  )
  // the character passed in is not mutated
  assert.equal(c.features[0].weapon, 'dagger')
})

test('Long Rest change refuses an ineligible, duplicate or unmastered weapon', () => {
  const c = rogue()
  assert.equal(changeMastery(c, 'Rogue', 'dagger', 'greatsword').changed, false)
  assert.equal(
    changeMastery(c, 'Rogue', 'dagger', 'hand crossbow').changed,
    false
  )
  assert.equal(changeMastery(c, 'Rogue', 'rapier', 'sling').changed, false)
  assert.equal(changeMastery(c, 'Fighter', 'dagger', 'rapier').changed, false)
})

test('two classes with masteries keep separate lists (Barbarian and Fighter)', () => {
  const c = {
    name: 'Brick',
    features: [
      mastered('greataxe', 'cleave', 'Barbarian'),
      mastered('spear', 'sap', 'Fighter'),
    ],
  }
  const opts = masteryChangeOptions(c)
  assert.deepEqual(opts.map((o) => o.className).sort(), [
    'Barbarian',
    'Fighter',
  ])
  // a Barbarian cannot swap to a ranged weapon, a Fighter can
  assert.equal(
    changeMastery(c, 'Barbarian', 'greataxe', 'longbow').changed,
    false
  )
  assert.equal(changeMastery(c, 'Fighter', 'spear', 'longbow').changed, true)
})
