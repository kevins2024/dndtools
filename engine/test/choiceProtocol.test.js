// The uniform choice description: what a UI renders and what it sends back.
const test = require('node:test')
const assert = require('node:assert/strict')
const { previewLevelUp, autoLevelUp } = require('../rules/5e/choiceProtocol')
const { blank, buildCharacter } = require('./helpers/autoLevel')

const level = (c, className, toLevel, answers) =>
  previewLevelUp(c, { className, toLevel, hpMethod: 'average' }, answers)

test('a pending choice is described: id, kind, how many, labelled options', () => {
  const r = level(blank('Barbarian', null, '2024'), 'Barbarian', 1)
  const c = r.choices.find((x) => x.type === 'weaponMasteryChoice')
  assert.equal(c.id, 'weaponMasteryChoice@1')
  assert.equal(c.kind, 'pick')
  assert.equal(c.min, 2)
  assert.equal(c.max, 2)
  assert.equal(c.answered, false)
  assert.match(c.prompt, /2 weapons/)
  assert.deepEqual(
    c.options.find((o) => o.value === 'war pick'),
    {
      value: 'war pick',
      label: 'War Pick',
      description: 'Martial melee weapon, 1d8 piercing. Mastery: Sap.',
    }
  )
  assert.equal(r.complete, false)
})

test('answers come back as { id: [values] } and reach the patch', () => {
  const answers = { 'weaponMasteryChoice@1': ['greataxe', 'handaxe'] }
  const r = level(blank('Barbarian', null, '2024'), 'Barbarian', 1, answers)
  assert.equal(r.complete, true)
  assert.deepEqual(r.problems, [])
  const kept = JSON.stringify(r.patch)
  assert.match(kept, /greataxe/)
  assert.match(kept, /handaxe/)
})

test('a wrong answer is reported against its choice, not applied', () => {
  const base = blank('Barbarian', null, '2024')
  const tooFew = level(base, 'Barbarian', 1, {
    'weaponMasteryChoice@1': ['greataxe'],
  })
  assert.equal(tooFew.complete, false)
  assert.match(tooFew.problems[0].error, /choose 2/)
  const notAnOption = level(base, 'Barbarian', 1, {
    'weaponMasteryChoice@1': ['greataxe', 'bazooka'],
  })
  assert.match(notAnOption.problems[0].error, /not one of the options/)
  const twice = level(base, 'Barbarian', 1, {
    'weaponMasteryChoice@1': ['greataxe', 'greataxe'],
  })
  assert.match(twice.problems[0].error, /twice/)
})

test('spell choices list real spells with level and school, and mark the ones already known', () => {
  const r = level(blank('Wizard', null, '2024'), 'Wizard', 1)
  const cantrips = r.choices.find((c) => c.type === 'newCantrips')
  assert.ok(cantrips.options.length > 5)
  assert.ok(cantrips.options.every((o) => o.level === 0 && o.school))
  const book = r.choices.find((c) => c.type === 'spellbookAdditions')
  assert.ok(book.options.every((o) => o.level >= 1))
  // Once a cantrip is on the sheet it is offered but disabled.
  const withFireBolt = {
    ...blank('Wizard', null, '2024'),
    spells: [{ name: 'Fire Bolt', level: 0 }],
  }
  const again = level(withFireBolt, 'Wizard', 1).choices.find(
    (c) => c.type === 'newCantrips'
  )
  assert.equal(
    again.options.find((o) => o.value === 'Fire Bolt').disabled,
    true
  )
})

test('an Ability Score Improvement is described with scores, cap and the feats on offer', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 3,
  })
  const r = level(character, 'Fighter', 4)
  const d = r.choices.find((c) => c.kind === 'asiOrFeat')
  assert.equal(d.cap, 20)
  assert.equal(d.points, 2)
  assert.equal(typeof d.scores.str, 'number')
  assert.ok(d.feats.some((f) => f.name === 'Alert' || f.name === 'Grappler'))
  assert.ok(!d.feats.some((f) => f.category === 'epic_boon'))
  const asi = level(character, 'Fighter', 4, {
    [d.id]: { type: 'asi', increases: { str: 2 } },
  })
  assert.equal(asi.choices.find((c) => c.id === d.id).answered, true)
  // A Fighter also gains a Weapon Mastery at 4, which is still open.
  assert.equal(asi.complete, false)
  assert.equal(asi.patch.stat_str, character.stat_str + 2)
})

test('an Epic Boon is offered at 19 and its level requirement is judged at the new level', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 18,
  })
  const d = level(character, 'Fighter', 19).choices.find(
    (c) => c.kind === 'asiOrFeat'
  )
  assert.equal(d.epicBoon, true)
  assert.equal(d.allowAsi, false)
  assert.ok(d.feats.length > 0)
  assert.ok(d.feats.every((f) => f.category === 'epic_boon' && f.eligible))
})

