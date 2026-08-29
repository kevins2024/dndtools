<template>
  <!-- Class Resources (ki, superiority dice, rage, etc.) — this is already
       fully data-driven (character.resources[], plus one legacy special case
       for ki_points merged into the same shape), so there's nothing
       type-specific left to split into further components. -->
  <div v-if="classResources.length">
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
  </div>
</template>

<script>
function nextSlotValue(max, current, clickedIndex) {
  const used = max - current
  return Math.min(
    max,
    Math.max(0, clickedIndex < used ? current + 1 : current - 1)
  )
}

export default {
  name: 'ClassResourcesPanel',

  props: {
    character: { type: Object, required: true },
    table: { type: String, default: 'characters' },
  },

  computed: {
    classResources() {
      const c = this.character
      const result = []

      // ki_points (Monk) — legacy special-case field, predates the generic
      // resources[] array below; merged into the same shape here.
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
  },

  methods: {
    toggleResource(res, slotIndex) {
      const newCurrent = nextSlotValue(res.max, res.current, slotIndex)
      if (res.key === 'ki_points') {
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: this.table,
          updatedItem: {
            ...this.character,
            ki_points: { ...this.character.ki_points, current: newCurrent },
          },
        })
        return
      }
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: {
          ...this.character,
          resources: (this.character.resources ?? []).map((r) =>
            (r.key ?? r.name) === res.key ? { ...r, current: newCurrent } : r
          ),
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

.slot-level-label--res {
  width: 2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.slot-box--res {
  border-color: var(--color-text-muted);
  background: var(--color-text-muted);
  border-radius: 50%;
}

.slot-box--res.used {
  background: transparent;
  border-color: var(--color-text-low);
}
</style>
