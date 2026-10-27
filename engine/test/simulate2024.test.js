// Behavioural sweep: take every 2024 class (and every subclass, official or legacy)
// from level 0 to 20 through the real diffLevelUp, with no choices answered, and
// check the invariants that must hold no matter which build it is. This is the
// "does anything blow up or come out wrong on the way up" net for content nobody
// has hand-checked (most subclasses have no second source).
const test = require('node:test')
const assert = require('node:assert/strict')
const { diffLevelUp } = require('../rules/5e/diffLevelUp')
const {
  listClasses,
  loadClass,
  allFeaturesUpToLevel,
} = require('../rules/5e/classFeatures')
const { listSubclasses, loadSubclass } = require('../rules/5e/subclasses')
const { hitDieForClass, proficiencyBonus } = require('../rules/5e/progression')
const { featureHpBonus } = require('../rules/5e/hpBonuses')

const CON_MOD = 2
const blank = (cls, sub) => ({
  name: 'T',
  ruleset: '2024',
  genus: 'Human',
  level: 0,
  stat_str: 16,
  stat_dex: 14,
  stat_con: 14,
  stat_int: 14,
  stat_wis: 14,
  stat_cha: 14,
  hp_max: 0,
  hp_current: 0,
  hit_dice_current: 0,
  features: [],
  spells: [],
  skill_proficiencies: ['Athletics', 'Insight', 'Stealth', 'Perception'],
  skill_expertise: [],
  classes: [{ name: cls, subclass: sub, level: 0, started: true }],
})

const classNames = listClasses('2024').map((c) =>
  typeof c === 'string' ? c : c.name
)
const builds = []
for (const c of classNames) builds.push([c, null])
for (const s of listSubclasses('2024')) builds.push([s.class, s.name])

// Class/subclass "slots" that are not features a sheet stores.
const PLACEHOLDER = /Subclass$|^Ability Score Improvement$|^Epic Boon$/i

function climb(cls, sub) {
  let ch = blank(cls, sub)
  const log = []
  for (let l = 1; l <= 20; l++) {
    const r = diffLevelUp(ch, {
      className: cls,
      toLevel: l,
      hpMethod: 'average',
    })
    ch = { ...ch, ...r.patch }
    log.push({ l, r, ch })
  }
  return log
}

test(`sweep covers all 13 classes and every listed subclass`, () => {
  assert.equal(classNames.length, 13)
  assert.ok(builds.length >= 13 + 100, `only ${builds.length} builds`)
})

