<template>
  <div>
    <template v-if="weaponSummaries.length">
      <div class="section-label">Weapons</div>
      <table class="weapon-table">
        <thead>
          <tr>
            <th class="col-inspect"></th>
            <th>Name</th>
            <th class="col-num" title="Attack bonus">Atk</th>
            <th class="col-num" title="Damage dice + modifier">Dmg</th>
            <th class="col-tag">Type</th>
            <th>Effects</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in weaponRows"
            :key="row.key"
            :class="{ 'weapon-extra-row': row.extra }"
          >
            <template v-if="!row.extra">
              <td class="col-inspect">
                <button
                  v-if="weaponItem(row.id)"
                  class="weapon-inspect-btn"
                  title="View weapon details"
                  @click="inspect(weaponItem(row.id))"
                >
                  <Search class="weapon-inspect-icon" />
                </button>
              </td>
              <td class="weapon-name">
                {{ row.name }}
                <span
                  v-if="row.thrown"
                  class="weapon-tag-badge"
                  :title="`Thrown weapon — range ${row.thrown.normal}/${row.thrown.long} ft.`"
                  >Thrown</span
                >
                <span
                  v-if="row.returning"
                  class="weapon-tag-badge weapon-tag-returning"
                  title="Returning — flies back to the wielder's hand immediately after it is thrown"
                  >Returning</span
                >
              </td>
              <td class="col-num">
                <span class="has-tip" :title="row.atkTooltip">{{
                  row.attack
                }}</span>
              </td>
              <td class="col-num">
                <span class="has-tip" :title="row.dmgTooltip">{{
                  row.damage
                }}</span>
                <span
                  v-if="row.thrownDamage"
                  class="thrown-damage-note"
                  :title="`Thrown attacks always use the base one-handed die, even while gripped two-handed for melee — ${row.thrownDamage} thrown vs. ${row.damage} melee.`"
                  >({{ row.thrownDamage }} thrown)</span
                >
              </td>
              <td class="col-tag">{{ row.type }}</td>
              <td class="col-effects">
                <span
                  v-for="e in weaponEffectsFor(row.id)"
                  :key="e.name"
                  class="feature-pill"
                  @click="inspectEffect(e)"
                  >{{ e.name
                  }}<span
                    v-if="e.uses_max"
                    class="pill-uses has-tip"
                    :title="`${e.uses_current ?? e.uses_max} of ${
                      e.uses_max
                    } uses remaining · recharges ${dnd.rechargeLabel(
                      e.recharge
                    )}`"
                    >{{ e.uses_current ?? e.uses_max }}/{{ e.uses_max }}</span
                  ><span v-if="e.recharge" class="pill-recharge">{{
                    dnd.rechargeLabel(e.recharge)
                  }}</span></span
                >
                <span
                  v-for="g in weaponSpellsFor(row.id)"
                  :key="g.name"
                  class="feature-pill"
                >
                  <span @click="inspectSpell(g)">{{ g.name }}</span>
                  <span v-if="g.actionType" class="pill-action">{{
                    dnd.actionTypeBadgeLabel(g.actionType)
                  }}</span>
                  <span
                    v-if="typeof g.chargeCost === 'number'"
                    class="pill-uses has-tip"
                    :title="`${g.chargeCost} charge(s) from ${row.name}'s pool`"
                    >{{ g.chargeCost }}⚡</span
                  >
                  <template v-else-if="g.chargeCost">
                    <input
                      type="number"
                      class="pill-cast-input"
                      :min="g.chargeCost.min"
                      :max="
                        Math.min(
                          g.chargeCost.max,
                          weaponItem(row.id).charges_current ?? 0
                        )
                      "
                      :value="castAmount(weaponItem(row.id), g)"
                      title="Charges to spend (your choice, higher = cast at a higher effective level)"
                      @click.stop
                      @input="
                        setCastAmount(
                          weaponItem(row.id),
                          g,
                          $event.target.value
                        )
                      "
                    />
                    <span class="pill-uses">⚡</span>
                  </template>
                  <span
                    v-if="g.usesMax != null"
                    class="pill-uses has-tip"
                    :title="`${g.usesCurrent ?? g.usesMax} of ${
                      g.usesMax
                    } uses remaining · recharges ${dnd.rechargeLabel(
                      g.recharge
                    )}`"
                    >{{ g.usesCurrent ?? g.usesMax }}/{{ g.usesMax }}</span
                  >
                  <button
                    v-if="isCastable(g)"
                    class="pill-cast-btn"
                    :disabled="!canCast(weaponItem(row.id), g)"
                    title="Spend the cost and cast"
                    @click.stop="cast(weaponItem(row.id), g)"
                  >
                    Cast
                  </button>
                </span>
              </td>
            </template>
            <template v-else>
              <td class="col-inspect"></td>
              <td class="weapon-extra-name" :title="row.source">
                + {{ row.source }}
              </td>
              <td></td>
              <td class="col-num weapon-extra-dmg">{{ row.die }}</td>
              <td class="col-tag">{{ row.dmgType }}</td>
              <td></td>
            </template>
          </tr>
        </tbody>
      </table>
    </template>
    <div v-else class="section-empty">No weapons equipped</div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import {
  buildItemPopupData,
  buildFeaturePopupData,
  buildSpellPopupData,
} from '@/utils/detailPopupBuilders.js'
import itemSpellCasting from '@/mixins/itemSpellCasting.js'
import { Search } from 'lucide-vue'

export default {
  name: 'WeaponTable',

  components: { Search },

  mixins: [itemSpellCasting],

  props: {
    character: { type: Object, required: true },
  },

  emits: ['inspect'],

  data() {
    return { dnd }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    weaponSummaries() {
      return dnd.buildWeaponRows(this.character, this.partyItems)
    },
    weaponRows() {
      const rows = []
      for (const w of this.weaponSummaries) {
        // Keyed by id, not name — two equipped weapons can share a name
        // (e.g. dual-wielding a matched pair), and a name-based key/lookup
        // would silently collapse them onto whichever came first. Real bug
        // found 2026-09-11.
        rows.push({ key: w.id, extra: false, ...w })
        for (const ex of w.extras ?? []) {
          rows.push({
            key: w.id + '|' + ex.source,
            extra: true,
            source: ex.source,
            die: ex.die,
            dmgType: ex.type,
          })
        }
      }
      return rows
    },
  },

  methods: {
    // Matched by id, not name+type+equipped_by — see weaponRows' comment on
    // why a name-based lookup isn't safe once two equipped weapons can share
    // a name.
    weaponItem(id) {
      return this.partyItems.find((i) => i.id === id) ?? null
    },
    // Effects live on the weapon that grants them (item.weapon_effects), so
    // showing them in the weapon's own row instead of a separate list makes
    // that association visible instead of implicit.
    weaponEffectsFor(id) {
      return this.weaponItem(id)?.weapon_effects ?? []
    },
    // Real spells a weapon can trigger (e.g. a marking shot forcing Faerie
    // Fire onto the target) — kept separate from weapon_effects so their
    // tooltip comes from the actual spell data (lookupSpell, via
    // buildSpellPopupData) instead of hand-copied spell text going stale.
    // Normalized via dnd.normalizeItemSpellGrant so a weapon-slot item like
    // Staff of Power gets the same accurate per-spell action/cost/material
    // handling as BattleItemsPanel gives wondrous items.
    weaponSpellsFor(id) {
      const item = this.weaponItem(id)
      return (item?.spells_granted ?? []).map((entry) =>
        dnd.normalizeItemSpellGrant(entry, item)
      )
    },
    async inspectEffect(effect) {
      this.$emit('inspect', await buildFeaturePopupData(effect))
    },
    async inspectSpell(grant) {
      this.$emit(
        'inspect',
        await buildSpellPopupData({ name: grant.name, level: null, grant })
      )
    },
    inspect(item) {
      this.$emit(
        'inspect',
        buildItemPopupData(item, this.character, this.partyItems)
      )
    },
  },
}
</script>

<style scoped>
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

.weapon-table th.col-inspect,
.weapon-table td.col-inspect {
  width: 1.4rem;
  padding-right: 0.3rem;
}

.weapon-inspect-btn {
  background: none;
  border: none;
  padding: 0;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-low);
  transition: color 0.1s;
}

.weapon-inspect-btn:hover {
  color: var(--color-accent);
}

.weapon-inspect-icon {
  width: 0.85rem;
  height: 0.85rem;
}

.weapon-name {
  color: var(--color-text);
}

.weapon-tag-badge {
  margin-left: 0.4rem;
  font-size: 0.7em;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  vertical-align: middle;
}

.thrown-damage-note {
  display: block;
  font-size: 0.7em;
  color: var(--color-text-low);
  white-space: nowrap;
}

.weapon-tag-returning {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
}

.col-effects {
  padding-left: 0.5rem;
}

.feature-pill {
  display: inline-block;
  margin: 1px 0.3rem 1px 0;
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

.pill-action {
  margin-left: 0.35em;
  font-size: 0.7em;
  padding: 0.05em 0.3em;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.pill-cast-input {
  width: 2.4em;
  margin-left: 0.35em;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font-size: 0.75em;
  padding: 0 0.2em;
}

.pill-cast-btn {
  margin-left: 0.35em;
  font-size: 0.7em;
  padding: 0.05em 0.35em;
  border-radius: 3px;
  border: 1px solid var(--color-accent);
  background: none;
  color: var(--color-accent);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.pill-cast-btn:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.pill-cast-btn:disabled {
  border-color: var(--color-border);
  color: var(--color-text-low);
  cursor: not-allowed;
}

/* .section-label is a global style (see App.vue) — not redefined here. */
</style>
