<template>
  <div class="battle">

    <!-- Initiative sidebar -->
    <aside class="initiative-sidebar">
      <div class="col-label">Initiative</div>
      <div class="initiative-list">
        <div
          v-for="(entry, i) in order"
          :key="entry.key"
          class="initiative-card"
          :class="[entry.type, { 'is-active': activeTurn === i }]"
          @click="activeTurn = i"
        >
          <div class="card-portrait">
            <img v-if="entry.type === 'player'" :src="entry.image" class="portrait-img" />
            <div v-else class="enemy-circle"></div>
          </div>

          <div class="card-info">
            <div class="card-name">{{ entry.name }}</div>
            <div class="card-meta">
              <span class="card-turn">{{ i + 1 }}</span>
              <span v-if="entry.type === 'player'" class="card-hp">
                {{ playerHp(entry.name) }}
              </span>
              <span v-else class="card-dmg">
                {{ enemyDmgLabel(entry.key) }}
              </span>
            </div>
          </div>

          <!-- All scores: click-to-edit -->
          <div class="card-score-wrap" @click.stop>
            <input
              v-if="editingKey === entry.key"
              :ref="`scoreInput-${entry.key}`"
              v-model.number="overrideValue"
              class="score-input"
              type="number"
              @blur="commitEdit(entry.key)"
              @keyup.enter="commitEdit(entry.key)"
              @keyup.escape="cancelEdit"
            />
            <span
              v-else
              class="card-score editable"
              title="Click to override initiative"
              @click="startEdit(entry.key, entry.total)"
            >
              {{ entry.total }}
            </span>
          </div>
        </div>
      </div>

      <!-- Add enemy mid-fight -->
      <div class="sidebar-add-enemy">
        <input
          v-model="newEnemyName"
          class="add-enemy-input"
          placeholder="Add enemy…"
          @keyup.enter="emitAddEnemy"
        />
        <input
          v-model.number="newEnemyMod"
          class="add-enemy-mod"
          type="number"
          placeholder="mod"
          @keyup.enter="emitAddEnemy"
        />
        <button class="add-enemy-btn" :disabled="!newEnemyName.trim()" @click="emitAddEnemy">+</button>
      </div>
    </aside>

    <!-- Turn panel -->
    <main class="turn-panel">

      <!-- Player turn -->
      <template v-if="activeEntry && activeEntry.type === 'player' && activeChar">
        <div class="panel-header">
          <span class="panel-name">{{ activeChar.name }}</span>
          <span class="panel-subtitle">{{ activeChar.class_breakdown || (activeChar.class + ' ' + activeChar.level) }}</span>
          <span class="panel-hp">{{ playerHp(activeChar.name) }} HP</span>
        </div>

        <CharacterCombatPanel :character="activeChar" />
      </template>

      <!-- Enemy turn -->
      <template v-else-if="activeEntry && activeEntry.type === 'enemy'">
        <div class="panel-header">
          <span class="panel-name">{{ activeEntry.name }}</span>
          <span class="panel-subtitle">Enemy</span>
        </div>

        <div class="section-label">Damage Tracker</div>
        <div class="damage-tracker">
          <div class="damage-summary">
            <span class="damage-taken">{{ activeEnemyHp.damage }}</span>
            <span class="damage-taken-label">damage taken</span>
            <template v-if="activeEnemyHp.maxHp !== null">
              <span class="damage-sep">/</span>
              <span class="damage-max">{{ activeEnemyHp.maxHp }} HP</span>
            </template>
          </div>

          <div class="damage-row">
            <input
              v-model.number="damageInput"
              class="field dmg-field"
              type="number"
              placeholder="Damage amount"
              min="0"
              @keyup.enter="applyDamage"
            />
            <button class="add-btn" :disabled="!damageInput" @click="applyDamage">Apply</button>
            <button
              class="reset-btn"
              title="Reset damage to 0"
              :disabled="activeEnemyHp.damage === 0"
              @click="resetDamage"
            >
              Reset
            </button>
          </div>

          <div class="max-hp-row">
            <input
              v-model.number="maxHpInput"
              class="field dmg-field"
              type="number"
              placeholder="Max HP (optional)"
              min="1"
              @blur="saveMaxHp"
              @keyup.enter="saveMaxHp"
            />
          </div>
        </div>
      </template>

      <div v-else class="panel-empty">Select a combatant to view their turn</div>

    </main>
  </div>
</template>

<script>
import characters from '@/data/characters.json'
import CharacterCombatPanel from '@/components/CharacterCombatPanel.vue'

