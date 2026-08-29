<template>
  <div class="sheet-section">
    <div class="section-title">Notes</div>
    <textarea
      class="notes-input"
      :value="character.notes"
      placeholder="Notes…"
      @input="commit($event.target.value)"
    ></textarea>
  </div>
</template>

<script>
export default {
  name: 'NotesPanel',

  props: {
    character: { type: Object, required: true },
    table: { type: String, default: 'characters' },
  },

  methods: {
    commit(value) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: this.table,
        updatedItem: { ...this.character, notes: value },
      })
    },
  },
}
</script>

<style scoped>
.sheet-section {
  border-top: 1px solid var(--color-bg-surface-alt);
  padding-top: 0.8vh;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.6vh;
}

.notes-input {
  width: 100%;
  min-height: 4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-md);
  font-style: italic;
  line-height: 1.5;
  padding: 0.4rem 0.5rem;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.notes-input:focus {
  border-color: var(--color-accent);
}
</style>
