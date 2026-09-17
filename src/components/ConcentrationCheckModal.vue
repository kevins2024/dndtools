<template>
  <div class="conc-modal">
    <div class="conc-modal-header">
      <Brain class="conc-modal-icon" />
      <span class="conc-modal-title">Concentration Check</span>
      <button
        class="conc-modal-close"
        title="Dismiss"
        @click="$emit('dismiss')"
      >
        ✕
      </button>
    </div>

    <p class="conc-modal-body">
      <strong>{{ alert.name }}</strong> took {{ alert.damage }} damage while
      concentrating — CON save, DC <strong>{{ alert.dc }}</strong
      >.
    </p>

    <p class="conc-modal-rule">{{ ruleSummary }}</p>

    <div class="conc-modal-actions">
      <button class="conc-btn dim" @click="$emit('dismiss')">Skip</button>
      <button class="conc-btn" @click="$emit('roll')">Roll Check</button>
    </div>

    <div v-if="queueCount > 1" class="conc-modal-queue">
      +{{ queueCount - 1 }} more waiting
    </div>
  </div>
</template>

<script>
import { Brain } from 'lucide-vue'
import { CONDITIONS } from '@/data/conditions.js'

// Deliberately NOT a full-screen backdrop modal (unlike every other modal in
// this app — PartyEditModal, ShortRestModal, etc — which all use
// position:fixed;inset:0). Project owner's explicit requirement: this must
// never block the dice roller (Drawer/DiceRoller.vue, mounted as a normal
// flex sibling of .context-area in AppLayout.vue, well outside Battle.vue's
// own box). Positioning this as position:absolute within .battle (which is
// already position:relative — see its own .bestiary-overlay for the same
// pattern) confines it structurally to Battle.vue's box, so it can never
// reach the drawer at all, without needing any pointer-events trickery.
// Skippable per spec — the Skip button just dismisses, no gate on
// continuing to play.
export default {
  name: 'ConcentrationCheckModal',

  components: { Brain },

  props: {
    alert: {
      type: Object,
      required: true,
      // { name, damage, dc, mod }
    },
    queueCount: { type: Number, default: 1 },
  },

  emits: ['roll', 'dismiss'],

  computed: {
    // Reuses conditions.js's own "Concentrating" summary rather than a
    // hand-written duplicate of the same rule text — one place to update
    // the wording, not two.
    ruleSummary() {
      return CONDITIONS.Concentrating.summary
    },
  },
}
</script>

<style scoped>
.conc-modal {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 300px;
  max-width: 90%;
  background: var(--color-bg-panel);
  border: 1px solid #a855f7;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 0.6rem 0.75rem 0.75rem;
  z-index: 250;
}

.conc-modal-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.conc-modal-icon {
  width: 1.1rem;
  height: 1.1rem;
  color: #a855f7;
  flex-shrink: 0;
}

.conc-modal-title {
  flex: 1;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.03em;
  color: var(--color-text);
}

.conc-modal-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-base);
  line-height: 1;
  padding: 0.1rem 0.2rem;
}
.conc-modal-close:hover {
  color: var(--color-text-danger);
}

.conc-modal-body {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  margin: 0 0 0.35rem;
  line-height: 1.4;
}
.conc-modal-body strong {
  color: var(--color-text);
}

.conc-modal-rule {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  font-style: italic;
  margin: 0 0 0.6rem;
  line-height: 1.35;
}

.conc-modal-actions {
  display: flex;
  gap: 0.4rem;
}

.conc-btn {
  flex: 1;
  padding: 0.3rem 0;
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  letter-spacing: 0.03em;
  background: #a855f7;
  border: 1px solid #a855f7;
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.12s;
}
.conc-btn:hover {
  opacity: 0.85;
}
.conc-btn.dim {
  background: none;
  color: var(--color-text-low);
  border-color: var(--color-border);
}
.conc-btn.dim:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
  opacity: 1;
}

.conc-modal-queue {
  margin-top: 0.4rem;
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  text-align: right;
}
</style>
