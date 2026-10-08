<template>
  <div class="dice-roller">
    <!-- Header -->
    <div class="roller-header">
      <div class="dice-buttons">
        <button
          v-for="die in dice"
          :key="die"
          class="die-btn"
          @click="roll(die)"
        >
          <img
            :src="die === 2 ? coin_heads : diceImages[die]"
            class="die-btn-icon"
          />
          {{ die === 2 ? 'coin' : `d${die}` }}
        </button>
        <label class="advantage-label">
          <input
            type="checkbox"
            v-model="advantage"
            @change="onAdvantageChange"
          />
          Advantage
        </label>
        <label class="advantage-label">
          <input
            type="checkbox"
            v-model="disadvantage"
            @change="onDisadvantageChange"
          />
          Disadvantage
        </label>
        <button
          class="clear-btn"
          :disabled="!history.length && !current"
          @click="clearHistory"
        >
          Clear
        </button>
        <button
          class="fall-btn"
          :class="{ 'fall-btn--active': showFall }"
          title="Fall damage (house rule): brace, roll, and see what you land on"
          @click="showFall = !showFall"
        >
          Fall
        </button>
        <span
          v-if="accumulated.length"
          class="acc-total"
          title="Running total — click dice to add, click here to clear"
          @click="clearAccumulated"
        >
          Σ {{ accumulatedTotal }}
          <span class="acc-count">({{ accumulated.length }})</span>
        </span>
      </div>
    </div>

    <FallDamagePanel
      v-if="showFall"
      :advantage="advantage"
      :disadvantage="disadvantage"
      @rolled="onFallRolled"
      @close="showFall = false"
    />

    <!-- Roll Area -->
    <div class="roll-area">
      <!-- History -->
      <div class="roll-history">
        <transition-group name="slide" tag="div" class="history-track">
          <div
            v-for="roll in history"
            :key="roll.id"
            class="history-die"
            :class="{
              'history-die--acc': accumulated.some((a) => a.id === roll.id),
            }"
            :title="'Click to add ' + roll.result + ' to running total'"
            @click="toggleAccumulate(roll)"
          >
            <div class="die-icon-wrap">
              <img :src="roll.image" class="die-bg-img dimmed" />
              <span
                class="die-result"
                :class="[critClass(roll), { 'has-tip': roll.math }]"
                :title="roll.math"
                >{{ roll.display }}</span
              >
            </div>
            <div class="die-label">{{ roll.die }}</div>
          </div>
        </transition-group>
      </div>

      <!-- Most Recent -->
      <div class="recent-zone">
        <transition name="pop" mode="out-in">
          <div
            v-if="current"
            :key="current.id"
            class="current-die"
            :class="{
              'current-die--acc': accumulated.some((a) => a.id === current.id),
            }"
            :title="'Click to add ' + current.result + ' to running total'"
            @click="toggleAccumulate(current)"
          >
            <div class="die-icon-wrap">
              <img :src="current.image" class="die-bg-img" />
              <div class="die-overlay">
                <div class="die-result">
                  <span
                    :class="[critClass(current), { 'has-tip': current.math }]"
                    :title="current.math"
                    >{{ current.display }}</span
                  >
                </div>
                <div v-if="current.advantage" class="die-sub">
                  {{ current.rolls[0] }} / {{ current.rolls[1] }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="current-die empty">
            <div class="die-label">Roll a die</div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script>
import coin_heads from '@/assets/dice/coin_heads.svg'
import coin_tails from '@/assets/dice/coin_tails.svg'
import d4 from '@/assets/dice/d4.svg'
import d6 from '@/assets/dice/d6.svg'
import d8 from '@/assets/dice/d8.svg'
import d10 from '@/assets/dice/d10.svg'
import d12 from '@/assets/dice/d12.svg'
import d20 from '@/assets/dice/d20.svg'
import { dnd } from '@/utils/dnd_utils.js'
import { d20Test } from '@/utils/d20Test.js'
import FallDamagePanel from './FallDamagePanel.vue'

let rollId = 0

export default {
  name: 'DiceRoller',

  components: { FallDamagePanel },

  data() {
    return {
      showFall: false,
      dice: [2, 4, 6, 8, 10, 12, 20],
      diceImages: {
        4: d4,
        6: d6,
        8: d8,
        10: d10,
        12: d12,
        20: d20,
      },
      coin_heads,
      coin_tails,
      advantage: false,
      disadvantage: false,
      current: null,
      history: [],
      accumulated: [],
    }
  },

  computed: {
    accumulatedTotal() {
      return this.accumulated.reduce((sum, r) => sum + r.result, 0)
    },
  },

  watch: {
    // Another component (e.g. AbilityScoreGrid's check/save roll icons)
    // hands over a labeled d20 + modifier via the store instead of the
    // player manually picking dice and doing the math themselves.
    // `immediate` matters: Drawer.vue v-if's its slot, so when the drawer is
    // closed this component doesn't exist yet — SET_PENDING_ROLL opens the
    // drawer and mounts us with the roll already sitting in the store, which
    // a plain watcher would never see as a change.
    '$store.state.pendingRoll': {
      immediate: true,
      handler(roll) {
        if (!roll) return
        this.rollPending(roll)
        this.$store.commit('CLEAR_PENDING_ROLL')
      },
    },
  },

  methods: {
    rollPending({ mod = 0, advantage = false }) {
      const test = d20Test.rollD20Test({
        // The roller's own toggle, or advantage the roll arrives with (an
        // item that grants it on this check).
        advantage: this.advantage || advantage,
        disadvantage: this.disadvantage,
        modifier: mod,
      })

      const entry = {
        id: rollId++,
        die: 'd20',
        sides: 20,
        rolls: test.rolls,
        result: test.value,
        display: `${test.value}`,
        natural: test.natural,
        math: test.breakdown.length > 1 ? dnd._formatBreakdown(test) : null,
        image: this.diceImages[20],
        advantage: test.mode !== 'normal',
      }

      if (this.current) this.history.unshift(this.current)
      this.current = entry
    },

    // A fall rolled in the Fall panel lands in the history like any other
    // roll, so it can be clicked into the running total.
    onFallRolled({ die, sides, rolls, result, display, math }) {
      const entry = {
        id: rollId++,
        die,
        sides,
        rolls,
        result,
        display,
        math,
        image: this.diceImages[sides],
        advantage: false,
      }
      if (this.current) this.history.unshift(this.current)
      this.current = entry
    },

    // A natural 20 or 1 on a d20 colors the shown number green or red,
    // whatever the modifier makes the total. (Entries from non-d20 dice and
    // the Fall panel have no `natural`.)
    critClass(entry) {
      if (entry.natural === 20) return 'nat-20'
      if (entry.natural === 1) return 'nat-1'
      return ''
    },

    onAdvantageChange() {
      if (this.advantage) this.disadvantage = false
    },
    onDisadvantageChange() {
      if (this.disadvantage) this.advantage = false
    },
    clearHistory() {
      this.history = []
      this.current = null
      this.accumulated = []
    },
    clearAccumulated() {
      this.accumulated = []
    },
    toggleAccumulate(roll) {
      const idx = this.accumulated.findIndex((a) => a.id === roll.id)
      if (idx === -1) this.accumulated.push(roll)
      else this.accumulated.splice(idx, 1)
    },
    roll(sides) {
      const rand = () => Math.floor(Math.random() * sides) + 1

      let rolls, result, display, image
      let math = null
      let natural = null // the d20 face that counts, for the nat 1 / 20 colors
      const mode =
        sides === 20
          ? d20Test.resolveMode({
              advantage: this.advantage,
              disadvantage: this.disadvantage,
            })
          : 'normal'

      if (mode !== 'normal') {
        const test = d20Test.rollD20Test({
          advantage: this.advantage,
          disadvantage: this.disadvantage,
        })
        rolls = test.rolls
        result = test.value
        natural = test.natural
        display = `${result} ${mode === 'advantage' ? '↑' : '↓'}`
        math = dnd._formatBreakdown(test)
        image = this.diceImages[sides]
      } else {
        rolls = [rand()]
        result = rolls[0]
        if (sides === 20) natural = result
        if (sides === 2) {
          display = result === 1 ? 'Heads' : 'Tails'
          image = result === 1 ? this.coin_heads : this.coin_tails
        } else {
          display = `${result}`
          image = this.diceImages[sides]
        }
      }

      const entry = {
        id: rollId++,
        die: sides === 2 ? 'coin' : `d${sides}`,
        sides,
        rolls,
        result,
        display,
        natural,
        math,
        image,
        advantage: mode !== 'normal',
      }

      if (this.current) {
        this.history.unshift(this.current)
      }

      this.current = entry
    },
  },
}
</script>

<style scoped>
.dice-roller {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Header ── */
.roller-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.6vh 0.8vw;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-panel-dark);
}

