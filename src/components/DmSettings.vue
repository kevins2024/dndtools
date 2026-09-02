<template>
  <div class="dm-settings">
    <section class="setting-block">
      <h3 class="setting-title">Party Level Cap</h3>
      <p class="setting-help">
        Applies to every character in the Level Up tool by default — parties
        generally level up together, so one campaign-wide cap keeps everyone in
        sync. A character can be given a higher or lower
        <code>level_cap_override</code> on their own record for a rare,
        deliberate exception (e.g. a pair of characters held back to learn a new
        class). The Level Up tool also has its own "ignore cap" toggle for
        previewing levels ahead without saving.
      </p>
      <div class="setting-row">
        <label for="level-cap-input">Current cap</label>
        <input
          id="level-cap-input"
          type="number"
          min="1"
          max="20"
          class="setting-input"
          :value="level_cap"
          placeholder="No cap"
          @change="onCapChange"
        />
        <button
          v-if="level_cap != null"
          class="clear-btn"
          title="Remove the cap entirely"
          @click="SET_LEVEL_CAP(null)"
        >
          Clear
        </button>
      </div>
    </section>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'

export default {
  name: 'DmSettings',

  computed: {
    ...mapState(['level_cap']),
  },

  methods: {
    ...mapMutations(['SET_LEVEL_CAP']),
    onCapChange(event) {
      const raw = event.target.value
      const value = raw === '' ? null : Math.max(1, Math.min(20, Number(raw)))
      this.SET_LEVEL_CAP(value)
    },
  },
}
</script>

<style scoped>
.dm-settings {
  padding: 1.25rem;
  overflow-y: auto;
  height: 100%;
}

.setting-block {
  max-width: 32rem;
}

.setting-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-text);
  margin: 0 0 0.5rem;
}

.setting-help {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  margin: 0 0 0.75rem;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.setting-row label {
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
}

.setting-input {
  width: 6rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
}

.clear-btn {
  font-size: var(--font-size-sm);
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
</style>
