<template>
  <div class="spellbook" v-if="character">
    <!-- ── Top bar: slots + preparation counter ── -->
    <div class="sb-topbar">
      <!-- Spell slots -->
      <div v-if="slotEntries.length" class="sb-slots-bar">
        <div
          v-for="[key, slot] in slotEntries"
          :key="key"
          class="sb-slot-level"
        >
          <span class="sb-slot-label">{{ levelLabel(key) }}</span>
          <span
            v-for="i in slot.max"
            :key="i"
            class="sb-slot-pip"
            :class="{ spent: i <= slot.max - slotCurrent(slot) }"
            :title="
              i <= slot.max - slotCurrent(slot)
                ? 'Spent — click to recover'
                : 'Available — click to spend'
            "
            @click="toggleSlot(key, i - 1)"
          ></span>
        </div>
      </div>

      <!-- Pact magic -->
      <div v-if="character.pact_magic" class="sb-slots-bar">
        <div class="sb-slot-level">
          <span class="sb-slot-label"
            >Pact L{{ character.pact_magic.level ?? '?' }}</span
          >
          <span
            v-for="i in character.pact_magic.max"
            :key="i"
            class="sb-slot-pip sb-slot-pip--pact"
            :class="{
              spent:
                i <=
                character.pact_magic.max - slotCurrent(character.pact_magic),
            }"
            :title="
              i <= character.pact_magic.max - slotCurrent(character.pact_magic)
                ? 'Spent — click to recover'
                : 'Available — click to spend'
            "
            @click="togglePact(i - 1)"
          ></span>
        </div>
      </div>

      <!-- Preparation counter (only for classes that prepare) -->
      <div v-if="preparationInfo" class="sb-prep-counter">
        <span class="sb-prep-label">Prepared</span>
        <span
          class="sb-prep-fraction"
          :class="{ 'sb-prep-over': preparationInfo.over }"
        >
          {{ preparationInfo.prepared
          }}<span class="sb-prep-max"> / {{ preparationInfo.max }}</span>
        </span>
        <div class="sb-prep-bar">
          <div
            class="sb-prep-bar-fill"
            :class="{ 'sb-prep-bar-over': preparationInfo.over }"
            :style="{
              width:
                Math.min(
                  100,
                  (preparationInfo.prepared / preparationInfo.max) * 100
                ) + '%',
            }"
          ></div>
        </div>
        <span class="sb-prep-hint"
          >{{ preparationInfo.ability.toUpperCase() }} mod + level · domain
          spells free · click a dot to toggle</span
        >
      </div>
    </div>

    <!-- ── Cross-character spell search ── -->
    <div class="sb-search-bar">
      <input
        v-model="spellSearch"
        class="sb-cross-search"
        placeholder="Search spells across all characters…"
        type="search"
      />
      <transition name="fade">
        <span
          v-if="spellSearchLower && !currentCharHasMatch"
          class="sb-search-miss"
        >
          {{ character.name }} doesn't have this spell
          <template v-if="crossCharMatches.length">
            — known by {{ crossCharMatches.join(', ') }}</template
          >
        </span>
      </transition>
    </div>

    <!-- ── Spell groups (spells in character record) ── -->
    <div
      v-for="group in filteredSpellGroups"
      :key="group.level"
      class="sb-group"
      :class="{ 'sb-group--filtered': spellSearchLower && !group.hasMatch }"
    >
      <div class="sb-group-header">
        <span class="sb-group-label">{{ group.label }}</span>
        <span v-if="group.slotInfo" class="sb-slot-badge">{{
          group.slotInfo
        }}</span>
        <span
          v-if="
            group.unpreparedCount &&
            preparationInfo &&
            !characterUsesFullClassList
          "
          class="sb-group-sub"
        >
          {{ group.preparedCount }} prepared ·
          {{ group.unpreparedCount }} unprepared
        </span>
      </div>

      <!-- Prepared spells grid -->
      <div class="sb-spell-grid">
        <div
          v-for="spell in group.prepared"
          :key="spell.name + (spell.artillerist ? '-art' : '')"
          class="sb-spell-entry"
          :class="{
            'sb-entry--match': isMatch(spell),
            'sb-entry--dim': spellSearchLower && !isMatch(spell),
          }"
        >
          <button
            class="sb-dot sb-dot--ready"
            :class="{ 'sb-dot--fixed': !canToggle(spell) }"
            :disabled="!canToggle(spell)"
            :title="prepTitle(spell)"
            @click.stop="togglePrepared(spell)"
          ></button>
          <span class="sb-name" @click="openSpell(spell)" :title="spell.name">{{
            spell.name
          }}</span>
          <span
            v-if="isMatch(spell) && sharers(spell).length"
            class="sb-sharers"
            >{{ sharers(spell).join(', ') }}</span
          >
          <span
            v-if="spell.domain"
            class="sb-badge sb-badge--domain"
            title="Domain — always prepared"
            >D</span
          >
          <span
            v-else-if="spell.artillerist"
            class="sb-badge sb-badge--artillerist"
            title="Artillerist spell"
            >A</span
          >
          <span
            v-else-if="spell.homebrew"
            class="sb-badge sb-badge--homebrew"
            title="Homebrew"
            >H</span
          >
          <span
            v-else-if="spell.featureGranted"
            class="sb-badge sb-badge--feat"
            :title="spell._source"
            >F</span
          >
          <span
            v-if="spellMeta[spell.name] && spellMeta[spell.name].concentration"
            class="sb-badge sb-badge--conc"
            title="Concentration"
            >C</span
          >
          <span
            v-if="spellMeta[spell.name]"
            class="sb-badge sb-badge--action"
            >{{ actionLabel(spellMeta[spell.name].actionType) }}</span
          >
          <span
            v-if="spellMeta[spell.name] && spellMeta[spell.name].school"
            class="sb-badge sb-badge--school"
            :title="spellMeta[spell.name].school"
            >{{ schoolAbbr(spellMeta[spell.name].school) }}</span
          >
        </div>
      </div>

      <!-- Unprepared spells (Wizard/Artificer spellbook only — not shown for full-class-list classes) -->
      <template
        v-if="
          preparationInfo &&
          !characterUsesFullClassList &&
          group.unprepared.length
        "
      >
        <div class="sb-unprepared-divider">
          <span>Not prepared today</span>
        </div>
        <div class="sb-spell-grid sb-spell-grid--dim">
          <div
            v-for="spell in group.unprepared"
            :key="spell.name"
            class="sb-spell-entry"
            :class="{
              'sb-entry--match': isMatch(spell),
              'sb-entry--dim': spellSearchLower && !isMatch(spell),
            }"
          >
            <button
              class="sb-dot"
              :title="prepTitle(spell)"
              @click.stop="togglePrepared(spell)"
            ></button>
            <span
              class="sb-name sb-name--unprepared"
              @click="openSpell(spell)"
              :title="spell.name"
              >{{ spell.name }}</span
            >
            <span
              v-if="isMatch(spell) && sharers(spell).length"
              class="sb-sharers"
              >{{ sharers(spell).join(', ') }}</span
            >
            <span
              v-if="
                spellMeta[spell.name] && spellMeta[spell.name].concentration
              "
              class="sb-badge sb-badge--conc"
              title="Concentration"
              >C</span
            >
            <span
              v-if="spellMeta[spell.name]"
              class="sb-badge sb-badge--action"
              >{{ actionLabel(spellMeta[spell.name].actionType) }}</span
            >
            <span
              v-if="spellMeta[spell.name] && spellMeta[spell.name].school"
              class="sb-badge sb-badge--school"
              :title="spellMeta[spell.name].school"
              >{{ schoolAbbr(spellMeta[spell.name].school) }}</span
            >
          </div>
        </div>
      </template>
    </div>

    <div v-if="!spellGroups.length" class="sb-empty">
      No spells recorded for this character.
    </div>

    <!-- ── Browse class spell list (Cleric, Druid, Paladin, Ranger) ── -->
    <div v-if="characterUsesFullClassList && classSpellList" class="sb-browse">
      <div class="sb-browse-header">
        <span class="sb-browse-title"
          >{{ $dnd.classLabel(character) }} Spell List</span
        >
        <span class="sb-browse-count"
          >{{ availableToPrepare.length }} available</span
        >
        <div class="sb-browse-controls">
          <input
            v-model="availableSearch"
            class="sb-search"
            placeholder="Search…"
            type="search"
          />
          <select v-model.number="availableLevelFilter" class="sb-level-select">
            <option :value="0">All levels</option>
            <option v-for="l in maxSpellLevel" :key="l" :value="l">
              Level {{ l }}
            </option>
          </select>
        </div>
      </div>

      <div
        v-if="preparationInfo && preparationInfo.over"
        class="sb-browse-warning"
      >
        Preparation limit reached ({{ preparationInfo.prepared }} /
        {{ preparationInfo.max }}) — unprepare a spell first
      </div>

      <div
        v-if="availableToPrepare.length"
        class="sb-spell-grid sb-spell-grid--dim"
      >
        <div
          v-for="spell in availableToPrepare"
          :key="spell.name"
          class="sb-spell-entry"
        >
          <button
            class="sb-dot"
            :disabled="preparationInfo && preparationInfo.over"
            :title="
              preparationInfo && preparationInfo.over
                ? 'Preparation limit reached'
                : 'Click to prepare'
            "
            @click.stop="prepareFromClassList(spell)"
          ></button>
          <span
            class="sb-name sb-name--available"
            @click="openSpell(spell)"
            :title="spell.name"
            >{{ spell.name }}</span
          >
          <span class="sb-badge sb-badge--level">{{
            spell.level === 0 ? 'C' : spell.level
          }}</span>
        </div>
      </div>
      <div v-else-if="availableSearch" class="sb-browse-empty">
        No spells match "{{ availableSearch }}"
      </div>
      <div v-else class="sb-browse-empty">
        All {{ $dnd.classLabel(character) }} spells are in your prepared list.
      </div>
    </div>

    <!-- Detail popup -->
    <DetailPopup
      v-if="popupOpen && popupItem"
      :open="popupOpen"
      :item="popupItem"
      @close="popupOpen = false"
    />
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { lookupSpell } from '@/utils/lookupService.js'
import {
  getCharacterSpells,
  getClassSpellList,
  usesFullClassList,
} from '@/utils/spellUtils.js'
import DetailPopup from '@/components/DetailPopup.vue'

