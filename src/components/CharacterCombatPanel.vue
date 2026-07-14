﻿﻿﻿﻿
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

    <!-- Saving throws -->
    <div class="saves-row">
      <span
        v-for="s in savingThrows"
        :key="s.key"
        class="save-chip has-tip"
        :class="{ 'save-chip--prof': s.proficient }"
        :title="s.tooltip"
        >{{ s.label }} {{ s.valueStr }}</span
      >
    </div>

    <!-- Conditions -->
    <div class="conditions-row">
      <span
        v-for="cond in CONDITIONS"
        :key="cond"
        class="cond-chip"
        :class="{
          'cond-chip--active':
            cond === 'Exhaustion'
              ? exhaustionLevel > 0
              : activeConditions.includes(cond),
        }"
        :title="conditionTooltip(cond)"
        @click="
          cond === 'Exhaustion' ? cycleExhaustion() : toggleCondition(cond)
        "
        >{{ cond
        }}<span
          v-if="cond === 'Exhaustion' && exhaustionLevel > 0"
          class="exhaustion-level"
        >
          {{ exhaustionLevel }}</span
        ></span
      >
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
          <tr
            v-for="row in weaponRows"
            :key="row.key"
            :class="{ 'weapon-extra-row': row.extra }"
          >
            <template v-if="!row.extra">
              <td class="weapon-name">{{ row.name }}</td>
              <td class="col-num">
                <span class="has-tip" :title="row.atkTooltip">{{
                  row.attack
                }}</span>
              </td>
              <td class="col-num">
                <span class="has-tip" :title="row.dmgTooltip">{{
                  row.damage
                }}</span>
              </td>
              <td class="col-tag">{{ row.type }}</td>
            </template>
            <template v-else>
              <td class="weapon-extra-name" :title="row.source">
                + {{ row.source }}
              </td>
              <td></td>
              <td class="col-num weapon-extra-dmg">{{ row.die }}</td>
              <td class="col-tag">{{ row.dmgType }}</td>
            </template>
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
      >
        {{ opt.label }}
      </button>
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
          >{{ f.name
          }}<span
            v-if="f.uses_max"
            class="pill-uses has-tip"
            :title="`${f.uses_current ?? f.uses_max} of ${
              f.uses_max
            } uses remaining · recharges ${rechargeLabel(f.recharge)}`"
            >{{ f.uses_current ?? f.uses_max }}/{{ f.uses_max }}</span
          ><span v-if="f.recharge" class="pill-recharge">{{
            rechargeLabel(f.recharge)
          }}</span></span
        >
      </div>
    </div>

    <!-- Feats -->
    <template v-if="feats.length">
      <div class="section-label">Feats</div>
      <div class="pill-row">
        <span
          v-for="feat in feats"
          :key="feat.name"
          class="feat-pill"
          @click="openFeaturePopup(feat)"
          >{{ feat.name
          }}<span
            v-if="feat.uses_max"
            class="pill-uses has-tip"
            :title="`${feat.uses_current ?? feat.uses_max} of ${
              feat.uses_max
            } uses remaining · recharges ${rechargeLabel(feat.recharge)}`"
            >{{ feat.uses_current ?? feat.uses_max }}/{{ feat.uses_max }}</span
          ><span v-if="feat.recharge" class="pill-recharge">{{
            rechargeLabel(feat.recharge)
          }}</span></span
        >
      </div>
    </template>

    <!-- Spell Slots -->
    <template v-if="!hideSpells && spellSlotLevels.length">
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
                ? 'Used — click to recover'
                : 'Available — click to use'
            "
            @click="toggleSlot(lvl.key, i - 1)"
          ></span>
        </div>
      </div>
    </template>

    <!-- Class Resources (ki, superiority dice, rage, etc.) -->
    <template v-if="classResources.length">
      <div class="section-label">Resources</div>
      <div class="spell-slots">
        <div v-for="res in classResources" :key="res.key" class="slot-level">
          <span
            class="slot-level-label slot-level-label--res"
            :title="res.name"
            >{{ res.label }}</span
          >
          <span
            v-for="i in res.max"
            :key="i"
            class="slot-box slot-box--res"
            :class="{ used: i <= res.max - res.current }"
            :title="
              i <= res.max - res.current
                ? `${res.name}: spent — click to recover`
                : `${res.name}: available — click to spend`
            "
            @click="toggleResource(res, i - 1)"
          ></span>
        </div>
      </div>
    </template>

    <!-- Woven Phase selector (Woven Sorcerer only) -->
    <template v-if="character.woven_phase !== undefined">
      <div class="section-label woven-label">
        Woven Phase
        <span class="woven-hint">Metamagic -1 SP for active schools</span>
      </div>
      <div class="woven-phases">
        <button
          v-for="(ph, key) in wovenPhases"
          :key="key"
          class="woven-phase-btn"
          :class="{ 'woven-phase-btn--active': character.woven_phase === key }"
          :style="
            character.woven_phase === key
              ? { borderColor: ph.color, backgroundColor: ph.color + '20' }
              : {}
          "
          :title="`${ph.schools.join(
            ' + '
          )}: Metamagic costs 1 fewer SP when applied to spells of these schools.\n\nLoom spells: ${ph.spells.join(
            ', '
          )}`"
          @click="setWovenPhase(key)"
        >
          <span
            class="woven-phase-name"
            :style="character.woven_phase === key ? { color: ph.color } : {}"
            >{{ ph.name }}</span
          >
          <span class="woven-phase-abbr">{{ ph.abbr }}</span>
        </button>
      </div>
    </template>

    <!-- Spells -->
    <!-- Combat-relevant items (weapons with descriptions, special equipment) -->
    <template v-if="battleItems.length">
      <div class="section-label">Items</div>
      <div class="pill-row">
        <span
          v-for="item in battleItems"
          :key="item.id ?? item.name"
          class="feature-pill"
          @click="openItemPopup(item)"
          >{{ item.name }}</span
        >
      </div>
    </template>

    <template v-if="!hideSpells && spellGroups.length">
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
            >{{ spell.name
            }}<Sparkle
              v-if="
                spellMeta[spell.name] && spellMeta[spell.name].concentration
              "
              class="conc-icon"
              title="Concentration"
            /><span
              v-if="spellMeta[spell.name] && spellMeta[spell.name].school"
              class="spell-school"
              :title="spellMeta[spell.name].school"
              >{{ schoolAbbr(spellMeta[spell.name].school) }}</span
            ></span
          >
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
import { dnd, STAT_KEYS } from '@/utils/dnd_utils.js'
import { conditionTooltip } from '@/data/conditions.js'
import { DEFAULT_SPEED_FT } from '@/utils/dnd_constants.js'
import { lookupSpell, lookupFeature } from '@/utils/lookupService.js'
import { getCharacterSpells } from '@/utils/spellUtils.js'
import DetailPopup from '@/components/DetailPopup.vue'
import StatChip from '@/components/StatChip.vue'
import { Sparkle } from 'lucide-vue'

const CONDITIONS = [
  'Concentrating',
  'Haste',
  'Bardic',
  'Blessed',
  'Hexed',
  'Poisoned',
  'Prone',
  'Frightened',
  'Charmed',
  'Stunned',
  'Paralyzed',
  'Grappled',
  'Restrained',
  'Blinded',
  'Deafened',
  'Invisible',
  'Incapacitated',
  'Exhaustion',
]

const FEATURE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'action', label: 'Action' },
  { value: 'bonus_action', label: 'Bonus' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'passive', label: 'Passive' },
]

const FEATURE_TYPE_ORDER = ['feature', 'maneuver']
const FEATURE_TYPE_LABEL = { feature: 'Features', maneuver: 'Maneuvers' }

const WOVEN_PHASES = {
  leno: {
    name: 'Leno',
    abbr: 'Abj · Div',
    schools: ['Abjuration', 'Divination'],
    color: '#7ec8e3',
    spells: [
      'Faerie Fire',
      'Moonbeam',
      'Clairvoyance',
      'Death Ward',
      'Scrying',
    ],
  },
  satin: {
    name: 'Satin',
    abbr: 'Ill · Trs',
    schools: ['Illusion', 'Transmutation'],
    color: '#b88fe0',
    spells: [
      'Silent Image',
      'Invisibility',
      'Blink',
      'Hallucinatory Terrain',
      'Dream',
    ],
  },
  twill: {
    name: 'Twill',
    abbr: 'Enc · Cnj',
    schools: ['Enchantment', 'Conjuration'],
    color: '#e8a860',
    spells: [
      'Dissonant Whispers',
      'Web',
      'Hunger of Hadar',
      'Confusion',
      'Hold Monster',
    ],
  },
}

function nextSlotValue(max, current, clickedIndex) {
  const used = max - current
  return Math.min(
    max,
    Math.max(0, clickedIndex < used ? current + 1 : current - 1)
  )
}

export default {
  name: 'CharacterCombatPanel',

  components: { DetailPopup, StatChip, Sparkle },

  props: {
    character: { type: Object, required: true },
    hideSpells: { type: Boolean, default: false },
  },

  watch: {
    'character.id'(newId, oldId) {
      if (newId !== oldId) {
        this.featureFilter = 'all'
        this.loadSpellMeta()
      }
    },
  },

  data() {
    return {
      popupOpen: false,
      popupItem: null,
      spellMeta: {},
      featureFilter: 'all',
      featureFilterOptions: FEATURE_FILTER_OPTIONS,
      CONDITIONS,
    }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    resolvedStats() {
      return dnd.resolveStats(this.character, this.partyItems)
    },
    savingThrows() {
      const { stats, bonuses } = this.resolvedStats
      const prof = dnd._prof(this.character, bonuses)
      const proficient = new Set(this.character.saving_throws ?? [])
      return STAT_KEYS.map(({ key, label }) => {
        const isProficient = proficient.has(key)
        const mod = dnd.mod(stats[key])
        const flatBonus = bonuses.saving_throws ?? 0
        const total = mod + (isProficient ? prof : 0) + flatBonus
        const parts = [`${label} ${dnd.signed(mod)}`]
        if (isProficient) parts.push(`prof ${dnd.signed(prof)}`)
        if (flatBonus) parts.push(`bonus ${dnd.signed(flatBonus)}`)
        parts.push(`= ${dnd.signed(total)}`)
        return {
          key,
          label,
          proficient: isProficient,
          valueStr: dnd.signed(total),
          tooltip: parts.join(' · '),
        }
      })
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
    someFeatures() {
      return (this.character.features ?? []).some((f) => f.type !== 'feat')
    },
    hasFilterableContent() {
      return (
        this.someFeatures ||
        getCharacterSpells(this.character, this.partyItems).length > 0
      )
    },
    activeConditions() {
      return this.character.conditions ?? []
    },
    exhaustionLevel() {
      return this.character.exhaustion_level ?? 0
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
      const { stats, bonuses } = this.resolvedStats
      const wisMod = dnd.mod(stats.wis)
      const prof = this.profBonus
      const isProficient = (this.character.skill_proficiencies ?? []).includes(
        'Perception'
      )
      const hasExpertise = (this.character.skill_expertise ?? []).includes(
        'Perception'
      )
      const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0
      const itemBonus = bonuses['skill_Perception'] ?? 0
      const featBonus = bonuses.passive_perception ?? 0
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

    weaponSummaries() {
      return dnd.buildWeaponRows(this.character, this.partyItems)
    },

    weaponRows() {
      const rows = []
      for (const w of this.weaponSummaries) {
        rows.push({ key: w.name, extra: false, ...w })
        for (const ex of w.extras ?? []) {
          rows.push({
            key: w.name + '|' + ex.source,
            extra: true,
            source: ex.source,
            die: ex.die,
            dmgType: ex.type,
          })
        }
      }
      return rows
    },

    feats() {
      return (this.character.features ?? []).filter((f) => f.type === 'feat')
    },
    featureGroups() {
      let features = (this.character.features ?? []).filter(
        (f) => f.type !== 'feat'
      )
      if (this.featureFilter !== 'all') {
        features = features.filter((f) =>
          this.featureFilter === 'passive'
            ? !f.action_type
            : f.action_type === this.featureFilter
        )
      }
      const map = {}
      for (const f of features) {
        const t = f.type || 'feature'
        ;(map[t] = map[t] ?? []).push(f)
      }
      const known = FEATURE_TYPE_ORDER.filter((t) => map[t]).map((t) => ({
        type: t,
        label: FEATURE_TYPE_LABEL[t],
        items: map[t],
      }))
      const other = Object.keys(map)
        .filter((t) => !FEATURE_TYPE_ORDER.includes(t))
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

    classResources() {
      const c = this.character
      const result = []

      // ki_points (Monk)
      if (c.ki_points?.max > 0) {
        result.push({
          key: 'ki_points',
          name: 'Ki',
          label: 'Ki',
          max: c.ki_points.max,
          current: c.ki_points.current ?? c.ki_points.max,
        })
      }

      // Generic resources array — any class can define these
      for (const res of c.resources ?? []) {
        if (res.max > 0) {
          result.push({
            key: res.key ?? res.name,
            name: res.name,
            label:
              res.label ??
              res.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase(),
            max: res.max,
            current: res.current ?? res.max,
          })
        }
      }

      return result
    },

    spellGroups() {
      let spells = getCharacterSpells(this.character, this.partyItems).filter(
        (s) => s.level === 0 || s.prepared
      )
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

    battleItems() {
      return this.partyItems.filter(
        (i) =>
          i.battle_effect &&
          (i.equipped_by === this.character.name ||
            (i.carried_by === this.character.name &&
              i.equipped_by === 'disallowed'))
      )
    },

    wovenPhases() {
      return WOVEN_PHASES
    },
  },

  methods: {
    conditionTooltip,

    setWovenPhase(key) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, woven_phase: key },
      })
    },

    rechargeLabel(recharge) {
      if (recharge === 'short_rest') return 'SR'
      if (recharge === 'long_rest') return 'LR'
      return recharge.replace(/_/g, ' ')
    },

    schoolAbbr(school) {
      const map = {
        abjuration: 'Abj',
        conjuration: 'Con',
        divination: 'Div',
        enchantment: 'Enc',
        evocation: 'Evo',
        illusion: 'Ill',
        necromancy: 'Nec',
        transmutation: 'Tra',
      }
      return map[school.toLowerCase()] ?? school.slice(0, 3)
    },

    toggleSlot(levelKey, slotIndex) {
      if (levelKey === 'pact') {
        const pm = this.character.pact_magic
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: 'characters',
          updatedItem: {
            ...this.character,
            pact_magic: {
              ...pm,
              current: nextSlotValue(pm.max, pm.current ?? pm.max, slotIndex),
            },
          },
        })
        return
      }
      const slot = this.character.spell_slots[levelKey]
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: {
          ...this.character,
          spell_slots: {
            ...this.character.spell_slots,
            [levelKey]: {
              ...slot,
              current: nextSlotValue(
                slot.max,
                slot.current ?? slot.max,
                slotIndex
              ),
            },
          },
        },
      })
    },

    toggleResource(res, slotIndex) {
      const newCurrent = nextSlotValue(res.max, res.current, slotIndex)
      if (res.key === 'ki_points') {
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: 'characters',
          updatedItem: {
            ...this.character,
            ki_points: { ...this.character.ki_points, current: newCurrent },
          },
        })
        return
      }
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: {
          ...this.character,
          resources: (this.character.resources ?? []).map((r) =>
            (r.key ?? r.name) === res.key ? { ...r, current: newCurrent } : r
          ),
        },
      })
    },

    cycleExhaustion() {
      const next = this.exhaustionLevel >= 6 ? 0 : this.exhaustionLevel + 1
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, exhaustion_level: next },
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
      const spells = getCharacterSpells(this.character, this.partyItems)
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
            meta[s.name] = {
              concentration: !!data.concentration,
              actionType,
              school: data.school ?? '',
            }
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
      if (feature.description)
        fields.push({ label: 'Effect', value: feature.description })
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

    openItemPopup(item) {
      const fields = []
      if (item.effect) fields.push({ label: 'Effect', value: item.effect })
      if (item.description)
        fields.push({ label: 'Description', value: item.description })
      if (item.notes) fields.push({ label: 'Notes', value: item.notes })
      const subtitleParts = [item.subtype ?? item.type]
      if (item.needs_attunement) subtitleParts.push('requires attunement')
      this.popupItem = {
        title: item.name,
        subtitle: subtitleParts.filter(Boolean).join(' · '),
        description: null,
        fields,
        itemType: 'item',
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

.weapon-extra-row td {
  padding-top: 0;
  padding-bottom: 0.3rem;
  border-bottom: none;
}

.weapon-extra-name {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  padding-left: 0.6rem;
}

.weapon-extra-dmg {
  color: var(--color-text-muted) !important;
  font-size: var(--font-size-base);
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
.spell-pill,
.feat-pill {
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

.feature-pill:hover,
.feat-pill:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.pill-uses {
  margin-left: 0.35em;
  font-size: 0.8em;
  color: var(--color-text-muted);
}

.pill-recharge {
  margin-left: 0.3em;
  font-size: 0.75em;
  color: var(--color-text-low);
  font-style: italic;
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
}

.conc-icon {
  width: 0.75em;
  height: 0.75em;
  margin-left: 0.4em;
  opacity: 0.65;
  vertical-align: middle;
  pointer-events: auto;
}

.spell-school {
  font-size: 0.7em;
  margin-left: 0.35em;
  color: var(--color-text-low);
  vertical-align: middle;
  letter-spacing: 0.02em;
}

/* â”€â”€ Feats â”€â”€ */
.feat-pill {
  display: inline-flex;
  align-items: center;
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

.slot-level-label--res {
  width: 2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-box--res {
  border-color: var(--color-text-muted);
  background: var(--color-text-muted);
  border-radius: 50%;
}

.slot-box--res.used {
  background: transparent;
  border-color: var(--color-text-low);
}

/* â”€â”€ Conditions â”€â”€ */
.saves-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.save-chip {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
  white-space: nowrap;
}

.save-chip--prof {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

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
  border-color: var(--color-condition);
  color: var(--color-condition);
  background: rgba(230, 126, 34, 0.12);
}

.exhaustion-level {
  font-weight: 700;
  font-size: 1.05em;
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

/* ── Woven Phase ── */
.woven-label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.woven-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-weight: normal;
  font-style: italic;
}

.woven-phases {
  display: flex;
  gap: 0.4rem;
}

.woven-phase-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.45rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  color: var(--color-text-muted);
}

.woven-phase-btn:hover {
  border-color: var(--color-text-muted);
}

.woven-phase-name {
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: color 0.12s;
}

.woven-phase-abbr {
  font-size: 0.62rem;
  color: var(--color-text-low);
  letter-spacing: 0.05em;
}
</style>
