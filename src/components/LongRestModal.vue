<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel">
      <!-- ── Header ── -->
      <div class="modal-header">
        <span class="modal-title">{{
          step === 'watches' ? 'Long Rest — Watch Assignment' : 'Marching Order'
        }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- ══ STEP 1: Watches ══════════════════════════ -->
      <template v-if="step === 'watches'">
        <div class="watches-body" @click="closePicker">
          <div class="watch-intro">
            Each slot = 2 hrs. A character in more than one slot exceeds the
            2-hr limit and won't benefit from this long rest.
          </div>

          <div class="watch-grid">
            <div v-for="(slot, si) in watches" :key="si" class="watch-row">
              <span class="slot-label"
                >Hrs {{ si * 2 + 1 }}–{{ (si + 1) * 2 }}</span
              >

              <div v-for="pi in [0, 1]" :key="pi" class="slot-wrap">
                <!-- Slot chip -->
                <div
                  class="slot-chip"
                  :class="{
                    'slot-filled': watches[si][pi],
                    'slot-overwatch':
                      watches[si][pi] && isOverwatch(watches[si][pi]),
                  }"
                  @click.stop="togglePicker(si, pi, $event)"
                >
                  <template v-if="watches[si][pi]">
                    <img :src="charImage(watches[si][pi])" class="slot-face" />
                    <span class="slot-name">{{ watches[si][pi] }}</span>
                    <span
                      v-if="isOverwatch(watches[si][pi])"
                      class="slot-warn-icon"
                      title="In multiple slots — won't long rest"
                      >⚠</span
                    >
                    <button
                      class="slot-x"
                      @click.stop="clearSlot(si, pi)"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </template>
                  <span v-else class="slot-empty">＋</span>
                </div>

                <!-- Inline picker dropdown -->
                <div
                  v-if="
                    pickerTarget &&
                    pickerTarget.si === si &&
                    pickerTarget.pi === pi
                  "
                  class="slot-picker"
                  :style="pickerStyle"
                  @click.stop
                >
                  <div
                    v-for="char in members"
                    :key="char.name"
                    class="picker-option"
                    :class="{
                      'picker-active': watches[si][pi] === char.name,
                      'picker-taken': watches[si][1 - pi] === char.name,
                      'picker-overwatch':
                        wouldBeOverwatch(char.name, si, pi) &&
                        watches[si][pi] !== char.name,
                    }"
                    @click="
                      watches[si][1 - pi] !== char.name && pickChar(char.name)
                    "
                  >
                    <img :src="char.image" class="picker-face" />
                    <div class="picker-text">
                      <span class="picker-name">{{ char.name }}</span>
                      <span class="picker-class">{{ char.class }}</span>
                    </div>
                    <div class="picker-badges">
                      <span class="picker-perc">{{ signedPerc(char) }}</span>
                      <span v-if="char.darkvision" class="picker-dv">DV</span>
                      <span
                        v-if="
                          wouldBeOverwatch(char.name, si, pi) &&
                          watches[si][pi] !== char.name
                        "
                        class="picker-norest"
                        >no LR</span
                      >
                    </div>
                  </div>
                  <div
                    v-if="watches[si][pi]"
                    class="picker-clear"
                    @click.stop="
                      clearSlot(si, pi)
                      closePicker()
                    "
                  >
                    Clear slot
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Overwatch warning -->
          <div v-if="overwatchChars.length" class="overwatch-warning">
            <span class="warn-icon">⚠</span>
            <strong>{{ overwatchChars.join(', ') }}</strong>
            {{ overwatchChars.length === 1 ? 'is' : 'are' }} assigned to
            multiple slots and won't benefit from this long rest.
          </div>
        </div>

        <div class="modal-footer">
          <div class="footer-summary">
            <template v-if="overwatchChars.length">
              {{ members.length - overwatchChars.length }} of
              {{ members.length }} members will long rest
            </template>
            <template v-else-if="totalWatchers === 0">
              No watch assigned — everyone sleeps
            </template>
            <template v-else>
              All {{ members.length }} members will long rest
            </template>
          </div>
          <button class="rest-btn" @click="beginRest">Begin Long Rest →</button>
        </div>
      </template>

      <!-- ══ STEP 2: Marching Order ═══════════════════ -->
      <template v-else>
        <div class="march-intro">
          Drag or use arrows to set today's marching order. Perception shown.
        </div>
        <div class="march-body">
          <div class="march-list">
            <div
              v-for="(name, idx) in marchOrder"
              :key="name"
              class="march-row"
            >
              <span class="march-pos">{{ idx + 1 }}</span>
              <div class="march-avatar">
                <img :src="charImage(name)" class="avatar-img" />
              </div>
              <div class="march-info">
                <div class="march-name">{{ name }}</div>
                <div class="march-class">{{ charClass(name) }}</div>
              </div>
              <div class="march-perc">
                <span class="perc-label">Perc</span>
                <span class="perc-val">{{ signedPercByName(name) }}</span>
              </div>
              <div class="march-btns">
                <button
                  class="arrow-btn"
                  :disabled="idx === 0"
                  @click="moveUp(idx)"
                >
                  ▲
                </button>
                <button
                  class="arrow-btn"
                  :disabled="idx === marchOrder.length - 1"
                  @click="moveDown(idx)"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="skip-btn" @click="$emit('close')">Skip</button>
          <button class="rest-btn" @click="saveMarchingOrder">
            Set Marching Order
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations } from 'vuex'
import { dnd } from '@/utils/dnd_utils'