// Classes that choose prepared spells daily from a full class list.
// All others are "known spells" casters where every spell on their list is always ready.
const PREPARATION_CLASSES = [
  'cleric',
  'druid',
  'wizard',
  'artificer',
  'paladin',
  'ranger',
]
// Half-casters: preparation limit uses floor(level / 2)
const HALF_CASTER_CLASSES = ['paladin', 'ranger', 'artificer']

export default {
  name: 'CharacterSpellbook',
  components: { DetailPopup },

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return {
      spellMeta: {},
      resolvedLevels: {},
      popupOpen: false,
      popupItem: null,
      availableSearch: '',
      availableLevelFilter: 0,
      spellSearch: '',
    }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    allSpells() {
      return getCharacterSpells(this.character, this.partyItems)
    },

    classSpellList() {
      return getClassSpellList(this.character)
    },

    characterUsesFullClassList() {
      return usesFullClassList(this.character)
    },

    maxSpellLevel() {
      const slots = this.character.spell_slots ?? {}
      const levels = Object.keys(slots)
        .map((k) => parseInt(k.replace('level_', '')))
        .filter((n) => !isNaN(n) && (slots[`level_${n}`]?.max ?? 0) > 0)
      if (levels.length === 0) return 0
      return Math.max(...levels)
    },

    // Spells from the class list that are NOT currently prepared.
    // For full-class-list classes, any unprepared spell (whether it was removed or
    // still sits in the record with prepared: false) belongs here, not in a limbo section.
    availableToPrepare() {
      if (!this.classSpellList || !this.characterUsesFullClassList) return []
      const preparedNames = new Set(
        this.allSpells.filter((s) => this.isReady(s)).map((s) => s.name)
      )
      const search = this.availableSearch.toLowerCase()
      return this.classSpellList.filter((s) => {
        if (preparedNames.has(s.name)) return false
        if (s.level > this.maxSpellLevel) return false
        if (
          this.availableLevelFilter > 0 &&
          s.level !== this.availableLevelFilter
        )
          return false
        if (search && !s.name.toLowerCase().includes(search)) return false
        return true
      })
    },

    slotEntries() {
      const slots = this.character.spell_slots
      if (!slots) return []
      return Object.entries(slots).sort((a, b) => {
        return (
          Number(a[0].replace('level_', '')) -
          Number(b[0].replace('level_', ''))
        )
      })
    },

    preparationInfo() {
      const classNames = (this.character.classes ?? []).map((c) =>
        c.name.toLowerCase()
      )
      const usesPrepare = PREPARATION_CLASSES.some((p) =>
        classNames.some((c) => c.includes(p))
      )
      if (!usesPrepare) return null

      const isHalfCaster = HALF_CASTER_CLASSES.some((p) =>
        classNames.some((c) => c.includes(p))
      )
      const level = this.character.level ?? 0
      const effectiveLevel = isHalfCaster
        ? Math.max(1, Math.floor(level / 2))
        : level

      const partyItems = this.$store.state.party_items ?? []
      const { stats } = dnd.resolveStats(this.character, partyItems)
      const ab = this.character.spellcasting_ability ?? 'wis'
      const mod = dnd.mod(stats[ab])
      const max = Math.max(1, mod + effectiveLevel)

      // Only count non-domain, non-artillerist, non-cantrip spells toward the limit
      const prepared = this.allSpells.filter(
        (s) =>
          s.level > 0 &&
          !s.domain &&
          !s.artillerist &&
          !s.featureGranted &&
          !s.homebrew &&
          this.isReady(s)
      ).length

      return { prepared, max, over: prepared > max, ability: ab }
    },

    spellGroups() {
      const byLevel = {}
      for (const spell of this.allSpells) {
        const lvl = spell.level ?? this.resolvedLevels[spell.name] ?? -1
        if (!byLevel[lvl]) byLevel[lvl] = []
        byLevel[lvl].push(spell)
      }

      const slots = this.character.spell_slots ?? {}
      const pm = this.character.pact_magic

      return Object.keys(byLevel)
        .map(Number)
        .sort((a, b) => {
          if (a === -1) return 1
          if (b === -1) return -1
          return a - b
        })
        .map((lvl) => {
          const spells = byLevel[lvl]
          const slotKey = `level_${lvl}`
          let slotInfo = null
          if (lvl > 0) {
            if (slots[slotKey]) {
              const s = slots[slotKey]
              slotInfo = `${this.slotCurrent(s)}/${s.max} slots`
            } else if (pm && pm.level === lvl) {
              slotInfo = `${this.slotCurrent(pm)}/${pm.max} pact`
            }
          }

          const prepared = spells.filter((s) => this.isReady(s))
          const unprepared = this.preparationInfo
            ? spells.filter((s) => !this.isReady(s))
            : []

          return {
            level: lvl,
            label:
              lvl === -1
                ? 'Feature Spells'
                : lvl === 0
                ? 'Cantrips'
                : `Level ${lvl}`,
            prepared,
            unprepared,
            preparedCount: prepared.length,
            unpreparedCount: unprepared.length,
            slotInfo,
          }
        })
        .filter((g) => g.prepared.length + g.unprepared.length > 0)
    },

    // ── Cross-character spell search ──
    spellSearchLower() {
      return this.spellSearch.trim().toLowerCase()
    },

    allCharacters() {
      return this.$store.state.characters ?? []
    },

    // Map: lowercase spell name → array of OTHER character names who know it
    sharersMap() {
      if (!this.spellSearchLower) return {}
      const map = {}
      for (const char of this.allCharacters) {
        if (char.name === this.character.name) continue
        for (const spell of char.spells ?? []) {
          if (spell.name.toLowerCase().includes(this.spellSearchLower)) {
            const key = spell.name.toLowerCase()
            ;(map[key] = map[key] ?? []).push(char.name)
          }
        }
      }
      return map
    },

    currentCharHasMatch() {
      if (!this.spellSearchLower) return true
      return (this.character.spells ?? []).some((s) =>
        s.name.toLowerCase().includes(this.spellSearchLower)
      )
    },

    // All other chars who have any spell matching the search (for the "miss" message)
    crossCharMatches() {
      if (!this.spellSearchLower) return []
      return [...new Set(Object.values(this.sharersMap).flat())]
    },

    // Annotated spell groups that also carry hasMatch flag for group dimming
    filteredSpellGroups() {
      return this.spellGroups.map((g) => ({
        ...g,
        hasMatch:
          !this.spellSearchLower ||
          [...g.prepared, ...(g.unprepared ?? [])].some((s) =>
            s.name.toLowerCase().includes(this.spellSearchLower)
          ),
      }))
    },
  },

  async created() {
    await this.loadMeta()
  },

  watch: {
    'character.id'() {
      this.loadMeta()
    },
  },

  methods: {
    isMatch(spell) {
      return (
        !!this.spellSearchLower &&
        spell.name.toLowerCase().includes(this.spellSearchLower)
      )
    },
    sharers(spell) {
      return this.sharersMap[spell.name.toLowerCase()] ?? []
    },

    slotCurrent(slot) {
      return slot.current ?? slot.max
    },

    levelLabel(key) {
      return `L${key.replace('level_', '')}`
    },

    isReady(spell) {
      if (spell.level === 0) return true
      if (
        spell.domain ||
        spell.artillerist ||
        spell.featureGranted ||
        spell.homebrew
      )
        return true
      if ('prepared' in spell) return !!spell.prepared
      return true
    },

    canToggle(spell) {
      if (!this.preparationInfo) return false
      if (spell.level === 0) return false
      if (
        spell.domain ||
        spell.artillerist ||
        spell.featureGranted ||
        spell.homebrew
      )
        return false
      return 'prepared' in spell
    },

    prepTitle(spell) {
      if (spell.level === 0) return 'Cantrips are always available'
      if (spell.domain) return 'Domain spell — always prepared'
      if (spell.artillerist) return 'Artillerist spell — always prepared'
      if (spell.featureGranted || spell.homebrew)
        return `Granted by ${spell._source} — always available`
      if (!this.preparationInfo) return 'Known spell — always available'
      return spell.prepared
        ? 'Prepared — click to unprepare'
        : 'Not prepared — click to prepare'
    },

    actionLabel(type) {
      if (type === 'bonus_action') return 'Bns'
      if (type === 'reaction') return 'Rxn'
      if (type === 'action') return 'Act'
      return 'Psv'
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

    togglePrepared(spell) {
      if (!this.canToggle(spell)) return
      let updated
      if (this.characterUsesFullClassList && spell.prepared) {
        // Remove entirely so it resurfaces in the class-list browse section
        updated = (this.character.spells ?? []).filter(
          (s) => s.name !== spell.name
        )
      } else {
        updated = (this.character.spells ?? []).map((s) =>
          s.name === spell.name ? { ...s, prepared: !s.prepared } : s
        )
      }
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, spells: updated },
      })
    },

    // Add a spell from the class list to the character's prepared list.
    prepareFromClassList(spell) {
      if (this.preparationInfo?.over) return
      const existing = (this.character.spells ?? []).find(
        (s) => s.name === spell.name
      )
      let updated
      if (existing) {
        // Already in record (e.g. was unprepared) — just flip the flag
        updated = this.character.spells.map((s) =>
          s.name === spell.name ? { ...s, prepared: true } : s
        )
      } else {
        // Brand new — add to character's spell record
        updated = [
          ...(this.character.spells ?? []),
          { name: spell.name, level: spell.level, prepared: true },
        ]
      }
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, spells: updated },
      })
    },

    toggleSlot(key, idx) {
      const slot = this.character.spell_slots[key]
      const cur = this.slotCurrent(slot)
      const used = slot.max - cur
      const newCur = idx < used ? cur + 1 : cur - 1
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: {
          ...this.character,
          spell_slots: {
            ...this.character.spell_slots,
            [key]: {
              ...slot,
              current: Math.min(slot.max, Math.max(0, newCur)),
            },
          },
        },
      })
    },

    togglePact(idx) {
      const pm = this.character.pact_magic
      const cur = this.slotCurrent(pm)
      const used = pm.max - cur
      const newCur = idx < used ? cur + 1 : cur - 1
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: {
          ...this.character,
          pact_magic: { ...pm, current: Math.min(pm.max, Math.max(0, newCur)) },
        },
      })
    },

    async loadMeta() {
      const meta = {}
      const levels = {}
      await Promise.all(
        this.allSpells.map(async (s) => {
          const data = await lookupSpell(s.name)
          if (!data) return
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
          if (s.level === null && data.level != null)
            levels[s.name] = data.level
        })
      )
      this.spellMeta = meta
      this.resolvedLevels = levels
    },

    async openSpell(spell) {
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
      const lvl = spell.level ?? this.resolvedLevels[spell.name]
      const levelStr =
        lvl === 0 ? 'Cantrip' : lvl != null ? `Level ${lvl}` : 'Spell'
      const school = data?.school ?? ''
      this.popupItem = {
        title: spell.name,
        subtitle: school ? `${levelStr} · ${school}` : levelStr,
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
  },
}
</script>

