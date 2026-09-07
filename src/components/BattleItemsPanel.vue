<template>
  <!-- Combat-relevant items (weapons with descriptions, special equipment).
       Weapons get their own inspect icon in the Weapons table — excluded
       here so an equipped weapon doesn't also show up as a duplicate pill.
       Shows each item's action cost (action/bonus action/reaction/passive)
       right next to it, since that's not otherwise visible without opening
       the item's own detail popup — and, where the item actually grants a
       usable spell or named ability (spells_granted / features_granted /
       stored_spells), shows that as its own clickable pill too, same
       treatment as WeaponTable gives weapon_effects.

       Laid out as a CSS multi-column list (not a table) so two evenly-filled
       columns cover the full width instead of one half-width column with
       dead space beside it — the browser balances column heights on its
       own, and break-inside:avoid keeps an item glued to its grants row. -->
  <div v-if="battleItems.length" class="items-box">
    <div class="section-label">Items</div>
    <div class="items-columns">
      <div
        v-for="item in battleItems"
        :key="item.id ?? item.name"
        class="item-block"
      >
        <div class="item-row">
          <button
            class="item-inspect-btn"
            title="View item details"
            @click="inspect(item)"
          >
            <Search class="item-inspect-icon" />
          </button>
          <span class="item-name" @click="inspect(item)">{{ item.name }}</span>
          <span
            class="cost-badge"
            :class="`cost-badge--${item.action_type || 'passive'}`"
            >{{ costLabel(item.action_type) }}</span
          >
        </div>
        <div v-if="grantsFor(item).length" class="grants-row">
          <span
            v-for="g in grantsFor(item)"
            :key="g.key"
            class="grant-pill"
            :class="`grant-pill--${g.kind}`"
          >
            <span class="grant-label" @click="inspectGrant(g)">{{
              g.label
            }}</span>
            <template v-if="g.kind === 'spell'">
              <span
                v-if="g.grant.actionType"
                class="cost-badge"
                :class="`cost-badge--${g.grant.actionType}`"
                >{{ costLabel(g.grant.actionType) }}</span
              >
              <span
                v-if="typeof g.grant.chargeCost === 'number'"
                class="resource-note"
                >{{ g.grant.chargeCost }}⚡</span
              >
              <template v-else-if="g.grant.chargeCost">
                <input
                  type="number"
                  class="cast-amount-input"
                  :min="g.grant.chargeCost.min"
                  :max="
                    Math.min(g.grant.chargeCost.max, item.charges_current ?? 0)
                  "
                  :value="castAmount(item, g.grant)"
                  title="Charges to spend (your choice, higher = cast at a higher effective level)"
                  @click.stop
                  @input="setCastAmount(item, g.grant, $event.target.value)"
                />
                <span class="resource-note">⚡</span>
              </template>
              <span v-else-if="g.grant.usesMax != null" class="resource-note"
                >{{ g.grant.usesCurrent ?? g.grant.usesMax }}/{{
                  g.grant.usesMax
                }}</span
              >
              <button
                v-if="isCastable(g.grant)"
                class="cast-btn"
                :disabled="!canCast(item, g.grant)"
                title="Spend the cost and cast"
                @click.stop="cast(item, g.grant)"
              >
                Cast
              </button>
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  buildItemPopupData,
  buildSpellPopupData,
  buildFeaturePopupData,
} from '@/utils/detailPopupBuilders.js'
import { dnd } from '@/utils/dnd_utils.js'
import itemSpellCasting from '@/mixins/itemSpellCasting.js'
import { Search } from 'lucide-vue'

export default {
  name: 'BattleItemsPanel',

  components: { Search },

  mixins: [itemSpellCasting],

  props: {
    character: { type: Object, required: true },
  },

  emits: ['inspect'],

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    battleItems() {
      return this.partyItems.filter(
        (i) =>
          i.battle_effect &&
          i.type !== 'weapon' &&
          (i.equipped_by === this.character.name ||
            (i.carried_by === this.character.name &&
              i.equipped_by === 'disallowed'))
      )
    },
  },

  methods: {
    costLabel(actionType) {
      return dnd.actionTypeBadgeLabel(actionType)
    },
    grantsFor(item) {
      const grants = []
      for (const entry of item.spells_granted ?? []) {
        const g = dnd.normalizeItemSpellGrant(entry, item)
        grants.push({
          key: `spell:${g.name}`,
          kind: 'spell',
          label: g.name,
          name: g.name,
          grant: g,
        })
      }
      for (const name of item.features_granted ?? []) {
        grants.push({
          key: `feature:${name}`,
          kind: 'feature',
          label: name,
          name,
        })
      }
      // Spell-storing items hold whatever was last cast into them — dynamic,
      // not a fixed grant, so it's kept visually distinct (a "holds:" pill).
      for (const stored of item.stored_spells ?? []) {
        grants.push({
          key: `stored:${stored.name}`,
          kind: 'stored',
          label: `holds: ${stored.name}`,
          name: stored.name,
        })
      }
      return grants
    },
    async inspectGrant(grant) {
      const data =
        grant.kind === 'feature'
          ? await buildFeaturePopupData({ name: grant.name })
          : await buildSpellPopupData({
              name: grant.name,
              level: null,
              grant: grant.grant,
            })
      this.$emit('inspect', data)
    },
    inspect(item) {
      this.$emit('inspect', buildItemPopupData(item))
    },
  },
}
</script>

<style scoped>
.items-columns {
  column-count: 2;
  column-gap: 1.5rem;
}

.item-block {
  break-inside: avoid;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--color-border);
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--font-size-md);
}

.item-inspect-btn {
  background: none;
  border: none;
  padding: 0;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-low);
  transition: color 0.1s;
  flex-shrink: 0;
}

.item-inspect-btn:hover {
  color: var(--color-accent);
}

.item-inspect-icon {
  width: 0.85rem;
  height: 0.85rem;
}

.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  color: var(--color-text);
}

.item-name:hover {
  color: var(--color-accent);
}

.cost-badge {
  flex-shrink: 0;
  display: inline-block;
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cost-badge--action {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.cost-badge--bonus_action {
  color: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.cost-badge--reaction {
  color: var(--color-text-danger);
  border-color: var(--color-text-danger);
}

.cost-badge--free {
  color: var(--color-success);
  border-color: var(--color-success);
}

.grants-row {
  padding-left: 1.65rem;
  padding-top: 0.15rem;
}

.grant-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 1px 0.3rem 1px 0;
  font-size: var(--font-size-base);
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  transition: border-color 0.12s ease;
}

.grant-pill:hover {
  border-color: var(--color-accent);
}

.grant-pill--stored {
  font-style: italic;
  color: var(--color-text-low);
}

.grant-label {
  cursor: pointer;
  transition: color 0.12s ease;
}

.grant-label:hover {
  color: var(--color-accent);
}

.resource-note {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.cast-amount-input {
  width: 2.6em;
  flex-shrink: 0;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font-size: var(--font-size-xs);
  padding: 0 0.2em;
}

.cast-btn {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--color-accent);
  background: none;
  color: var(--color-accent);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cast-btn:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.cast-btn:disabled {
  border-color: var(--color-border);
  color: var(--color-text-low);
  cursor: not-allowed;
}
</style>
