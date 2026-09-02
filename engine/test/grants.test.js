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

test("Denna and Revven's feat-granted spells now sync with what their own feature entries already documented", () => {
  const path = require('path')
  const characters = require(path.join(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'characters.json'
  ))

  // Jaygar's own assertions were removed 2026-09-02 when his character
  // record was deleted for a from-scratch rebuild (New Character + Level
  // Up tools, Infused Arbalist subclass). Rebuild is now complete (through
  // level 9) — not re-added because his new build genuinely doesn't use
  // Fey Touched at all: both his ASIs (levels 4, 8) went straight into
  // stats instead of feats, which is also what makes his INT 20 legally
  // reachable this time (the old build spent both ASIs on feats, leaving no
  // legal path to INT 20 under this table's point-buy rules).

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
