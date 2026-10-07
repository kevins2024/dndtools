<template>
  <div class="fall-panel">
    <div class="fall-header">
      <span class="fall-title">Fall Damage</span>
      <button class="fall-close" title="Close" @click="$emit('close')">
        ✕
      </button>
    </div>

    <div class="fall-row">
      <label class="fall-field">
        Height
        <input
          v-model.number="heightFt"
          class="fall-num"
          type="number"
          min="0"
          step="10"
        />
        ft
      </label>
      <label class="fall-field fall-field--grow">
        Character
        <select v-model="characterId" class="fall-select">
          <option value="">— manual bonuses —</option>
          <option v-for="c in characters" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="roundedNote" class="fall-note">{{ roundedNote }}</p>

    <p v-if="lethal" class="fall-note fall-note--danger">
      Over {{ lethalOverFt }} ft the dice don't decide: the faller dies, and
      whatever they land on dies too (Large or smaller; bigger takes
      {{ capDamage }}).
    </p>
    <p v-else-if="!tier" class="fall-note">Under 10 ft — no fall damage.</p>
    <template v-else>
      <table class="fall-table">
        <thead>
          <tr>
            <th>Tier {{ tier }} · DC {{ dc }}</th>
            <th>Dice</th>
            <th>Min</th>
            <th>Avg</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Braced (success)</td>
            <td>{{ braced.dice }}</td>
            <td>{{ braced.min }}</td>
            <td>{{ braced.avg }}</td>
            <td>{{ braced.max }}</td>
          </tr>
          <tr>
            <td>Not braced</td>
            <td>{{ unbraced.dice }}</td>
            <td>{{ unbraced.min }}</td>
            <td>{{ unbraced.avg }}</td>
            <td>{{ unbraced.max }}</td>
          </tr>
        </tbody>
      </table>

      <div class="fall-brace">
        <span class="fall-label">Brace with</span>
        <label class="fall-choice">
          <input v-model="brace" type="radio" value="con" />
          CON save
          <input
            v-model.number="bonus.con"
            class="fall-num fall-num--bonus"
            type="number"
            title="Saving throw bonus"
          />
        </label>
        <label class="fall-choice">
          <input v-model="brace" type="radio" value="acrobatics" />
          Acrobatics
          <input
            v-model.number="bonus.acrobatics"
            class="fall-num fall-num--bonus"
            type="number"
            title="Skill bonus"
          />
        </label>
        <label class="fall-choice">
          <input v-model="brace" type="radio" value="none" />
          None (d8)
        </label>
      </div>
    </template>

    <div class="fall-row">
      <label class="fall-field fall-field--grow">
        Landing on
        <select v-model="landing" class="fall-select">
          <option value="none">Nothing</option>
          <option value="someone">Someone / something (same damage)</option>
          <option value="hurl">Hurl Yourself (×{{ hurlMultiplier }})</option>
        </select>
      </label>
      <button class="fall-roll" @click="roll">Roll fall</button>
    </div>

    <div v-if="result" class="fall-result">
      <div v-if="result.brace" class="fall-line">
        <strong>{{ result.brace.label }}</strong> {{ result.brace.total }}
        <span class="fall-muted">({{ result.brace.math }})</span> vs DC
        {{ result.brace.dc }} →
        <strong :class="result.brace.success ? 'fall-ok' : 'fall-bad'">{{
          result.brace.success ? 'braced — d6s' : 'failed — d8s'
        }}</strong>
      </div>
      <div v-else-if="result.fall" class="fall-line fall-muted">
        No brace — d8s.
      </div>
      <div v-if="result.fall" class="fall-line">
        {{ result.fall.dice }}:
        <span class="fall-muted">{{ result.fall.rolls.join(' + ') }}</span>
        = <strong class="fall-total">{{ result.fall.total }}</strong>
        <span class="fall-muted"> damage to the faller</span>
      </div>
      <div v-if="result.none" class="fall-line fall-muted">No fall damage.</div>
      <div v-if="result.lethal" class="fall-line fall-bad">
        The faller dies.
      </div>
      <div v-if="result.landed" class="fall-line">{{ result.landed }}</div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { d20Test } from '@/utils/d20Test.js'
