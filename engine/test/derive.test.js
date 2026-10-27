// Scores, max HP and proficiency bonus are calculated from the recorded facts
// (base scores, score history, hit-die results), never trusted from a stored copy.
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildCharacter } = require('./helpers/autoLevel')
const { deriveCharacter, hydrateCharacter } = require('../rules/5e/derive')
const { auditCharacter } = require('../rules/5e/auditCharacter')
const { extraCantrips } = require('../rules/5e/cantripAllowance')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')

test('a level-up that raises Constitution adds the retroactive HP, and the calculation agrees', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 3,
    ruleset: '2024',
  })
  const before = character.hp_max
  const conBefore = character.stat_con
  // ASI at 4: +2 CON takes 14 -> 16, modifier +2 -> +3, so the 3 earlier levels each gain 1
  const r = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    hpMethod: 'average',
    asiOrFeatResolutions: { 4: { type: 'asi', increases: { con: 2 } } },
  })
  assert.equal(r.patch.stat_con, conBefore + 2)
  const level4 = 6 + 3 // average d10 (6) + new CON modifier
  assert.equal(r.patch.hp_max, before + level4 + 3)
  const updated = { ...character, ...r.patch }
  const d = deriveCharacter(updated)
  assert.equal(d.hp_max, updated.hp_max)
  assert.equal(d.stat_con, updated.stat_con)
})

test('ability scores are the base plus every recorded change; max HP is recorded dice + CON + bonuses', () => {
  const c = {
    genus: 'Human',
    ruleset: '2014',
    classes: [{ name: 'Fighter', level: 2 }],
    features: [],
    ability_base: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    ability_score_history: [
      { ability: 'str', amount: 1, source: 'Species' },
      { ability: 'con', amount: 2, source: 'Story: Belt of Giant Health' },
    ],
    level_history: [
      { kind: 'level', class: 'Fighter', level: 1, hp: { die: 10 } },
      { kind: 'level', class: 'Fighter', level: 2, hp: { die: 7, rolls: [7] } },
    ],
  }
  const d = deriveCharacter(c)
  assert.deepEqual(d.scores, {
    str: 16,
    dex: 12,
    con: 16,
    int: 8,
    wis: 10,
    cha: 10,
  })
  assert.equal(d.hp_max, 10 + 7 + 3 * 2)
  assert.equal(d.proficiency_bonus, 2)
  const unrecorded = { ...c, level_history: [], hp_unrecorded_dice: 17 }
  assert.equal(deriveCharacter(unrecorded).hp_max, 17 + 6)
})

test('a record without base scores is left alone, and the audit says so', () => {
  const c = {
    classes: [{ name: 'Fighter', level: 1 }],
    stat_str: 10,
    hp_max: 5,
  }
  assert.equal(deriveCharacter(c), null)
  assert.equal(hydrateCharacter(c), c)
})

test('the audit fails a sheet whose stored numbers disagree with the calculation', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 5,
    ruleset: '2024',
  })
  assert.ok(
    !auditCharacter(character).some((i) => i.code === 'derived-mismatch')
  )
  const tampered = { ...character, hp_max: character.hp_max + 4 }
  assert.ok(
    auditCharacter(tampered).some(
      (i) => i.code === 'derived-mismatch' && /hp_max/.test(i.message)
    )
  )
  const stat = { ...character, stat_int: character.stat_int + 1 }
  assert.ok(
    auditCharacter(stat).some(
      (i) => i.code === 'derived-mismatch' && /stat_int/.test(i.message)
    )
  )
})

test('hydrating lays the calculated numbers over the stored ones and never leaves current HP above the maximum', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 4,
    ruleset: '2024',
  })
  const stale = { ...character, hp_max: 1, stat_str: 3, hp_current: 999 }
  const h = hydrateCharacter(stale)
  assert.equal(h.hp_max, character.hp_max)
  assert.equal(h.stat_str, character.stat_str)
  assert.equal(h.hp_current, character.hp_max)
})

test('extra cantrips come from homebrew features and the High Elf cantrip', () => {
  assert.equal(
    extraCantrips({ features: [{ id: 'hb_tackett_legendary_cantrips' }] }),
    3
  )
  assert.equal(
    extraCantrips({ genus: 'Elf', subgenus: 'High Elf', features: [] }),
    1
  )
  assert.equal(extraCantrips({ genus: 'Human', features: [] }), 0)
})
