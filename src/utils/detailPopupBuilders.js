// Shared "build the data for DetailPopup" logic — extracted so WeaponTable,
// WeaponTable, FeaturePillsPanel, and SpellPillsByLevel can each open
// the same popup without each re-implementing the same async lookup +
// field-building logic (previously all lived inline in
// CharacterCombatPanel.vue). Each atom calls the relevant builder, then emits
// the result up to whichever view owns the actual <DetailPopup> instance.
import { lookupSpell, lookupFeature } from '@/utils/lookupService.js'
import { dnd } from '@/utils/dnd_utils.js'

export async function buildSpellPopupData(spell) {
  const data = await lookupSpell(spell.name)
  const fields = []
  if (data?.casting_time)
    fields.push({ label: 'Cast', value: data.casting_time })
  if (data?.range) fields.push({ label: 'Range', value: data.range })
  if (data?.duration) fields.push({ label: 'Duration', value: data.duration })
  if (data?.concentration) fields.push({ label: 'Conc', value: 'Yes' })
  if (data?.components) fields.push({ label: 'Comp', value: data.components })
  if (data?.save) fields.push({ label: 'Save', value: data.save })
  if (data?.damage_type) fields.push({ label: 'Dmg', value: data.damage_type })

  // Item-granted spells carry their own real cost/action data (see
  // dnd.normalizeItemSpellGrant) — this can genuinely differ from the
  // spell's own casting_time (a magic item can grant a faster or slower
  // cast than the spell normally has), so it's surfaced as its own field
  // rather than assumed to match.
  if (spell.grant) {
    const g = spell.grant
    if (g.actionType)
      fields.push({
        label: 'Via item',
        value: dnd.actionTypeBadgeLabel(g.actionType),
      })
    if (typeof g.chargeCost === 'number')
      fields.push({
        label: 'Cost',
        value: `${g.chargeCost} charge${g.chargeCost === 1 ? '' : 's'}`,
      })
    else if (g.chargeCost && typeof g.chargeCost === 'object')
      fields.push({
        label: 'Cost',
        value: `${g.chargeCost.min}-${g.chargeCost.max} charges (your choice)`,
      })
    else if (g.usesMax != null)
      fields.push({
        label: 'Uses',
        value: `${g.usesCurrent ?? g.usesMax}/${g.usesMax}${
          g.recharge ? ` · ${dnd.rechargeLabel(g.recharge)}` : ''
        }`,
      })
    if (g.materialComponentRequired) {
      fields.push({
        label: 'Material',
        value: data?.material ?? 'Required — bring your own component',
      })
    } else if (data?.components?.includes('M')) {
      fields.push({
        label: 'Material',
        value: 'Not required — item substitutes',
      })
    }
  }

  // spell.level is null for item/feature-granted spells (the grant doesn't
  // record a level) — fall back to the looked-up spell's own real level
  // rather than showing "Level null".
  const resolvedLevel = spell.level ?? data?.level ?? null
  const level =
    resolvedLevel === 0 ? 'Cantrip' : `Level ${resolvedLevel ?? '?'}`
  const school = data?.school ?? ''
  return {
    title: spell.name,
    subtitle: school ? `${level} · ${school}` : level,
    description: data?.description ?? null,
    fields,
    itemType: 'spell',
    editable: {
      name: spell.name,
      level: resolvedLevel,
      description: data?.description ?? null,
      school: data?.school ?? null,
      casting_time: data?.casting_time ?? null,
      range: data?.range ?? null,
      duration: data?.duration ?? null,
      concentration: data?.concentration ?? false,
      components: data?.components ?? null,
      save: data?.save ?? null,
      damage_type: data?.damage_type ?? null,
      spell_list: data?.spell_list ?? null,
    },
  }
}

