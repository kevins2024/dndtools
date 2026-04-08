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
          <input type="checkbox" v-model="advantage" />
          Advantage
        </label>
      </div>
    </div>

    <!-- Roll Area -->
    <div class="roll-area">
      <!-- History -->
      <div class="roll-history">
        <transition-group name="slide" tag="div" class="history-track">
          <div v-for="roll in history" :key="roll.id" class="history-die">
            <div class="die-icon-wrap">
              <img :src="roll.image" class="die-bg-img dimmed" />
              <span class="die-result">{{ roll.display }}</span>
            </div>
            <div class="die-label">{{ roll.die }}</div>
          </div>
        </transition-group>
      </div>

      <!-- Most Recent -->
      <div class="recent-zone">
        <transition name="pop">
          <div v-if="current" :key="current.id" class="current-die">
            <div class="die-icon-wrap">
              <img :src="current.image" class="die-bg-img" />
              <div class="die-overlay">
                <div class="die-result">{{ current.display }}</div>
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

let rollId = 0

export default {
  name: 'DiceRoller',

  data() {
    return {
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
      current: null,
      history: [],
    }
  },

  methods: {
    roll(sides) {
      const rand = () => Math.floor(Math.random() * sides) + 1

      let rolls, result, display, image

      if (this.advantage && sides === 20) {
        rolls = [rand(), rand()]
        result = Math.max(...rolls)
        display = `${result} ↑`
        image = this.diceImages[sides]
      } else {
        rolls = [rand()]
        result = rolls[0]
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
        image,
        advantage: this.advantage && sides === 20,
      }

      if (this.current) {
        this.history.push(this.current)
        if (this.history.length > 9) this.history.shift()
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
  font-size: var(--font-size-text);
  padding: 3px 10px;
  transition: all 0.15s ease;
}

.die-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.2);
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
  font-size: var(--font-size-label);
  cursor: pointer;
  margin-left: 0.4vw;
  user-select: none;
}

.advantage-label input {
  accent-color: var(--color-accent);
  cursor: pointer;
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
  flex-direction: row;
  align-items: center;
  gap: 0.8vw;
  width: 100%;
  justify-content: flex-end;
}

.history-die {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  flex-shrink: 0;
}

.history-die .die-label {
  font-size: var(--font-size-xxxs);
  color: var(--color-die);
}

.history-die .die-result {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-low);
  position: relative;
  z-index: 1;
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
}

.current-die.empty {
  border-color: var(--color-border);
  box-shadow: none;
  color: var(--color-die);
}

.current-die .die-result {
  font-size: var(--font-size-huge);
  font-weight: 700;
  line-height: 1;
  color: var(--color-warning);
}

.current-die.empty .die-label {
  font-size: var(--font-size-tiny);
  color: var(--color-die);
}

.die-sub {
  font-size: var(--font-size-xxs);
  color: var(--color-text-low);
  margin-top: 2px;
}

/* ── Transitions ── */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter {
  transform: translateX(60px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(-60px);
  opacity: 0;
}
.slide-leave-active {
  position: absolute;
}

.pop-enter-active {
  transition: all 0.2s ease;
}
.pop-enter {
  transform: scale(0.7);
  opacity: 0;
}
</style>
