<template>
  <div class="combat-panel">
    <div class="chip-row">
      <div class="chip">
        <span class="chip-val"
          >{{ character.hp_current }}/{{ character.hp_max }}</span
        >
        <span class="chip-label">HP</span>
      </div>
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
        <span class="chip-val">+{{ profBonus }}</span>
        <span class="chip-label">Prof</span>
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
        <span class="chip-label">Save DC</span>
      </div>
    </div>

    <!-- Conditions -->
    <div class="conditions-row">
      <span
        v-for="cond in CONDITIONS"
        :key="cond"
        class="cond-chip"
        :class="{ 'cond-chip--active': activeConditions.includes(cond) }"
        @click="toggleCondition(cond)"
      >{{ cond }}</span>
    </div>

    <template v-if="weaponSummaries.length">
      <div class="section-label">Weapons</div>
      <table class="weapon-table">
        <thead>
          <tr>
            <th>Name</th>
            <th class="col-num" title="Attack bonus">Atk</th>
            <th class="col-num" title="Damage dice + modifier">Dmg</th>
            <th class="col-tag">Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in weaponSummaries" :key="w.name">
            <td class="weapon-name">{{ w.name }}</td>
            <td class="col-num">
              <span class="has-tip" :title="w.atkTooltip">{{ w.attack }}</span>
            </td>
            <td class="col-num">
              <span class="has-tip" :title="w.dmgTooltip">{{ w.damage }}</span>
            </td>
            <td class="col-tag">{{ w.type }}</td>
          </tr>
        </tbody>
      </table>
    </template>
    <div v-else class="section-empty">No weapons equipped</div>

    <!-- Features & Spells filter -->
    <div v-if="hasFilterableContent" class="feature-filter-row">
      <button
        v-for="opt in featureFilterOptions"
        :key="opt.value"
        class="filter-btn"
        :class="{ 'filter-btn--active': featureFilter === opt.value }"
        @click="featureFilter = opt.value"
      >{{ opt.label }}</button>
    </div>

    <!-- Features -->
    <div v-for="group in featureGroups" :key="group.type" class="pill-group">
      <div class="pill-group-label">{{ group.label }}</div>
      <div class="pill-row">
        <span
          v-for="f in group.items"
          :key="f.name"
          class="feature-pill"
          @click="openFeaturePopup(f)"
          >{{ f.name }}</span
        >
      </div>
    </div>

    <!-- Feats -->
    <template v-if="visibleFeats.length || hiddenFeats.length">
      <div class="feat-header">
        <span class="section-label">Feats</span>
        <button
          v-if="hiddenFeats.length"
          class="show-hidden-toggle"
          @click="showHiddenFeats = !showHiddenFeats"
        >
          {{
            showHiddenFeats ? 'collapse hidden' : `${hiddenFeats.length} hidden`
          }}
        </button>
      </div>
      <div class="pill-row">
        <span
          v-for="feat in visibleFeats"
          :key="feat.name"
          class="feat-pill"
          @click="openFeaturePopup(feat)"
        >
          {{ feat.name }}
          <button
            class="feat-action"
            title="Hide from battle"
            @click.stop="toggleFeatHidden(feat, true)"
          >
            Ã—
          </button>
        </span>
        <template v-if="showHiddenFeats">
          <span
            v-for="feat in hiddenFeats"
            :key="feat.name"
            class="feat-pill feat-pill--hidden"
            @click="openFeaturePopup(feat)"
          >
            {{ feat.name }}
            <button
              class="feat-action feat-action--restore"
              title="Show in battle"
              @click.stop="toggleFeatHidden(feat, false)"
            >
              â†©
            </button>
          </span>
        </template>
      </div>
    </template>

    <!-- Spell Slots -->
    <template v-if="spellSlotLevels.length">
      <div class="section-label">Spell Slots</div>
      <div class="spell-slots">
        <div v-for="lvl in spellSlotLevels" :key="lvl.key" class="slot-level">
          <span class="slot-level-label">{{ lvl.label }}</span>
          <span
            v-for="i in lvl.max"
            :key="i"
            class="slot-box"
            :class="{ used: i <= lvl.max - lvl.current }"
            :title="
              i <= lvl.max - lvl.current
                ? 'Used â€” click to recover'
                : 'Available â€” click to use'
            "
            @click="toggleSlot(lvl.key, i - 1)"
          ></span>
        </div>
      </div>
    </template>

    <!-- Spells -->
    <template v-if="spellGroups.length">
      <div class="section-label">Spells</div>
      <div v-for="group in spellGroups" :key="group.label" class="pill-group">
        <div class="pill-group-label">{{ group.label }}</div>
        <div class="pill-row">
          <span
            v-for="spell in group.spells"
            :key="spell.name"
            class="spell-pill"
            :class="{ 'spell-pill--domain': spell.domain }"
            :title="spell.domain ? 'Domain spell â€” always prepared' : null"
            @click="openSpellPopup(spell)"
            >{{ spell.name
            }}<Sparkle
              v-if="spellMeta[spell.name] && spellMeta[spell.name].concentration"
              class="conc-icon"
              title="Concentration"
            /></span>
        </div>
      </div>
    </template>

    <DetailPopup
      v-if="popupItem"
      :open="popupOpen"
      :readonly="true"
      :item="popupItem"
      @close="popupOpen = false"
    />
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { DEFAULT_SPEED_FT } from '@/utils/dnd_constants.js'
import { lookupSpell, lookupFeature } from '@/utils/lookupService.js'
import DetailPopup from '@/components/DetailPopup.vue'
import StatChip from '@/components/StatChip.vue'
import { Sparkle } from 'lucide-vue'