<style scoped>
.spellbook {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.75rem 1rem 1rem;
  overflow-y: auto;
  height: 100%;
}

/* ── Top bar ── */
.sb-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem 2rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--color-border);
}

.sb-slots-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
}

.sb-slot-level {
  display: flex;
  align-items: center;
  gap: 3px;
}

.sb-slot-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  min-width: 1.8rem;
}

.sb-slot-pip {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1.5px solid var(--color-accent);
  background: rgba(200, 169, 110, 0.3);
  cursor: pointer;
  transition: background 0.1s;
}
.sb-slot-pip:hover {
  background: rgba(200, 169, 110, 0.6);
}
.sb-slot-pip.spent {
  background: transparent;
  border-color: var(--color-border);
}
.sb-slot-pip--pact {
  border-color: #8866dd;
  background: rgba(136, 102, 221, 0.3);
}
.sb-slot-pip--pact:hover {
  background: rgba(136, 102, 221, 0.6);
}
.sb-slot-pip--pact.spent {
  background: transparent;
  border-color: var(--color-border);
}

/* Preparation counter */
.sb-prep-counter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sb-prep-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.sb-prep-fraction {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: #5a9e5a;
  line-height: 1;
}
.sb-prep-fraction.sb-prep-over {
  color: #c0442a;
}
.sb-prep-max {
  font-weight: normal;
  color: var(--color-text-low);
}