export async function buildFeaturePopupData(feature) {
  // Species traits carry their own real description straight from
  // engine/data/species.json (copied onto the character record at creation
  // time — see NewCharacterTool.vue's speciesTraitRecords) — deliberately
  // skip the name-based lookupFeature cascade for these rather than risk the
  // exact "Lucky" (Halfling racial trait) vs. "Lucky" (PHB feat) collision
  // class of bug lookupFeature has already hit once (see
  // engine/CHECKLIST.md's feat-catalog writeup).
  const data =
    feature.type === 'speciesTrait' && feature.description
      ? { subtitle: null, description: feature.description }
      : await lookupFeature(feature.name, feature.id)
  const fields = []
  if (feature.action_type)
    fields.push({ label: 'Action', value: feature.action_type })
  if (feature.recharge)
    fields.push({ label: 'Recharge', value: feature.recharge })
  if (feature.uses_max != null) {
    const uses =
      feature.uses_current != null
        ? `${feature.uses_current}/${feature.uses_max}`
        : String(feature.uses_max)
    fields.push({ label: 'Uses', value: uses })
  }
  // Skip for species traits — their description is already the main body
  // above (data.description), so repeating it as an "Effect" field would
  // just show the same text twice.
  if (feature.description && feature.type !== 'speciesTrait')
    fields.push({ label: 'Effect', value: feature.description })
  if (feature.note) fields.push({ label: 'Note', value: feature.note })
  return {
    title: feature.name,
    subtitle: data?.subtitle ?? null,
    description: data?.description ?? null,
    fields,
    itemType: 'feature',
    editable: {
      name: feature.name,
      description: data?.description ?? null,
      subtitle: data?.subtitle ?? null,
      action_type: feature.action_type ?? null,
      recharge: feature.recharge ?? null,
    },
  }
}

// character/partyItems are optional — only weapons get attack/damage fields,
// and only when a character is passed (attack/damage bonuses need STR/DEX
// mod + proficiency, which live on the character, not the item). Versatile
// and thrown get their own separate lines rather than a single blended one —
// they're mechanically different attacks (different die, and a thrown attack
// always uses the base one-handed die even if the weapon's current grip is
// two-handed — real RAW, not modeled elsewhere in the app yet either, see
// TODO.md). When a weapon is BOTH versatile and thrown (Spear, Trident),
// the thrown attack's numbers are identical to the one-handed melee attack's
// (same ability mod, same base die), so those two are combined into one line
// instead of showing the same numbers twice.
export function buildItemPopupData(item, character = null, partyItems = []) {
  const fields = []

  if (item.type === 'weapon' && character) {
    const props = dnd._weaponProps(item)
    const dmgType = props.damage_type ? ` ${props.damage_type}` : ''
    const dmgBonus = dnd.damageBonus(character, item, partyItems)
    const dmgSuffix = dnd.signed(dmgBonus) + dmgType
    fields.push({
      label: 'Attack',
      value: dnd.signed(dnd.attackBonus(character, item, partyItems)),
    })
    const oneHandLabel =
      props.versatile && props.thrown
        ? 'One-Handed / Thrown'
        : props.versatile
        ? 'One-Handed'
        : props.thrown
        ? 'Thrown'
        : 'Damage'
    const range = props.thrown
      ? ` (range ${props.thrown.normal}/${props.thrown.long} ft.)`
      : ''
    fields.push({
      label: oneHandLabel,
      value: `${props.damage_dice}${dmgSuffix}${range}`,
    })
    if (props.versatile) {
      fields.push({
        label: 'Two-Handed',
        value: `${props.damage_dice_2h}${dmgSuffix}`,
      })
    }
    const propTags = []
    if (props.finesse) propTags.push('Finesse')
    if (props.returning) propTags.push('Returning')
    if (propTags.length)
      fields.push({ label: 'Properties', value: propTags.join(', ') })
  }

  if (item.effect) fields.push({ label: 'Effect', value: item.effect })
  if (item.description)
    fields.push({ label: 'Description', value: item.description })
  if (item.notes) fields.push({ label: 'Notes', value: item.notes })
  if (item.enhancement_bonus)
    fields.push({
      label: 'Enhancement',
      value: dnd.signed(item.enhancement_bonus),
    })
  const subtitleParts = [item.weapon_category ?? item.subtype ?? item.type]
  if (item.needs_attunement) subtitleParts.push('requires attunement')
  return {
    title: item.name,
    subtitle: subtitleParts.filter(Boolean).join(' · '),
    description: null,
    fields,
    itemType: 'item',
  }
}
