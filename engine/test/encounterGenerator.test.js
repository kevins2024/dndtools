const test = require('node:test')
const assert = require('node:assert/strict')
const {
  TARGET_HIT_PCT,
  analyzeParty,
  enemyBenchmarks,
  estimatePartyHP,
} = require('../rules/encounterGenerator')

test('analyzeParty returns a sane default profile for an empty party', () => {
  const profile = analyzeParty([])
  assert.equal(profile.avgLevel, 5)
  assert.equal(profile.hasMartial, true)
  assert.equal(profile.hasHealer, false)
})

test('analyzeParty detects roles from class lists and estimates AC/attack/DC from real stats', () => {
  const party = [
    {
      level: 9,
      classes: [{ name: 'Cleric' }],
      stat_wis: 18,
      proficiency_bonus: 4,
    },
    {
      level: 9,
      classes: [{ name: 'Fighter' }],
      stat_str: 18,
      proficiency_bonus: 4,
    },
  ]
  const profile = analyzeParty(party)
  assert.equal(profile.avgLevel, 9)
  assert.equal(profile.hasHealer, true)
  assert.equal(profile.hasMartial, true)
  assert.equal(profile.hasArcane, false)
  // Every character gets BOTH an attack-bonus and a spell-DC estimate
  // regardless of class, since analyzeParty doesn't filter by role -- a
  // missing stat just contributes mod 0, not a skipped entry:
  // Cleric: physAtk = max(strMod 0, dexMod 0) + prof 4 = 4.
  //         spellDC = 8 + prof 4 + max(intMod 0, wisMod +4, chaMod 0) = 16.
  // Fighter: physAtk = max(strMod +4, dexMod 0) + prof 4 = 8.
  //          spellDC = 8 + prof 4 + max(0, 0, 0) = 12.
  assert.equal(profile.avgAtkBonus, Math.round((4 + 8) / 2))
  assert.equal(profile.avgSpellDC, Math.round((16 + 12) / 2))
})

test('enemyBenchmarks scales enemy atk/AC/save with difficulty in the expected direction', () => {
  const profile = { estimatedAC: 17, avgAtkBonus: 7, avgSpellDC: 15 }
  const trivial = enemyBenchmarks(profile, 'trivial')
  const deadly = enemyBenchmarks(profile, 'deadly')
  // Higher difficulty should ask more of the enemy: higher effective atk/AC pressure.
  assert.ok(deadly.enemyAtk >= trivial.enemyAtk)
  assert.ok(deadly.enemyAC >= trivial.enemyAC)
})

test('enemyBenchmarks falls back to the medium-ish default for an unknown difficulty key', () => {
  const profile = { estimatedAC: 17, avgAtkBonus: 7, avgSpellDC: 15 }
  const result = enemyBenchmarks(profile, 'not-a-real-difficulty')
  assert.ok(Number.isFinite(result.enemyAtk))
  assert.ok(Number.isFinite(result.enemyAC))
  assert.ok(Number.isFinite(result.enemySave))
})

test('estimatePartyHP: max (CON 14) always exceeds min (CON 10) at the same level, and both grow with level', () => {
  const low = estimatePartyHP(1)
  const high = estimatePartyHP(9)
  assert.ok(low.maxHP > low.minHP)
  assert.ok(high.minHP > low.minHP)
  assert.ok(high.maxHP > low.maxHP)
})

test('TARGET_HIT_PCT is exported so calibrateAttackBonus (still in encounter_utils.js) can share it', () => {
  assert.equal(TARGET_HIT_PCT.trivial, 0.35)
  assert.equal(TARGET_HIT_PCT.deadly, 0.72)
})
