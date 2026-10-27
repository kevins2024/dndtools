// The choices a 2024 class asks for as it levels (Weapon Mastery, Fighting Style
// feats, Divine/Primal Order, Expertise, Metamagic, Primal Knowledge). Rules text
// is from the 2024 PHB class pages on dnd2024.wikidot.com.
const test = require('node:test')
const assert = require('node:assert/strict')
const { resolveChoices2024, masteryPool } = require('../rules/5e/choices2024')

const char = (o = {}) => ({
  name: 'T',
  ruleset: '2024',
  skill_proficiencies: [
    'Athletics',
    'Insight',
    'Stealth',
    'Perception',
    'Arcana',
    'History',
  ],
  skill_expertise: [],
  features: [],
  spells: [],
  ...o,
})
const run = (
  className,
  fromLevel,
  toLevel,
  choices = {},
  character = char(),
  subclassName = null
) =>
  resolveChoices2024({
    character,
    className,
    subclassName,
    fromLevel,
    toLevel,
    choices,
  })
const pendingTypes = (r) => r.pendingChoices.map((p) => p.type)

// ── Weapon Mastery ──────────────────────────────────────────────────────

test('Barbarian Weapon Mastery: two kinds of Simple or Martial MELEE weapons at 1st, a third at 4th, a fourth at 10th', () => {
  const none = run('Barbarian', 0, 1)
  assert.deepEqual(pendingTypes(none), ['weaponMasteryChoice'])
  assert.equal(none.pendingChoices[0].count, 2)
  const opts = none.pendingChoices[0].options
  assert.ok(
    opts.includes('greataxe') &&
      opts.includes('handaxe') &&
      opts.includes('javelin')
  )
  assert.ok(
    !opts.includes('longbow'),
    'ranged weapons are not on the Barbarian list'
  )

  const picked = run('Barbarian', 0, 1, {
    weaponMastery: ['greataxe', 'handaxe'],
  })
  assert.deepEqual(pendingTypes(picked), [])
  assert.deepEqual(
    picked.features.map((f) => [f.name, f.mastery, f.type, f._source]),
    [
      ['Weapon Mastery: Greataxe', 'cleave', 'weaponMastery', 'Barbarian'],
      ['Weapon Mastery: Handaxe', 'vex', 'weaponMastery', 'Barbarian'],
    ]
  )

  const owned = char({ features: picked.features })
  const at4 = run('Barbarian', 3, 4, {}, owned)
  assert.equal(at4.pendingChoices[0].count, 1)
  assert.ok(
    !at4.pendingChoices[0].options.includes('greataxe'),
    'already chosen kinds are not offered again'
  )
  assert.equal(run('Barbarian', 4, 5, {}, owned).pendingChoices.length, 1) // still owes the 3rd pick until it is made
})

test('an invalid Weapon Mastery pick is refused with a note and stays pending', () => {
  const r = run('Barbarian', 0, 1, { weaponMastery: ['longbow', 'greataxe'] })
  assert.deepEqual(
    r.features.map((f) => f.weapon),
    ['greataxe']
  )
  assert.equal(r.pendingChoices[0].count, 1)
  assert.match(r.notes.join(' '), /longbow/i)
})

test('weapon pools: Fighter takes any Simple/Martial weapon; Rogue only Simple or Finesse/Light ones', () => {
  const fighter = masteryPool('Fighter')
  assert.ok(fighter.includes('longbow') && fighter.includes('greatsword'))
  const rogue = masteryPool('Rogue')
  assert.ok(
    rogue.includes('rapier') &&
      rogue.includes('scimitar') &&
      rogue.includes('dagger') &&
      rogue.includes('hand crossbow')
  )
  assert.ok(rogue.includes('quarterstaff')) // Simple
  assert.ok(
    !rogue.includes('greatsword') &&
      !rogue.includes('longsword') &&
      !rogue.includes('longbow')
  )
})

test('Fighter masters 3 kinds at 1st; Paladin, Ranger and Rogue 2', () => {
  assert.equal(
    run('Fighter', 0, 1).pendingChoices.find(
      (p) => p.type === 'weaponMasteryChoice'
    ).count,
    3
  )
  for (const cls of ['Paladin', 'Ranger', 'Rogue']) {
    const r = run(cls, 0, cls === 'Rogue' ? 1 : 2)
    assert.equal(
      r.pendingChoices.find((p) => p.type === 'weaponMasteryChoice').count,
      2,
      cls
    )
  }
  // Wizards have no Weapon Mastery.
  assert.ok(!pendingTypes(run('Wizard', 0, 1)).includes('weaponMasteryChoice'))
})

