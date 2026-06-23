<template>
  <div class="character-context">
    <aside class="char-col scrollable">
      <div class="col-label">Characters</div>
      <label class="dedup-toggle">
        <input v-model="hideDuplicates" type="checkbox" />
        Hide duplicates
      </label>
      <div class="char-list">
        <div
          v-for="group in groupedCharacters"
          :key="group.label"
          class="char-group"
        >
          <div
            class="group-label"
            :class="{ 'group-label--active': group.active }"
          >
            {{ group.label }}
          </div>
          <div
            v-for="char in group.chars"
            :key="char.name"
            class="char-card"
            :class="{ selected: selectedName === char.name }"
            @click="selectedName = char.name"
          >
            <div
              class="char-img"
              :style="{ backgroundImage: `url(${char.image})` }"
            ></div>
            <div class="char-name">
              <ClassIcon :character="char" class="char-class-icon" />{{
                char.name
              }}
            </div>
          </div>
        </div>
      </div>
    </aside>

    <section class="detail-area">
      <CharacterDetails
        :character="selectedCharacter"
        :requested-tab="navTab"
      />
    </section>
  </div>
</template>

<script>
import CharacterDetails from './CharacterDetails.vue'
import ClassIcon from './ClassIcon.vue'
import dataService from '../utils/dataService'

export default {
  name: 'CharacterContext',
  components: { CharacterDetails, ClassIcon },

  data() {
    return {
      selectedName: null,
      navTab: null,
      hideDuplicates: true, // default overwritten in created()
    }
  },

  computed: {
    characters() {
      return this.$store.state.characters
    },
    groupedCharacters() {
      const allChars = this.characters
      const assigned = new Set()
      const parties = [...this.$store.state.parties].sort((a, b) =>
        b.active ? 1 : a.active ? -1 : 0
      )
      const groups = parties
        .map((party) => {
          const chars = party.members
            .map((name) => allChars.find((c) => c.name === name))
            .filter(Boolean)
            .filter((c) => !this.hideDuplicates || !assigned.has(c.name))
          chars.forEach((c) => assigned.add(c.name))
          return { label: party.name, active: party.active, chars }
        })
        .filter((g) => g.chars.length)
      const ungrouped = allChars.filter((c) => !assigned.has(c.name))
      if (ungrouped.length)
        groups.push({ label: 'Other', active: false, chars: ungrouped })
      return groups
    },
    selectedCharacter() {
      if (!this.selectedName) return null
      return this.characters.find((c) => c.name === this.selectedName) ?? null
    },
  },

  async created() {
    const prefs = await dataService.getUserPrefs()
    if (prefs.hideDuplicates !== undefined) {
      this.hideDuplicates = prefs.hideDuplicates
    }
  },

  watch: {
    characters: {
      immediate: true,
      handler(chars) {
        if (
          !this.selectedName &&
          chars.length &&
          !this.$store.state.characterNavRequest
        ) {
          const first = this.groupedCharacters[0]?.chars[0]
          this.selectedName = first ? first.name : chars[0].name
        }
      },
    },
    '$store.state.characterNavRequest': {
      immediate: true,
      handler(req) {
        if (req) {
          this.selectedName = req.name
          this.navTab = req.tab ?? 'sheet'
          this.$store.commit('CLEAR_CHARACTER_NAV')
          this.$nextTick(() => {
            this.navTab = null
          })
        }
      },
    },
    hideDuplicates(val) {
      dataService.patchUserPrefs({ hideDuplicates: val }).catch(console.warn)
    },
  },

  methods: {},
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
}

.dedup-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 6px;
  font-size: 0.65rem;
  color: var(--color-text-low);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  user-select: none;
}

.dedup-toggle input {
  accent-color: var(--color-accent);
  cursor: pointer;
}

.char-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.char-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0 8px;
  border-bottom: 1px solid var(--color-border);
}

.char-group:last-child {
  border-bottom: none;
}

.group-label {
  width: 88%;
  font-family: var(--font-display);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-low);
  padding: 0 2px 2px;
}

.group-label--active {
  color: var(--color-accent);
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
  font-size: var(--font-size-base);
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

.char-class-icon {
  width: 11px;
  height: 11px;
  opacity: 0.7;
  margin-right: 3px;
  vertical-align: middle;
  flex-shrink: 0;
}

/* ── Detail area ── */
.detail-area {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
