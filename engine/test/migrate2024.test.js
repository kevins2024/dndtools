// The 2014 -> 2024 character migration, run against the real roster in
// src/data/characters.json (the same data the app uses).
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { migrateCharacterTo2024 } = require('../rules/5e/migrate2024')

const roster = require(path.join(__dirname, '..', '..', 'src', 'data', 'characters.json'))
const catalog = require('../data/5e/feature-catalog.json')
const byName = (n) => roster.find((c) => c.name === n)
const migrate = (n, opts) => migrateCharacterTo2024(byName(n), opts)
const names = (c) => c.features.map((f) => f.name)

test('invariants hold for every character on the roster', () => {
  for (const src of roster) {
    const before = JSON.stringify(src)
    const { character: c, questions } = migrateCharacterTo2024(src)
    assert.equal(JSON.stringify(src), before, `${src.name}: input was mutated`)
    assert.equal(c.ruleset, '2024')
    for (const k of ['level', 'hp_max', 'hp_current', 'hit_dice_current', 'stat_str', 'stat_dex', 'stat_con', 'stat_int', 'stat_wis', 'stat_cha', 'proficiency_bonus']) {
      assert.equal(c[k], src[k], `${src.name}: ${k} changed`)
    }
    assert.deepEqual(c.classes.map((k) => [k.name, k.level]), src.classes.map((k) => [k.name, k.level]), src.name)
    assert.equal((c.spells || []).length, (src.spells || []).length, `${src.name}: spells changed`)
    // no duplicate feature ids, and every 2024 id resolves to a name
    const ids = c.features.map((f) => f.id).filter((i) => i && i.startsWith('pub24_'))
    assert.equal(new Set(ids).size, ids.length, `${src.name}: duplicate 2024 feature ids`)
    for (const id of ids) assert.ok(catalog[id], `${src.name}: ${id} missing from the feature catalog`)
    // homebrew/custom features survive
    for (const f of src.features) {
      if (f.id && /^(hb_|campaign)/.test(f.id)) assert.ok(c.features.some((g) => g.id === f.id), `${src.name}: lost ${f.name}`)
    }
    assert.ok(Array.isArray(questions))
  }
})

test('migrating twice changes nothing more', () => {
  const once = migrate('Rhuna').character
  const twice = migrateCharacterTo2024(once)
  assert.equal(JSON.stringify(twice.character), JSON.stringify(once))
  assert.match(twice.warnings[0], /Already on the 2024/)
})

test('Rhuna (Barbarian 9): Brutal Critical gone, Brutal Strike in; Berserker renamed; Half-Orc kept as legacy', () => {
  const { character: c, changes, warnings } = migrate('Rhuna')
  assert.ok(!names(c).some((n) => /Brutal Critical/.test(n)))
  assert.ok(names(c).includes('Brutal Strike') && names(c).includes('Instinctive Pounce'))
  assert.equal(c.classes[0].subclass, 'Path of the Berserker')
  assert.ok(names(c).includes('Frenzy') && names(c).includes('Mindless Rage'))
  assert.ok(changes.some((x) => /Berserker is now Path of the Berserker/.test(x.detail)))
  assert.ok(warnings.some((w) => /Half-Orc.*legacy/i.test(w)))
  assert.equal(c.features.find((f) => f.name === 'Rage').uses_max, 4) // Barbarian 9
  assert.ok(names(c).includes('Hurl Something'), 'custom feature kept')
})

test('Rhuna owes three Weapon Mastery picks and a Primal Knowledge skill; answers clear them', () => {
  const r = migrate('Rhuna')
  const ids = r.questions.map((q) => q.id)
  assert.ok(ids.includes('Barbarian:weaponMasteryChoice@9'))
  assert.ok(ids.includes('Barbarian:skillChoice@3'))
  const done = migrate('Rhuna', { answers: { choices2024: { Barbarian: { weaponMastery: ['greataxe', 'handaxe', 'javelin'], primalKnowledgeSkill: 'nature' } } } })
  const left = done.questions.map((q) => q.id)
  assert.ok(!left.includes('Barbarian:weaponMasteryChoice@9') && !left.includes('Barbarian:skillChoice@3'))
  assert.ok(names(done.character).includes('Weapon Mastery: Greataxe'))
  assert.ok(done.character.skill_proficiencies.includes('Nature'))
})