// ── Fighting Style (a feat now) ─────────────────────────────────────────

test('Fighting Style is a Fighting Style FEAT: Fighter at 1st, Paladin and Ranger at 2nd', () => {
  const f = run('Fighter', 0, 1)
  const pending = f.pendingChoices.find((p) => p.type === 'fightingStyleChoice')
  assert.ok(pending)
  assert.ok(
    [
      'Archery',
      'Defense',
      'Dueling',
      'Great Weapon Fighting',
      'Protection',
      'Two Weapon Fighting',
    ].every((n) => pending.options.includes(n))
  )
  assert.ok(!pending.options.includes('Alert'), 'only fighting_style feats')

  const chosen = run('Fighter', 0, 1, { fightingStyle: 'Archery' })
  const feat = chosen.features.find((x) => x.name === 'Archery')
  assert.deepEqual(
    [feat.type, feat.id, feat._source, feat.level_gained],
    ['feat', 'pub24_feat-archery', 'Fighter', 1]
  )

  assert.ok(!pendingTypes(run('Paladin', 0, 1)).includes('fightingStyleChoice'))
  assert.ok(pendingTypes(run('Paladin', 1, 2)).includes('fightingStyleChoice'))
  assert.ok(pendingTypes(run('Ranger', 1, 2)).includes('fightingStyleChoice'))
})

test('a Fighting Style already taken is not offered again; a non-style feat is refused', () => {
  const owned = char({
    features: [{ name: 'Archery', type: 'feat', id: 'pub24_feat-archery' }],
  })
  const r = run('Fighter', 0, 1, {}, owned)
  assert.ok(
    !r.pendingChoices
      .find((p) => p.type === 'fightingStyleChoice')
      .options.includes('Archery')
  )
  const bad = run('Fighter', 0, 1, { fightingStyle: 'Alert' })
  assert.equal(
    bad.features.length,
    bad.features.filter((f) => f.type === 'weaponMastery').length
  )
  assert.match(bad.notes.join(' '), /Alert/)
})

test("Champion's Additional Fighting Style (7th) asks for a second style", () => {
  const owned = char({
    features: [{ name: 'Archery', type: 'feat', id: 'pub24_feat-archery' }],
  })
  const r = run('Fighter', 6, 7, {}, owned, 'Champion')
  assert.ok(pendingTypes(r).includes('fightingStyleChoice'))
})

// ── Divine / Primal Order ───────────────────────────────────────────────

test('Cleric Divine Order: Protector = Martial weapons + Heavy armor; Thaumaturge = one extra cantrip', () => {
  assert.deepEqual(
    pendingTypes(run('Cleric', 0, 1)).filter((t) => t === 'divineOrderChoice'),
    ['divineOrderChoice']
  )
  const p = run('Cleric', 0, 1, { divineOrder: 'Protector' })
  assert.deepEqual(p.extraWeaponProficiencies, ['martial'])
  assert.deepEqual(p.extraArmorProficiencies, ['heavy'])
  assert.equal(p.extraCantrips, 0)
  assert.equal(
    p.features.find((f) => f.name === 'Divine Order: Protector').type,
    'divineOrder'
  )
  const t = run('Cleric', 0, 1, { divineOrder: 'Thaumaturge' })
  assert.equal(t.extraCantrips, 1)
  assert.deepEqual(t.extraWeaponProficiencies, [])
})

test('Druid Primal Order: Warden = Martial weapons + Medium armor; Magician = one extra cantrip', () => {
  const w = run('Druid', 0, 1, { primalOrder: 'Warden' })
  assert.deepEqual(
    [w.extraWeaponProficiencies, w.extraArmorProficiencies],
    [['martial'], ['medium']]
  )
  assert.equal(run('Druid', 0, 1, { primalOrder: 'Magician' }).extraCantrips, 1)
  assert.throws(
    () => run('Druid', 0, 1, { primalOrder: 'Protector' }),
    /Primal Order/
  )
})

// ── Expertise ───────────────────────────────────────────────────────────

