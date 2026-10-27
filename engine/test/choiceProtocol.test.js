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
