<template>
  <div v-if="companion" class="companion-strip">
    <img :src="companion.image" class="companion-thumb" />
    <span class="companion-name">{{ companion.name }}</span>
    <label class="companion-summon">
      <input
        type="checkbox"
        :checked="companion.summoned"
        @change="toggleSummoned"
      />
      Summoned
    </label>
  </div>
</template>

<script>
export default {
  name: 'CompanionSummonStrip',

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    companion() {
      return (
        (this.$store.state.companions ?? []).find(
          (c) => c.owner === this.character.name
        ) ?? null
      )
    },
  },

  methods: {
    toggleSummoned() {
      if (!this.companion) return
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'companions',
        updatedItem: { ...this.companion, summoned: !this.companion.summoned },
      })
    },
  },
}
</script>

<style scoped>
.companion-strip {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.3vh 0.5vw;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-panel);
  font-size: var(--font-size-sm);
}

.companion-thumb {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.companion-name {
  font-weight: 600;
  color: var(--color-accent);
  flex: 1;
}

.companion-summon {
  display: flex;
  align-items: center;
  gap: 0.3em;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.companion-summon input {
  cursor: pointer;
}
</style>
