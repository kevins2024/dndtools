const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')

test('Fey Touched grants data matches verified RAW text', () => {
  const feat = engine.loadFeat('Fey Touched')
  assert.ok(feat)
  assert.deepEqual(feat.grants_spells.fixed, ['Misty Step'])
  assert.equal(feat.grants_spells.choice.level, 1)
  assert.deepEqual(feat.grants_spells.choice.schools, [
    'Divination',
    'Enchantment',
  ])
})

test('isFeatGrantedSpell recognizes the fixed grant, not an arbitrary spell', () => {
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', 'Misty Step'), true)
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', 'Fireball'), false)
})

test("Rith's actual Fey Touched and Divine Magic tags line up with the grants catalogs", () => {
  const path = require('path')
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))
  const rith = characters.find((c) => c.name === 'Rith')
  const mistyStep = rith.spells.find((s) => s.name === 'Misty Step')
  assert.equal(
    engine.isFeatGrantedSpell(mistyStep._source, mistyStep.name),
    true
  )

  const divineSoul = engine.loadSubclass('Sorcerer', 'Divine Soul')
  const bless = rith.spells.find((s) => s.name === 'Bless')
  assert.equal(divineSoul.grants_spells.affinity_bonus_spell.law, bless.name)
})

test('Shadow Touched grants data matches verified RAW text', () => {
  const feat = engine.loadFeat('Shadow Touched')
  assert.ok(feat)
  assert.deepEqual(feat.grants_spells.fixed, ['Invisibility'])
  assert.deepEqual(feat.grants_spells.choice.schools, [
    'Illusion',
    'Necromancy',
  ])
})

test("Jaygar, Denna, and Revven's feat-granted spells now sync with what their own feature entries already documented", () => {
  const path = require('path')
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))

  const jaygar = characters.find((c) => c.name === 'Jaygar')
  const jaygarMisty = jaygar.spells.find((s) => s.name === 'Misty Step')
  assert.ok(jaygarMisty)
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', jaygarMisty.name), true)
  // "Command" was jaygar's documented choice pick (see his Fey Touched feature's
  // spells_granted) — Command is 1st-level Enchantment, a legal choice.
  assert.ok(jaygar.spells.some((s) => s.name === 'Command'))

  const denna = characters.find((c) => c.name === 'Denna')
  const dennaInvis = denna.spells.find((s) => s.name === 'Invisibility')
  assert.ok(dennaInvis)
  assert.equal(
    engine.isFeatGrantedSpell('Shadow Touched', dennaInvis.name),
    true
  )
  assert.ok(denna.spells.some((s) => s.name === 'Inflict Wounds'))

  const revven = characters.find((c) => c.name === 'Revven')
  const revvenMisty = revven.spells.find((s) => s.name === 'Misty Step')
  assert.ok(revvenMisty)
  assert.equal(engine.isFeatGrantedSpell('Fey Touched', revvenMisty.name), true)
  assert.ok(revven.spells.some((s) => s.name === 'Comprehend Languages'))
})
