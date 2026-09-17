<template>
  <div>
    <div v-for="group in featureGroups" :key="group.type" class="pill-group">
      <div class="pill-group-label">{{ group.label }}</div>
      <div class="pill-row">
        <span
          v-for="f in group.items"
          :key="f.name"
          class="feature-pill"
          @click="inspect(f)"
          ><Star
            v-if="f.type === 'feat'"
            class="feat-marker"
            title="Feat"
          /><Fingerprint
            v-else-if="f.type === 'speciesTrait'"
            class="species-trait-marker"
            title="Species trait"
          /><ActionCostIcon :action-type="f.action_type" />{{ f.name
          }}<span
            v-if="f.uses_max"
            class="pill-uses has-tip"
            :title="`${f.uses_current ?? f.uses_max} of ${
              f.uses_max
            } uses remaining · recharges ${dnd.rechargeLabel(f.recharge)}`"
            >{{ f.uses_current ?? f.uses_max }}/{{ f.uses_max }}</span
          ><span v-if="f.recharge" class="pill-recharge">{{
            dnd.rechargeLabel(f.recharge)
          }}</span></span
        >
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { buildFeaturePopupData } from '@/utils/detailPopupBuilders.js'
import ActionCostIcon from '@/components/ActionCostIcon.vue'
import { Star, Fingerprint } from 'lucide-vue'

const FEATURE_TYPE_ORDER = ['feature', 'maneuver']
const FEATURE_TYPE_LABEL = { feature: 'Features', maneuver: 'Maneuvers' }

export default {
  name: 'FeaturePillsPanel',

  components: { ActionCostIcon, Star, Fingerprint },

  props: {
    character: { type: Object, required: true },
    // 'all' | 'action' | 'bonus_action' | 'reaction' | 'passive' — owned by
    // whichever view renders both this and SpellPillsByLevel, since one
    // filter row controls both lists at once.
    filter: { type: String, default: 'all' },
  },

  emits: ['inspect'],

  data() {
    return { dnd }
  },

  computed: {
    featureGroups() {
      // species_traits is a separate character-record array (not part of
      // character.features — see NewCharacterTool.vue's characterShell()),
      // merged in here so it renders in the same list rather than a fourth
      // UI location, matching how feats already mix into this same list.
      let features = [
        ...(this.character.features ?? []),
        ...(this.character.species_traits ?? []),
      ]
      if (this.filter !== 'all') {
        features = features.filter((f) =>
          this.filter === 'passive'
            ? !f.action_type
            : f.action_type === this.filter
        )
      }
      const map = {}
      for (const f of features) {
        // Feats and species traits mix into the same bucket as plain
        // features (marked with their own icon instead of a separate
        // section) — only maneuvers and other genuinely distinct types keep
        // their own group.
        const t =
          !f.type || f.type === 'feat' || f.type === 'speciesTrait'
            ? 'feature'
            : f.type
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
  },

  methods: {
    async inspect(feature) {
      this.$emit(
        'inspect',
        await buildFeaturePopupData(feature, this.character)
      )
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

.feature-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
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

.feat-marker {
  width: 0.8em;
  height: 0.8em;
  flex-shrink: 0;
  color: var(--color-accent-strong);
}

.species-trait-marker {
  width: 0.8em;
  height: 0.8em;
  flex-shrink: 0;
  color: var(--color-text-muted);
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

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
}
</style>
