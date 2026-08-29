<template>
  <div class="sheet-section">
    <div class="section-title">Ability Scores</div>
    <div class="stat-grid">
      <div v-for="stat in stats" :key="stat.key" class="stat-block">
        <div class="stat-label">
          {{ stat.label }}
          <span
            v-if="stat.modified"
            class="stat-boost-badge has-tip"
            :title="stat.tooltip"
            >&#9670;</span
          >
        </div>
        <div class="stat-score has-tip" :title="stat.tooltip">
          {{ stat.score }}
        </div>
        <div class="stat-check-row">
          <span class="stat-mod" :class="stat.mod >= 0 ? 'pos' : 'neg'">
            {{ stat.modStr }}
          </span>
          <button
            class="roll-btn"
            :title="`Roll ${stat.label} check`"
            @click="rollCheck(stat)"
          >
            <img :src="d20Icon" class="roll-btn-icon" />
          </button>
        </div>

        <div v-if="showSavingThrows" class="stat-save-row">
          <span
            class="save-dot has-tip"
            :class="{ 'save-dot--prof': savingThrows[stat.key].proficient }"
            :title="
              savingThrows[stat.key].proficient
                ? 'Proficient save'
                : 'Not proficient'
            "
          ></span>
          <span class="save-mod">{{ savingThrows[stat.key].totalStr }}</span>
          <button
            class="roll-btn"
            :title="`Roll ${stat.label} save`"
            @click="rollSave(stat)"
          >
            <img :src="d20Icon" class="roll-btn-icon" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import d20Icon from '@/assets/dice/d20.svg'

export default {
  name: 'AbilityScoreGrid',

  props: {
    character: { type: Object, required: true },
    // Folds an inline saving-throw proficiency dot + modifier + roll icon
    // onto each tile — used on the full sheet (which has no other saves
    // display) but not in the compact combat view, which uses the separate
    // SavingThrowsPanel instead since ability scores aren't shown there.
    showSavingThrows: { type: Boolean, default: false },
  },

  data() {
    return { d20Icon }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    stats() {
      return dnd.statArray(this.character, this.partyItems)
    },
    savingThrows() {
      if (!this.showSavingThrows) return {}
      const { stats, bonuses } = dnd.resolveStats(
        this.character,
        this.partyItems
      )
      const prof = dnd._prof(this.character, bonuses)
      const proficient = new Set(this.character.saving_throws ?? [])
      const flatBonus = bonuses.saving_throws ?? 0
      const result = {}
      for (const key of Object.keys(stats)) {
        const isProficient = proficient.has(key)
        const total =
          dnd.mod(stats[key]) + (isProficient ? prof : 0) + flatBonus
        result[key] = {
          proficient: isProficient,
          total,
          totalStr: dnd.signed(total),
        }
      }
      return result
    },
  },

  methods: {
    rollCheck(stat) {
      this.$store.commit('SET_PENDING_ROLL', {
        label: `${this.character.name} — ${stat.label} check`,
        mod: stat.mod,
      })
    },
    rollSave(stat) {
      this.$store.commit('SET_PENDING_ROLL', {
        label: `${this.character.name} — ${stat.label} save`,
        mod: this.savingThrows[stat.key].total,
      })
    },
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

.stat-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.6rem;
}

.stat-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-panel);
  padding: 0.4vh 0;
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 0.2em;
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
}

.stat-boost-badge {
  font-size: 0.7em;
  color: var(--color-accent);
  line-height: 1;
}

.stat-score {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}

.stat-check-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.stat-mod {
  font-size: var(--font-size-md);
}

.stat-mod.pos {
  color: var(--color-accent);
}
.stat-mod.neg {
  color: var(--color-text-danger);
}

.stat-save-row {
  display: flex;
  align-items: center;
  gap: 0.3em;
  margin-top: 0.2vh;
  padding-top: 0.2vh;
  border-top: 1px dotted var(--color-border);
  width: 100%;
  justify-content: center;
}

.save-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid var(--color-text-low);
  background: transparent;
}
.save-dot--prof {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.save-mod {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.roll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.12s ease;
}
.roll-btn:hover {
  opacity: 1;
}

.roll-btn-icon {
  width: 12px;
  height: 12px;
}
</style>
