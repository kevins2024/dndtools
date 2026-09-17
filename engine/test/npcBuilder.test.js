const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../index')
const { ROLE_TABLE } = require('../rules/npcBuilder')

const ROLES = Object.keys(ROLE_TABLE)

test('buildCombatant reaches the exact requested level for every supported role', () => {
  for (const role of ROLES) {
    const { character } = engine.buildCombatant({
      speciesName: 'Human',
      role,
      targetLevel: 8,
    })
    assert.equal(character.level, 8, `${role} character.level`)
    assert.equal(character.classes[0].level, 8, `${role} classes[0].level`)
    assert.equal(character.classes[0].name, ROLE_TABLE[role].className)
  }
})

test('buildCombatant never leaves an unresolved pendingChoice behind', () => {
  for (const role of ROLES) {
    const { character } = engine.buildCombatant({
      speciesName: 'Human',
      role,
      targetLevel: 10,
    })
    // A clean build implies the next level-up call (11) sees no leftover
    // choice this module doesn't already know how to resolve — re-running
    // diffLevelUp one more level directly and checking it doesn't reject
    // anything is the real proof there's no unresolved state hiding.
    const { diffLevelUp } = require('../rules/5e/diffLevelUp')
    const result = diffLevelUp(character, {
      className: ROLE_TABLE[role].className,
      toLevel: 11,
      hpMethod: 'average',
    })
    assert.ok(result.patch, `${role}: diffLevelUp rejected a clean build`)
  }
})

test('ASI heuristic caps the primary stat at 20 and never exceeds it, even with every ASI available', () => {
  const { character } = engine.buildCombatant({
    speciesName: 'Human',
    role: 'melee_str',
    targetLevel: 19, // Barbarian's last ASI level
  })
  assert.equal(character.stat_str, 20)
  assert.ok(character.stat_str <= 20)
  assert.ok(character.stat_con <= 20)
})

test('each role has its real subclass and a non-empty features list by level 10', () => {
  for (const role of ROLES) {
    const roleConfig = ROLE_TABLE[role]
    const { character } = engine.buildCombatant({
      speciesName: 'Human',
      role,
      targetLevel: 10,
    })
    assert.equal(character.classes[0].subclass, roleConfig.subclassName)
    assert.ok(character.features.length > 0, `${role} has no features`)
  }
})

test('Wizard and Warlock builds only ever learn spells from their own preference list, no duplicates', () => {
  for (const role of ['caster_int', 'caster_cha']) {
    const roleConfig = ROLE_TABLE[role]
    const allowed = new Set(
      [
        ...(roleConfig.cantripPreferences || []),
        ...(roleConfig.spellPreferences || []),
      ].map((n) => n.toLowerCase())
    )
    const { character } = engine.buildCombatant({
      speciesName: 'Human',
      role,
      targetLevel: 12,
    })
    const seen = new Set()
    for (const spell of character.spells) {
      const key = spell.name.toLowerCase()
      assert.ok(
        allowed.has(key),
        `${role}: "${spell.name}" not in preference list`
      )
      assert.ok(!seen.has(key), `${role}: "${spell.name}" learned twice`)
      seen.add(key)
    }
  }
})

test('toEncounterData populates every field Battle.vue reads, for every role', () => {
  for (const role of ROLES) {
    const { character } = engine.buildCombatant({
      speciesName: 'Human',
      role,
      targetLevel: 8,
    })
    const ed = engine.toEncounterData(character, role, false)
    assert.ok(typeof ed.ac === 'number', `${role} ac`)
    assert.ok(typeof ed.hp === 'number' && ed.hp > 0, `${role} hp`)
    assert.ok(typeof ed.maxHp === 'number' && ed.maxHp > 0, `${role} maxHp`)
    assert.ok(ed.stats && typeof ed.stats.str === 'number', `${role} stats`)
    assert.ok(Array.isArray(ed.features), `${role} features`)
    assert.ok(Array.isArray(ed.spells), `${role} spells`)
    // attackBonus/weapon are populated for martial roles, null for casters —
    // exactly one of the two pairs should be present, never neither.
    const isCaster = role === 'caster_int' || role === 'caster_cha'
    if (isCaster) {
      assert.equal(ed.attackBonus, null, `${role} attackBonus`)
      assert.equal(ed.weapon, null, `${role} weapon`)
      assert.ok(typeof ed.spellSaveDC === 'number', `${role} spellSaveDC`)
    } else {
      assert.ok(typeof ed.attackBonus === 'number', `${role} attackBonus`)
      assert.ok(ed.weapon && ed.weapon.damageDice, `${role} weapon`)
    }
  }
})

test('toEncounterData AC and attack bonus never decrease as targetLevel rises', () => {
  for (const role of ROLES) {
    const levels = [3, 8, 13, 18]
    let prevAc = -Infinity
    let prevAttack = -Infinity
    for (const lvl of levels) {
      const { character } = engine.buildCombatant({
        speciesName: 'Human',
        role,
        targetLevel: lvl,
      })
      const ed = engine.toEncounterData(character, role, false)
      assert.ok(ed.ac >= prevAc, `${role} level ${lvl}: AC dropped`)
      const attack = ed.attackBonus ?? ed.spellAttackBonus
      assert.ok(
        attack >= prevAttack,
        `${role} level ${lvl}: attack bonus dropped`
      )
      prevAc = ed.ac
      prevAttack = attack
    }
  }
})

test('builds cleanly at both a low and a high target level for every role', () => {
  for (const role of ROLES) {
    for (const lvl of [2, 19]) {
      assert.doesNotThrow(() => {
        engine.buildCombatant({ speciesName: 'Human', role, targetLevel: lvl })
      }, `${role} failed at level ${lvl}`)
    }
  }
})

test('listRoles returns all 5 supported roles with their class/subclass', () => {
  const roles = engine.listRoles()
  assert.equal(roles.length, ROLES.length)
  for (const r of roles) {
    assert.ok(ROLE_TABLE[r.id], `unknown role id "${r.id}"`)
    assert.equal(r.className, ROLE_TABLE[r.id].className)
  }
})