for (const [cls, sub] of builds) {
  test(`${cls}${
    sub ? ` / ${sub}` : ''
  }: levels 1-20 hold the invariants`, () => {
    const die = hitDieForClass(cls)
    const classData = loadClass(cls, '2024')
    const subData = sub ? loadSubclass(cls, sub, '2024') : null
    const log = climb(cls, sub)
    for (const { l, r, ch } of log) {
      const tag = `${cls}/${sub} L${l}`
      // A level-0 -> 1 pickup is processed like a multiclass pickup (the New Character
      // tool, which ignores it, relies on that), so a tool-proficiency note at L1 is
      // expected; anything else is not.
      const unexpected = r.warnings.filter(
        (w) =>
          !(
            l === 1 &&
            /^Multiclassing into .* tool proficiencies aren't tracked/.test(
              w
            ) &&
            !/undefined/.test(w)
          )
      )
      assert.deepEqual(unexpected, [], `${tag} warnings`)
      assert.equal(ch.level, l, `${tag} level`)
      assert.equal(ch.classes.length, 1, `${tag} one class entry`)
      assert.equal(ch.classes[0].level, l, `${tag} class level`)
      assert.equal(ch.classes[0].subclass, sub, `${tag} subclass kept`)
      assert.equal(
        ch.proficiency_bonus,
        proficiencyBonus(l),
        `${tag} proficiency bonus`
      )

      // HP: max die at 1st, average (die/2 + 1) after, plus Con each level.
      const hp =
        die +
        CON_MOD +
        (l - 1) * (die / 2 + 1 + CON_MOD) +
        featureHpBonus(ch.features, [{ name: cls, level: l }])
      assert.equal(ch.hp_max, hp, `${tag} hp_max`)
      assert.equal(ch.hit_dice_current, l, `${tag} hit dice`)

      // No duplicate features (same name granted twice at the same level).
      const keys = ch.features.map((f) => `${f.name}@${f.level_gained}`)
      assert.equal(
        new Set(keys).size,
        keys.length,
        `${tag} duplicate features: ${keys.filter(
          (k, i) => keys.indexOf(k) !== i
        )}`
      )

      // Every feature has a sane use count and nothing is NaN/undefined.
      for (const f of ch.features) {
        assert.ok(
          f.name && typeof f.name === 'string',
          `${tag} nameless feature`
        )
        if (f.uses_max !== undefined && f.uses_max !== null)
          assert.ok(
            Number.isInteger(f.uses_max) && f.uses_max >= 0,
            `${tag} ${f.name} uses_max ${f.uses_max}`
          )
      }

      // Pending choices are well-formed.
      for (const p of r.pendingChoices) {
        assert.ok(
          typeof p.type === 'string' && p.type,
          `${tag} choice without type`
        )
        if (p.count !== undefined)
          assert.ok(
            Number.isInteger(p.count) && p.count > 0,
            `${tag} ${p.type} count ${p.count}`
          )
      }
    }

    // Everything the class (and subclass) promises by level 20 ended up on the sheet.
    const final = log[19].ch
    // "Action Surge (One Use)" / "Indomitable (One Use)" are one sheet feature whose uses grow.
    const base = (n) => n.replace(/ \((One|Two|Three) Uses?\)$/i, '')
    const have = new Set(final.features.map((f) => base(f.name)))
    const missing = []
    for (const f of allFeaturesUpToLevel(cls, 20, '2024')) {
      if (PLACEHOLDER.test(f.name)) continue
      if (!have.has(base(f.name))) missing.push(`${f.name} (L${f.level})`)
    }
    if (subData)
      for (const [lvl, names] of Object.entries(subData.features_by_level))
        for (const n of names)
          if (!have.has(n)) missing.push(`${n} (subclass L${lvl})`)
    assert.deepEqual(missing, [], `${cls}/${sub} never granted`)

    // Subclass features arrive at (not before) the level the subclass says.
    if (subData)
      for (const [lvl, names] of Object.entries(subData.features_by_level))
        for (const n of names) {
          const f = final.features.find((x) => x.name === n)
          if (f && f.level_gained != null)
            assert.equal(f.level_gained, Number(lvl), `${n} level_gained`)
        }

    // Spell slots match the class (or third-caster subclass) tables.
    const table = (n, lvl) => {
      const src = subData?.[`spell_slots_level_1_by_level`]
        ? subData
        : classData
      return src[`spell_slots_level_${n}_by_level`]?.[String(lvl)] ?? 0
    }
    if (cls === 'Warlock')
      for (const { l, ch } of log) {
        assert.equal(
          ch.pact_magic?.max,
          classData.spell_slots_by_level[String(l)],
          `Warlock L${l} pact slots`
        )
        assert.equal(
          ch.pact_magic?.slot_level,
          classData.slot_level_by_level[String(l)],
          `Warlock L${l} pact slot level`
        )
        assert.equal(
          ch.spell_slots,
          undefined,
          `Warlock L${l} has no ordinary slots`
        )
      }
    for (const { l, ch } of log) {
      const slots = ch.spell_slots ?? {}
      for (let n = 1; n <= 9; n++) {
        const want = table(n, l)
        const got = slots[`level_${n}`]?.max ?? 0
        assert.equal(got, want, `${cls}/${sub} L${l} level-${n} slots`)
      }
    }
  })
}