export default {
  name: 'Battle',

  components: { CharacterCombatPanel },

  props: {
    order: { type: Array, required: true },
  },

  emits: ['override-roll', 'add-enemy'],

  data() {
    return {
      activeTurn:    0,
      editingKey:    null,
      overrideValue: null,
      enemyHp:       {},
      damageInput:   null,
      maxHpInput:    null,
      newEnemyName:  '',
      newEnemyMod:   0,
    }
  },

  computed: {
    activeEntry() {
      return this.order[this.activeTurn] ?? null
    },
    activeChar() {
      if (!this.activeEntry || this.activeEntry.type !== 'player') return null
      return characters.find((c) => c.name === this.activeEntry.name) ?? null
    },
    activeEnemyHp() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return null
      return this.enemyHp[this.activeEntry.key] ?? { damage: 0, maxHp: null }
    },
  },

  watch: {
    // Sync maxHpInput with stored value when active entry changes
    activeEntry(entry) {
      if (entry?.type === 'enemy') {
        this.maxHpInput = this.enemyHp[entry.key]?.maxHp ?? null
        this.damageInput = null
      }
    },
  },

  methods: {
    // ── Player HP display ──
    playerHp(name) {
      const char = characters.find((c) => c.name === name)
      if (!char) return '—'
      return `${char.hp_current}/${char.hp_max}`
    },

    // ── Enemy damage display (sidebar) ──
    enemyDmgLabel(key) {
      const hp = this.enemyHp[key]
      if (!hp || hp.damage === 0) return ''
      if (hp.maxHp !== null) return `${hp.maxHp - hp.damage}/${hp.maxHp}`
      return `DMG ${hp.damage}`
    },

    // ── Enemy HP helpers ──
    _ensureEnemyHp(key) {
      if (!this.enemyHp[key]) {
        this.$set(this.enemyHp, key, { damage: 0, maxHp: null })
      }
    },
    applyDamage() {
      const amount = Number(this.damageInput)
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, {
        ...this.enemyHp[key],
        damage: this.enemyHp[key].damage + amount,
      })
      this.damageInput = null
    },
    resetDamage() {
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, { ...this.enemyHp[key], damage: 0 })
    },
    saveMaxHp() {
      if (!this.activeEntry) return
      const key = this.activeEntry.key
      const val = this.maxHpInput > 0 ? this.maxHpInput : null
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, { ...this.enemyHp[key], maxHp: val })
    },

    // ── Add enemy mid-fight ──
    emitAddEnemy() {
      if (!this.newEnemyName.trim()) return
      this.$emit('add-enemy', {
        name: this.newEnemyName.trim(),
        mod: isNaN(this.newEnemyMod) ? 0 : this.newEnemyMod,
      })
      this.newEnemyName = ''
      this.newEnemyMod = 0
    },

    // ── Initiative override ──
    startEdit(key, currentTotal) {
      this.editingKey = key
      this.overrideValue = currentTotal
      this.$nextTick(() => {
        const ref = this.$refs[`scoreInput-${key}`]
        const el = Array.isArray(ref) ? ref[0] : ref
        el?.focus()
        el?.select()
      })
    },
    commitEdit(key) {
      const total = Number(this.overrideValue)
      if (!isNaN(total)) this.$emit('override-roll', { key, total })
      this.editingKey = null
      this.overrideValue = null
    },
    cancelEdit() {
      this.editingKey = null
      this.overrideValue = null
    },

  },
}
</script>

<style scoped>
.battle {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── Initiative Sidebar ── */
.initiative-sidebar {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.col-label {
  padding: 0.4rem 0.75rem;
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.initiative-list { display: flex; flex-direction: column; }

.initiative-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s ease;
}

.initiative-card:hover       { background: var(--color-bg-surface); }
.initiative-card.is-active   { background: var(--color-bg-surface-alt); }
.initiative-card.player.is-active { border-left: 3px solid var(--color-accent); }
.initiative-card.enemy.is-active  { border-left: 3px solid var(--color-text-danger); }

.card-portrait {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 4px;
  overflow: hidden;
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

.enemy-circle {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #6b2020;
  border: 2px solid var(--color-text-danger);
}

.card-info   { flex: 1; min-width: 0; }

.card-name {
  font-size: var(--font-size-small);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
  margin-top: 0.1rem;
}

.card-turn { font-size: var(--font-size-tiny); color: var(--color-text-low); }

.card-hp {
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
}

.card-dmg {
  font-size: var(--font-size-tiny);
  color: var(--color-text-danger);
}

.card-score {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent-strong);
  min-width: 1.75rem;
  text-align: right;
  flex-shrink: 0;
}

.card-score-wrap {
  flex-shrink: 0;
  min-width: 1.75rem;
  text-align: right;
}

.card-score.editable {
  cursor: pointer;
  border-bottom: 1px dashed var(--color-border);
}

.card-score.editable:hover {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.score-input {
  width: 2.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 3px;
  color: var(--color-accent-strong);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
  text-align: right;
  padding: 0.1rem 0.2rem;
}

/* ── Sidebar add enemy ── */
.sidebar-add-enemy {
  display: flex;
  gap: 0.3rem;
  padding: 0.5rem 0.5rem;
  border-top: 1px solid var(--color-border);
  margin-top: auto;
  flex-shrink: 0;
}

.add-enemy-input {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-tiny);
  font-family: var(--font-body);
}

.add-enemy-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.add-enemy-mod {
  width: 2.8rem;
  padding: 0.25rem 0.3rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-tiny);
  font-family: var(--font-body);
  text-align: center;
}

.add-enemy-mod:focus {
  outline: none;
  border-color: var(--color-accent);
}

.add-enemy-btn {
  padding: 0.25rem 0.5rem;
  background: var(--color-bg-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.add-enemy-btn:hover:not(:disabled) {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}

.add-enemy-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Turn Panel ── */
.turn-panel {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.6rem;
}

.panel-name {
  font-family: var(--font-display);
  font-size: var(--font-size-large);
  color: var(--color-text);
}

.panel-subtitle {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.panel-hp {
  margin-left: auto;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

/* ── Damage Tracker ── */
.damage-tracker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.damage-summary {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.damage-taken {
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  color: var(--color-text-danger);
}

.damage-taken-label {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.damage-sep { color: var(--color-text-low); }

.damage-max {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.damage-row,
.max-hp-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
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

.field:focus { outline: none; border-color: var(--color-accent); }

.dmg-field { width: 8rem; }

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

.add-btn:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.reset-btn {
  padding: 0.35rem 0.6rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-small);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover:not(:disabled) { border-color: var(--color-text-danger); color: var(--color-text-danger); }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Panel Empty ── */
.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
}
</style>