export default {
  name: 'CharacterCombatPanel',

  components: { DetailPopup, StatChip, Sparkle },

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return {
      popupOpen: false,
      popupItem: null,
      spellMeta: {},
      showHiddenFeats: false,
      featureFilter: 'all',
      featureFilterOptions: [
        { value: 'all', label: 'All' },
        { value: 'action', label: 'Action' },
        { value: 'bonus_action', label: 'Bonus' },
        { value: 'reaction', label: 'Reaction' },
        { value: 'passive', label: 'Passive' },
      ],
      CONDITIONS: ['Concentrating', 'Blessed', 'Hexed', 'Poisoned', 'Prone', 'Frightened', 'Charmed', 'Stunned', 'Paralyzed', 'Grappled', 'Restrained', 'Blinded', 'Deafened', 'Invisible', 'Incapacitated', 'Exhausted'],
    }
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
    someFeatures() {
      return (this.character.features ?? []).some((f) => f.type !== 'feat')
    },
    hasFilterableContent() {
      return (
        this.someFeatures ||
        (this.character.spells ?? []).length > 0 ||
        (this.character.artillerist_spells?.spells ?? []).length > 0
      )
    },
    activeConditions() {
      return this.character.conditions ?? []
    },

    ac() {
      return dnd.ac(this.character, { carriedPartyItems: this.partyItems })
    },
    acExplain() {
      return () =>
        dnd.acBreakdown(this.character, { carriedPartyItems: this.partyItems })
    },

    speed() {
      const s = this.character.speed
      if (!s) return `${DEFAULT_SPEED_FT} ft`
      const base = typeof s === 'number' ? `${s} ft` : s
      const bonus = this.equippedItems.reduce(
        (sum, i) => sum + (i.stat_bonuses?.speed ?? 0),
        0
      )
      return bonus
        ? `${(typeof s === 'number' ? s : DEFAULT_SPEED_FT) + bonus} ft`
        : base
    },
    speedTooltip() {
      return this.character.speed ? '' : `Default ${DEFAULT_SPEED_FT} ft`
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
      const base = `${ab.toUpperCase()} ${dnd.signed(mod)} + Prof ${dnd.signed(prof)}`
      if (!itemBonus) return `${base} = ${dnd.signed(mod + prof)}`
      const itemStr = (this.itemBonusBreakdown.spell_attack ?? [])
        .map(({ name, value }) => `${name} ${dnd.signed(value)}`)
        .join(', ')
      return `${base} + ${itemStr} = ${dnd.signed(mod + prof + itemBonus)}`
    },
    spellSaveDC() {
      return dnd.spellSaveDC(this.character, this.partyItems)
    },
    spellDCTooltip() {
      if (!this.character.spellcasting_ability) return ''
      const ab = this.character.spellcasting_ability
      const mod = dnd.mod(this.resolvedStats.stats[ab])
      const prof = this.profBonus
      const itemBonus = this.resolvedStats.bonuses.spell_save_dc ?? 0
      const base = `8 + ${ab.toUpperCase()} ${dnd.signed(mod)} + Prof ${dnd.signed(prof)}`
      if (!itemBonus) return `${base} = ${8 + mod + prof}`
      const itemStr = (this.itemBonusBreakdown.spell_save_dc ?? [])
        .map(({ name, value }) => `${name} ${dnd.signed(value)}`)
        .join(', ')
      return `${base} + ${itemStr} = ${8 + mod + prof + itemBonus}`
    },

    weaponSummaries() {
      const { stats, bonuses } = this.resolvedStats
      const strMod = dnd.mod(stats.str)
      const dexMod = dnd.mod(stats.dex)
      const prof = this.profBonus

      const weapons = this.equippedItems.filter((i) => i.type === 'weapon')
      const summaries = weapons.map((w) => {
        const props = dnd._weaponProps(w)
        const magic = w.enhancement_bonus ?? 0
        let statMod, statDesc
        if (props.finesse) {
          statMod = Math.max(strMod, dexMod)
          statDesc = `Finesse â€” best of STR ${dnd.signed(
            strMod
          )}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)}`
        } else if (props.weapon_type === 'ranged') {
          statMod = dexMod
          statDesc = `DEX ${dnd.signed(dexMod)}`
        } else {
          statMod = strMod
          statDesc = `STR ${dnd.signed(strMod)}`
        }
        const atkBonusKey = props.weapon_type === 'ranged' ? 'ranged_attack' : 'melee_attack'
        const atkTotal = dnd.attackBonus(this.character, w, this.partyItems)
        const atkParts = [statDesc, `Prof ${dnd.signed(prof)}`]
        if (magic) atkParts.push(`Enchanted ${dnd.signed(magic)}`)
        ;(this.itemBonusBreakdown[atkBonusKey] ?? []).forEach(({ name, value }) =>
          atkParts.push(`${name} ${dnd.signed(value)}`)
        )
        atkParts.push(`= ${dnd.signed(atkTotal)}`)

        const dmgBonus = dnd.damageBonus(this.character, w, this.partyItems)
        const die = dnd.gripDie(this.character, w, this.partyItems)
        const dmgParts = [die, statDesc.split('â€”')[0].trim()]
        if (magic) dmgParts.push(`Enchanted ${dnd.signed(magic)}`)
        if (props.weapon_type === 'ranged') {
          ;(this.itemBonusBreakdown['ranged_damage'] ?? []).forEach(({ name, value }) =>
            dmgParts.push(`${name} ${dnd.signed(value)}`)
          )
        }

        return {
          name: w.name,
          attack: dnd.signed(atkTotal),
          damage: `${die}${dnd.signed(dmgBonus)}`,
          type: props.weapon_type,
          atkTooltip: atkParts.join(' + ').replace(' + =', ' ='),
          dmgTooltip: dmgParts.join(' + '),
        }
      })

      if (this.character.martial_arts_die) {
        const die = this.character.martial_arts_die
        const statMod = Math.max(strMod, dexMod)
        const unarmedAtk = bonuses.unarmed_attack ?? 0
        const unarmedDmg = bonuses.unarmed_damage ?? 0
        const atkTotal = statMod + prof + unarmedAtk
        const dmgTotal = statMod + unarmedDmg
        const atkParts = [
          `Martial Arts ${dnd.signed(statMod)}`,
          `Prof ${dnd.signed(prof)}`,
        ]
        if (unarmedAtk) atkParts.push(`Items ${dnd.signed(unarmedAtk)}`)
        atkParts.push(`= ${dnd.signed(atkTotal)}`)
        const dmgParts = [`${die}`, `STR/DEX ${dnd.signed(statMod)}`]
        if (unarmedDmg) dmgParts.push(`Items ${dnd.signed(unarmedDmg)}`)
        summaries.unshift({
          name: 'Unarmed Strike',
          attack: dnd.signed(atkTotal),
          damage: `${die}${dnd.signed(dmgTotal)}`,
          type: 'melee',
          atkTooltip: atkParts.join(' + ').replace('+ =', '='),
          dmgTooltip: dmgParts.join(' + '),
        })
      }

      return summaries
    },

    visibleFeats() {
      return (this.character.features ?? []).filter(
        (f) => f.type === 'feat' && !f.battle_hidden
      )
    },
    hiddenFeats() {
      return (this.character.features ?? []).filter(
        (f) => f.type === 'feat' && f.battle_hidden
      )
    },
    featureGroups() {
      let features = (this.character.features ?? []).filter(
        (f) => f.type !== 'feat'
      )
      if (this.featureFilter !== 'all') {
        features = features.filter((f) =>
          this.featureFilter === 'passive' ? !f.action_type : f.action_type === this.featureFilter
        )
      }
      const TYPE_ORDER = ['feature', 'maneuver']
      const TYPE_LABEL = { feature: 'Features', maneuver: 'Maneuvers' }
      const map = {}
      for (const f of features) {
        const t = f.type || 'feature'
        ;(map[t] = map[t] ?? []).push(f)
      }
      const known = TYPE_ORDER.filter((t) => map[t]).map((t) => ({
        type: t,
        label: TYPE_LABEL[t],
        items: map[t],
      }))
      const other = Object.keys(map)
        .filter((t) => !TYPE_ORDER.includes(t))
        .map((t) => ({
          type: t,
          label: t.charAt(0).toUpperCase() + t.slice(1) + 's',
          items: map[t],
        }))
      return [...known, ...other]
    },

    spellSlotLevels() {
      const result = []
      const slots = this.character.spell_slots
      if (slots) {
        result.push(
          ...Object.entries(slots)
            .map(([key, slot]) => ({
              key,
              label: key.replace('level_', 'L'),
              max: slot.max,
              current: slot.current ?? slot.max,
            }))
            .filter((s) => s.max > 0)
        )
      }
      const pm = this.character.pact_magic
      if (pm && pm.max > 0) {
        result.push({
          key: 'pact',
          label: `Pact L${pm.slot_level}`,
          max: pm.max,
          current: pm.current ?? pm.max,
        })
      }
      return result
    },

    spellGroups() {
      let spells = [
        ...(this.character.spells ?? []),
        ...(this.character.artillerist_spells?.spells ?? []).map((s) => ({
          ...s,
          domain: true,
        })),
      ]
      if (this.featureFilter !== 'all') {
        spells = spells.filter((s) => {
          const at = this.spellMeta[s.name]?.actionType
          if (this.featureFilter === 'passive') return !at || at === 'passive'
          return at === this.featureFilter
        })
      }
      const map = {}
      for (const s of spells) {
        const lvl = s.level ?? 0
        ;(map[lvl] = map[lvl] ?? []).push(s)
      }
      return Object.keys(map)
        .map(Number)
        .sort((a, b) => a - b)
        .map((lvl) => ({
          label: lvl === 0 ? 'Cantrips' : `Level ${lvl}`,
          spells: map[lvl],
        }))
    },
  },

  methods: {
    toggleFeatHidden(feat, hidden) {
      const updatedFeatures = (this.character.features ?? []).map((f) =>
        f.name === feat.name && f.type === 'feat'
          ? { ...f, battle_hidden: hidden }
          : f
      )
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, features: updatedFeatures },
      })
    },

    toggleSlot(levelKey, slotIndex) {
      if (levelKey === 'pact') {
        const pm = this.character.pact_magic
        const cur = pm.current ?? pm.max
        const used = pm.max - cur
        const newCurrent = slotIndex < used ? cur + 1 : cur - 1
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: 'characters',
          updatedItem: {
            ...this.character,
            pact_magic: { ...pm, current: Math.min(pm.max, Math.max(0, newCurrent)) },
          },
        })
        return
      }
      const slot = this.character.spell_slots[levelKey]
      const cur = slot.current ?? slot.max
      const used = slot.max - cur
      const newCurrent = slotIndex < used ? cur + 1 : cur - 1
      const updatedSlots = {
        ...this.character.spell_slots,
        [levelKey]: {
          ...slot,
          current: Math.min(slot.max, Math.max(0, newCurrent)),
        },
      }
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, spell_slots: updatedSlots },
      })
    },

    toggleCondition(cond) {
      const current = [...this.activeConditions]
      const idx = current.indexOf(cond)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(cond)
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, conditions: current },
      })
    },

    async loadSpellMeta() {
      const spells = [
        ...(this.character.spells ?? []),
        ...(this.character.artillerist_spells?.spells ?? []),
      ]
      const meta = {}
      await Promise.all(
        spells.map(async (s) => {
          const data = await lookupSpell(s.name)
          if (data) {
            const ct = (data.casting_time ?? '').toLowerCase()
            let actionType = 'passive'
            if (ct.includes('bonus action')) actionType = 'bonus_action'
            else if (ct.includes('reaction')) actionType = 'reaction'
            else if (ct.includes('action')) actionType = 'action'
            meta[s.name] = { concentration: !!data.concentration, actionType }
          }
        })
      )
      this.spellMeta = meta
    },

    async openSpellPopup(spell) {
      const data = await lookupSpell(spell.name)
      const fields = []
      if (data?.casting_time)
        fields.push({ label: 'Cast', value: data.casting_time })
      if (data?.range) fields.push({ label: 'Range', value: data.range })
      if (data?.duration)
        fields.push({ label: 'Duration', value: data.duration })
      if (data?.concentration) fields.push({ label: 'Conc', value: 'Yes' })
      if (data?.components)
        fields.push({ label: 'Comp', value: data.components })
      if (data?.save) fields.push({ label: 'Save', value: data.save })
      if (data?.damage_type)
        fields.push({ label: 'Dmg', value: data.damage_type })

      const level = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`
      const school = data?.school ?? ''
      this.popupItem = {
        title: spell.name,
        subtitle: school ? `${level} Â· ${school}` : level,
        description: data?.description ?? null,
        fields,
        itemType: 'spell',
        editable: {
          name: spell.name,
          level: spell.level,
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
      this.popupOpen = true
    },

    async openFeaturePopup(feature) {
      const data = await lookupFeature(feature.name)
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
      if (feature.note) fields.push({ label: 'Note', value: feature.note })
      this.popupItem = {
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
      this.popupOpen = true
    },
  },

  async created() {
    this.dnd = dnd
    await this.loadSpellMeta()
  },
}
</script>

<style scoped>
.combat-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
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

.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.section-empty {
  font-size: var(--font-size-md);
  color: var(--color-text-low);
}

.weapon-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-md);
}

.weapon-table th {
  text-align: left;
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  font-weight: normal;
  color: var(--color-text-low);
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
}

.weapon-table td {
  padding: 0.4rem 0.5rem 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
}

.weapon-table tr:last-child td {
  border-bottom: none;
}

.weapon-table th.col-num,
.weapon-table td.col-num {
  text-align: right;
  min-width: 3rem;
  font-family: var(--font-display);
  color: var(--color-accent-strong);
}

.weapon-table th.col-tag,
.weapon-table td.col-tag {
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  padding-left: 0.5rem;
}

.weapon-name {
  color: var(--color-text);
}

/* â”€â”€ Features & Spells â”€â”€ */
.pill-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
}

.pill-group-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  letter-spacing: 0.04em;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.feature-pill,
.spell-pill {
  font-size: var(--font-size-base);
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.feature-pill:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.spell-pill {
  border-color: var(--color-bg-surface-alt);
  color: var(--color-accent);
}

.spell-pill:hover {
  border-color: var(--color-accent-strong);
  color: var(--color-accent-strong);
}

.spell-pill--domain {
  border-style: dashed;
  opacity: 0.8;
}

.conc-icon {
  width: 0.75em;
  height: 0.75em;
  margin-left: 0.4em;
  opacity: 0.65;
  vertical-align: middle;
  pointer-events: auto;
}

/* â”€â”€ Feats â”€â”€ */
.feat-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.show-hidden-toggle {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.show-hidden-toggle:hover {
  color: var(--color-text-muted);
}

.feat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: var(--font-size-base);
  padding: 0.15rem 0.3rem 0.15rem 0.5rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.feat-pill:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.feat-pill--hidden {
  opacity: 0.35;
  border-style: dashed;
}

.feat-action {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--font-size-base);
  color: inherit;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 0.12s;
}

.feat-action:hover {
  opacity: 1;
}

.feat-action--restore {
  font-size: var(--font-size-xs);
}

/* â”€â”€ Spell Slots â”€â”€ */
.spell-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.75rem;
}

.slot-level {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.slot-level-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  width: 1.5rem;
  flex-shrink: 0;
}

.slot-box {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--color-accent);
  background: var(--color-accent);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}

.slot-box.used {
  background: transparent;
  border-color: var(--color-text-low);
}

.slot-box:hover {
  opacity: 0.75;
}

/* â”€â”€ Conditions â”€â”€ */
.conditions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.cond-chip {
  font-size: var(--font-size-xs);
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-low);
  cursor: pointer;
  letter-spacing: 0.03em;
  user-select: none;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.cond-chip:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.cond-chip--active {
  border-color: #e67e22;
  color: #e67e22;
  background: rgba(230, 126, 34, 0.12);
}

/* â”€â”€ Feature filter â”€â”€ */
.feature-filter-row {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-btn {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-low);
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: border-color 0.12s, color 0.12s;
}

.filter-btn:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.filter-btn--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