import {
  LETHAL_OVER_FT,
  FALL_CAP_DAMAGE,
  fallDamage,
  rollFall,
  fallCheckOptions,
} from '@/utils/fall.js'
import { landingImpact } from '@/utils/houseRules.js'
import {
  hurlYourselfDamage,
  HURL_YOURSELF_MULTIPLIER,
} from '@/utils/hurlSomething.js'

// The campaign's fall-damage house rule (engine/rules/5e/fall.js): the
// rolling and the numbers all come from the engine; this only collects the
// inputs, runs the brace d20 through the same d20Test the dice roller uses
// (so Advantage / Disadvantage apply), and lays out the result. A rolled
// fall is also handed to the roller's history as one entry, so it can be
// added to the running total.
export default {
  name: 'FallDamagePanel',

  props: {
    advantage: { type: Boolean, default: false },
    disadvantage: { type: Boolean, default: false },
  },

  emits: ['rolled', 'close'],

  data() {
    return {
      heightFt: 30,
      characterId: '',
      bonus: { con: 0, acrobatics: 0 },
      brace: 'con',
      landing: 'none',
      result: null,
      lethalOverFt: LETHAL_OVER_FT,
      capDamage: FALL_CAP_DAMAGE,
      hurlMultiplier: HURL_YOURSELF_MULTIPLIER,
    }
  },

  computed: {
    characters() {
      return this.$store.state.characters ?? []
    },
    character() {
      return this.characters.find((c) => c.id === this.characterId) ?? null
    },
    height() {
      return Math.max(0, Number(this.heightFt) || 0)
    },
    unbraced() {
      return fallDamage(this.height)
    },
    braced() {
      return fallDamage(this.height, { braced: true })
    },
    lethal() {
      return this.unbraced.lethal
    },
    tier() {
      return this.lethal ? 0 : this.unbraced.tier
    },
    dc() {
      return this.unbraced.dc
    },
    // Falls count whole 10 ft steps, rounding down: 25 ft is 20 ft.
    roundedNote() {
      if (this.lethal || !this.tier || this.height % 10 === 0) return ''
      return `${this.height} ft counts as ${
        this.tier * 10
      } ft (rounds down to full 10 ft)`
    },
  },

  watch: {
    characterId() {
      this.fillBonuses()
    },
  },

  methods: {
    // The character's real Acrobatics and CON-save bonuses (any valid height
    // gives the same bonuses), and the better one pre-selected.
    fillBonuses() {
      const c = this.character
      if (!c) return
      const equipped = dnd._equippedOnly(c, this.$store.state.party_items)
      const options = fallCheckOptions(c, equipped, 10)
      this.bonus = {
        con: options.constitution,
        acrobatics: options.acrobatics,
      }
      this.brace = options.best === 'acrobatics' ? 'acrobatics' : 'con'
    },

    roll() {
      const h = this.height
      this.result = null

      if (this.lethal) {
        this.result = {
          lethal: true,
          landed: this.landedText(null, true),
        }
        return
      }
      if (!this.tier) {
        this.result = { none: true }
        return
      }

      let brace = null
      let braced = false
      if (this.brace !== 'none') {
        const test = d20Test.rollD20Test({
          advantage: this.advantage,
          disadvantage: this.disadvantage,
          modifier: Number(this.bonus[this.brace]) || 0,
        })
        braced = test.value >= this.dc
        brace = {
          label: this.brace === 'con' ? 'CON save' : 'Acrobatics',
          total: test.value,
          math: dnd._formatBreakdown(test).replace(/\n/g, ', '),
          dc: this.dc,
          success: braced,
        }
      }

      const fall = rollFall(h, { braced })
      this.result = {
        brace,
        fall,
        landed: this.landedText(fall.total, false),
      }

      this.$emit('rolled', {
        die: fall.dice,
        sides: fall.die,
        rolls: fall.rolls,
        result: fall.total,
        display: `${fall.total}`,
        math: [
          `Fall ${h} ft (${braced ? 'braced' : 'not braced'}): ${fall.dice}`,
          fall.rolls.join(' + ') + ` = ${fall.total}`,
        ].join('\n'),
      })
    },

    // What the thing the faller lands on takes, per the house rules.
    landedText(total, lethal) {
      if (this.landing === 'none') return ''
      if (lethal) {
        return `Whatever you land on dies if it is Large or smaller; Huge or bigger takes ${FALL_CAP_DAMAGE}.`
      }
      if (this.landing === 'someone') {
        const hit = landingImpact(total, {})
        return `Whatever you land on takes ${hit.damage} (the same).`
      }
      const hit = hurlYourselfDamage(total, {})
      return `Each target takes ${hit.damage} (${total} × ${HURL_YOURSELF_MULTIPLIER}).`
    },
  },
}
</script>

