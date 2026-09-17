<template>
  <div v-if="spellGroups.length">
    <div class="section-label">Spells</div>
    <div v-for="group in spellGroups" :key="group.label" class="pill-group">
      <div class="pill-group-label">{{ group.label }}</div>
      <div class="pill-row">
        <span
          v-for="spell in group.spells"
          :key="spell.name"
          class="spell-pill"
          :class="{ 'spell-pill--domain': spell.domain }"
          :title="
            spell.domain
              ? 'Domain spell — always prepared'
              : spell.featureGranted
              ? `Free cast via ${spell._source} (doesn't count against spells known)`
              : null
          "
          @click="inspect(spell)"
          ><ActionCostIcon
            :action-type="
              spellMeta[spell.name] && spellMeta[spell.name].actionType
            "
          />{{ spell.name
          }}<span v-if="spell.featureGranted" class="spell-granted-mark">*</span
          ><Sparkle
            v-if="spellMeta[spell.name] && spellMeta[spell.name].concentration"
            class="conc-icon"
            title="Concentration"
          /><span
            v-if="spellMeta[spell.name] && spellMeta[spell.name].school"
            class="spell-school"
            :style="{ color: dnd.schoolColorVar(spellMeta[spell.name].school) }"
            :title="spellMeta[spell.name].school"
            >{{ dnd.schoolAbbr(spellMeta[spell.name].school) }}</span
          ></span
        >
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { lookupSpell } from '@/utils/lookupService.js'
import { getCharacterSpells } from '@/utils/spellUtils.js'
import { buildSpellPopupData } from '@/utils/detailPopupBuilders.js'
import { Sparkle } from 'lucide-vue'
import ActionCostIcon from '@/components/ActionCostIcon.vue'

export default {
  name: 'SpellPillsByLevel',

  components: { Sparkle, ActionCostIcon },

  props: {
    character: { type: Object, required: true },
    // 'all' | 'action' | 'bonus_action' | 'reaction' | 'passive' — shared
    // with FeaturePillsPanel via whichever view renders both.
    filter: { type: String, default: 'all' },
  },

  emits: ['inspect'],

  data() {
    return { dnd, spellMeta: {}, resolvedLevels: {} }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    spellGroups() {
      let spells = getCharacterSpells(
        this.character,
        this.partyItems,
        this.$store.state.subclasses,
        this.$store.state.spellbooks
      ).filter((s) => s.level === 0 || s.prepared)
      if (this.filter !== 'all') {
        spells = spells.filter((s) => {
          const at = this.spellMeta[s.name]?.actionType
          if (this.filter === 'passive') return !at || at === 'passive'
          return at === this.filter
        })
      }
      const map = {}
      for (const s of spells) {
        // Feature/item-granted spells (e.g. Iyani's Weave Attunement grid,
        // a Staff of Power's charges) come in with level: null — resolved
        // asynchronously below via lookupSpell, same as spellMeta. Real bug
        // found 2026-09-15: this used to fall back straight to 0, silently
        // filing every one of these under Cantrips regardless of its real
        // level (e.g. Synaptic Static, a 5th-level spell). Skip rendering
        // until the real level resolves rather than ever guess wrong.
        const lvl = s.level ?? this.resolvedLevels[s.name]
        if (lvl == null) continue
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

  watch: {
    'character.id'(newId, oldId) {
      if (newId !== oldId) this.loadSpellMeta()
    },
  },

  async created() {
    await this.loadSpellMeta()
  },

  methods: {
    async loadSpellMeta() {
      const spells = getCharacterSpells(
        this.character,
        this.partyItems,
        this.$store.state.subclasses,
        this.$store.state.spellbooks
      )
      const meta = {}
      const levels = {}
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
            if (s.level === null && data.level != null)
              levels[s.name] = data.level
          }
        })
      )
      this.spellMeta = meta
      this.resolvedLevels = levels
    },

    async inspect(spell) {
      this.$emit('inspect', await buildSpellPopupData(spell))
    },
  },
}
</script>

<style scoped>
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

.spell-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-size: var(--font-size-base);
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
  border: 1px solid var(--color-bg-surface-alt);
  color: var(--color-accent);
  background: var(--color-bg-panel);
}

.spell-pill:hover {
  border-color: var(--color-accent-strong);
  color: var(--color-accent-strong);
}

.spell-pill--domain {
  border-style: dashed;
}

.spell-granted-mark {
  color: var(--color-accent);
  font-weight: 700;
  margin-left: 1px;
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
</style>