test('the subclass is a choice; answering it opens the subclass’s own choices', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 2,
  })
  const open = {
    ...character,
    classes: character.classes.map((c) => ({ ...c, subclass: null })),
  }
  const first = level(open, 'Fighter', 3)
  const sub = first.choices.find((c) => c.type === 'subclassChoice')
  assert.equal(sub.kind, 'subclass')
  assert.ok(sub.options.some((o) => o.value === 'Battle Master'))
  const after = level(open, 'Fighter', 3, { [sub.id]: ['Battle Master'] })
  assert.ok(
    after.choices.some((c) => c.type === 'maneuverChoice'),
    'maneuvers asked once the subclass is chosen'
  )
  assert.equal(
    after.patch.classes.find((c) => c.name === 'Fighter').subclass,
    'Battle Master'
  )
})

test('autoLevelUp answers everything it is shown, and the result matches answering by hand', () => {
  const base = blank('Wizard', 'Evoker', '2024')
  const auto = autoLevelUp(base, {
    className: 'Wizard',
    toLevel: 1,
    hpMethod: 'average',
  })
  assert.equal(auto.complete, true)
  const byHand = level(base, 'Wizard', 1, auto.answers)
  assert.deepEqual(byHand.patch, auto.patch)
})

test('preferences are taken first, then the engine’s own order', () => {
  const base = blank('Wizard', 'Evoker', '2024')
  const r = autoLevelUp(
    base,
    { className: 'Wizard', toLevel: 1, hpMethod: 'average' },
    { prefer: { newCantrips: ['Ray of Frost', 'Fire Bolt'] } }
  )
  assert.deepEqual(r.answers['newCantrips@1'].slice(0, 2), [
    'Ray of Frost',
    'Fire Bolt',
  ])
})

test('an Ability Score Improvement answer is checked before it is applied', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 3,
  })
  const o = { className: 'Fighter', toLevel: 4, hpMethod: 'average' }
  const id = 'asiOrFeat@4'
  for (const [bad, why] of [
    [{ type: 'asi', increases: { str: 3 } }, /exactly 2/],
    [
      { type: 'asi', increases: { str: 1, dex: 1, con: 1 } },
      /one score by 2 or two/,
    ],
    [{ type: 'asi', increases: { str: 2, dex: 1 } }, /exactly 2/],
    [{ type: 'asi', increases: { luck: 2 } }, /not an ability/],
    [{ type: 'feat', featName: 'No Such Feat' }, /not a feat on offer/],
  ]) {
    const r = previewLevelUp(character, o, { [id]: bad })
    assert.match(r.problems[0].error, why)
    assert.equal(
      r.patch.stat_str,
      character.stat_str,
      'a bad answer changes nothing'
    )
  }
  const split = previewLevelUp(character, o, {
    [id]: { type: 'asi', increases: { str: 1, dex: 1 } },
  })
  assert.deepEqual(split.problems, [])
  assert.equal(split.patch.stat_dex, character.stat_dex + 1)
  const capped = previewLevelUp(
    {
      ...character,
      stat_str: 19,
      ability_base: { ...character.ability_base, str: 19 },
    },
    o,
    { [id]: { type: 'asi', increases: { str: 2 } } }
  )
  assert.match(capped.problems[0].error, /cannot go above 20/)
})

test('a feat with picks of its own describes them, and the answer must supply them', () => {
  const { character } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 3,
  })
  const o = { className: 'Wizard', toLevel: 4, hpMethod: 'average' }
  const d = previewLevelUp(character, o).choices.find(
    (c) => c.kind === 'asiOrFeat'
  )
  const adept = d.feats.find((f) => f.name === 'Elemental Adept')
  assert.equal(adept.eligible, true)
  assert.deepEqual(adept.abilityChoices.sort(), ['cha', 'int', 'wis'])
  const pick = adept.choices.find((c) => c.id === 'damage_type')
  assert.ok(pick.options.some((x) => x.value === 'Poison'))
  const answers = (x) => ({
    [d.id]: { type: 'feat', featName: 'Elemental Adept', ...x },
  })
  assert.match(
    previewLevelUp(character, o, answers({ choices: { damage_type: 'Fire' } }))
      .problems[0].error,
    /choose an ability/
  )
  assert.match(
    previewLevelUp(character, o, answers({ abilityChoice: 'int' })).problems[0]
      .error,
    /damage type/i
  )
  const ok = previewLevelUp(
    character,
    o,
    answers({ abilityChoice: 'int', choices: { damage_type: 'Fire' } })
  )
  assert.deepEqual(ok.problems, [])
  assert.equal(ok.patch.stat_int, character.stat_int + 1)
  assert.ok(ok.patch.features.some((f) => f.name === 'Elemental Adept'))
})

