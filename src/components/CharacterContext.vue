<template>
  <div class="character-context">
    <aside
      ref="charCol"
      class="char-col scrollable"
      @dragover="onColDragOver"
      @dragleave="onColDragLeave"
    >
      <div class="col-label">Characters</div>
      <label class="dedup-toggle">
        <input v-model="hideDuplicates" type="checkbox" />
        Hide duplicates
      </label>
      <div ref="charList" class="char-list">
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
            :class="{
              selected: selectedName === char.name,
              'drop-target': dropTargetName === char.name,
            }"
            :data-char-name="char.name"
            @click="selectedName = char.name"
            @dragenter="onCardDragOver($event, char)"
            @dragover="onCardDragOver($event, char)"
            @dragleave="onCardDragLeave(char)"
            @drop="onCardDrop($event, char)"
          >
            <div
              class="char-img"
              :style="{ backgroundImage: `url(${char.image})` }"
            >
              <button
                class="magnify-btn"
                title="View full image"
                @click.stop="lightboxChar = char"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                  <path d="M8 11h6M11 8v6" />
                </svg>
              </button>
            </div>
            <div class="char-name">
              <ClassIcon
                :character="char"
                class="char-class-icon"
                :style="{
                  color: $dnd.classColorVar(
                    char.classes && char.classes[0] && char.classes[0].name
                  ),
                }"
              />{{ char.name }}
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

    <!-- Full-size image lightbox, opened via a card's magnify button -->
    <div
      v-if="lightboxChar"
      class="lightbox-overlay"
      @click="lightboxChar = null"
    >
      <img :src="lightboxChar.image" class="lightbox-img" @click.stop />
    </div>

    <!-- Confirmation for a drag-and-drop item hand-off, with undo -->
    <div v-if="transferNotice" class="transfer-toast">
      <span>{{ transferNotice.text }}</span>
      <button class="transfer-undo" @click="undoTransfer">Undo</button>
    </div>
  </div>
</template>

<script>
import CharacterDetails from './CharacterDetails.vue'
import ClassIcon from './ClassIcon.vue'
import dataService from '../utils/dataService'
import { ITEM_DRAG_TYPE } from '../utils/itemDrag'

// Edge auto-scroll while an item is being dragged: within EDGE_ZONE px of the
// top/bottom of the character column it scrolls, faster the closer to the
// edge. The browser's own drag auto-scroll is slow and inconsistent, and this
// is the whole point of the feature on a long roster.
const EDGE_ZONE = 90
const MAX_SCROLL_PER_FRAME = 22
// dragover keeps firing (~every 50-350ms) while the pointer is over the
// column, even when held still; if it stops (pointer left, drop elsewhere,
// the dragged row was removed from the DOM so no dragend), so does scrolling.
const DRAG_STALE_MS = 400

