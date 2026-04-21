<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <div class="dialog-panel">
      <div v-if="$slots.title" class="dialog-title">
        <slot name="title" />
      </div>
      <slot />
      <div v-if="$slots.actions" class="dialog-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Dialog',

  props: {
    open: {
      type: Boolean,
      required: true,
    },
  },
}
</script>

<style scoped>
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

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.act-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-small);
  padding: 0.5rem 1rem;
  border-radius: 6px;
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
</style>
