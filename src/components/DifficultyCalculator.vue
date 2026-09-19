<template>
  <div class="difficulty-tool">
    <p class="tool-help">
      Design an enemy around a target hit-chance for the active party. Move the
      slider to the odds you want to aim for (65% is a commonly cited sweet
      spot), and see what attack bonus an enemy needs to hit each character that
      often, and what AC an enemy needs to be hit by each character that often.
    </p>
    <button class="calc-btn" @click="showModal = true">
      Calculate Difficulty
    </button>

    <div
      v-if="showModal"
      class="modal-backdrop"
      @click.self="showModal = false"
    >
      <div class="modal-panel">
        <div class="modal-header">
          <span class="modal-title">Encounter Difficulty Calculator</span>
          <button class="close-btn" @click="showModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="!activeMembers.length" class="empty-note">
            No active party set — mark a party active in the Parties tab first.
          </div>
          <template v-else>
            <div class="slider-row">
              <label for="target-slider" class="slider-label"
                >Target hit chance: <strong>{{ targetPercent }}%</strong></label
              >
              <input
                id="target-slider"
                type="range"
                min="0"
                max="95"
                step="5"
                v-model.number="targetPercent"
                class="slider-input"
              />
              <div class="slider-ticks">
                <span>0%</span>
                <span>95%</span>
              </div>
            </div>

            <div class="grid-wrap">
              <table class="diff-grid">
                <thead>
                  <tr>
                    <th>Character</th>
                    <th>AC</th>
                    <th>Attack bonus</th>
                    <th>Enemy bonus to hit them {{ targetPercent }}%</th>
                    <th>Enemy AC to be hit {{ targetPercent }}% of the time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.name">
                    <td>{{ row.name }}</td>
                    <td>{{ row.ac }}</td>
                    <td>
                      <template v-if="row.attackBonus != null">
                        {{ dnd.signed(row.attackBonus) }}
                        <span class="source-tag">({{ row.source }})</span>
                      </template>
                      <span v-else class="na">—</span>
                    </td>
                    <td>{{ dnd.signed(row.enemyBonusNeeded) }}</td>
                    <td>
                      <template v-if="row.enemyACNeeded != null">
                        {{ row.enemyACNeeded }}
                      </template>
                      <span v-else class="na">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { dnd } from '@/utils/dnd_utils.js'

export default {
  name: 'DifficultyCalculator',

  data() {
    return {
      dnd,
      showModal: false,
      targetPercent: 65,
    }
  },

  computed: {
    ...mapState(['parties', 'characters', 'party_items']),

    activeParty() {
      return this.parties.find((p) => p.active) ?? null
    },

    activeMembers() {
      if (!this.activeParty) return []
      return this.activeParty.members
        .map((name) => this.characters.find((c) => c.name === name))
        .filter(Boolean)
    },

    // The d20 roll an attacker needs to hit, at the target %: a d20 succeeds
    // on (21 - neededRoll) of its 20 faces, so neededRoll = 21 - target/5.
    // Runs 21 (0%) down to 2 (95%) in whole-number steps since target is
    // always a multiple of 5 — deliberately NOT clamped to the real RAW
    // "nat 1 always misses / nat 20 always hits" range (5%-95%), since the
    // project owner's own spec calls for the slider to reach exactly 0 and
    // 95, and this is a design heuristic, not a literal roll simulator.
    neededRoll() {
      return 21 - this.targetPercent / 5
    },

    rows() {
      return this.activeMembers.map((c) => {
        const ac = dnd.ac(c, { carriedPartyItems: this.party_items })
        const weaponBonus = this.bestWeaponBonus(c)
        const spellBonus = dnd.spellAttackBonus(c, this.party_items)

        let attackBonus = null
        let source = null
        if (weaponBonus != null && spellBonus != null) {
          if (spellBonus > weaponBonus) {
            attackBonus = spellBonus
            source = 'spell'
          } else {
            attackBonus = weaponBonus
            source = 'weapon'
          }
        } else if (weaponBonus != null) {
          attackBonus = weaponBonus
          source = 'weapon'
        } else if (spellBonus != null) {
          attackBonus = spellBonus
          source = 'spell'
        }

        return {
          name: c.name,
          ac,
          attackBonus,
          source,
          // Enemy attack bonus needed to hit THIS character's AC at the
          // target rate: d20 + bonus >= AC succeeds on neededRoll+, so
          // bonus = AC - neededRoll.
          enemyBonusNeeded: ac - this.neededRoll,
          // Enemy AC needed for THIS character's own best attack to hit it
          // at the target rate: bonus + neededRoll >= AC, so AC = bonus +
          // neededRoll — same formula, solved for the other side.
          enemyACNeeded:
            attackBonus != null ? attackBonus + this.neededRoll : null,
        }
      })
    },
  },

  methods: {
    // Mirrors buildWeaponRows' own filtering (dnd_utils.js) — only the
    // currently-active loadout's real weapons, not the other gear set or
    // bare-handed placeholders — then takes whichever hits hardest.
    bestWeaponBonus(character) {
      const weapons = this.party_items.filter(
        (i) =>
          i.equipped_by === character.name &&
          i.type === 'weapon' &&
          dnd.isActiveEquipped(i, character)
      )
      if (!weapons.length) return null
      return Math.max(
        ...weapons.map((w) => dnd.attackBonus(character, w, this.party_items))
      )
    },
  },
}
</script>

<style scoped>
.difficulty-tool {
  padding: 1.25rem;
  overflow-y: auto;
  height: 100%;
}

.tool-help {
  max-width: 40rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  margin: 0 0 1rem;
}

.calc-btn {
  padding: 0.5rem 1rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-accent-strong);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.calc-btn:hover {
  background: var(--color-bg-surface);
}

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
  width: min(78vw, 900px);
  max-height: 82vh;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

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

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.1rem 1.25rem;
}

.empty-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.slider-row {
  margin-bottom: 1.25rem;
}

.slider-label {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  margin-bottom: 0.4rem;
}

.slider-input {
  width: 100%;
}

.slider-ticks {
  display: flex;
  justify-content: space-between;
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  margin-top: 0.15rem;
}

.grid-wrap {
  overflow-x: auto;
}

.diff-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.diff-grid th,
.diff-grid td {
  padding: 0.5rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.diff-grid th {
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.diff-grid td {
  color: var(--color-text);
}

.source-tag {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
}

.na {
  color: var(--color-text-low);
}
</style>
