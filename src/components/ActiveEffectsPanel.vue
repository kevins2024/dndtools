<template>
  <div
    class="sheet-section"
    v-if="character.active_effects && character.active_effects.length"
  >
    <div class="section-title">Active Effects</div>
    <div class="feature-list">
      <div
        v-for="effect in character.active_effects"
        :key="effect.name"
        class="feature-item"
      >
        <span class="feature-name">{{ effect.name }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActiveEffectsPanel',

  props: {
    character: { type: Object, required: true },
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

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.6vw;
  font-size: var(--font-size-md);
}

.feature-name {
  color: var(--color-text);
  flex: 1;
}
</style>
