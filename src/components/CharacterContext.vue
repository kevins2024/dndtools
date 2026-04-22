<template>
  <div class="character-context">

    <aside class="char-col">
      <div class="col-label">Characters</div>
      <div class="char-list">
        <div
          v-for="char in characters"
          :key="char.name"
          class="char-card"
          :class="{ selected: selectedName === char.name }"
          @click="selectedName = char.name"
        >
          <div
            class="char-img"
            :style="{ backgroundImage: `url(${char.image})` }"
          ></div>
          <div class="char-name">{{ char.name }}</div>
        </div>
      </div>
    </aside>

    <section class="detail-area">
      <CharacterDetails :character="selectedCharacter" />
    </section>

  </div>
</template>

<script>
import CharacterDetails from './CharacterDetails.vue'
import characters from '@/data/characters.json'

export default {
  name: 'CharacterContext',
  components: { CharacterDetails },

  data() {
    return {
      characters,
      selectedName: characters.length ? characters[0].name : null,
    }
  },

  computed: {
    selectedCharacter() {
      if (!this.selectedName) return null
      return this.characters.find((c) => c.name === this.selectedName) ?? null
    },
  },
}
</script>

<style scoped>
.character-context {
  display: grid;
  grid-template-columns: 120px 1fr;
  height: 100%;
  overflow: hidden;
}

/* ── Character column ── */
.char-col {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.col-label {
  padding: 0.4rem 0.6rem;
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.char-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.char-card {
  width: 88%;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.char-card:hover {
  border-color: var(--color-accent);
}

.char-card.selected {
  border-color: var(--color-accent);
}

.char-img {
  width: 100%;
  aspect-ratio: 13 / 16;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  background-size: cover;
}

.char-name {
  padding: 4px 6px;
  text-align: center;
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
  background: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.char-card:hover .char-name,
.char-card.selected .char-name {
  color: var(--color-accent);
}

/* ── Detail area ── */
.detail-area {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
