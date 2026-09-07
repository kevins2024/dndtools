// Shared "spend an item-granted spell's cost and cast it" logic — used by
// BattleItemsPanel.vue (wondrous items) and WeaponTable.vue (weapon-slot
// items like Staff of Power, whose spells_granted lives in the same shape
// but renders in a different table layout). See dnd.normalizeItemSpellGrant
// for what a normalized grant object looks like.
export default {
  data() {
    // Player's chosen charge-spend amount for a range-cost grant (e.g. a
    // wand's variable-level upcast) — keyed by "itemId:spellName" so each
    // pill remembers its own in-progress choice independent of others.
    return { castAmounts: {} }
  },
  methods: {
    // Whether this spell grant has any resource to spend at all — plain
    // "always available" grants (e.g. an attunement-taught spell cast with
    // the wielder's own slots) get no Cast button, just the inspect pill.
    isCastable(grant) {
      return grant.chargeCost != null || grant.usesCurrent != null
    },
    castAmountKey(item, grant) {
      return `${item.id}:${grant.name}`
    },
    castAmount(item, grant) {
      const key = this.castAmountKey(item, grant)
      return this.castAmounts[key] ?? grant.chargeCost.min
    },
    setCastAmount(item, grant, value) {
      const clamped = Math.max(
        grant.chargeCost.min,
        Math.min(
          Math.min(grant.chargeCost.max, item.charges_current ?? 0),
          Number(value) || grant.chargeCost.min
        )
      )
      this.$set(this.castAmounts, this.castAmountKey(item, grant), clamped)
    },
    canCast(item, grant) {
      if (grant.chargeCost != null) {
        const cost =
          typeof grant.chargeCost === 'number'
            ? grant.chargeCost
            : this.castAmount(item, grant)
        return (item.charges_current ?? 0) >= cost
      }
      if (grant.usesCurrent != null) return grant.usesCurrent > 0
      return false
    },
    cast(item, grant) {
      if (!this.canCast(item, grant)) return
      if (typeof grant.chargeCost === 'number') {
        this.$store.commit('SPEND_CHARGE', {
          itemId: item.id,
          amount: grant.chargeCost,
        })
      } else if (grant.chargeCost) {
        this.$store.commit('SPEND_CHARGE', {
          itemId: item.id,
          amount: this.castAmount(item, grant),
        })
      } else if (grant.usesCurrent != null) {
        this.$store.commit('SPEND_GRANT_USE', {
          itemId: item.id,
          spellName: grant.name,
          choiceGroup: grant.choiceGroup,
        })
      }
    },
  },
}
