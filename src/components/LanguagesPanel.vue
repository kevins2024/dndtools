<template>
  <div class="sheet-section">
    <div class="section-title">Languages</div>
    <div class="pill-list">
      <span
        v-for="lang in character.languages ?? []"
        :key="lang"
        class="pill"
        >{{ lang }}</span
      >
    </div>
  </div>
</template>

<script>
export default {
  name: 'LanguagesPanel',

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

.pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4vw;
}

.pill {
  font-size: var(--font-size-base);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-low);
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
