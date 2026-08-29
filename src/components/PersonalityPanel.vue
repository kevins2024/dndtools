<template>
  <div
    class="sheet-section"
    v-if="character.personality_traits || character.personality_quirks"
  >
    <div class="section-title">Personality</div>
    <p v-if="character.personality_traits" class="flavor-text">
      {{ character.personality_traits }}
    </p>
    <p v-if="character.personality_quirks" class="flavor-text quirk">
      {{ character.personality_quirks }}
    </p>
  </div>
</template>

<script>
export default {
  name: 'PersonalityPanel',

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

.flavor-text.quirk {
  color: var(--color-text-low);
  margin-top: 0.4vh;
}
</style>
