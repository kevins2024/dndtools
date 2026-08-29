<template>
  <div class="sheet-section" v-if="character.appearance">
    <div class="section-title">Appearance</div>
    <p class="flavor-text">{{ character.appearance }}</p>
  </div>
</template>

<script>
export default {
  name: 'AppearancePanel',

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

.flavor-text {
  font-size: var(--font-size-md);
  color: var(--color-text-low);
  line-height: 1.5;
  margin: 0;
  font-style: italic;
}
</style>