.dice-buttons {
  display: flex;
  align-items: center;
  gap: 0.4vw;
}

.die-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-lg);
  padding: 3px 10px;
  transition: all 0.15s ease;
}

.die-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.2);
}

.fall-btn {
  margin-left: 0.4vw;
  padding: 3px 10px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.fall-btn:hover,
.fall-btn--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.die-btn-icon {
  width: 16px;
  height: 16px;
  opacity: 0.6;
}

.die-btn:hover .die-btn-icon {
  opacity: 1;
}

.advantage-label {
  display: flex;
  align-items: center;
  gap: 0.3vw;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  cursor: pointer;
  margin-left: 0.4vw;
  user-select: none;
}

.advantage-label input {
  accent-color: var(--color-accent);
  cursor: pointer;
}

.clear-btn {
  margin-left: 0.4vw;
  padding: 3px 10px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.clear-btn:hover:not(:disabled) {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}
.clear-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.acc-total {
  margin-left: 0.4vw;
  padding: 3px 10px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.acc-total:hover {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}
.acc-count {
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
}

.history-die {
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease,
    box-shadow 0.12s ease;
}
.history-die:hover {
  border-color: var(--color-accent);
}
.history-die--acc {
  border-color: var(--color-accent);
  border-width: 2px;
  background: rgba(var(--color-accent-rgb), 0.12);
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.3);
}
.history-die--acc .die-result {
  color: var(--color-accent);
  font-weight: 700;
}
.history-die--acc .die-bg-img {
  opacity: 0.7;
}
.history-die--acc .die-label {
  color: var(--color-accent);
}

/* ── Roll Area ── */
.roll-area {
  display: flex;
  align-items: center;
  gap: 1.5vw;
  flex: 1;
  padding: 1vh 1vw;
  overflow: hidden;
  width: 71%;
}

/* ── Die icon wrap (image behind number) ── */
.die-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.die-bg-img {
  position: absolute;
  width: 90%;
  height: 90%;
  object-fit: contain;
  opacity: 0.9;
}

.die-bg-img.dimmed {
  opacity: 0.3;
}

.die-overlay {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

/* ── History ── */
.roll-history {
  flex: 1;
  overflow: hidden;
  height: 100%;
  display: flex;
  align-items: center;
}

.history-track {
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  gap: 0.8vw;
  width: 100%;
  justify-content: flex-start;
  position: relative;
}

.history-die {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  flex-shrink: 0;
  will-change: transform;
}

.history-die .die-label {
  font-size: var(--font-size-base);
  color: var(--color-die);
}

.history-die .die-result {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-low);
  position: relative;
  z-index: 1;
}

/* Natural 20 / natural 1 — beats the history, current and accumulated colors. */
.history-die .die-result.nat-20,
.current-die .die-result .nat-20 {
  color: #4cd964;
}
.history-die .die-result.nat-1,
.current-die .die-result .nat-1 {
  color: #ff4d4d;
}

/* ── Current ── */
.recent-zone {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.current-die {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  border-radius: 10px;
  border: 2px solid var(--color-highlight);
  background: var(--color-bg-surface);
  box-shadow: 0 0 20px rgba(var(--color-highlight-rgb), 0.35),
    0 0 6px rgba(var(--color-highlight-rgb), 0.2);
  color: var(--color-warning);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.current-die--acc {
  border-color: var(--color-accent);
  border-width: 3px;
  background: rgba(var(--color-accent-rgb), 0.12);
  box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.4),
    0 0 8px rgba(var(--color-accent-rgb), 0.3);
}

.current-die--acc .die-result {
  color: var(--color-accent);
}

.current-die.empty {
  border-color: var(--color-border);
  box-shadow: none;
  color: var(--color-die);
}

.current-die .die-result {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  line-height: 1;
  color: var(--color-warning);
}

.current-die.empty .die-label {
  font-size: var(--font-size-base);
  color: var(--color-die);
}

.die-sub {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  margin-top: 2px;
}

/* ── Transitions ── */
.slide-move {
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.slide-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter {
  opacity: 0;
  transform: scale(1.2);
}
.slide-leave-active {
  position: absolute;
  transition: opacity 0.15s ease;
}
.slide-leave-to {
  opacity: 0;
}

.pop-enter-active {
  transition: opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.pop-enter {
  transform: scale(0.75);
  opacity: 0;
}
.pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.pop-leave-to {
  transform: scale(0.85);
  opacity: 0;
}

/* Result has math behind it (a modifier, or advantage's two dice) —
   hover for the breakdown instead of printing it inline. */
.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: help;
}
</style>
