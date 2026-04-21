<template>
  <div class="combat-context">

    <!-- ── Setup phase ── -->
    <template v-if="phase === 'setup'">

      <aside class="col bench-col">
        <div class="col-label">Bench</div>
        <PlayerCharacterSelect />
      </aside>

      <aside class="col ondeck-col">
        <div class="col-label">On-Deck</div>
        <div class="portrait-list">
          <div
            v-for="name in playerNames"
            :key="name"
            class="player-card"
            title="Send back to bench"
            @click="removeFromCombat(name)"
          >
            <div
              class="player-img"
              :style="{ backgroundImage: `url(${portrait(name)})` }"
            ></div>
            <div class="player-name">{{ name }}</div>
          </div>
          <div v-if="playerNames.length === 0" class="col-empty">
            No players on-deck
          </div>
        </div>
      </aside>

      <section class="col enemy-col">
        <div class="col-label">Enemies</div>
        <div class="enemy-input-row">
          <input
            v-model="enemyName"
            class="field name-field"
            placeholder="Enemy name"
            @keyup.enter="addEnemy"
          />
          <input
            v-model.number="enemyMod"
            class="field mod-field"
            placeholder="Init"
            type="number"
            @keyup.enter="addEnemy"
          />
          <button class="add-btn" :disabled="!enemyName.trim()" @click="addEnemy">
            Add
          </button>
        </div>
        <div class="enemy-list">
          <div v-for="e in enemies" :key="e.id" class="enemy-row">
            <span class="enemy-name">{{ e.name }}</span>
            <span class="enemy-mod">{{ formatMod(e.mod) }}</span>
            <button class="remove-btn" @click="removeEnemy(e)">✕</button>
          </div>
          <div v-if="enemies.length === 0" class="col-empty">
            No enemies added yet
          </div>
        </div>
      </section>

      <div class="roll-bar">
        <button
          class="roll-btn"
          :disabled="!hasAnyCombatant"
          @click="rollInitiative"
        >
          Roll Initiative
        </button>
      </div>

    </template>

    <!-- ── Battle phase ── -->
    <template v-else>
      <Battle class="battle-fill" :order="initiativeOrder" @override-roll="onOverrideRoll" />
      <div class="roll-bar">
        <button class="back-btn" @click="phase = 'setup'">← Back to Setup</button>
      </div>
    </template>

  </div>
</template>

<script>
import PlayerCharacterSelect from './PlayerCharacterSelect.vue'
import Battle from './Battle.vue'
import characters from '@/data/characters.json'
import { dnd } from '@/utils/dnd_utils.js'

export default {
  name: 'CombatContext',
  components: { PlayerCharacterSelect, Battle },

  data() {
    return {
      phase: 'setup',
      enemies: [],
      rolls: {},
      enemyName: '',
      enemyMod: 0,
      nextEnemyId: 1,
    }
  },

  computed: {
    playerNames() {
      return this.$store.state.selectedPlayers
    },
    hasAnyCombatant() {
      return this.playerNames.length > 0 || this.enemies.length > 0
    },
    allEntries() {
      const players = this.playerNames.map((name) => {
        const char = characters.find((c) => c.name === name)
        return {
          key: `player-${name}`,
          type: 'player',
          name,
          mod: char ? dnd.initiative(char) : 0,
          image: char?.image ?? '',
        }
      })
      const enemies = this.enemies.map((e) => ({
        key: `enemy-${e.id}`,
        type: 'enemy',
        name: e.name,
        mod: e.mod,
        image: '',
      }))
      return [...players, ...enemies]
    },
    initiativeOrder() {
      return this.allEntries
        .map((e) => ({ ...e, total: this.rolls[e.key]?.total ?? 0 }))
        .sort((a, b) => b.total - a.total || b.mod - a.mod)
    },
  },

  methods: {
    portrait(name) {
      const char = characters.find((c) => c.name === name)
      return char?.image ?? ''
    },
    removeFromCombat(name) {
      this.$store.commit('SET_SELECTED_PLAYERS', this.playerNames.filter((n) => n !== name))
      this.$delete(this.rolls, `player-${name}`)
    },
    addEnemy() {
      if (!this.enemyName.trim()) return
      this.enemies.push({
        id: this.nextEnemyId++,
        name: this.enemyName.trim(),
        mod: isNaN(this.enemyMod) ? 0 : this.enemyMod,
      })
      this.enemyName = ''
      this.enemyMod = 0
    },
    removeEnemy(e) {
      this.enemies = this.enemies.filter((x) => x.id !== e.id)
      this.$delete(this.rolls, `enemy-${e.id}`)
    },
    rollInitiative() {
      const newRolls = {}
      for (const entry of this.allEntries) {
        const roll = dnd.roll()
        newRolls[entry.key] = { total: roll + entry.mod }
      }
      this.rolls = newRolls
      this.phase = 'battle'
    },
    onOverrideRoll({ key, total }) {
      this.$set(this.rolls, key, { ...this.rolls[key], total })
    },
    formatMod: (mod) => dnd.signed(mod),
  },
}
</script>

<style scoped>
.combat-context {
  display: grid;
  grid-template-columns: 120px 140px 1fr;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    "bench ondeck enemies"
    "roll  roll   roll";
  height: 100%;
  overflow: hidden;
}

/* Battle phase fills the whole area above the roll bar */
.battle-fill {
  grid-column: 1 / -1;
}

/* ── Shared column styles ── */
.col {
  display: flex;
  flex-direction: column;
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

.col-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-tiny);
  text-align: center;
  padding: 1rem 0.5rem;
}

/* ── Bench ── */
.bench-col {
  grid-area: bench;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
}

/* ── On-Deck ── */
.ondeck-col {
  grid-area: ondeck;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
}

.portrait-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.player-card {
  width: 88%;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.player-card:hover { opacity: 0.7; }

.player-img {
  width: 100%;
  aspect-ratio: 13 / 16;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  background-size: cover;
}

.player-name {
  padding: 4px 6px;
  text-align: center;
  font-size: var(--font-size-tiny);
  color: var(--color-accent);
  background: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Enemies ── */
.enemy-col {
  grid-area: enemies;
  padding: 0.75rem 1rem;
  background: var(--color-bg);
  overflow-y: auto;
}

.enemy-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.field {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-small);
  font-family: var(--font-body);
  padding: 0.35rem 0.5rem;
}

.field:focus {
  outline: none;
  border-color: var(--color-accent);
}

.name-field { flex: 1; }
.mod-field { width: 4rem; }

.add-btn {
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.enemy-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.enemy-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-text-danger);
  border-radius: 4px;
}

.enemy-name { flex: 1; font-size: var(--font-size-small); color: var(--color-text); }
.enemy-mod  { font-size: var(--font-size-tiny); color: var(--color-text-muted); min-width: 2.5rem; text-align: right; }

.remove-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-tiny);
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: color 0.15s ease;
}
.remove-btn:hover { color: var(--color-text-danger); }

/* ── Roll Bar ── */
.roll-bar {
  grid-area: roll;
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
}

.roll-btn {
  padding: 0.45rem 3rem;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-bg);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.roll-btn:hover:not(:disabled) {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.roll-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.back-btn {
  padding: 0.45rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
