<template>
  <div class="chip-row">
    <div class="chip">
      <span class="chip-val"
        ><StatChip :value="ac" :explain="acExplain"
      /></span>
      <span class="chip-label">AC</span>
    </div>
    <div class="chip">
      <span class="chip-val has-tip" :title="speedTooltip">{{ speed }}</span>
      <span class="chip-label">Speed</span>
    </div>
    <div class="chip">
      <span class="chip-val has-tip" :title="profBonusTooltip"
        >+{{ profBonus }}</span
      >
      <span class="chip-label">Prof</span>
    </div>
    <div class="chip">
      <span class="chip-val has-tip" :title="passivePerceptionTooltip">{{
        passivePerception
      }}</span>
      <span class="chip-label">Passive Perc</span>
    </div>
    <div v-if="spellAttack !== null" class="chip">
      <span class="chip-val has-tip" :title="spellAttackTooltip">{{
        dnd.signed(spellAttack)
      }}</span>
      <span class="chip-label">Spell Atk</span>
    </div>
    <div class="chip">
      <span class="chip-val has-tip" :title="spellDCTooltip">{{
        spellSaveDC
      }}</span>
      <span class="chip-label">Save DC</span>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { DEFAULT_SPEED_FT } from '@/utils/dnd_constants.js'
import StatChip from '@/components/StatChip.vue'

export default {
  name: 'VitalsChipRow',

  components: { StatChip },

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return { dnd }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    resolvedStats() {
      return dnd.resolveStats(this.character, this.partyItems)
    },
    profBonus() {
      return dnd._prof(this.character, this.resolvedStats.bonuses)
    },
    profBonusTooltip() {
      const lvl = this.character.level ?? 1
      return `Level ${lvl} character\n+2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20\n= +${this.profBonus}`
    },
    equippedItems() {
      return this.partyItems.filter(
        (i) => i.equipped_by === this.character.name
      )
    },
    itemBonusBreakdown() {
      const result = {}
      for (const item of this.equippedItems) {
        for (const [key, val] of Object.entries(item.stat_bonuses ?? {})) {
          if (!result[key]) result[key] = []
          result[key].push({ name: item.name, value: val })
        }
      }
      return result
    },

    ac() {
      return dnd.ac(this.character, { carriedPartyItems: this.partyItems })
    },
    acExplain() {
      return () =>
        dnd.acBreakdown(this.character, { carriedPartyItems: this.partyItems })
    },

    speed() {
      const baseNum =
        typeof this.character.speed === 'number'
          ? this.character.speed
          : DEFAULT_SPEED_FT
      const itemBonus = this.equippedItems.reduce(
        (sum, i) => sum + (i.stat_bonuses?.speed ?? 0),
        0
      )
      const featureBonus = (this.character.features ?? []).reduce(
        (sum, f) => sum + (f.stat_bonuses?.speed ?? 0),
        0
      )
      return `${baseNum + itemBonus + featureBonus} ft`
    },
    speedTooltip() {
      const hasExplicit = typeof this.character.speed === 'number'
      const baseNum = hasExplicit ? this.character.speed : DEFAULT_SPEED_FT
      const parts = [`${baseNum} ft${hasExplicit ? '' : ' (default)'}`]
      for (const f of this.character.features ?? []) {
        const bonus = f.stat_bonuses?.speed
        if (bonus) parts.push(`${f.name} +${bonus}`)
      }
      for (const i of this.equippedItems) {
        const bonus = i.stat_bonuses?.speed
        if (bonus) parts.push(`${i.name} +${bonus}`)
      }
      return parts.length > 1 ? parts.join(' · ') : ''
    },
    passivePerception() {
      return dnd.passivePerception(this.character, this.partyItems)
    },
    passivePerceptionTooltip() {
      const { stats } = this.resolvedStats
      const wisMod = dnd.mod(stats.wis)
      const prof = this.profBonus
      const isProficient = (this.character.skill_proficiencies ?? []).includes(
        'Perception'
      )
      const hasExpertise = (this.character.skill_expertise ?? []).includes(
        'Perception'
      )
      const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0
      const itemBonus = this.resolvedStats.bonuses['skill_Perception'] ?? 0
      const featBonus = this.resolvedStats.bonuses.passive_perception ?? 0
      const parts = ['10 (base)', `WIS ${dnd.signed(wisMod)}`]
      if (hasExpertise)
        parts.push(`Expertise ${dnd.signed(profBonus)} (Prof ×2)`)
      else if (isProficient) parts.push(`Prof ${dnd.signed(profBonus)}`)
      if (itemBonus) parts.push(`Items ${dnd.signed(itemBonus)}`)
      if (featBonus) parts.push(`Feat bonus ${dnd.signed(featBonus)}`)
      parts.push(`= ${dnd.passivePerception(this.character, this.partyItems)}`)
      return parts.join('\n')
    },

    spellAttack() {
      return dnd.spellAttackBonus(this.character, this.partyItems)
    },
    spellAttackTooltip() {
      if (!this.character.spellcasting_ability) return ''
      const ab = this.character.spellcasting_ability
      const mod = dnd.mod(this.resolvedStats.stats[ab])
      const prof = this.profBonus
      const itemBonus = this.resolvedStats.bonuses.spell_attack ?? 0
      const base = `${ab.toUpperCase()} ${dnd.signed(mod)} + Prof ${dnd.signed(
        prof
      )}`
      if (!itemBonus) return `${base} = ${dnd.signed(mod + prof)}`
      const itemStr = (this.itemBonusBreakdown.spell_attack ?? [])
        .map(({ name, value }) => `${name} ${dnd.signed(value)}`)
        .join(', ')
      return `${base} + ${itemStr} = ${dnd.signed(mod + prof + itemBonus)}`
    },
    spellSaveDC() {
      if (this.character.spellcasting_ability) {
        return dnd.spellSaveDC(this.character, this.partyItems)
      }
      const { stats } = this.resolvedStats
      return (
        8 + this.profBonus + Math.max(dnd.mod(stats.str), dnd.mod(stats.dex))
      )
    },
    spellDCTooltip() {
      const prof = this.profBonus
      if (this.character.spellcasting_ability) {
        const ab = this.character.spellcasting_ability
        const mod = dnd.mod(this.resolvedStats.stats[ab])
        const itemBonus = this.resolvedStats.bonuses.spell_save_dc ?? 0
        const base = `8 + ${ab.toUpperCase()} ${dnd.signed(
          mod
        )} + Prof ${dnd.signed(prof)}`
        if (!itemBonus) return `${base} = ${8 + mod + prof}`
        const itemStr = (this.itemBonusBreakdown.spell_save_dc ?? [])
          .map(({ name, value }) => `${name} ${dnd.signed(value)}`)
          .join(', ')
        return `${base} + ${itemStr} = ${8 + mod + prof + itemBonus}`
      }
      const { stats } = this.resolvedStats
      const strMod = dnd.mod(stats.str)
      const dexMod = dnd.mod(stats.dex)
      const statMod = Math.max(strMod, dexMod)
      const statName = statMod === dexMod && dexMod >= strMod ? 'DEX' : 'STR'
      return `8 + ${statName} ${dnd.signed(statMod)} + Prof ${dnd.signed(
        prof
      )} = ${8 + statMod + prof}`
    },
  },
}
</script>

<style scoped>
.chip-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.9rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: default;
  min-width: 4rem;
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
}

.chip-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  line-height: 1;
}

.chip-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  margin-top: 0.15rem;
}
</style>
