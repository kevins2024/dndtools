<template>
  <div class="inventory-manager">
    <!-- Left: This character -->
    <div class="inv-column">
      <div class="col-title">{{ character.name }}</div>

      <div class="col-section">
        <div class="col-section-label">Equipped</div>
        <div v-if="slotSummaries.length > 0" class="slot-summary">
          <span
            v-for="summary in slotSummaries"
            :key="summary.slot"
            class="slot-chip"
            :class="{ over: summary.over }"
          >
            {{ summary.slot }} {{ summary.count }}/{{ summary.cap }}
          </span>
        </div>
        <div v-if="equippedItems.length === 0" class="empty">
          Nothing equipped
        </div>
        <div
          v-for="item in equippedItems"
          :key="item.id"
          class="inv-item equipped"
          :class="{ overloaded: isSlotOverfilled(item.slot || item.type) }"
          @click="unequip(item)"
          title="Click to unequip"
        >
          <span class="item-name">{{ item.name }}</span>
          <span class="item-slot">{{ item.slot || item.type }}</span>
          <span class="item-tag">{{ item.type }}</span>
          <span class="item-action">↓</span>
        </div>
      </div>

      <div class="col-section">
        <div class="col-section-label">Carrying</div>
        <div v-if="carriedItems.length === 0" class="empty">
          Nothing carried
        </div>
        <div
          v-for="item in carriedItems"
          :key="item.id"
          class="inv-item carried"
        >
          <span
            class="item-name"
            @click="canEquip(item) && equip(item)"
            :title="canEquip(item) ? 'Click to equip' : 'Slot full'"
          >
            {{ item.name }}
          </span>
          <span class="item-tag">{{ item.type }}</span>
          <div class="item-actions">
            <button
              class="act-btn"
              @click="equip(item)"
              :disabled="!canEquip(item)"
              :title="canEquip(item) ? 'Equip' : 'Slot full'"
            >
              ↑
            </button>
            <button
              class="act-btn dim"
              @click="toPool(item)"
              title="Return to party pool"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Available -->
    <div class="inv-column">
      <div class="col-title">Party Pool</div>

      <div class="col-section">
        <div v-if="poolItems.length === 0" class="empty">
          Party pool is empty
        </div>
        <div
          v-for="item in poolItems"
          :key="item.id"
          class="inv-item pool"
          @click="carry(item)"
          title="Click to carry"
        >
          <span class="item-name">{{ item.name }}</span>
          <span class="item-tag">{{ item.type }}</span>
          <span class="item-action">→</span>
          <button
            class="act-btn dim delete-btn"
            @click.stop="confirmDelete(item)"
            title="Delete item"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="deleteDialogOpen"
      class="dialog-backdrop"
      @click.self="cancelDelete"
    >
      <div class="dialog-panel">
        <div class="dialog-title">Confirm delete</div>
        <p>
          Delete
          <strong>{{ deleteCandidate ? deleteCandidate.name : '' }}</strong>
          from the party pool?
        </p>
        <label class="dialog-field">
          <span>If you sold the item, how much did it sell for?</span>
          <input
            v-model="deleteSaleValue"
            type="number"
            min="0"
            placeholder="0"
          />
        </label>
        <div class="dialog-actions">
          <button class="act-btn dim" @click="cancelDelete">Cancel</button>
          <button class="act-btn" @click="deleteConfirmed">
            Delete and add gold
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CharacterInventory',

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    allItems() {
      return this.$store.state.party_items
    },
    equippedItems() {
      return this.allItems.filter((i) => i.equipped_by === this.character.name)
    },
    carriedItems() {
      return this.allItems.filter(
        (i) => i.carried_by === this.character.name && !i.equipped_by
      )
    },
    poolItems() {
      return this.allItems.filter((i) => this.isPoolItem(i))
    },
    slotCounts() {
      return this.equippedItems.reduce((counts, item) => {
        const slot = item.slot || item.type || 'unknown'
        counts[slot] = (counts[slot] || 0) + 1
        return counts
      }, {})
    },
    multiSlotTypes() {
      return ['ring', 'melee1h', 'ranged1h']
    },
    slotSummaries() {
      return Object.entries(this.slotCounts).map(([slot, count]) => {
        const cap = this.multiSlotTypes.includes(slot) ? 2 : 1
        return {
          slot,
          count,
          cap,
          over: count > cap,
        }
      })
    },
  },

  data() {
    return {
      deleteDialogOpen: false,
      deleteCandidate: null,
      deleteSaleValue: '',
    }
  },

  methods: {
    slotCapacity(slot) {
      return this.multiSlotTypes.includes(slot) ? 2 : 1
    },
    isSlotOverfilled(slot) {
      const count = this.slotCounts[slot] || 0
      return count > this.slotCapacity(slot)
    },
    isPoolItem(item) {
      return (
        item.carried_by === 'party' || (!item.carried_by && !item.equipped_by)
      )
    },
    canEquip(item) {
      if (item.equipped_by === 'disallowed') return false
      const slot = item.slot || item.type || 'unknown'
      const count = this.slotCounts[slot] || 0
      return count < this.slotCapacity(slot)
    },
    equip(item) {
      if (!this.canEquip(item)) return
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        equipped_by: this.character.name,
        carried_by: this.character.name,
      })
    },
    unequip(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        equipped_by: null,
        carried_by: this.character.name,
      })
    },
    carry(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        carried_by: this.character.name,
        equipped_by: null,
      })
    },
    toPool(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        carried_by: 'party',
        equipped_by: null,
      })
    },
    confirmDelete(item) {
      this.deleteCandidate = item
      this.deleteSaleValue = ''
      this.deleteDialogOpen = true
    },
    cancelDelete() {
      this.deleteDialogOpen = false
      this.deleteCandidate = null
      this.deleteSaleValue = ''
    },
    deleteConfirmed() {
      if (!this.deleteCandidate) return
      const value = parseFloat(this.deleteSaleValue)
      const gold = Number.isFinite(value) && value > 0 ? value : 0
      this.$store.commit('DELETE_PARTY_ITEM', this.deleteCandidate.id)
      if (gold) {
        this.$store.commit('ADJUST_PARTY_GOLD', gold)
      }
      this.cancelDelete()
    },
  },
}
</script>

