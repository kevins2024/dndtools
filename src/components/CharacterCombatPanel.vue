<template>
  <div class="combat-panel">

    <div class="chip-row">
      <div class="chip">
        <span class="chip-val">{{ character.hp_current }}/{{ character.hp_max }}</span>
        <span class="chip-label">HP</span>
      </div>
      <div class="chip">
        <span class="chip-val"><StatChip :value="ac" :explain="acExplain" /></span>
        <span class="chip-label">AC</span>
      </div>
      <div class="chip" :title="speedTooltip">
        <span class="chip-val">{{ speed }}</span>
        <span class="chip-label">Speed</span>
      </div>
      <div class="chip">
        <span class="chip-val">+{{ profBonus }}</span>
        <span class="chip-label">Prof</span>
      </div>
      <div v-if="spellAttack !== null" class="chip" :title="spellAttackTooltip">
        <span class="chip-val">{{ dnd.signed(spellAttack) }}</span>
        <span class="chip-label">Spell Atk</span>
      </div>
      <div v-if="spellSaveDC !== null" class="chip" :title="spellDCTooltip">
        <span class="chip-val">{{ spellSaveDC }}</span>
        <span class="chip-label">Save DC</span>
      </div>
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
            <td class="col-num" :title="w.atkTooltip">{{ w.attack }}</td>
            <td class="col-num" :title="w.dmgTooltip">{{ w.damage }}</td>
            <td class="col-tag">{{ w.type }}</td>
          </tr>
        </tbody>
      </table>
    </template>
    <div v-else class="section-empty">No weapons equipped</div>

    <!-- Features -->
    <div v-for="group in featureGroups" :key="group.type" class="pill-group">
      <div class="pill-group-label">{{ group.label }}</div>
      <div class="pill-row">
        <span
          v-for="f in group.items"
          :key="f.name"
          class="feature-pill"
          @click="openFeaturePopup(f)"
        >{{ f.name }}</span>
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
        >{{ showHiddenFeats ? 'collapse hidden' : `${hiddenFeats.length} hidden` }}</button>
      </div>
      <div class="pill-row">
        <span
          v-for="feat in visibleFeats"
          :key="feat.name"
          class="feat-pill"
          @click="openFeaturePopup(feat)"
        >
          {{ feat.name }}
          <button class="feat-action" title="Hide from battle" @click.stop="toggleFeatHidden(feat, true)">×</button>
        </span>
        <template v-if="showHiddenFeats">
          <span
            v-for="feat in hiddenFeats"
            :key="feat.name"
            class="feat-pill feat-pill--hidden"
            @click="openFeaturePopup(feat)"
          >
            {{ feat.name }}
            <button class="feat-action feat-action--restore" title="Show in battle" @click.stop="toggleFeatHidden(feat, false)">↩</button>
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
            :title="i <= lvl.max - lvl.current ? 'Used — click to recover' : 'Available — click to use'"
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
            :title="spell.domain ? 'Domain spell — always prepared' : null"
            @click="openSpellPopup(spell)"
          >{{ spell.name }}</span>
        </div>
      </div>
    </template>

    <DetailPopup
      v-if="popupItem"
      :open="popupOpen"
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

