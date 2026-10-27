// "Do the rules apply properly to characters?" — builds characters through the real
// level-up engine, answering every choice with a deterministic policy, and runs the
// legality audit (rules/5e/auditCharacter.js) after EVERY level. Anything the audit
// flags is an engine or data bug, not a bad sheet.
//
// Default run: every class under both rulesets with one subclass each, plus a set of
// multiclass careers. Set FULL_SWEEP=1 to build every subclass (about a minute).
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildCharacter,
  buildMulticlass,
  blank,
  levelOnce,
} = require('./helpers/autoLevel')
const { auditCharacter } = require('../rules/5e/auditCharacter')
const { listClasses } = require('../rules/5e/classFeatures')
const { listSubclasses } = require('../rules/5e/subclasses')
const { getBonusSpells } = require('../rules/5e/characterSpells')
const { loadSubclass } = require('../rules/5e/subclasses')

const FULL = Boolean(process.env.FULL_SWEEP)
const problems = (character) =>
  auditCharacter(character, { spellbooks: [] }).filter(
    (i) => i.severity !== 'info'
  )
const describe = (list) =>
  list.map((i) => `[${i.severity}] ${i.code}: ${i.message}`).join('\n')

for (const ruleset of ['2014', '2024']) {
  const classes = listClasses(ruleset).map((c) =>
    typeof c === 'string' ? c : c.name
  )
  for (const className of classes) {
    const subs = listSubclasses(ruleset).filter((s) => s.class === className)
    for (const sub of FULL ? subs : subs.slice(0, 1)) {
      test(`${ruleset} ${className} / ${sub.name}: levels 1-20 pass the legality audit with every choice answered`, () => {
        const { log } = buildCharacter({
          className,
          subclass: sub.name,
          toLevel: 20,
          ruleset,
        })
        for (const { level, character, unresolved } of log) {
          assert.deepEqual(
            unresolved.map((p) => p.type),
            [],
            `L${level}: choices left unanswered`
          )
          const bad = problems(character)
          assert.equal(
            bad.length,
            0,
            `${className} ${level}:\n${describe(bad)}`
          )
        }
      })
    }
  }
}

const PLANS = [
  [
    ['Fighter', 0, 5],
    ['Wizard', 0, 4],
  ],
  [
    ['Barbarian', 0, 6],
    ['Paladin', 0, 3],
  ],
  [
    ['Rogue', 0, 3],
    ['Warlock', 0, 5],
  ],
  [
    ['Cleric', 0, 3],
    ['Druid', 0, 3],
    ['Sorcerer', 0, 3],
  ],
  [
    ['Bard', 0, 5],
    ['Ranger', 0, 5],
  ],
  [
    ['Paladin', 0, 6],
    ['Sorcerer', 0, 6],
  ],
  [
    ['Wizard', 0, 7],
    ['Fighter', 'Eldritch Knight', 5],
  ],
  [
    ['Monk', 0, 4],
    ['Rogue', 'Arcane Trickster', 4],
  ],
]
for (const ruleset of ['2014', '2024']) {
  for (const plan of PLANS) {
    const label = plan.map(([c, , n]) => `${c} ${n}`).join(' / ')
    test(`${ruleset} multiclass ${label} passes the legality audit at every level`, () => {
      const resolved = plan.map(([c, s, n]) => [
        c,
        typeof s === 'string'
          ? s
          : listSubclasses(ruleset).find((x) => x.class === c)?.name ?? null,
        n,
      ])
      const { log } = buildMulticlass({ plan: resolved, ruleset })
      for (const {
        className,
        level,
        characterLevel,
        character,
        unresolved,
      } of log) {
        assert.deepEqual(
          unresolved.map((p) => p.type),
          [],
          `${className} ${level}: choices left unanswered`
        )
        const bad = problems(character)
        assert.equal(
          bad.length,
          0,
          `character level ${characterLevel} (${className} ${level}):\n${describe(
            bad
          )}`
        )
      }
    })
  }
}

// ── rules that were missing from the engine, pinned down ──────────────────

test('Tough adds 2 HP per character level, retroactively, when taken at a level-up', () => {
  let { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 3,
    ruleset: '2024',
  })
  const before = character.hp_max
  const r = levelOnce(character, 'Fighter', 4, '2024').result
  const withoutTough = r.patch.hp_max - before
  const res = { 4: { type: 'feat', featName: 'Tough' } }
  const { diffLevelUp } = require('../rules/5e/diffLevelUp')
  const t = diffLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    hpMethod: 'average',
    asiOrFeatResolutions: res,
  })
  assert.equal(t.patch.hp_max - before, withoutTough + 2 * 4)
})

