// End to end: the new-character route and the level-up route, over HTTP against the real server, with a
// simulated Kessara-like High Elf Wizard (nothing here reads a stored character). The finished sheet is
// checked against the 2024 book: what creation owes, what level 1 and level 3 add.
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const net = require('node:net')

const ROOT = path.join(__dirname, '..', '..', '..')

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
const post = (port, url, payload) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(payload)
    const req = http.request(
      {
        port,
        path: url,
        host: '127.0.0.1',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = ''
        res.on('data', (d) => (body += d))
        res.on('end', () =>
          resolve({ status: res.statusCode, json: JSON.parse(body) })
        )
      }
    )
    req.on('error', reject)
    req.end(data)
  })

let server
let port
test.before(async () => {
  port = await freePort()
  server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 15000)
    server.stdout.on('data', (d) => {
      if (String(d).includes('Data server running')) {
        clearTimeout(t)
        resolve()
      }
    })
  })
})
test.after(() => server?.kill())

const answers = {
  name: 'Route Elf',
  species: 'Elf',
  background: 'Sage',
  className: 'Wizard',
  speciesPicks: {
    lineage: 'High Elf',
    spellAbility: 'int',
    keenSenses: 'Perception',
  },
  backgroundBonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' },
  featPicks: {
    background: {
      cantrip_1: 'Light',
      cantrip_2: 'Mage Hand',
      spell_1: 'Magic Missile',
      ability: 'int',
    },
  },
  languages: ['Dwarvish', 'Giant'],
  scoreMethod: 'pointBuy',
  scores: { str: 8, dex: 14, con: 14, int: 15, wis: 10, cha: 8 },
  classSkills: ['Investigation', 'Medicine'],
  equipment: { class: 'A', background: 'A' },
}

test('the new-character route returns the sheet, the derived grants and the starting equipment', async () => {
  const r = await post(port, '/api/engine/new-character', { answers })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.pending, [])
  assert.equal(r.json.grants.darkvision, 60)
  assert.ok(r.json.grants.savingThrowAdvantages.includes('being_charmed'))
  assert.equal(r.json.equipment.gold, 5 + 8)
  assert.ok(r.json.equipment.items.some((i) => i.name === 'Spellbook'))
})

test('the level-up route takes that sheet to level 3 as a Bladesinger and the lineage spell arrives', async () => {
  let character = (await post(port, '/api/engine/new-character', { answers }))
    .json.character
  const answered = {}
  for (const toLevel of [1, 2, 3]) {
    // answer every question the route asks, the way the screen would
    let result
    for (let pass = 0; pass < 6; pass++) {
      result = (
        await post(port, '/api/engine/level-up', {
          character,
          className: 'Wizard',
          toLevel,
          hpMethod: 'average',
          answers: answered,
        })
      ).json
      const open = result.choices.filter((c) => !c.answered && !c.optional)
      if (!open.length) break
      for (const c of open) {
        if (c.kind === 'subclass') answered[c.id] = ['Bladesinger']
        else if (c.slots)
          answered[c.id] = c.slots.map(
            (s) => s.options.find((o) => !o.disabled).value
          )
        else
          answered[c.id] = c.options
            .filter((o) => !o.disabled)
            .slice(0, c.max)
            .map((o) => o.value)
      }
    }
    assert.equal(result.complete, true, `level ${toLevel}`)
    character = { ...character, ...result.patch }
  }
  assert.equal(character.level ?? 3, 3)
  assert.ok(
    character.spells.some(
      (s) => s.name === 'Detect Magic' && s._source === 'Elf: High Elf'
    ),
    'High Elf lineage spell at character level 3'
  )
  assert.ok(character.weapon_proficiencies.includes('rapier'))
  assert.equal(character.skill_proficiencies.length, 5 + 1)
})

test('the new-character route carries the species rules through: a Halfling rerolls 1s, an Elf rests 4 hours and a Goliath has a boon with dice', async () => {
  const base = {
    name: 'Route',
    background: 'Soldier',
    className: 'Fighter',
    backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
    scoreMethod: 'standardArray',
    scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
    languages: ['Elvish', 'Orc'],
    backgroundTool: 'Dice Set',
    classSkills: ['Acrobatics', 'Athletics'],
    equipment: { class: 'A', background: 'A' },
  }
  const halfling = (
    await post(port, '/api/engine/new-character', {
      answers: { ...base, species: 'Halfling' },
    })
  ).json
  assert.deepEqual(halfling.grants.d20RerollOn, [1])
  const elf = (
    await post(port, '/api/engine/new-character', {
      answers: {
        ...base,
        species: 'Elf',
        classSkills: ['Acrobatics', 'Athletics'],
        speciesPicks: {
          lineage: 'Wood Elf',
          spellAbility: 'wis',
          keenSenses: 'Perception',
        },
      },
    })
  ).json
  assert.equal(elf.grants.longRestHours, 4)
  assert.equal(elf.grants.needsSleep, false)
  const goliath = (
    await post(port, '/api/engine/new-character', {
      answers: {
        ...base,
        species: 'Goliath',
        speciesPicks: { ancestry: "Fire's Burn" },
      },
    })
  ).json
  assert.ok(
    goliath.character.features.some(
      (f) => f.id === 'pub24_species_goliath-giant-ancestry--fires-burn'
    )
  )
})

test('POST /api/engine/character-sheet gives the sheet for a character as the screen holds it, with its equipped items', async () => {
  const base = {
    name: 'Sheet',
    background: 'Soldier',
    className: 'Fighter',
    backgroundBonus: { mode: 'twoOne', plus2: 'str', plus1: 'con' },
    scoreMethod: 'standardArray',
    scores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 13 },
    languages: ['Elvish', 'Orc'],
    backgroundTool: 'Dice Set',
    classSkills: ['Acrobatics', 'Athletics'],
    equipment: { class: 'A', background: 'A' },
  }
  const { character } = (
    await post(port, '/api/engine/new-character', {
      answers: { ...base, species: 'Half-Orc' },
    })
  ).json
  const sheet = (
    await post(port, '/api/engine/character-sheet', {
      character,
      partyItems: [],
    })
  ).json
  assert.equal(sheet.speed.value, 30)
  assert.equal(sheet.size.current, 'Medium')
  assert.equal(sheet.grants.darkvision, 60)
  assert.ok(Array.isArray(sheet.saveDCs))
  // an Amulet of Health-like item the screen says the character has equipped counts for max HP
  const withItem = (
    await post(port, '/api/engine/character-sheet', {
      character: {
        ...character,
        level: 1,
        classes: [{ name: 'Fighter', level: 1 }],
        hp_max: 12,
      },
      partyItems: [
        {
          name: 'Amulet of Health',
          equipped_by: character.name,
          stat_overrides: { con: 19 },
        },
      ],
    })
  ).json
  const without = (
    await post(port, '/api/engine/character-sheet', {
      character: {
        ...character,
        level: 1,
        classes: [{ name: 'Fighter', level: 1 }],
        hp_max: 12,
      },
      partyItems: [],
    })
  ).json
  assert.ok(withItem.hp.effectiveMax.value > without.hp.effectiveMax.value)
  assert.equal(
    (await post(port, '/api/engine/character-sheet', {})).status,
    400
  )
})