export default {
  name: 'LongRestModal',
  emits: ['close'],

  data() {
    return {
      step: 'watches',
      watches: [
        [null, null],
        [null, null],
        [null, null],
        [null, null],
      ],
      pickerTarget: null, // { si, pi }
      marchOrder: [],
    }
  },

  computed: {
    ...mapState(['characters', 'party_items', 'parties']),
    ...mapGetters(['activeParty']),

    members() {
      if (!this.activeParty) return []
      return this.activeParty.members
        .map((name) => this.characters.find((c) => c.name === name))
        .filter(Boolean)
    },

    // How many slots each character appears in
    watchSlotCount() {
      const counts = {}
      for (const slot of this.watches) {
        for (const name of slot) {
          if (name) counts[name] = (counts[name] ?? 0) + 1
        }
      }
      return counts
    },

    // Characters in 2+ slots (exceed the 2-hr limit)
    overwatchChars() {
      return Object.entries(this.watchSlotCount)
        .filter(([, c]) => c > 1)
        .map(([name]) => name)
    },

    totalWatchers() {
      return Object.keys(this.watchSlotCount).length
    },

    pickerStyle() {
      if (!this.pickerTarget?.bottom) return {}
      const { left, width, top, bottom } = this.pickerTarget
      const spaceBelow = window.innerHeight - bottom - 8
      const openUp = spaceBelow < 180
      return {
        position: 'fixed',
        left: `${left}px`,
        width: `${width}px`,
        zIndex: 200,
        ...(openUp
          ? {
              bottom: `${window.innerHeight - top + 4}px`,
              maxHeight: `${top - 12}px`,
            }
          : {
              top: `${bottom + 4}px`,
              maxHeight: `${spaceBelow}px`,
            }),
      }
    },
  },

  created() {
    const saved = this.activeParty?.marching_order ?? []
    const memberNames = this.activeParty?.members ?? []
    const ordered = saved.filter((n) => memberNames.includes(n))
    const missing = memberNames.filter((n) => !ordered.includes(n))
    this.marchOrder = [...ordered, ...missing]
  },

  methods: {
    ...mapMutations(['LONG_REST', 'SET_PARTIES']),

    signedPerc(char) {
      const val = dnd.skill(char, 'Perception', this.party_items)
      return val >= 0 ? `+${val}` : `${val}`
    },

    signedPercByName(name) {
      const char = this.characters.find((c) => c.name === name)
      if (!char) return '—'
      return this.signedPerc(char)
    },

    charImage(name) {
      return this.characters.find((c) => c.name === name)?.image ?? ''
    },

    charClass(name) {
      return this.characters.find((c) => c.name === name)?.class ?? ''
    },

    isOverwatch(name) {
      return (this.watchSlotCount[name] ?? 0) > 1
    },

    // Would assigning this char to (si, pi) result in them being in 2+ slots?
    wouldBeOverwatch(name, si, pi) {
      let count = 0
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          if (i === si && j === pi) continue
          if (this.watches[i][j] === name) count++
        }
      }
      return count >= 1
    },

    togglePicker(si, pi, event) {
      if (this.pickerTarget?.si === si && this.pickerTarget?.pi === pi) {
        this.pickerTarget = null
      } else {
        const r = event.currentTarget.getBoundingClientRect()
        this.pickerTarget = {
          si,
          pi,
          left: r.left,
          width: r.width,
          top: r.top,
          bottom: r.bottom,
        }
      }
    },

    closePicker() {
      this.pickerTarget = null
    },

    pickChar(name) {
      if (!this.pickerTarget) return
      const { si, pi } = this.pickerTarget
      if (this.watches[si][1 - pi] === name) return
      this.$set(this.watches[si], pi, name)
      this.pickerTarget = null
    },

    clearSlot(si, pi) {
      this.$set(this.watches[si], pi, null)
    },

    beginRest() {
      this.LONG_REST({ skipChars: this.overwatchChars })
      this.step = 'marching'
    },

    moveUp(idx) {
      if (idx === 0) return
      const arr = [...this.marchOrder]
      ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
      this.marchOrder = arr
    },

    moveDown(idx) {
      if (idx === this.marchOrder.length - 1) return
      const arr = [...this.marchOrder]
      ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
      this.marchOrder = arr
    },

    saveMarchingOrder() {
      const updated = this.parties.map((p) =>
        p.active ? { ...p, marching_order: [...this.marchOrder] } : p
      )
      this.SET_PARTIES(updated)
      this.$emit('close')
    },
  },
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 16, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.modal-panel {
  width: min(68vw, 820px);
  max-height: 82vh;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.modal-title {
  flex: 1;
  font-family: var(--font-display, serif);
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.close-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.1rem 0.3rem;
  line-height: 1;
}
.close-btn:hover {
  color: var(--color-text-danger);
}

/* ── Watches body ── */
.watches-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.watch-intro {
  font-size: 0.76rem;
  color: var(--color-text-low);
  line-height: 1.4;
}

/* ── Watch grid ── */
.watch-grid {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.watch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.slot-label {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.06em;
  color: var(--color-text-low);
  width: 5rem;
  flex-shrink: 0;
}

/* ── Slot chip ── */
.slot-wrap {
  position: relative;
  flex: 1;
}

.slot-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px dashed var(--color-border);
  border-radius: 5px;
  cursor: pointer;
  min-height: 2.4rem;
  transition: border-color 0.1s, background 0.12s;
  user-select: none;
}
.slot-chip:hover {
  border-color: var(--color-accent);
  background: var(--color-bg-panel-dark);
}
.slot-chip.slot-filled {
  border-style: solid;
  border-color: var(--color-border);
}
.slot-chip.slot-overwatch {
  border-color: rgba(200, 120, 40, 0.6);
  background: rgba(200, 120, 40, 0.06);
}

.slot-face {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 20%;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.slot-name {
  flex: 1;
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slot-warn-icon {
  font-size: var(--font-size-xs);
  color: #c8963a;
  flex-shrink: 0;
}
.slot-x {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-xs);
  padding: 0 0.1rem;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.1s;
}
.slot-x:hover {
  color: var(--color-text-danger);
}
.slot-empty {
  font-size: 1rem;
  color: var(--color-text-low);
  margin: 0 auto;
  opacity: 0.45;
}

/* ── Picker dropdown ── */
.slot-picker {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  overflow-y: auto;
}

.picker-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  transition: background 0.08s;
}
.picker-option:hover:not(.picker-taken) {
  background: var(--color-bg-panel);
}
.picker-option.picker-active {
  background: rgba(var(--color-accent-rgb), 0.1);
}
.picker-option.picker-taken {
  opacity: 0.3;
  cursor: not-allowed;
}
.picker-option.picker-overwatch {
  opacity: 0.65;
}

.picker-face {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 20%;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.picker-text {
  flex: 1;
  min-width: 0;
}
.picker-name {
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picker-class {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.picker-badges {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}
.picker-perc {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  font-weight: 600;
  color: var(--color-accent);
}
.picker-dv {
  font-size: var(--font-size-xs);
  background: rgba(80, 60, 120, 0.7);
  color: #c8a8f0;
  border: 1px solid rgba(180, 130, 255, 0.35);
  border-radius: 3px;
  padding: 1px 4px;
}
.picker-norest {
  font-size: var(--font-size-xs);
  color: #c8963a;
  background: rgba(200, 150, 58, 0.1);
  border: 1px solid rgba(200, 150, 58, 0.3);
  border-radius: 3px;
  padding: 1px 4px;
}
.picker-clear {
  padding: 0.3rem 0.65rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  cursor: pointer;
  border-top: 1px solid var(--color-border);
  transition: color 0.1s;
}
.picker-clear:hover {
  color: var(--color-text-danger);
}

/* ── Overwatch warning ── */
.overwatch-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: #c8963a;
  background: rgba(200, 150, 58, 0.08);
  border: 1px solid rgba(200, 150, 58, 0.3);
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
}
.warn-icon {
  flex-shrink: 0;
  font-size: 0.85rem;
}

/* ── Footer ── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1.1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
  gap: 1rem;
}
.footer-summary {
  font-size: 0.78rem;
  color: var(--color-text-low);
}

.rest-btn {
  padding: 0.35rem 1.2rem;
  background: var(--color-accent);
  color: #0e0c09;
  border: none;
  border-radius: 5px;
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.12s;
}
.rest-btn:hover {
  opacity: 0.85;
}
.skip-btn {
  padding: 0.35rem 0.9rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  cursor: pointer;
}
.skip-btn:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
}

/* ── Marching order ── */
.march-intro {
  font-size: 0.78rem;
  color: var(--color-text-low);
  padding: 0.6rem 1.1rem 0;
  flex-shrink: 0;
}
.march-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.1rem;
}
.march-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.march-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 5px;
}
.march-pos {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  width: 1.2rem;
  text-align: center;
  flex-shrink: 0;
}
.march-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 20%;
}
.march-info {
  flex: 1;
  min-width: 0;
}
.march-name {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
}
.march-class {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.march-perc {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  flex-shrink: 0;
}
.perc-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-low);
}
.perc-val {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
}
.march-btns {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.arrow-btn {
  width: 1.4rem;
  height: 1rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  font-size: 0.55rem;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.1s, border-color 0.1s;
}
.arrow-btn:hover:not(:disabled) {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.arrow-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
</style>