test('Draconic Resilience adds 1 HP per Sorcerer level (2014 from level 1; 2024 from level 3)', () => {
  const hp = (ruleset, subclass, lvl) =>
    buildCharacter({ className: 'Sorcerer', subclass, toLevel: lvl, ruleset })
      .character.hp_max
  const plain = (ruleset, lvl) =>
    buildCharacter({
      className: 'Sorcerer',
      subclass: ruleset === '2024' ? 'Wild Magic Sorcery' : 'Wild Magic',
      toLevel: lvl,
      ruleset,
    }).character.hp_max
  assert.equal(hp('2014', 'Draconic Bloodline', 1) - plain('2014', 1), 1)
  assert.equal(hp('2014', 'Draconic Bloodline', 5) - plain('2014', 5), 5)
  assert.equal(hp('2024', 'Draconic Sorcery', 3) - plain('2024', 3), 3)
  assert.equal(hp('2024', 'Draconic Sorcery', 5) - plain('2024', 5), 5)
})

test('2024 Dwarf: Dwarven Toughness gives +1 HP per level (species data, not the 2014 Hill Dwarf)', () => {
  const { diffLevelUp } = require('../rules/5e/diffLevelUp')
  const base = { ...blank('Fighter', null, '2024') }
  const human = diffLevelUp(base, {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  }).patch.hp_max
  const dwarf = diffLevelUp(
    { ...base, genus: 'Dwarf' },
    { className: 'Fighter', toLevel: 1, hpMethod: 'average' }
  ).patch.hp_max
  assert.equal(dwarf - human, 1)
})

test("2024 Paladin always has Divine Smite prepared from level 2; Ranger always has Hunter's Mark from level 1", () => {
  const pal = buildCharacter({
    className: 'Paladin',
    subclass: 'Oath of Devotion',
    toLevel: 2,
    ruleset: '2024',
  })
  assert.ok(!pal.log[0].character.spells.some((s) => s.name === 'Divine Smite'))
  assert.ok(
    pal.character.spells.some(
      (s) => s.name === 'Divine Smite' && s.featureGranted
    )
  )
  const ran = buildCharacter({
    className: 'Ranger',
    subclass: 'Hunter',
    toLevel: 1,
    ruleset: '2024',
  })
  assert.ok(
    ran.character.spells.some(
      (s) => s.name === "Hunter's Mark" && s.featureGranted
    )
  )
  const old = buildCharacter({
    className: 'Paladin',
    subclass: 'Oath of Devotion',
    toLevel: 2,
    ruleset: '2014',
  })
  assert.ok(
    !old.character.spells.some((s) => s.name === 'Divine Smite'),
    '2014 Divine Smite is a feature, not a spell'
  )
})

test('2024 Warlock patron spells are always prepared and derived from the subclass', () => {
  const sub = loadSubclass('Warlock', 'Great Old One Patron', '2024')
  assert.ok(sub.patron_spells_by_level)
  const names = getBonusSpells(
    {
      classes: [
        { name: 'Warlock', subclass: 'Great Old One Patron', level: 5 },
      ],
    },
    [{ ...sub, class: 'Warlock' }]
  ).map((s) => s.name)
  assert.deepEqual(names.sort(), [
    'Clairvoyance',
    'Detect Thoughts',
    'Dissonant Whispers',
    'Hunger of Hadar',
    'Phantasmal Force',
    "Tasha's Hideous Laughter",
  ])
})

test('Bard Magical Secrets picks are part of the Spells Known number, not on top of it (2014)', () => {
  const { character } = buildCharacter({
    className: 'Bard',
    subclass: 'College of Lore',
    toLevel: 10,
    ruleset: '2014',
  })
  const leveled = character.spells.filter(
    (s) => s.level > 0 && !s.featureGranted
  )
  assert.equal(leveled.length, 14)
})

test('2024 Bard, Sorcerer and Warlock pick their prepared spells at level-up from the class table', () => {
  for (const [cls, sub, at1] of [
    ['Bard', 'College of Lore', 4],
    ['Sorcerer', 'Wild Magic Sorcery', 2],
    ['Warlock', 'The Fiend', 2],
  ]) {
    const { character, log } = buildCharacter({
      className: cls,
      subclass: sub,
      toLevel: 1,
      ruleset: '2024',
    })
    const prepared = character.spells.filter(
      (s) => s.level > 0 && s.prepared !== false && !s.featureGranted
    )
    assert.equal(prepared.length, at1, `${cls} level 1`)
    assert.equal(log[0].unresolved.length, 0)
  }
})

test('the starting class of a new character is not treated as a multiclass pickup', () => {
  const { diffLevelUp } = require('../rules/5e/diffLevelUp')
  const r = diffLevelUp(blank('Rogue', null, '2024'), {
    className: 'Rogue',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.ok(!r.pendingChoices.some((p) => p.type === 'multiclassSkillChoice'))
  assert.ok(!r.warnings.some((w) => /Multiclassing/.test(w)))
  assert.equal(r.patch.classes.find((c) => c.name === 'Rogue').started, true)
})

test('every level-up records a level_history entry with the HP gain and method', () => {
  const { log } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 3,
    ruleset: '2024',
  })
  const history = log[2].character.level_history
  assert.equal(history.length, 3)
  assert.deepEqual(
    history.map((h) => h.level),
    [1, 2, 3]
  )
  assert.equal(history[0].hp.method, 'max')
  assert.equal(history[1].hp.method, 'average')
  assert.ok(
    history.every(
      (h) =>
        h.kind === 'level' && h.class === 'Wizard' && h.recorded === 'level-up'
    )
  )
})
