<template>
  <div class="pcsb-root">
    <!-- Always reachable regardless of what's currently selected in the host
         tool — this reflects every character with unsaved changes in the
         store (not just from whichever tool is mounted), since neither
         Level Up nor New Character autosaves. Each one can be saved or
         reverted independently, so finishing one character doesn't force a
         decision on an experiment still in progress on another. -->
    <div v-if="pendingNames.length" class="pcsb-save-bar">
      <div class="pcsb-save-bar-title">
        Unsaved changes — {{ pendingNames.length }} character{{
          pendingNames.length === 1 ? '' : 's'
        }}
      </div>
      <div v-for="name in pendingNames" :key="name" class="pcsb-pending-row">
        <span class="pcsb-pending-name">{{ name }}</span>
        <button
          class="pcsb-btn"
          :disabled="savingName === name"
          @click="$emit('save-only', name)"
        >
          {{ savingName === name ? 'Saving…' : 'Save only this' }}
        </button>
        <button
          class="pcsb-btn pcsb-btn--danger"
          :disabled="savingName === name"
          @click="$emit('revert', name)"
        >
          Revert
        </button>
      </div>
      <div class="pcsb-save-all-row">
        <button
          class="pcsb-btn pcsb-btn--confirm pcsb-btn--large"
          :disabled="savingName === 'all'"
          @click="$emit('save-all')"
        >
          {{ savingName === 'all' ? 'Saving…' : 'Save All' }}
        </button>
        <span v-if="saveError" class="pcsb-error">{{ saveError }}</span>
      </div>
    </div>
    <div v-else-if="justSaved" class="pcsb-confirmed-note">✓ Saved.</div>
  </div>
</template>

<script>
export default {
  name: 'PendingCharacterSaveBar',

  props: {
    pendingNames: { type: Array, required: true },
    savingName: { type: String, default: null },
    saveError: { type: String, default: null },
    justSaved: { type: Boolean, default: false },
  },
}
</script>

<style scoped>
.pcsb-save-bar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--color-bg-surface-alt);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  padding: 0.6rem 0.9rem;
}

.pcsb-save-bar-title {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  font-size: var(--font-size-sm);
}

.pcsb-pending-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.pcsb-pending-name {
  flex: 1;
  color: var(--color-text);
}

.pcsb-btn {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.pcsb-btn--confirm {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
}

.pcsb-btn--large {
  padding: 0.5rem 1.2rem;
  font-size: var(--font-size-base);
}

.pcsb-btn--danger {
  color: var(--color-text-danger);
  border-color: var(--color-text-danger);
}

.pcsb-save-all-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--color-border);
}

.pcsb-error {
  color: var(--color-text-danger);
  font-size: var(--font-size-sm);
}

.pcsb-confirmed-note {
  color: var(--color-success);
  font-size: var(--font-size-sm);
}
</style>
