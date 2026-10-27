// Everything a character sheet shows that is CALCULATED, in one call, each with the
// lines that explain it.
//
//   const sheet = characterSheet(character, { equippedItems })
//   sheet.hp.max          { value, breakdown: [{ label, amount }], tooltip }
//   sheet.abilities.str   { score: {...}, modifier: {...} }
//   sheet.savingThrows.dex, sheet.skills.Stealth, sheet.ac, sheet.speed, ...
//
// Every leaf is `{ value, breakdown, tooltip }` where `breakdown` is the data (the
// amounts always add up to `value`) and `tooltip` is the same lines joined as the text
// a UI can show as-is:  "Hit dice (+49)\nCON modifier +2 x 9 levels (+18)\n= 85".
// One implementation of each number: this file only gathers the engine functions that
// compute them, it does no rules math of its own beyond adding up their lines.
//
// `equippedItems` = the character's equipped items, already hydrated (the caller
// filters; the engine never reads party_items.json).

const { resolveEffectiveStats } = require('./characterStats')
const { abilityModifier } = require('./abilities')
const { abilityScoreBreakdown } = require('./abilityScoreBreakdown')
const { effectiveProficiencyBonusBreakdown } = require('./proficiency')
const { computeAC } = require('./armorClass')
const {
  savingThrowBreakdown,
  skillBreakdown,
  passivePerceptionBreakdown,
  initiativeBreakdown,
  spellSaveDCBreakdown,
  spellAttackBonusBreakdown,
  hasInitiativeAdvantage,
  SKILL_MAP,
} = require('./checks')
const { maxHpBreakdown } = require('./derive')
const { speedBreakdown } = require('./speed')
const { exhaustionEffects } = require('./exhaustion')
const {
  resolveSpellcasting,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
  pactMagicForLevel,
} = require('./spellcasting')
const { multiclassSpellSlots } = require('./multiclass')
const { extraCantrips } = require('./cantripAllowance')
const { hitDieForClass } = require('./progression')
const { rulesetOf } = require('./rulesetId')

const { applyAttunement } = require('./attunement')

const KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`)

// The one place breakdown lines become text (the UI's tooltip shape).
function formatBreakdown({ value, breakdown }) {
  return [
    ...breakdown.map((l) => `${l.label} (${signed(l.amount)})`),
    `= ${value}`,
  ].join('\n')
}

const leaf = (result) =>
  result == null
    ? null
    : {
        value: result.value,
        breakdown: result.breakdown,
        tooltip: formatBreakdown(result),
      }

function abilityBlock(character, equippedItems) {
  const out = {}
  for (const row of abilityScoreBreakdown(character, equippedItems)) {
    const lines = [
      { label: 'Base score', amount: row.base },
      ...row.contributions,
    ]
    const sum = lines.reduce((n, l) => n + l.amount, 0)
    // An item that SETS the score (Amulet of Health, Gauntlets of Ogre Power) shows as the
    // difference it makes.
    if (sum !== row.score)
      lines.push({
        label: row.override
          ? `${row.override.name} (sets the score to ${row.override.value})`
          : 'Other',
        amount: row.score - sum,
      })
    out[row.key] = {
      score: leaf({ value: row.score, breakdown: lines }),
      modifier: leaf({
        value: row.mod,
        breakdown: [
          {
            label: `Score ${row.score}: (score - 10) / 2, rounded down`,
            amount: row.mod,
          },
        ],
      }),
    }
  }
  return out
}

function hitDiceBlock(character) {
  const byDie = {}
  for (const c of character.classes || []) {
    const die = hitDieForClass(c.name)
    if (die) byDie[die] = (byDie[die] || 0) + c.level
  }
  const total = Object.values(byDie).reduce((n, v) => n + v, 0)
  return {
    dice: Object.entries(byDie).map(([die, count]) => ({
      die: Number(die),
      count,
    })),
    total,
    remaining: character.hit_dice_current ?? total,
    tooltip: Object.entries(byDie)
      .map(([d, n]) => `${n}d${d}`)
      .join(' + '),
  }
}

function spellcastingBlock(character, equippedItems) {
  const ruleset = rulesetOf(character)
  const { scores } = resolveEffectiveStats(character, equippedItems)
  const casters = (character.classes || [])
    .map((c) => ({ c, sc: resolveSpellcasting(c.name, c.subclass, ruleset) }))
    .filter((x) => x.sc)
  if (!casters.length) return null
  const classes = casters.map(({ c, sc }) => {
    const ability = sc.ability
    const mod = abilityModifier(scores[ability] ?? 10)
    const cantrips = cantripsKnownForClass(c.name, c.level, c.subclass, ruleset)
    const known = spellsKnownForClass(c.name, c.level, c.subclass, ruleset)
    const prepared = preparedSpellCount(
      c.name,
      c.level,
      mod,
      c.subclass,
      ruleset
    )
    const knownStyle2024 =
      ruleset === '2024' &&
      (['Bard', 'Sorcerer', 'Warlock'].includes(c.name) || sc.type === 'third')
    const preparedLines =
      prepared == null
        ? null
        : ruleset === '2024'
        ? [
            {
              label: `${c.name} ${c.level}: prepared spells in the class table`,
              amount: prepared,
            },
          ]
        : [
            {
              label: `${c.name} level${
                sc.type === 'full' ? '' : ' / 2, rounded down'
              }`,
              amount: sc.type === 'full' ? c.level : Math.floor(c.level / 2),
            },
            { label: `${ability.toUpperCase()} mod`, amount: mod },
            ...(prepared === 1 &&
            (sc.type === 'full' ? c.level : Math.floor(c.level / 2)) + mod < 1
              ? [
                  {
                    label: 'Minimum of 1',
                    amount:
                      1 -
                      ((sc.type === 'full'
                        ? c.level
                        : Math.floor(c.level / 2)) +
                        mod),
                  },
                ]
              : []),
          ]
    return {
      class: c.name,
      subclass: c.subclass ?? null,
      level: c.level,
      ability,
      saveDC: leaf(spellSaveDCBreakdown(character, equippedItems, ability)),
      attackBonus: leaf(
        spellAttackBonusBreakdown(character, equippedItems, ability)
      ),
      cantripsKnown: leaf({
        value: cantrips,
        breakdown: [
          {
            label: `${c.name} ${c.level}: cantrips in the class table`,
            amount: cantrips,
          },
        ],
      }),
      spellsKnown:
        known == null
          ? null
          : leaf({
              value: known,
              breakdown: [
                {
                  label: `${c.name} ${c.level}: spells known in the class table`,
                  amount: known,
                },
              ],
            }),
      preparedLimit: preparedLines
        ? leaf({ value: prepared, breakdown: preparedLines })
        : null,
      choosesAtLevelUp: knownStyle2024 || known != null,
    }
  })
  const normal = multiclassSpellSlots(
    (character.classes || []).map((c) => ({
      name: c.name,
      level: c.level,
      subclass: c.subclass,
    })),
    ruleset
  )
  const warlock = (character.classes || []).find((c) => c.name === 'Warlock')
  const extra = extraCantrips(character)
  return {
    classes,
    slots: normal
      .map((max, i) => ({ level: i + 1, max }))
      .filter((s) => s.max > 0),
    pact: warlock
      ? {
          level: pactMagicForLevel(warlock.level, ruleset).slot_level,
          slots: pactMagicForLevel(warlock.level, ruleset).slots,
        }
      : null,
    extraCantrips: extra,
  }
}

function characterSheet(character, { equippedItems = [] } = {}) {
  const ruleset = rulesetOf(character)
  const { bonuses } = resolveEffectiveStats(character, equippedItems)
  const hp = maxHpBreakdown(character, equippedItems)
  const ac = computeAC(character, equippedItems)

  const savingThrows = {}
  for (const k of KEYS)
    savingThrows[k] = leaf(savingThrowBreakdown(character, k, equippedItems))
  const skills = {}
  for (const name of Object.keys(SKILL_MAP))
    skills[name] = leaf(skillBreakdown(character, name, equippedItems))

  return {
    name: character.name,
    ruleset,
    level: (character.classes || []).reduce((n, c) => n + (c.level || 0), 0),
    proficiencyBonus: leaf(
      effectiveProficiencyBonusBreakdown(character, bonuses, equippedItems)
    ),
    abilities: abilityBlock(character, equippedItems),
    hp: {
      max: leaf({ value: hp.value, breakdown: hp.breakdown }),
      effectiveMax: leaf({
        value: hp.effectiveValue,
        breakdown: hp.effectiveBreakdown,
      }),
      current: character.hp_current ?? null,
      temp: character.hp_temp ?? 0,
      hitDice: hitDiceBlock(character),
    },
    ac: leaf(ac),
    initiative: {
      ...leaf(initiativeBreakdown(character, equippedItems)),
      advantage: hasInitiativeAdvantage(character, equippedItems),
    },
    speed: leaf(speedBreakdown(character, equippedItems)),
    passivePerception: leaf(
      passivePerceptionBreakdown(character, equippedItems)
    ),
    savingThrows,
    skills,
    exhaustion: exhaustionEffects(character.exhaustion_level, ruleset),
    spellcasting: spellcastingBlock(character, equippedItems),
  }
}

// The items that count for a character's numbers: the ones equipped by them, with an
// un-attuned item that needs attunement stripped of its special effects (attunement.js).
function equippedItemsFor(character, partyItems = []) {
  return applyAttunement(
    [...(character.items ?? []), ...partyItems].filter(
      (i) => i.equipped_by === character.name
    )
  )
}

// Every `{ value, breakdown }` leaf in a sheet, with its path — for tests and tooling.
function eachLeaf(node, fn, path = '') {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node.breakdown) && typeof node.value === 'number')
    fn(node, path)
  for (const [k, v] of Object.entries(node))
    if (k !== 'breakdown' && v && typeof v === 'object')
      eachLeaf(v, fn, path ? `${path}.${k}` : k)
}

module.exports = { characterSheet, equippedItemsFor, formatBreakdown, eachLeaf }