export default {
  name: 'CharacterContext',
  components: { CharacterDetails, ClassIcon },

  data() {
    return {
      selectedName: null,
      navTab: null,
      hideDuplicates: true, // default overwritten in created()
      lightboxChar: null,
      dropTargetName: null,
      transferNotice: null, // { text, before }
      noticeTimer: null,
      scrollSpeed: 0,
      lastDragOverAt: 0,
      scrollRaf: null,
    }
  },

  computed: {
    characters() {
      return this.$store.state.characters
    },
    groupedCharacters() {
      const allChars = this.characters
      const assigned = new Set()
      const parties = [...this.$store.getters.liveParties].sort((a, b) =>
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
        groups.push({
          label: 'Not in a Party',
          active: false,
          chars: ungrouped,
        })
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
            this.scrollSelectedIntoView()
          })
        }
      },
    },
    hideDuplicates(val) {
      dataService.patchUserPrefs({ hideDuplicates: val }).catch(console.warn)
    },
  },

  beforeDestroy() {
    this.stopAutoScroll()
    clearTimeout(this.noticeTimer)
  },

  methods: {
    // ── Item drag-and-drop ──
    isItemDrag(e) {
      return Array.from(e.dataTransfer?.types ?? []).includes(ITEM_DRAG_TYPE)
    },
    onCardDragOver(e, char) {
      if (!this.isItemDrag(e)) return
      e.preventDefault() // marks this as a valid drop target
      e.dataTransfer.dropEffect = 'move'
      this.dropTargetName = char.name
    },
    onCardDragLeave(char) {
      if (this.dropTargetName === char.name) this.dropTargetName = null
    },
    async onCardDrop(e, char) {
      if (!this.isItemDrag(e)) return
      e.preventDefault()
      const itemId = e.dataTransfer.getData(ITEM_DRAG_TYPE)
      this.dropTargetName = null
      this.stopAutoScroll()
      const result = await this.$store.dispatch('transferItem', {
        itemId,
        toCharacter: char.name,
      })
      if (!result) return
      this.showNotice(`${result.after.name} → ${char.name}`, result.before)
    },
    showNotice(text, before) {
      clearTimeout(this.noticeTimer)
      this.transferNotice = { text, before }
      this.noticeTimer = setTimeout(() => {
        this.transferNotice = null
      }, 6000)
    },
    undoTransfer() {
      if (!this.transferNotice) return
      this.$store.commit('UPDATE_ITEM', this.transferNotice.before)
      clearTimeout(this.noticeTimer)
      this.transferNotice = null
    },

    // ── Edge auto-scroll ──
    onColDragOver(e) {
      if (!this.isItemDrag(e)) return
      const col = this.$refs.charCol
      if (!col) return
      const rect = col.getBoundingClientRect()
      const fromTop = e.clientY - rect.top
      const fromBottom = rect.bottom - e.clientY
      let speed = 0
      if (fromTop < EDGE_ZONE) {
        speed = -MAX_SCROLL_PER_FRAME * (1 - Math.max(fromTop, 0) / EDGE_ZONE)
      } else if (fromBottom < EDGE_ZONE) {
        speed = MAX_SCROLL_PER_FRAME * (1 - Math.max(fromBottom, 0) / EDGE_ZONE)
      }
      this.scrollSpeed = speed
      this.lastDragOverAt = performance.now()
      if (speed !== 0 && this.scrollRaf == null) this.tickAutoScroll()
    },
    onColDragLeave(e) {
      // dragleave also fires when crossing between child elements; only stop
      // when the pointer has actually left the column.
      if (!this.$refs.charCol?.contains(e.relatedTarget)) {
        this.scrollSpeed = 0
        this.dropTargetName = null
      }
    },
    tickAutoScroll() {
      const col = this.$refs.charCol
      const stale = performance.now() - this.lastDragOverAt > DRAG_STALE_MS
      if (!col || stale || this.scrollSpeed === 0) {
        this.scrollRaf = null
        return
      }
      col.scrollTop += this.scrollSpeed
      this.scrollRaf = requestAnimationFrame(this.tickAutoScroll)
    },
    stopAutoScroll() {
      this.scrollSpeed = 0
      if (this.scrollRaf != null) cancelAnimationFrame(this.scrollRaf)
      this.scrollRaf = null
    },

    scrollSelectedIntoView() {
      const list = this.$refs.charList
      if (!list) return
      const card = Array.from(list.querySelectorAll('.char-card')).find(
        (el) => el.dataset.charName === this.selectedName
      )
      card?.scrollIntoView({ block: 'nearest' })
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
}

.char-card:hover {
  border-color: var(--color-accent);
}

.char-card.selected {
  border-color: var(--color-accent);
}

/* An item is being dragged over this portrait — release to hand it over. */
.char-card.drop-target {
  border-color: var(--color-accent-strong, var(--color-accent));
  box-shadow: 0 0 0 2px var(--color-accent);
  transform: scale(1.04);
}

.char-card {
  transition: border-color 0.15s ease, transform 0.1s ease, box-shadow 0.1s ease;
}

.char-img {
  position: relative;
  width: 100%;
  aspect-ratio: 13 / 16;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  background-size: cover;
}

.magnify-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 1.4rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-accent);
  opacity: 0;
  transition: opacity 0.12s ease;
  backdrop-filter: blur(2px);
}

.magnify-btn svg {
  width: 0.85rem;
  height: 0.85rem;
}

.char-card:hover .magnify-btn {
  opacity: 1;
}

.magnify-btn:hover {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
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

<style>
.transfer-toast {
  position: fixed;
  bottom: 18px;
  right: 18px;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  color: var(--color-text);
  font-size: var(--font-size-base);
}

.transfer-undo {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-accent);
  cursor: pointer;
  padding: 2px 8px;
}

.transfer-undo:hover {
  border-color: var(--color-accent);
}

.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.8);
}
</style>
