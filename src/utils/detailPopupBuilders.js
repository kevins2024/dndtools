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
  const data = await lookupFeature(feature.name, feature.id)
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
  if (feature.description)
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

export function buildItemPopupData(item) {
  const fields = []
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
