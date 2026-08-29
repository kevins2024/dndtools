<template>
  <div v-if="slotLevels.length" class="spell-slots">
    <div v-for="lvl in slotLevels" :key="lvl.key" class="slot-level">
      <span class="slot-level-label">{{ lvl.label }}</span>
      <span
        v-for="i in lvl.max"
        :key="i"
        class="slot-box"
        :class="{
          used: i <= lvl.max - lvl.current,
          'slot-box--pact': lvl.key === 'pact',
        }"
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

<script>
// Shared by CharacterCombatPanel.vue (used during combat) and
// CharacterSpellbook.vue (the full spellbook tab) — previously each had its
// own separate clickable-pip implementation of the exact same
// character.spell_slots / pact_magic data. Unifying also fixes a real bug:
// CharacterSpellbook's version read `pact_magic.level` for the slot-level
// label, but the actual field is `slot_level` (confirmed against real
// character data) — it was silently showing "Pact L?" instead of the real
// slot level.
function nextSlotValue(max, current, clickedIndex) {
  const used = max - current
  return Math.min(
    max,
    Math.max(0, clickedIndex < used ? current + 1 : current - 1)
  )
}

export default {
  name: 'SpellSlotsTracker',

  props: {
    character: { type: Object, required: true },
    // Which store table `character` lives in — lets this be reused for
    // non-character combatants without their slot edits leaking into
    // state.characters.
    table: { type: String, default: 'characters' },
  },

  computed: {
    slotLevels() {
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
  },

  methods: {
    toggleSlot(levelKey, slotIndex) {
      if (levelKey === 'pact') {
        const pm = this.character.pact_magic
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: this.table,
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
        table: this.table,
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
  },
}
</script>

<style scoped>
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

/* Pact magic slots get their own accent color, carried over from the
   spellbook's original pip styling, so they read as a visually distinct
   resource from normal spell slots. */
.slot-box--pact {
  border-color: #8866dd;
  background: #8866dd;
}
.slot-box--pact.used {
  background: transparent;
  border-color: var(--color-text-low);
}
</style>