<style scoped>
.fall-panel {
  position: fixed;
  right: 1rem;
  bottom: 22vh;
  width: 473px;
  max-width: 94vw;
  max-height: 75vh;
  overflow-y: auto;
  z-index: 300;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  padding: 0.6rem 0.75rem 0.75rem;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
}

.fall-header {
  font-size: inherit; /* beats the global `p, div` size */
  display: flex;
  align-items: center;
  margin-bottom: 0.45rem;
}
.fall-title {
  flex: 1;
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  letter-spacing: 0.03em;
}
.fall-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.fall-close:hover {
  color: var(--color-text-danger);
}

.fall-row {
  font-size: inherit;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.4rem 0;
}
.fall-field {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-muted);
}
.fall-field--grow {
  flex: 1;
}
.fall-num,
.fall-select {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  padding: 2px 5px;
}
.fall-num {
  width: 4.2rem;
}
.fall-num--bonus {
  width: 3.2rem;
  margin-left: 0.2rem;
}
.fall-select {
  flex: 1;
  min-width: 0;
}

.fall-note {
  font-size: inherit;
  margin: 0.4rem 0;
  color: var(--color-text-muted);
  line-height: 1.4;
}
.fall-note--danger {
  color: var(--color-text-danger);
}

.fall-table {
  font-size: var(
    --font-size-base
  ); /* the braced / not braced rows keep their size */
  width: 100%;
  border-collapse: collapse;
  margin: 0.3rem 0;
}
.fall-table th,
.fall-table td {
  text-align: right;
  padding: 2px 6px;
  border-bottom: 1px solid var(--color-border);
}
.fall-table th:first-child,
.fall-table td:first-child {
  text-align: left;
}
.fall-table th {
  color: var(--color-text-muted);
  font-weight: normal;
}

.fall-brace {
  font-size: inherit;
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  align-items: center;
  gap: 0.35rem 1.4rem;
  margin: 0.4rem 0;
}
.fall-label {
  grid-column: 1 / -1;
  color: var(--color-text-muted);
}
.fall-choice {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}
.fall-choice input[type='radio'] {
  accent-color: var(--color-accent);
}

.fall-roll {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  padding: 4px 14px;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.fall-roll:hover {
  background: var(--color-accent);
  color: var(--color-bg-panel-dark);
}

.fall-result {
  font-size: inherit;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}
.fall-line {
  font-size: inherit;
  margin: 0.2rem 0;
  line-height: 1.4;
}
.fall-muted {
  color: var(--color-text-muted);
}
.fall-total {
  font-size: var(--font-size-md);
  color: var(--color-accent);
}
.fall-ok {
  color: #5cb85c;
}
.fall-bad {
  color: var(--color-text-danger);
}
</style>