test('a feat prerequisite is shown as ineligible with its reason', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 3,
  })
  const d = previewLevelUp(character, {
    className: 'Fighter',
    toLevel: 4,
    hpMethod: 'average',
  }).choices.find((c) => c.kind === 'asiOrFeat')
  const adept = d.feats.find((f) => f.name === 'Elemental Adept')
  assert.equal(adept.eligible, false)
  assert.ok(adept.reason)
})

test('the hit point part of a level-up is described with its explanation', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 2,
  })
  const o = { className: 'Fighter', toLevel: 3 }
  const rolled = previewLevelUp(character, {
    ...o,
    hpMethod: 'roll',
    hpRolls: [7],
  })
  assert.equal(rolled.hp.die, 10)
  assert.equal(rolled.hp.average, 6)
  assert.equal(rolled.hp.forcedMax, false)
  assert.equal(rolled.hp.method, 'roll')
  assert.equal(rolled.hp.gain, 7 + 2)
  assert.match(rolled.hp.tooltip, /Hit die \(\+7\)\nCON modifier \(\+2\)\n= 9/)
  const avg = previewLevelUp(character, { ...o, hpMethod: 'average' })
  assert.equal(avg.hp.gain, 6 + 2)
  const first = previewLevelUp(blank('Fighter', 'Champion', '2024'), {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'roll',
    hpRolls: [1],
  })
  assert.equal(first.hp.forcedMax, true)
  assert.equal(first.hp.gain, 10 + 2)
})

test('a known-spell caster may swap a spell: optional, never blocks, applied when answered', () => {
  const { character } = buildCharacter({
    className: 'Bard',
    subclass: 'College of Lore',
    toLevel: 4,
  })
  const o = { className: 'Bard', toLevel: 5, hpMethod: 'average' }
  const first = previewLevelUp(character, o)
  const swap = first.choices.find((c) => c.id === 'spellSwap')
  assert.equal(swap.optional, true)
  assert.ok(
    swap.slots[0].options.length > 0 && swap.slots[1].options.length > 0
  )
  // Unanswered, it does not hold up completion.
  const auto = autoLevelUp(character, o)
  assert.equal(auto.complete, true)
  const from = swap.slots[0].options[0].value
  const to = swap.slots[1].options.find((x) => !x.disabled).value
  const done = previewLevelUp(character, o, {
    ...auto.answers,
    spellSwap: [from, to],
  })
  assert.deepEqual(done.problems, [])
  const names = done.patch.spells.map((s) => s.name)
  assert.ok(names.includes(to) && !names.includes(from))
  // Swapping a spell for itself is refused.
  assert.match(
    previewLevelUp(character, o, { spellSwap: [from, from] }).problems[0].error,
    /twice/
  )
  // A caster that prepares daily is not offered it.
  const { character: wiz } = buildCharacter({
    className: 'Wizard',
    subclass: 'Evoker',
    toLevel: 4,
  })
  assert.ok(
    !previewLevelUp(wiz, {
      className: 'Wizard',
      toLevel: 5,
      hpMethod: 'average',
    }).choices.some((c) => c.id === 'spellSwap')
  )
})

test('options carry their text where the data has it, and the level cap is reported', () => {
  const r = previewLevelUp(blank('Barbarian', null, '2024'), {
    className: 'Barbarian',
    toLevel: 1,
    hpMethod: 'average',
    levelCap: 0,
  })
  assert.match(
    r.choices[0].options.find((o) => o.value === 'greataxe').description,
    /Mastery: Cleave/
  )
  assert.deepEqual(r.levelCap, { cap: 0, exceeded: true })
  const f = previewLevelUp(blank('Fighter', null, '2024'), {
    className: 'Fighter',
    toLevel: 1,
    hpMethod: 'average',
  })
  const style = f.choices.find((c) => c.type === 'fightingStyleChoice')
  assert.ok(
    style.options.find((o) => o.value === 'Defense').description.length > 20
  )
})

test('nothing can be gained past character level 20', () => {
  const { character } = buildCharacter({
    className: 'Fighter',
    subclass: 'Champion',
    toLevel: 20,
  })
  const r = previewLevelUp(character, {
    className: 'Fighter',
    toLevel: 21,
    hpMethod: 'average',
  })
  assert.match(r.blocked, /level 20/)
  const ok = previewLevelUp(character, {
    className: 'Fighter',
    toLevel: 20,
    hpMethod: 'average',
  })
  assert.equal(ok.blocked, null)
})