<style scoped>
.inventory-manager {
  display: flex;
  gap: 1vw;
  height: 100%;
  padding: 1vh 1vw;
  overflow: hidden;
}

/* ── Columns ── */
.inv-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.col-title {
  font-family: var(--font-display);
  font-size: var(--font-size-small);
  color: var(--color-accent-strong);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 0.4vh;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.col-section {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.slot-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4vw;
  margin-bottom: 0.4vh;
}

.slot-chip {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font-size: var(--font-size-xxs);
}

.slot-chip.over {
  border-color: var(--color-text-danger);
  background: rgba(160, 60, 50, 0.15);
  color: var(--color-text-danger);
}

.col-section-label {
  font-size: var(--font-size-xxxs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.2vh;
}

/* ── Items ── */
.inv-item {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  font-size: var(--font-size-small);
}

.inv-item.overloaded {
  border-color: var(--color-text-danger);
  background: rgba(160, 60, 50, 0.12);
}

.inv-item.equipped {
  border-color: var(--color-accent);
}

.inv-item.equipped:hover {
  border-color: var(--color-text-danger);
}

.inv-item.carried:hover,
.inv-item.pool:hover {
  border-color: var(--color-accent);
}

.item-name {
  flex: 1;
  color: var(--color-text);
}

.item-slot {
  font-size: var(--font-size-xxs);
  color: var(--color-text-muted);
  padding: 0 6px;
  border-left: 1px solid var(--color-border);
}

.item-tag {
  font-size: var(--font-size-xxs);
  color: var(--color-text-low);
}

.item-action {
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
}

.item-actions {
  display: flex;
  gap: 4px;
}

.act-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-tiny);
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s ease;
}

.act-btn:disabled {
  color: var(--color-text-low);
  cursor: not-allowed;
}

.act-btn:hover {
  color: var(--color-accent);
}

.act-btn.dim:hover {
  color: var(--color-text-danger);
}

.empty {
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  font-style: italic;
  padding: 2px 0;
}

.delete-btn {
  margin-left: auto;
  color: var(--color-text-danger);
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 18, 0.7);
  z-index: 20;
}

.dialog-panel {
  width: min(92vw, 420px);
  padding: 1.2rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  font-size: var(--font-size-small);
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.dialog-field {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.dialog-field input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