.sb-prep-bar {
  width: 80px;
  height: 5px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}
.sb-prep-bar-fill {
  height: 100%;
  background: #5a9e5a;
  border-radius: 3px;
  transition: width 0.2s;
}
.sb-prep-bar-fill.sb-prep-bar-over {
  background: #c0442a;
}

.sb-prep-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}

/* ── Spell groups ── */
/* ── Cross-character search bar ── */
.sb-search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
}

.sb-cross-search {
  flex: 1;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  padding: 0.25rem 0.5rem;
  outline: none;
}
.sb-cross-search:focus {
  border-color: var(--color-accent);
}

.sb-search-miss {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  white-space: nowrap;
  font-style: italic;
}

/* ── Search match highlighting ── */
.sb-entry--match {
  background: rgba(var(--color-accent-rgb), 0.08) !important;
  border-radius: 4px;
  outline: 1px solid rgba(var(--color-accent-rgb), 0.3);
}
.sb-entry--match .sb-name {
  color: var(--color-accent) !important;
}

.sb-entry--dim {
  color: var(--color-text-low);
}
.sb-entry--dim .sb-name {
  color: var(--color-text-low);
}

.sb-sharers {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  margin-left: 0.25rem;
  white-space: nowrap;
}

.sb-group--filtered {
  color: var(--color-text-low);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.sb-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sb-group-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-bottom: 0.15rem;
  border-bottom: 1px solid var(--color-border);
}