test('Rogue Expertise: two proficient skills at 1st, two more at 6th (none already doubled)', () => {
  const r = run('Rogue', 0, 1, { expertise: { 1: ['Stealth', 'Perception'] } })
  assert.deepEqual(r.expertiseSkills, ['Stealth', 'Perception'])
  assert.equal(r.features[0].name, 'Expertise: Stealth, Perception')
  const ask = run('Rogue', 0, 1).pendingChoices.find((p) => p.type === 'expertiseChoice')
  assert.equal(ask.count, 2)

  const have = char({ skill_expertise: ['Stealth', 'Perception'] })
  const at6 = run('Rogue', 5, 6, {}, have).pendingChoices.find((p) => p.type === 'expertiseChoice')
  assert.ok(!at6.options.includes('Stealth'))
  assert.equal(at6.count, 2)
})

test('Expertise needs proficiency in the skill', () => {
  const r = run('Rogue', 0, 1, { expertise: { 1: ['Acrobatics', 'Stealth'] } })
  assert.deepEqual(r.expertiseSkills, ['Stealth'])
  assert.match(r.notes.join(' '), /Acrobatics/)
})

test('Bard Expertise comes at 2nd and 9th; Ranger Deft Explorer (2nd) gives one Expertise; Wizard Scholar (2nd) one, from a short list', () => {
  assert.deepEqual(pendingTypes(run('Bard', 1, 2)), ['expertiseChoice'])
  assert.deepEqual(pendingTypes(run('Bard', 8, 9)), ['expertiseChoice'])
  assert.deepEqual(pendingTypes(run('Bard', 2, 3)), [])
  const dx = run('Ranger', 1, 2).pendingChoices.find(
    (p) => p.type === 'expertiseChoice'
  )
  assert.equal(dx.count, 1)
  const scholar = run('Wizard', 1, 2).pendingChoices.find(
    (p) => p.type === 'expertiseChoice'
  )
  assert.equal(scholar.count, 1)
  assert.deepEqual(scholar.options.sort(), ['Arcana', 'History'].sort()) // only proficient skills on the Scholar list
})

// ── Metamagic ───────────────────────────────────────────────────────────

test('Sorcerer Metamagic: two options at 2nd, two more at 10th and again at 17th', () => {
  const none = run('Sorcerer', 1, 2)
  const p = none.pendingChoices.find((x) => x.type === 'metamagicChoice')
  assert.equal(p.count, 2)
  assert.ok(
    p.options.includes('Seeking Spell') && p.options.includes('Twinned Spell')
  )
  const chosen = run('Sorcerer', 1, 2, {
    metamagic: ['Quickened Spell', 'Twinned Spell'],
  })
  assert.deepEqual(
    chosen.features.map((f) => f.name),
    ['Metamagic: Quickened Spell', 'Metamagic: Twinned Spell']
  )
  assert.equal(chosen.features[0].type, 'metamagic')
  const owned = char({ features: chosen.features })
  assert.equal(run('Sorcerer', 9, 10, {}, owned).pendingChoices[0].count, 2)
  assert.ok(
    !run('Sorcerer', 9, 10, {}, owned).pendingChoices[0].options.includes(
      'Twinned Spell'
    )
  )
  assert.equal(run('Sorcerer', 2, 9, {}, owned).pendingChoices.length, 0)
})

// ── Primal Knowledge, and 2014 stays out of it ──────────────────────────

test('Barbarian Primal Knowledge (3rd): one more skill from the Barbarian list', () => {
  const p = run('Barbarian', 2, 3).pendingChoices.find(
    (x) => x.type === 'skillChoice'
  )
  assert.equal(p.count, 1)
  assert.ok(
    p.options.includes('animal_handling') && !p.options.includes('athletics'),
    'skills already known are not offered'
  )
  const r = run('Barbarian', 2, 3, { primalKnowledgeSkill: 'survival' })
  assert.deepEqual(r.extraSkillProficiencies, ['Survival'])
})

test('under the 2014 rules this module does nothing', () => {
  const r = resolveChoices2024({
    character: char({ ruleset: '2014' }),
    className: 'Barbarian',
    fromLevel: 0,
    toLevel: 1,
    choices: {},
  })
  assert.deepEqual([r.features, r.pendingChoices], [[], []])
})
