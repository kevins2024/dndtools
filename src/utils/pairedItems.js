// Thin wrapper around engine/rules/5e/pairedItems.js, same pattern as
// src/utils/characterSpells.js. Imports the zero-dependency leaf file directly
// — NOT the engine/index.js barrel (see combatTurn.js's header comment).
const pairedItemsEngine = require('../../engine/rules/5e/pairedItems')

export const holderOf = pairedItemsEngine.holderOf
export const effectNeedsPair = pairedItemsEngine.effectNeedsPair
export const pairInfo = pairedItemsEngine.pairInfo
export const pairRequirement = pairedItemsEngine.pairRequirement

// "Siv (carried, not equipped)" / "Pirra (equipped)" / "stored at X"
function partnerWhere(p) {
  if (p.status === 'equipped') return `${p.who} (equipped)`
  if (p.status === 'carried') return `${p.who} (carried, not equipped)`
  if (p.status === 'stored') return `stored at ${p.place}`
  return 'nobody'
}

// "The Farreach (A) — Siv (carried, not equipped)", or a note when the
// partner isn't in the party inventory at all.
export function partnersText(info) {
  return info.partners.length
    ? info.partners.map((p) => `${p.name} — ${partnerWhere(p)}`).join('; ')
    : 'its partner is not in the party inventory'
}

// Rows for a DetailPopup ({ label, value }) saying who has the other half and
// how close the bearers have to be. The distance is the player's to judge.
export function pairFields(info) {
  if (!info) return []
  const fields = [{ label: 'Needs its pair', value: partnersText(info) }]
  if (info.rangeFt != null)
    fields.push({
      label: 'Range',
      value: `Within ${info.rangeFt} ft of it (check the distance yourself)`,
    })
  return fields
}

// One line for a tooltip, from the structured pairInfo():
// "Farreach Pairing needs its pair: The Farreach (A) — Siv (carried, not equipped), within 30 ft"
export function describePair(info, effectName = null) {
  if (!info) return ''
  const range = info.rangeFt != null ? `, within ${info.rangeFt} ft` : ''
  return effectName
    ? `${effectName} needs its pair: ${partnersText(info)}${range}`
    : `Paired with ${partnersText(info)}${range}`
}
