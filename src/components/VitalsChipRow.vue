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
    <div v-if="flySpeed" class="chip">
      <span class="chip-val has-tip" title="A Fly Speed equal to your Speed">{{
        flySpeed
      }}</span>
      <span class="chip-label">Fly</span>
    </div>
    <div v-if="sizeNow" class="chip">
      <span class="chip-val">{{ sizeNow }}</span>
      <span class="chip-label">Size</span>
    </div>
    <div v-if="tremorsense" class="chip">
      <span class="chip-val">{{ tremorsense }} ft</span>
      <span class="chip-label">Tremorsense</span>
    </div>
    <div class="chip">
      <span
        class="chip-val has-tip chip-clickable"
        :class="{ 'chip-off': !hasInspiration }"
        :title="heroicInspirationTooltip"
        @click="toggleHeroicInspiration"
        >{{ hasInspiration ? '★' : '☆' }}</span
      >
      <span class="chip-label">Inspiration</span>
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
    <div v-if="spellSaveDC !== null" class="chip">
      <span class="chip-val has-tip" :title="spellDCTooltip">{{
        spellSaveDC
      }}</span>
      <span class="chip-label">{{ saveLabel }}</span>
    </div>
    <div v-if="grappleDC" class="chip">
      <span class="chip-val has-tip" :title="grappleDC.tooltip">{{
        grappleDC.value
      }}</span>
      <span class="chip-label">Grapple DC</span>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { DEFAULT_SPEED_FT } from '@/utils/dnd_constants.js'
import StatChip from '@/components/StatChip.vue'
import engineSheet from '@/mixins/engineSheet'
import {
  HEROIC_INSPIRATION_RULE,
  hasHeroicInspiration,
  grantHeroicInspiration,
  spendHeroicInspiration,
} from '@/utils/heroicInspiration'