export default {
  name: 'CharacterCombatPanel',

  components: { DetailPopup, StatChip },

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return {
      popupOpen: false,
      popupItem: null,
      showHiddenFeats: false,
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
      return this.partyItems.filter((i) => i.equipped_by === this.character.name)
    },

    ac() {
      return dnd.ac(this.character, { carriedPartyItems: this.partyItems })
    },
    acExplain() {
      return () => dnd.acBreakdown(this.character, { carriedPartyItems: this.partyItems })
    },

    speed() {
      const s = this.character.speed
      if (!s) return `${DEFAULT_SPEED_FT} ft`
      const base = typeof s === 'number' ? `${s} ft` : s
      const bonus = this.equippedItems.reduce((sum, i) => sum + (i.stat_bonuses?.speed ?? 0), 0)
      return bonus ? `${(typeof s === 'number' ? s : DEFAULT_SPEED_FT) + bonus} ft` : base
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
      return itemBonus
        ? `${base} + Items ${dnd.signed(itemBonus)} = ${dnd.signed(mod + prof + itemBonus)}`
        : `${base} = ${dnd.signed(mod + prof)}`
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
      return itemBonus
        ? `${base} + Items ${dnd.signed(itemBonus)} = ${8 + mod + prof + itemBonus}`
        : `${base} = ${8 + mod + prof}`
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
          statDesc = `Finesse — best of STR ${dnd.signed(strMod)}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)}`
        } else if (props.weapon_type === 'ranged') {
          statMod = dexMod
          statDesc = `DEX ${dnd.signed(dexMod)}`
        } else {
          statMod = strMod
          statDesc = `STR ${dnd.signed(strMod)}`
        }
        const typeBonus = props.weapon_type === 'ranged'
          ? (bonuses.ranged_attack ?? 0)
          : (bonuses.melee_attack ?? 0)
        const atkTotal = dnd.attackBonus(this.character, w, this.partyItems)
        const atkParts = [statDesc, `Prof ${dnd.signed(prof)}`]
        if (magic) atkParts.push(`Magic ${dnd.signed(magic)}`)
        if (typeBonus) atkParts.push(`Item ${dnd.signed(typeBonus)}`)
        atkParts.push(`= ${dnd.signed(atkTotal)}`)

        const dmgBonus = dnd.damageBonus(this.character, w, this.partyItems)
        const die = dnd.gripDie(this.character, w, this.partyItems)
        const rangedBonus = props.weapon_type === 'ranged' ? (bonuses.ranged_damage ?? 0) : 0
        const dmgParts = [die, statDesc.split('—')[0].trim()]
        if (magic) dmgParts.push(`Magic ${dnd.signed(magic)}`)
        if (rangedBonus) dmgParts.push(`Item ${dnd.signed(rangedBonus)}`)

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
        const atkParts = [`Martial Arts ${dnd.signed(statMod)}`, `Prof ${dnd.signed(prof)}`]
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
      return (this.character.features ?? []).filter((f) => f.type === 'feat' && !f.battle_hidden)
    },
    hiddenFeats() {
      return (this.character.features ?? []).filter((f) => f.type === 'feat' && f.battle_hidden)
    },
    featureGroups() {
      const features = (this.character.features ?? []).filter((f) => f.type !== 'feat')
      const TYPE_ORDER = ['feature', 'maneuver']
      const TYPE_LABEL = { feature: 'Features', maneuver: 'Maneuvers' }
      const map = {}
      for (const f of features) {
        const t = f.type || 'feature'
        ;(map[t] = map[t] ?? []).push(f)
      }
      const known = TYPE_ORDER.filter((t) => map[t]).map((t) => ({ type: t, label: TYPE_LABEL[t], items: map[t] }))
      const other = Object.keys(map).filter((t) => !TYPE_ORDER.includes(t))
        .map((t) => ({ type: t, label: t.charAt(0).toUpperCase() + t.slice(1) + 's', items: map[t] }))
      return [...known, ...other]
    },

    spellSlotLevels() {
      const slots = this.character.spell_slots
      if (!slots) return []
      return Object.entries(slots)
        .map(([key, slot]) => ({
          key,
          label: key.replace('level_', 'L'),
          max: slot.max,
          current: slot.current ?? slot.max,
        }))
        .filter((s) => s.max > 0)
    },

    spellGroups() {
      const spells = [
        ...(this.character.spells ?? []),
        ...(this.character.artillerist_spells?.spells ?? []).map((s) => ({ ...s, domain: true })),
      ]
      const map = {}
      for (const s of spells) {
        const lvl = s.level ?? 0
        ;(map[lvl] = map[lvl] ?? []).push(s)
      }
      return Object.keys(map)
        .map(Number)
        .sort((a, b) => a - b)
        .map((lvl) => ({ label: lvl === 0 ? 'Cantrips' : `Level ${lvl}`, spells: map[lvl] }))
    },
  },

  methods: {
    toggleFeatHidden(feat, hidden) {
      const updatedFeatures = (this.character.features ?? []).map((f) =>
        f.name === feat.name && f.type === 'feat' ? { ...f, battle_hidden: hidden } : f
      )
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, features: updatedFeatures },
      })
    },

    toggleSlot(levelKey, slotIndex) {
      const slot = this.character.spell_slots[levelKey]
      const used = slot.max - (slot.current ?? slot.max)
      const newCurrent = slotIndex < used
        ? slot.current + 1  // recover slot
        : slot.current - 1  // use slot
      const updatedSlots = {
        ...this.character.spell_slots,
        [levelKey]: { ...slot, current: Math.min(slot.max, Math.max(0, newCurrent)) },
      }
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, spell_slots: updatedSlots },
      })
    },

    async openSpellPopup(spell) {
      const data = await lookupSpell(spell.name)
      const fields = []
      if (data?.casting_time) fields.push({ label: 'Cast', value: data.casting_time })
      if (data?.range) fields.push({ label: 'Range', value: data.range })
      if (data?.duration) fields.push({ label: 'Duration', value: data.duration })
      if (data?.components) fields.push({ label: 'Comp', value: data.components })
      if (data?.save) fields.push({ label: 'Save', value: data.save })
      if (data?.damage_type) fields.push({ label: 'Dmg', value: data.damage_type })

      const level = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`
      const school = data?.school ?? ''
      this.popupItem = {
        title: spell.name,
        subtitle: school ? `${level} · ${school}` : level,
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
      if (feature.action_type) fields.push({ label: 'Action', value: feature.action_type })
      if (feature.recharge) fields.push({ label: 'Recharge', value: feature.recharge })
      if (feature.uses_max != null) {
        const uses = feature.uses_current != null
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

  created() {
    this.dnd = dnd
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

.chip-val {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent-strong);
  line-height: 1;
}

.chip-label {
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  margin-top: 0.15rem;
}

.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.section-empty {
  font-size: var(--font-size-small);
  color: var(--color-text-low);
}

.weapon-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-small);
}

.weapon-table th {
  text-align: left;
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
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

.weapon-table tr:last-child td { border-bottom: none; }

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
  font-size: var(--font-size-tiny);
  padding-left: 0.5rem;
}

.weapon-name { color: var(--color-text); }

/* ── Features & Spells ── */
.pill-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
}

.pill-group-label {
  font-size: var(--font-size-tiny);
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
  font-size: var(--font-size-tiny);
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

/* ── Feats ── */
.feat-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.show-hidden-toggle {
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.show-hidden-toggle:hover { color: var(--color-text-muted); }

.feat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: var(--font-size-tiny);
  padding: 0.15rem 0.3rem 0.15rem 0.5rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.feat-pill:hover { border-color: var(--color-accent); color: var(--color-accent); }

.feat-pill--hidden {
  opacity: 0.35;
  border-style: dashed;
}

.feat-action {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: var(--font-size-tiny);
  color: inherit;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 0.12s;
}

.feat-action:hover { opacity: 1; }

.feat-action--restore { font-size: 10px; }

/* ── Spell Slots ── */
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
  font-size: var(--font-size-tiny);
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

.slot-box:hover { opacity: 0.75; }
</style>