.sb-group-label {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent);
}

.sb-slot-badge {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0 5px;
}

.sb-group-sub {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

/* ── Spell grid ── */
.sb-spell-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 2px 0.5rem;
}

.sb-spell-entry {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.3rem;
  border-radius: 3px;
  min-width: 0;
  transition: background 0.1s;
}
.sb-spell-entry:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Prepared dot */
.sb-dot {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  transition: border-color 0.1s, background 0.1s, opacity 0.1s;
}
/* Unprepared: hover shows green + (will prepare) */
.sb-dot:not(.sb-dot--ready):not(.sb-dot--fixed):not(:disabled):hover {
  border-color: #5a9e5a;
  background: rgba(90, 158, 90, 0.2);
}
.sb-dot:not(.sb-dot--ready):not(.sb-dot--fixed):not(:disabled):hover::after {
  content: '+';
  color: #5a9e5a;
  font-weight: 700;
}
/* Prepared toggleable: hover dims to show it will be unprepared */
.sb-dot--ready:not(.sb-dot--fixed):hover {
  background: rgba(90, 158, 90, 0.35);
  border-color: #5a9e5a;
}
.sb-dot--ready:not(.sb-dot--fixed):hover::after {
  content: '−';
  color: #fff;
  font-weight: 700;
}
.sb-dot:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.sb-dot--ready {
  background: #5a9e5a;
  border-color: #5a9e5a;
}
.sb-dot--fixed {
  cursor: default;
}
.sb-dot--ready.sb-dot--fixed {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

/* Spell name */
.sb-name {
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.1s;
}
.sb-name:hover {
  color: var(--color-accent);
}
.sb-name--unprepared {
  color: var(--color-text-muted);
}
.sb-name--unprepared:hover {
  color: var(--color-text);
}
.sb-name--available {
  color: var(--color-text-muted);
}

/* Compact badges */
.sb-badge {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 0 3px;
  border-radius: 2px;
  border: 1px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.4;
  letter-spacing: 0.02em;
}
.sb-badge--domain {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.sb-badge--artillerist {
  border-color: #4488cc;
  color: #4488cc;
}
.sb-badge--homebrew {
  border-color: #cc7744;
  color: #cc7744;
}
.sb-badge--feat {
  border-color: #88aa44;
  color: #88aa44;
}
.sb-badge--conc {
  border-color: #8866dd;
  color: #8866dd;
}
.sb-badge--action {
  border-color: var(--color-border);
  color: var(--color-text-low);
}
.sb-badge--school {
  border-color: var(--color-border);
  color: var(--color-text-low);
}
.sb-badge--level {
  border-color: var(--color-border);
  color: var(--color-text-low);
  min-width: 12px;
  text-align: center;
}

/* Unprepared divider */
.sb-unprepared-divider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.2rem;
}
.sb-unprepared-divider span {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
  font-style: italic;
}
.sb-unprepared-divider::before,
.sb-unprepared-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-bg-surface-alt);
}

/* ── Browse section ── */
.sb-browse {
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sb-browse-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sb-browse-title {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent);
  white-space: nowrap;
}

.sb-browse-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
}

.sb-browse-controls {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}

.sb-search {
  background: var(--color-bg-panel-dark);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  padding: 0.2rem 0.5rem;
  width: 140px;
  outline: none;
}
.sb-search:focus {
  border-color: var(--color-accent);
}

.sb-level-select {
  background: var(--color-bg-panel-dark);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  padding: 0.2rem 0.4rem;
  outline: none;
  cursor: pointer;
}
.sb-level-select:focus {
  border-color: var(--color-accent);
}

.sb-browse-warning {
  font-size: var(--font-size-xs);
  color: #c0442a;
  font-style: italic;
}

.sb-browse-empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  padding: 0.5rem 0;
}

/* Empty state */
.sb-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  padding: 2rem;
  text-align: center;
}
</style>
