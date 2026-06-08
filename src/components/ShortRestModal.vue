<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel">
      <div class="modal-header">
        <span class="modal-title">{{
          step === 'configure' ? 'Short Rest' : 'Short Rest — Results'
        }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- ══ STEP 1: Configure ═══════════════════════ -->
      <template v-if="step === 'configure'">
        <div class="rest-intro">
          Spend Hit Dice to recover HP. Short-rest features recharge for all
          party members.
        </div>
        <div class="member-list">
          <div v-for="char in members" :key="char.name" class="member-row">
            <div class="member-avatar">
              <img :src="char.image" class="avatar-img" />
            </div>
            <div class="member-info">
              <div class="member-name">{{ char.name }}</div>
              <div class="member-class">{{ char.class }}</div>
            </div>
            <div class="hp-section">
              <div class="hp-numbers">
                {{ char.hp_current }}<span class="hp-sep">/</span
                >{{ char.hp_max }}
                <span v-if="hpMissing(char) > 0" class="hp-missing"
                  >−{{ hpMissing(char) }}</span
                >
                <span v-else class="hp-full">full</span>
              </div>
              <div class="hp-bar-track">
                <div
                  class="hp-bar-fill"
                  :style="{ width: hpPct(char) + '%' }"
                  :class="hpColorClass(char)"
                ></div>
              </div>
            </div>
            <div class="hd-section">
              <div class="hd-available">
                {{ hdAvailable(char) }}× {{ char.hit_die || 'd8' }}
              </div>
              <div class="hd-stepper">
                <button
                  class="step-btn"
                  :disabled="diceToSpend[char.name] === 0"
                  @click="decDice(char.name)"
                >
                  −
                </button>
                <span class="hd-count">{{ diceToSpend[char.name] }}</span>
                <button
                  class="step-btn"
                  :disabled="
                    diceToSpend[char.name] >= hdAvailable(char) ||
                    hpMissing(char) === 0
                  "
                  @click="incDice(char.name)"
                >
                  +
                </button>
              </div>
              <div
                class="hd-estimate"
                v-if="diceToSpend[char.name] > 0"
                :title="`Average ${
                  dieSides(char.hit_die || 'd8') / 2 + 0.5 + conMod(char)
                } per die`"
              >
                ≈ +{{ estimateHeal(char) }} HP
              </div>
              <div
                class="hd-estimate muted"
                v-else-if="hdAvailable(char) === 0"
              >
                no dice left
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <span class="footer-note"
            >Short-rest features recharge for all members.</span
          >
          <div class="footer-btns">
            <button class="cancel-btn" @click="$emit('close')">Cancel</button>
            <button class="rest-btn" @click="takeRest">
              Take Short Rest →
            </button>
          </div>
        </div>
      </template>

      <!-- ══ STEP 2: Results ════════════════════════ -->
      <template v-else>
        <div class="results-list">
          <div
            v-for="char in members"
            :key="char.name"
            class="result-row"
            :class="{ 'result-quiet': !hadAnything(char.name) }"
          >
            <div class="result-avatar">
              <img :src="char.image" class="avatar-img" />
            </div>
            <div class="result-body">
              <div class="result-name">{{ char.name }}</div>
              <div
                class="result-roll"
                v-if="rollResults[char.name].diceSpent > 0"
              >
                {{ rollResults[char.name].diceSpent }}{{ char.hit_die || 'd8' }}
                <template v-if="rollResults[char.name].rolls.length">
                  <span class="roll-parts">
                    ({{ rollResults[char.name].rolls.join(' + ') }})
                  </span>
                  <template v-if="conMod(char) !== 0">
                    {{ conMod(char) >= 0 ? '+' : ''
                    }}{{ conMod(char) * rollResults[char.name].diceSpent }} CON
                  </template>
                  = <strong>+{{ rollResults[char.name].hpGained }} HP</strong>
                </template>
                <span class="result-hp-change">
                  ❤ {{ rollResults[char.name].hpBefore }} →
                  {{ rollResults[char.name].hpAfter }}/{{ char.hp_max }}
                </span>
              </div>
              <div class="result-roll muted" v-else>No hit dice spent.</div>
              <div
                class="result-recharged"
                v-if="rollResults[char.name].recharged.length"
              >
                Recharged:
                <span
                  v-for="f in rollResults[char.name].recharged"
                  :key="f"
                  class="recharged-chip"
                  >{{ f }}</span
                >
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div></div>
          <button class="rest-btn" @click="$emit('close')">Done</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations } from 'vuex'
import { dnd } from '@/utils/dnd_utils'

export default {
  name: 'ShortRestModal',
  emits: ['close'],

  data() {
    return {
      step: 'configure',
      diceToSpend: {},
      rollResults: {},
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
  },

  created() {
    this.members.forEach((char) => {
      this.$set(this.diceToSpend, char.name, 0)
    })
  },

  methods: {
    ...mapMutations(['SHORT_REST']),

    conMod(char) {
      return Math.floor(((char.stat_con ?? 10) - 10) / 2)
    },

    dieSides(hitDie) {
      return parseInt((hitDie || 'd8').slice(1))
    },

    hdAvailable(char) {
      return char.hit_dice_current ?? char.level ?? 1
    },

    hpMissing(char) {
      return (char.hp_max ?? 0) - (char.hp_current ?? 0)
    },

    hpPct(char) {
      if (!char.hp_max) return 100
      return Math.round((char.hp_current / char.hp_max) * 100)
    },

    hpColorClass(char) {
      const pct = this.hpPct(char)
      if (pct >= 75) return 'hp-green'
      if (pct >= 40) return 'hp-yellow'
      return 'hp-red'
    },

    estimateHeal(char) {
      const n = this.diceToSpend[char.name] ?? 0
      if (n === 0) return 0
      const sides = this.dieSides(char.hit_die)
      const avg = (sides + 1) / 2
      const total = Math.round(n * (avg + this.conMod(char)))
      return Math.min(Math.max(0, total), this.hpMissing(char))
    },

    incDice(name) {
      const char = this.members.find((c) => c.name === name)
      if (!char) return
      const max = this.hdAvailable(char)
      const cur = this.diceToSpend[name] ?? 0
      if (cur < max) this.$set(this.diceToSpend, name, cur + 1)
    },

    decDice(name) {
      const cur = this.diceToSpend[name] ?? 0
      if (cur > 0) this.$set(this.diceToSpend, name, cur - 1)
    },

    rollDie(sides) {
      return Math.floor(Math.random() * sides) + 1
    },

    takeRest() {
      const results = {}
      const spentMap = {}

      for (const char of this.members) {
        const n = this.diceToSpend[char.name] ?? 0
        const sides = this.dieSides(char.hit_die)
        const con = this.conMod(char)
        const rolls = Array.from({ length: n }, () => this.rollDie(sides))
        const rawTotal = rolls.reduce((s, r) => s + r + con, 0)
        const hpGained = Math.max(0, Math.min(rawTotal, this.hpMissing(char)))

        const recharged = []
        for (const f of char.features || []) {
          if (
            f.recharge === 'short_rest' &&
            f.uses_max &&
            f.uses_current < f.uses_max
          ) {
            recharged.push(
              f.name
                .replace(/\s*\(.*\)/, '')
                .replace(/^.+—\s*/, '')
                .trim()
            )
          }
        }
        if (
          char.pact_magic?.recharge === 'short_rest' &&
          char.pact_magic.current < char.pact_magic.max
        ) {
          recharged.push('Pact Magic')
        }

        results[char.name] = {
          diceSpent: n,
          rolls,
          hpGained,
          hpBefore: char.hp_current,
          hpAfter: Math.min(char.hp_max, char.hp_current + hpGained),
          recharged,
        }
        spentMap[char.name] = { diceSpent: n, hpGained }
      }

      this.rollResults = results
      this.SHORT_REST(spentMap)
      this.step = 'results'
    },

    hadAnything(name) {
      const r = this.rollResults[name]
      if (!r) return false
      return r.diceSpent > 0 || r.recharged.length > 0
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
  width: min(64vw, 780px);
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

/* ── Intro ── */
.rest-intro {
  font-size: 0.78rem;
  color: var(--color-text-low);
  padding: 0.6rem 1.1rem 0;
  flex-shrink: 0;
}

/* ── Member list ── */
.member-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.8rem;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.4rem;
  border-bottom: 1px solid var(--color-border);
}
.member-row:last-child {
  border-bottom: none;
}

.member-avatar {
  width: 2.4rem;
  height: 2.4rem;
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

.member-info {
  width: 5.5rem;
  flex-shrink: 0;
}
.member-name {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.member-class {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── HP bar ── */
.hp-section {
  flex: 1;
  min-width: 0;
}
.hp-numbers {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: 0.2rem;
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
}
.hp-sep {
  color: var(--color-text-low);
}
.hp-missing {
  font-size: var(--font-size-xs);
  color: #d07060;
  margin-left: 0.2rem;
}
.hp-full {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  margin-left: 0.2rem;
}
.hp-bar-track {
  height: 5px;
  background: var(--color-bg-panel);
  border-radius: 3px;
  overflow: hidden;
}
.hp-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.hp-green {
  background: var(--color-success);
}
.hp-yellow {
  background: #c8963a;
}
.hp-red {
  background: #c84040;
}

/* ── HD stepper ── */
.hd-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  width: 7rem;
}
.hd-available {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.hd-stepper {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.step-btn {
  width: 1.4rem;
  height: 1.4rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.1s, border-color 0.1s;
}
.step-btn:hover:not(:disabled) {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.step-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
.hd-count {
  font-size: 1rem;
  font-family: var(--font-display, serif);
  color: var(--color-text);
  min-width: 1.2rem;
  text-align: center;
}
.hd-estimate {
  font-size: var(--font-size-xs);
  color: #6aaccc;
}
.hd-estimate.muted {
  color: var(--color-text-low);
  opacity: 0.6;
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
.footer-note {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}
.footer-btns {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
.cancel-btn {
  padding: 0.35rem 0.9rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  cursor: pointer;
}
.cancel-btn:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
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
  transition: opacity 0.12s;
}
.rest-btn:hover {
  opacity: 0.85;
}

/* ── Results ── */
.results-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.8rem;
}
.result-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.55rem 0.4rem;
  border-bottom: 1px solid var(--color-border);
}
.result-row:last-child {
  border-bottom: none;
}
.result-row.result-quiet {
  opacity: 0.4;
}
.result-avatar {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  margin-top: 2px;
}
.result-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}
.result-name {
  font-size: 0.82rem;
  font-family: var(--font-display, serif);
  color: var(--color-text-muted);
}
.result-roll {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.result-roll.muted {
  color: var(--color-text-low);
}
.roll-parts {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
}
.result-hp-change {
  margin-left: 0.4rem;
  font-size: var(--font-size-xs);
  color: var(--color-success);
}
.result-recharged {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}
.recharged-chip {
  background: rgba(80, 160, 210, 0.12);
  border: 1px solid rgba(80, 160, 210, 0.3);
  color: #8ac8e0;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: var(--font-size-xs);
}
</style>
