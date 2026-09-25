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
          }}</span
          ><span
            v-if="f.per_turn_cap && usedThisTurn(f)"
            class="pill-turn-used has-tip"
            title="Already used this turn"
            >used this turn</span
          ><button
            v-if="f.uses_max"
            class="pill-spend-btn"
            :disabled="(f.uses_current ?? f.uses_max) <= 0 || usedThisTurn(f)"
            title="Spend one use"
            @click.stop="spendUse(f)"
          >
            −1</button
          ><button
            v-if="f.uses_max && (f.uses_current ?? f.uses_max) < f.uses_max"
            class="pill-restore-btn"
            title="Restore one use (undo)"
            @click.stop="restoreUse(f)"
          >
            +1</button
          ><button
            v-if="f.per_turn_cap && !f.uses_max"
            class="pill-turn-toggle-btn"
            :class="{ 'is-used': usedThisTurn(f) }"
            :title="
              usedThisTurn(f)
                ? 'Mark available again this turn (undo)'
                : 'Mark used this turn'
            "
            @click.stop="toggleTurnUse(f)"
          >
            {{ usedThisTurn(f) ? '↺' : '✓' }}
          </button></span
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
    // Which store table `character` actually lives in — companions use a
    // separate table (see CharacterCombatPanel.vue), so spendUse/restoreUse
    // need to write back to the right place.
    table: { type: String, default: 'characters' },
    // 'all' | 'action' | 'bonus_action' | 'reaction' | 'passive' — owned by
    // whichever view renders both this and SpellPillsByLevel, since one
    // filter row controls both lists at once.
    filter: { type: String, default: 'all' },
    // combatTurn.resources[<this character's combatant key>] — i.e. the
    // { action, bonusAction, reaction, ...extra } object for THIS character
    // specifically, or null outside an active encounter (character sheet,
    // New Character tool, etc., where "this turn" has no meaning at all).
    // A per_turn_cap feature (Action Surge 17th, Sneak Attack) reads its own
    // spent/available state from here, keyed by its own id — see
    // engine/rules/combatTurn.js's freshResources for why this lives in
    // ephemeral battle state rather than on the character record.
    turnResources: { type: Object, default: null },
  },

  emits: ['inspect', 'feature-used', 'feature-turn-toggle'],

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
    // True once this feature's own per-turn flag has been spent THIS turn —
    // undefined turnResources (no active encounter) or a feature with no
    // per_turn_cap at all both read as "not used" (never gates anything
    // outside combat, where the concept doesn't apply).
    usedThisTurn(feature) {
      if (!feature.per_turn_cap || !this.turnResources || !feature.id)
        return false
      return this.turnResources[feature.id] === false
    },
    // Real gap found 2026-09-18: uses_max/uses_current were tracked and
    // shown, but nothing anywhere could actually spend one — see
    // SPEND_FEATURE_USE's own comment in store/index.js.
    spendUse(feature) {
      if ((feature.uses_current ?? feature.uses_max) <= 0) return
      if (this.usedThisTurn(feature)) return
      this.$store.commit('SPEND_FEATURE_USE', {
        characterName: this.character.name,
        table: this.table,
        featureName: feature.name,
      })
      // A per_turn_cap feature's pool spend and its "used this turn" flag
      // move together — see engine/CHECKLIST.md's 2026-09-24 entry on why
      // Action Surge's 17th-level upgrade needs BOTH a pool (uses_max/
      // uses_current, persisted) and this ephemeral per-turn gate, not one
      // or the other.
      if (feature.per_turn_cap && feature.id) {
        this.$emit('feature-turn-toggle', feature.id)
      }
      this.$emit(
        'feature-used',
        `${feature.name} (${(feature.uses_current ?? feature.uses_max) - 1}/${
          feature.uses_max
        } left)`
      )
    },
    restoreUse(feature) {
      this.$store.commit('RESTORE_FEATURE_USE', {
        characterName: this.character.name,
        table: this.table,
        featureName: feature.name,
      })
      // Undoing a spend restores the per-turn flag too, symmetric with
      // spendUse above — only if it was actually flagged used, so this
      // never flips an already-available flag to "used" by mistake.
      if (feature.per_turn_cap && feature.id && this.usedThisTurn(feature)) {
        this.$emit('feature-turn-toggle', feature.id)
      }
    },
    // For a per_turn_cap feature with NO uses_max at all (Sneak Attack —
    // unlimited attempts, no rest-based pool, just "once per turn you can
    // apply the bonus") — a manual mark/unmark toggle, since this app has
    // no way to know an attack happened or whether it qualified (advantage,
    // flanking). Purely the ephemeral per-turn flag; no Vuex feature-use
    // commit at all, since there's no uses_current to spend.
    toggleTurnUse(feature) {
      if (!feature.id) return
      this.$emit('feature-turn-toggle', feature.id)
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

.pill-turn-used {
  margin-left: 0.3em;
  font-size: 0.7em;
  color: var(--color-text-low);
  font-style: italic;
}

.pill-turn-toggle-btn {
  margin-left: 0.35em;
  font-size: 0.7em;
  line-height: 1;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  border: 1px solid var(--color-accent);
  background: none;
  color: var(--color-accent);
  cursor: pointer;
}

.pill-turn-toggle-btn:hover {
  background: var(--color-accent);
  color: var(--color-bg);
}

.pill-turn-toggle-btn.is-used {
  border-color: var(--color-border);
  color: var(--color-text-low);
}

.pill-spend-btn,
.pill-restore-btn {
  margin-left: 0.35em;
  font-size: 0.7em;
  line-height: 1;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  border: 1px solid var(--color-accent);
  background: none;
  color: var(--color-accent);
  cursor: pointer;
}

.pill-spend-btn:hover:not(:disabled),
.pill-restore-btn:hover {
  background: var(--color-accent);
  color: var(--color-bg);
}

.pill-spend-btn:disabled {
  border-color: var(--color-border);
  color: var(--color-text-low);
  cursor: not-allowed;
}

.pill-restore-btn {
  border-color: var(--color-border);
  color: var(--color-text-low);
}
</style>