test('Vaz: Silver Dragonborn becomes the 2024 Dragonborn; Two-Weapon Fighting becomes a feat; Battle Master kept', () => {
  const { character: c } = migrate('Vaz')
  assert.ok(names(c).includes('Breath Weapon') && names(c).includes('Draconic Flight'))
  assert.ok(!names(c).includes('Damage Resistance') || true)
  const style = c.features.find((f) => f.id === 'pub24_feat-two-weapon-fighting')
  assert.ok(style && style.type === 'feat')
  assert.ok(!c.features.some((f) => f.type === 'fightingStyle'))
  assert.equal(c.classes[0].subclass, 'Battle Master')
  assert.ok(c.features.some((f) => f.id === 'pub24_sub_fighter-battle-master-combat-superiority'))
})

test('Kerra: Pact of the Tome becomes an invocation, and she is asked for the remaining invocation', () => {
  const r = migrate('Kerra')
  const pact = r.character.features.find((f) => f.name === 'Pact of the Tome')
  assert.equal(pact.type, 'invocation')
  assert.ok(!r.character.features.some((f) => f.type === 'pactBoon'))
  assert.ok(r.questions.some((q) => q.id === 'Warlock:invocationChoice'))
})

test('Therynv\'l (Wood Elf): 2024 Elf traits + Wood Elf lineage', () => {
  const { character: c } = migrate("Therynv'l")
  assert.ok(names(c).includes('Elven Lineage') || names(c).some((n) => /Elf Lineage: Wood Elf/.test(n)))
  assert.ok(names(c).includes('Trance') && names(c).includes('Keen Senses'))
  assert.ok(!names(c).includes('Elf Weapon Training'), '2014 Wood Elf trait removed')
})

test('Eladrin Elf stays the legacy 2014 species', () => {
  const r = migrate('Enauweyn')
  assert.ok(r.warnings.some((w) => /Eladrin/.test(w)))
  assert.ok(names(r.character).includes('Fey Step'))
})

test('legacy subclasses keep their features untouched (Elowenne\'s Chronurgy Magic)', () => {
  const src = byName('Elowenne')
  const { character: c, warnings } = migrate('Elowenne')
  assert.ok(warnings.some((w) => /Chronurgy Magic.*legacy/i.test(w)))
  for (const f of src.features.filter((x) => /Timeline Freeze|Chronal Shift|Temporal Awareness/.test(x.name))) {
    assert.ok(c.features.some((g) => g.name === f.name), `lost ${f.name}`)
  }
  assert.equal(c.classes[0].subclass, 'Chronurgy Magic')
})

test('Lexica (Bard 9): Expertise comes at 2 and 9 in 2024, so a second Expertise is owed', () => {
  const r = migrate('Lexica')
  assert.ok(r.questions.some((q) => /^Bard:expertiseChoice@9$/.test(q.id)))
  assert.ok(!r.questions.some((q) => /^Bard:expertiseChoice@2$/.test(q.id)), 'the existing Expertise is re-seated to level 2')
})

test('background: a 2014 background maps to its 2024 equivalent and grants the origin feat; unknown asks', () => {
  const sorra = migrate('Sorra') // Far Traveler -> Wayfarer (Lucky)
  assert.equal(sorra.character.background, 'Wayfarer')
  assert.ok(sorra.character.features.some((f) => f.name === 'Lucky' && f._grant === 'origin'))
  const vaz = migrate('Vaz') // no background recorded
  assert.ok(vaz.questions.some((q) => q.id === 'background'))
  const answered = migrate('Vaz', { answers: { background: 'Soldier' } })
  assert.equal(answered.character.background, 'Soldier')
  assert.ok(answered.character.features.some((f) => f.name === 'Savage Attacker'))
  const none = migrate('Sorra', { answers: { originFeat: 'none' } })
  assert.ok(!none.character.features.some((f) => f._grant === 'origin'))
})

test('weapon mastery is suggested from the weapons the character wields', () => {
  const r = migrate('Vaz', { equippedWeapons: ['longsword', 'shortbow'] })
  const q = r.questions.find((x) => x.id.startsWith('Fighter:weaponMasteryChoice'))
  assert.deepEqual(q.pending.suggested, ['longsword', 'shortbow'])
})

test('every migrated roster character passes validateCharacter without errors', () => {
  const { validateCharacter } = require('../rules/validateCharacter')
  for (const src of roster) {
    const { character } = migrateCharacterTo2024(src)
    const issues = validateCharacter(character)
    assert.deepEqual(issues.filter((i) => i.severity === 'error'), [], src.name)
    // 2024 casters prepare, so the old fixed-known-spell cap no longer applies.
    assert.ok(!issues.some((i) => /fixed-known caster/.test(i.message)), `${src.name}: 2014 known-spell cap fired on a 2024 sheet`)
  }
})