export default {
  name: 'VitalsChipRow',

  components: { StatChip },

  // `sheet`: the engine's calculated sheet for this character (speed, size, spellcasting, save DCs)
  mixins: [engineSheet],

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return { dnd }
  },

  computed: {
    hasInspiration() {
      return hasHeroicInspiration(this.character)
    },
    heroicInspirationTooltip() {
      return `Heroic Inspiration: ${HEROIC_INSPIRATION_RULE.summary}\n${
        this.hasInspiration
          ? 'You have it. Click when you spend it.'
          : 'You do not have it. Click when the DM gives it to you.'
      }`
    },
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

    // the Speed in feet; a temporary state (Large Form's +10 ft.) comes from the engine
    speedFeet() {
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
      return baseNum + itemBonus + featureBonus + this.grants.speedBonus
    },
    // The engine's Speed (species, lineage, class movement, feats, items, exhaustion, temporary states)
    // when it has answered; the older sum below only when there is no server (the static build).
    speed() {
      return this.sheet
        ? `${this.sheet.speed.value} ft`
        : `${this.speedFeet} ft`
    },
    flySpeed() {
      if (this.sheet)
        return this.sheet.flySpeed ? `${this.sheet.flySpeed.value} ft` : null
      return this.grants.flySpeedEqualsSpeed ? this.speed : null
    },
    sizeNow() {
      return this.sheet?.size.current ?? this.grants.size
    },
    tremorsense() {
      return this.grants.senses.tremorsense ?? 0
    },
    // Real mechanical wiring for species traits (2026-09-07) — darkvision
    // and resistances previously had nowhere on the PC-facing sheet to
    // show at all (darkvision was only ever displayed at New Character
    // creation time, resistances had no field anywhere in the app).
    grants() {
      return dnd.characterGrants(this.character)
    },
    darkvision() {
      return this.grants.darkvision
    },
    resistances() {
      return this.grants.resistances
    },
    // Informational only, per this app's DM-arbitrated design (see
    // CLAUDE.md) — advantage isn't a mechanic this app resolves or rolls
    // for anywhere, so this chip just surfaces a fact for the player/DM to
    // apply at the table (Fey Ancestry, Brave, Gnome Cunning, etc. — see
    // TODO.md/species.json's grants_saving_throw_advantage field).
    savingThrowAdvantageLabels() {
      return this.grants.savingThrowAdvantages.map((trigger) =>
        String(trigger).replace(/_/g, ' ')
      )
    },
    speedTooltip() {
      if (this.sheet) return this.sheet.speed.tooltip
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
      for (const line of this.grants.speedLines)
        parts.push(`${line.label} +${line.amount}`)
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

    // Every way this character casts, from the engine: each caster class with its own ability, and
    // each species or feat that casts with an ability of its own (Light Bearer, a lineage). null until
    // the engine sheet arrives.
    spellSources() {
      if (!this.sheet) return null
      const out = (this.sheet.spellcasting?.classes ?? []).map((c) => ({
        label: c.subclass ? `${c.class} (${c.subclass})` : c.class,
        ability: c.ability,
        dc: c.saveDC,
        attack: c.attackBonus,
      }))
      for (const s of this.sheet.featureSpellcasting ?? [])
        if (!out.some((o) => o.ability === s.ability))
          out.push({
            label: s.source,
            ability: s.ability,
            dc: s.saveDC,
            attack: s.attackBonus,
          })
      return out
    },
    spellAttack() {
      if (this.spellSources)
        return this.spellSources.length
          ? this.spellSources[0].attack.value
          : null
      return dnd.spellAttackBonus(this.character, this.partyItems)
    },
    spellAttackTooltip() {
      if (this.spellSources) return this.sourcesTooltip((s) => s.attack)
      return dnd.spellAttackBonusBreakdown(this.character, this.partyItems)
    },
    // The save DC to show: the first way the character casts, else a class feature's DC (Battle
    // Master's maneuvers, the Monk's Focus...). null when the character has none.
    classDC() {
      return this.sheet?.saveDCs?.[0] ?? null
    },
    // The save DC of the Grapple and Shove options of an Unarmed Strike (the engine's, with its
    // breakdown). null without the server.
    grappleDC() {
      return this.sheet?.grappleDC ?? null
    },
    spellSaveDC() {
      if (this.spellSources) {
        if (this.spellSources.length) return this.spellSources[0].dc.value
        return this.classDC ? this.classDC.saveDC.value : null
      }
      // no server: the older single-ability answer
      if (this.character.spellcasting_ability)
        return dnd.spellSaveDC(this.character, this.partyItems)
      return (
        8 +
        this.profBonus +
        Math.max(
          dnd.mod(this.resolvedStats.stats.str),
          dnd.mod(this.resolvedStats.stats.dex)
        )
      )
    },
    saveLabel() {
      if (this.spellSources && !this.spellSources.length && this.classDC)
        return this.classDC.label
      return 'Save DC'
    },
    spellDCTooltip() {
      if (this.spellSources) {
        if (!this.spellSources.length)
          return this.classDC ? this.classDC.saveDC.tooltip : ''
        return this.sourcesTooltip((s) => s.dc)
      }
      if (this.character.spellcasting_ability)
        return dnd.spellSaveDCBreakdown(this.character, this.partyItems)
      return ''
    },
  },

  methods: {
    // Click to spend Heroic Inspiration, or to give it (the DM awards it). The rules are in
    // engine/rules/5e/heroicInspiration.js.
    toggleHeroicInspiration() {
      const result = this.hasInspiration
        ? spendHeroicInspiration(this.character)
        : grantHeroicInspiration(this.character)
      if (!Object.keys(result.patch).length) return
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, ...result.patch },
      })
    },
    // The first source's breakdown, then one line per way of casting when there are several
    sourcesTooltip(pick) {
      const [first, ...rest] = this.spellSources
      const lines = [pick(first).tooltip]
      if (rest.length) {
        lines.push('', 'Other ways this character casts:')
        for (const s of rest)
          lines.push(
            `${s.label} (${s.ability.toUpperCase()}): attack ${dnd.signed(
              s.attack.value
            )}, DC ${s.dc.value}`
          )
      }
      return lines.join('\n')
    },
  },
}
</script>

<style scoped>
.chip-off {
  opacity: 0.45;
}
.chip-clickable {
  cursor: pointer;
}

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
