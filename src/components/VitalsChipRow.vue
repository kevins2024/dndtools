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
    <div v-if="darkvision" class="chip">
      <span class="chip-val">{{ darkvision }} ft</span>
      <span class="chip-label">Darkvision</span>
    </div>
    <div v-if="resistances.length" class="chip">
      <span class="chip-val has-tip" :title="resistances.join(', ')">{{
        resistances.length
      }}</span>
      <span class="chip-label">Resist</span>
    </div>
    <div v-if="savingThrowAdvantageLabels.length" class="chip">
      <span
        class="chip-val has-tip"
        :title="savingThrowAdvantageLabels.join(', ')"
        >{{ savingThrowAdvantageLabels.length }}</span
      >
      <span class="chip-label">Adv. Saves</span>
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
    // Engine-backed breakdown (2026-09-30) — the old hand-written version
    // just described the level table from scratch and never actually showed
    // an item bonus (e.g. an Ioun Stone of Mastery) even when one applied.
    profBonusTooltip() {
      return dnd.profBonusBreakdown(
        this.character,
        this.resolvedStats.bonuses,
        this.partyItems
      )
    },
    equippedItems() {
      return this.partyItems.filter(
        (i) => i.equipped_by === this.character.name
      )
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
    // Real mechanical wiring for species traits (2026-09-07) — darkvision
    // and resistances previously had nowhere on the PC-facing sheet to
    // show at all (darkvision was only ever displayed at New Character
    // creation time, resistances had no field anywhere in the app).
    darkvision() {
      return this.character.darkvision ?? 0
    },
    resistances() {
      return this.character.resistances ?? []
    },
    // Informational only, per this app's DM-arbitrated design (see
    // CLAUDE.md) — advantage isn't a mechanic this app resolves or rolls
    // for anywhere, so this chip just surfaces a fact for the player/DM to
    // apply at the table (Fey Ancestry, Brave, Gnome Cunning, etc. — see
    // TODO.md/species.json's grants_saving_throw_advantage field).
    savingThrowAdvantageLabels() {
      return (this.character.saving_throw_advantages ?? []).map((trigger) =>
        String(trigger).replace(/_/g, ' ')
      )
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
    // Engine-backed breakdown (2026-09-30) — see dnd_utils.js's
    // passivePerceptionBreakdown/engine checks.js.
    passivePerceptionTooltip() {
      return dnd.passivePerceptionBreakdown(this.character, this.partyItems)
    },

    spellAttack() {
      return dnd.spellAttackBonus(this.character, this.partyItems)
    },
    // Engine-backed breakdown (2026-09-30) — returns '' for a non-caster,
    // same as before (the chip itself is v-if="spellAttack !== null" gated,
    // so this was never actually rendered for one anyway).
    spellAttackTooltip() {
      return dnd.spellAttackBonusBreakdown(this.character, this.partyItems)
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
    // Only the spellcasting-ability branch is engine-backed (2026-09-30) —
    // the non-caster fallback below (8 + Prof + best of STR/DEX, for a
    // martial character's maneuver-style save DC) has no spellcasting_ability
    // at all, so it isn't something spellSaveDCBreakdown can compute; it
    // stays hand-written here since it was never duplicated anywhere else.
    spellDCTooltip() {
      if (this.character.spellcasting_ability) {
        return dnd.spellSaveDCBreakdown(this.character, this.partyItems)
      }
      const prof = this.profBonus
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
