// How a feature-use result reads on this screen. The numbers (dice rolled, DCs, amounts) are all the
// engine's (featureUse.useFeature); this only words them.
const dmg = (e) =>
  `${e.total} ${e.type ?? ''} damage (${e.dice}: ${e.rolls.join(
    ' + '
  )})`.replace(/  +/g, ' ')

export function describeEffect(e) {
  switch (e.kind) {
    case 'heal':
      return `heals ${e.total} (${e.dice}: ${e.rolls.join(' + ')})${
        e.target ? ` — ${e.target}` : ''
      }`
    case 'temp_hp':
      return `+${e.amount} temporary Hit Points`
    case 'action':
      return `take the ${e.action} action`
    case 'damage':
      return `${dmg(e)}${e.trigger ? ` — ${e.trigger}` : ''}${
        e.target ? ` (to ${e.target})` : ''
      }`
    case 'area_save': {
      const where = e.shapes
        ? e.shapes.map((s) => `${s.feet}-foot ${s.shape}`).join(' or ')
        : `${e.radiusFeet} feet`
      const parts = [
        `${e.ability.toUpperCase()} save DC ${e.dc.value} (${where})`,
      ]
      if (e.damage)
        parts.push(
          `failure: ${dmg(e.damage)}${
            e.onSuccess === 'half' ? ', half on a success' : ''
          }`
        )
      if (e.onFailure)
        parts.push(
          `failure: ${e.onFailure.condition} until ${e.onFailure.until}`
        )
      return parts.join('; ')
    }
    case 'reduce_damage':
      return `reduces the damage by ${e.total} (${e.dice}: ${e.rolls.join(
        ' + '
      )}${e.bonus ? ` ${e.bonus > 0 ? '+' : '−'} ${Math.abs(e.bonus)}` : ''})`
    case 'teleport':
      return `teleport up to ${e.feet} ft. to ${e.to}`
    case 'condition':
      return `target is ${e.condition}${e.trigger ? ` — ${e.trigger}` : ''}`
    case 'speed_reduction':
      return `target's Speed −${e.feet} ft. until ${e.until}`
    default:
      return e.kind
  }
}

// One line: "Healing Hands: heals 7 (3d4: 2 + 4 + 1) — a creature you touch"
export function describeUse(result) {
  if (!result.ok) return result.error
  const body = result.effects.map(describeEffect).join('; ')
  return `${result.feature}${body ? `: ${body}` : ''}${
    result.durationMinutes ? ` (${result.durationMinutes} min.)` : ''
  }${result.requires ? ` — needs ${result.requires}` : ''}`
}
