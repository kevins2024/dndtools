﻿﻿<template>
  <div class="battle">

    <!-- Initiative sidebar -->
    <aside class="initiative-sidebar">
      <div class="col-label">Initiative</div>
      <div class="initiative-list">
        <div
          v-for="(entry, i) in order"
          :key="entry.key"
          class="initiative-card"
          :class="[entry.type, { 'is-active': activeTurn === i, 'friendly': combatantStates[entry.key] === 'friendly', 'neutral': combatantStates[entry.key] === 'neutral' }]"
          @click="activeTurn = i"
        >
          <div class="card-portrait">
            <img v-if="entry.type === 'player'" :src="entry.image" class="portrait-img" />
            <div
              v-else
              class="enemy-circle"
              :class="combatantStates[entry.key]"
              :title="combatantStates[entry.key] === 'friendly' ? 'Friendly — click for neutral' : combatantStates[entry.key] === 'neutral' ? 'Neutral — click for enemy' : 'Enemy — click for friendly'"
              @click.stop="$emit('toggle-friendly', entry.key)"
            ></div>
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
        <button class="add-enemy-btn" @click="emitAddEnemy">+</button>
      </div>
    </aside>

    <!-- Right column: turn panel + dice roller -->
    <div class="battle-right">
    <main class="turn-panel">

      <!-- Player turn -->
      <template v-if="activeEntry && activeEntry.type === 'player' && activeChar">
        <div class="panel-header">
          <span class="panel-name">{{ activeChar.name }}</span>
          <span class="panel-subtitle">{{ activeChar.class_breakdown || (activeChar.class + ' ' + activeChar.level) }}</span>
          <span class="panel-hp">{{ playerHp(activeChar.name) }} HP</span>
        </div>

        <div class="section-label">HP</div>
        <div class="damage-tracker">
          <div class="damage-summary">
            <span class="damage-taken" :class="{ 'hp-low': playerCurrentHp(activeChar.name) <= 0 }">{{ playerCurrentHp(activeChar.name) }}</span>
            <span class="damage-taken-label">/ {{ activeChar.hp_max }} HP</span>
          </div>
          <div class="damage-row">
            <input v-model.number="playerDmgInput" class="field dmg-field" type="number" placeholder="Damage" min="0" @keyup.enter="applyPlayerDamage" />
            <button class="add-btn" :disabled="!playerDmgInput" @click="applyPlayerDamage">Apply</button>
            <input v-model.number="playerHealInput" class="field dmg-field heal-field" type="number" placeholder="Heal" min="0" @keyup.enter="applyPlayerHeal" />
            <button class="heal-btn" :disabled="!playerHealInput" @click="applyPlayerHeal">Heal</button>
          </div>
        </div>

        <CharacterCombatPanel :character="activeChar" />
      </template>

      <!-- Enemy turn -->
      <template v-else-if="activeEntry && activeEntry.type === 'enemy'">
        <div class="panel-header">
          <span class="panel-name">{{ activeEntry.name }}</span>
          <span class="panel-subtitle">{{ activeEntry.encounterData ? activeEntry.encounterData.roleLabel : 'Enemy' }}</span>
        </div>

        <!-- Combat stats chips (encounter data only) -->
        <template v-if="activeEntry.encounterData">
          <div class="section-label">Stats</div>
          <div class="enemy-stat-chips">
            <div class="enemy-stat-chip">
              <span class="enemy-chip-val">{{ activeEntry.encounterData.ac }}</span>
              <span class="enemy-chip-lbl">AC</span>
            </div>
            <div class="enemy-stat-chip">
              <span class="enemy-chip-val">{{ activeEntry.encounterData.attackBonus }}</span>
              <span class="enemy-chip-lbl">Attack</span>
            </div>
            <div v-if="activeEntry.encounterData.weapon" class="enemy-stat-chip weapon-chip">
              <span class="enemy-chip-val">{{ activeEntry.encounterData.weapon.damageDice }}{{ signed(activeEntry.encounterData.weapon.damageMod) }}</span>
              <span class="enemy-chip-lbl">{{ activeEntry.encounterData.weapon.displayName }}</span>
            </div>
          </div>
        </template>

        <!-- Ability scores — always shown, always editable -->
        <div class="section-label">Ability Scores</div>
        <div class="enemy-ability-row">
          <div v-for="s in statKeys" :key="s" class="ability-chip">
            <span class="ability-lbl">{{ s.toUpperCase() }}</span>
            <button class="ability-adj-btn" @click="adjustEnemyStat(s, 1)">+</button>
            <input
              class="ability-score-input"
              type="number"
              min="1"
              max="30"
              :value="activeEnemyStats[s]"
              @change="setEnemyStat(s, $event.target.valueAsNumber)"
            />
            <button class="ability-adj-btn" @click="adjustEnemyStat(s, -1)">−</button>
            <span class="ability-mod">{{ scoreMod(activeEnemyStats[s]) }}</span>
          </div>
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
            <button class="remove-enemy-btn" title="Remove from initiative" @click="$emit('remove-enemy', activeEntry.key)">✕ Remove</button>
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

        <!-- Conditions -->
        <div class="section-label">Conditions</div>
        <div class="enemy-cond-row">
          <button
            v-for="cond in CONDITIONS"
            :key="cond"
            class="enemy-cond-chip"
            :class="{ 'enemy-cond-chip--active': hasEnemyCondition(cond) }"
            :title="conditionTooltip(cond)"
            @click="toggleEnemyCondition(cond)"
          >{{ cond }}</button>
        </div>
      </template>

      <div v-else class="panel-empty">Select a combatant to view their turn</div>

    </main>

    <div class="dice-bar">
      <DiceRoller />
    </div>
    </div>
  </div>
</template>

<script>
import CharacterCombatPanel from '@/components/CharacterCombatPanel.vue'
import DiceRoller from '@/components/DiceRoller.vue'
import { conditionTooltip } from '@/data/conditions.js'

export default {
  name: 'Battle',

  components: { CharacterCombatPanel, DiceRoller },

  props: {
    order:           { type: Array,  required: true },
    combatantStates: { type: Object, default: () => ({}) },
  },

  emits: ['override-roll', 'add-enemy', 'toggle-friendly', 'remove-enemy'],

  data() {
    return {
      activeTurn:    0,
      editingKey:    null,
      overrideValue: null,
      enemyHp:         {},
      enemyConditions: {},
      enemyStats:      {},
      damageInput:    null,
      maxHpInput:     null,
      playerHpDelta:  {},
      playerDmgInput: null,
      playerHealInput: null,
      newEnemyName:  '',
      newEnemyMod:   0,
      statKeys: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
      CONDITIONS: [
        'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled',
        'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
        'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Concentrating',
      ],
    }
  },

  computed: {
    activeEntry() {
      return this.order[this.activeTurn] ?? null
    },
    activeChar() {
      if (!this.activeEntry || this.activeEntry.type !== 'player') return null
      return this.$store.state.characters.find((c) => c.name === this.activeEntry.name) ?? null
    },
    activeEnemyHp() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return null
      return this.enemyHp[this.activeEntry.key] ?? { damage: 0, maxHp: null }
    },

    activeEnemyStats() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return {}
      const key = this.activeEntry.key
      const fromEncounter = this.activeEntry.encounterData?.stats ?? {}
      const fromOverrides = this.enemyStats[key] ?? {}
      return Object.fromEntries(
        this.statKeys.map((s) => [s, fromOverrides[s] ?? fromEncounter[s] ?? 10])
      )
    },
  },

  watch: {
    '$store.state.restVersion'() {
      this.playerHpDelta = {}
    },
    order: {
      immediate: true,
      handler(entries) {
        for (const entry of entries) {
          if (entry.type === 'enemy' && entry.encounterData?.maxHp && !this.enemyHp[entry.key]) {
            this.$set(this.enemyHp, entry.key, { damage: 0, maxHp: entry.encounterData.maxHp })
          }
        }
      },
    },
    activeEntry(entry) {
      if (entry?.type === 'enemy') {
        this.maxHpInput = this.enemyHp[entry.key]?.maxHp ?? null
        this.damageInput = null
      }
    },
  },

  methods: {
    conditionTooltip,

    // ── Player HP display ──
    playerHp(name) {
      const char = this.$store.state.characters.find((c) => c.name === name)
      if (!char) return '—'
      const delta = this.playerHpDelta[name] ?? 0
      return `${char.hp_current - delta}/${char.hp_max}`
    },
    playerCurrentHp(name) {
      const char = this.$store.state.characters.find((c) => c.name === name)
      if (!char) return null
      return char.hp_current - (this.playerHpDelta[name] ?? 0)
    },
    applyPlayerDamage() {
      const amount = Number(this.playerDmgInput)
      if (!amount || amount <= 0 || !this.activeChar) return
      const name = this.activeChar.name
      this.$set(this.playerHpDelta, name, (this.playerHpDelta[name] ?? 0) + amount)
      this.playerDmgInput = null
    },
    applyPlayerHeal() {
      const amount = Number(this.playerHealInput)
      if (!amount || amount <= 0 || !this.activeChar) return
      const name = this.activeChar.name
      const newDelta = Math.max(0, (this.playerHpDelta[name] ?? 0) - amount)
      this.$set(this.playerHpDelta, name, newDelta)
      this.playerHealInput = null
    },

    // â”€â”€ Enemy damage display (sidebar) â”€â”€
    enemyDmgLabel(key) {
      const hp = this.enemyHp[key]
      if (!hp || hp.damage === 0) return ''
      if (hp.maxHp !== null) return `${hp.maxHp - hp.damage}/${hp.maxHp}`
      return `DMG ${hp.damage}`
    },

    // â”€â”€ Enemy HP helpers â”€â”€
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

    // ── Enemy conditions ──
    hasEnemyCondition(cond) {
      return (this.enemyConditions[this.activeEntry?.key] ?? []).includes(cond)
    },
    toggleEnemyCondition(cond) {
      const key = this.activeEntry.key
      const current = this.enemyConditions[key] ?? []
      this.$set(
        this.enemyConditions,
        key,
        current.includes(cond) ? current.filter((c) => c !== cond) : [...current, cond]
      )
    },

    // ── Enemy ability scores ──
    setEnemyStat(stat, value) {
      const key = this.activeEntry.key
      if (!this.enemyStats[key]) this.$set(this.enemyStats, key, {})
      const clamped = isNaN(value) ? 10 : Math.min(30, Math.max(1, value))
      this.$set(this.enemyStats[key], stat, clamped)
    },
    adjustEnemyStat(stat, delta) {
      this.setEnemyStat(stat, (this.activeEnemyStats[stat] ?? 10) + delta)
    },

    scoreMod(score) {
      const m = Math.floor(((score ?? 10) - 10) / 2)
      return m >= 0 ? `+${m}` : `${m}`
    },
    signed(n) {
      return n >= 0 ? `+${n}` : `${n}`
    },

    // â”€â”€ Add enemy mid-fight â”€â”€
    emitAddEnemy() {
      this.$emit('add-enemy', {
        name: this.newEnemyName.trim(),
        mod: isNaN(this.newEnemyMod) ? 0 : this.newEnemyMod,
      })
      this.newEnemyName = ''
      this.newEnemyMod = 0
    },

    // â”€â”€ Initiative override â”€â”€
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

/* â”€â”€ Initiative Sidebar â”€â”€ */
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
  font-size: var(--font-size-base);
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
.initiative-card.player.is-active          { border-left: 3px solid var(--color-accent); }
.initiative-card.enemy.is-active           { border-left: 3px solid var(--color-text-danger); }
.initiative-card.enemy.friendly.is-active  { border-left: 3px solid #4a9e6b; }
.initiative-card.enemy.neutral.is-active   { border-left: 3px solid #c9952a; }

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
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.enemy-circle.friendly {
  background: #1e4d2e;
  border-color: #4a9e6b;
}

.enemy-circle.neutral {
  background: #4d3d0a;
  border-color: #c9952a;
}

.card-info   { flex: 1; min-width: 0; }

.card-name {
  font-size: var(--font-size-md);
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

.card-turn { font-size: var(--font-size-base); color: var(--color-text-low); }

.card-hp {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

.card-dmg {
  font-size: var(--font-size-base);
  color: var(--color-text-danger);
}

.card-score {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
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
  font-size: var(--font-size-md);
  text-align: right;
  padding: 0.1rem 0.2rem;
}

/* â”€â”€ Sidebar add enemy â”€â”€ */
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
  font-size: var(--font-size-base);
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
  font-size: var(--font-size-base);
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
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.add-enemy-btn:hover:not(:disabled) {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}

.add-enemy-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* â”€â”€ Right column â”€â”€ */
.battle-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* â”€â”€ Turn Panel â”€â”€ */
.turn-panel {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* â”€â”€ Dice bar â”€â”€ */
.dice-bar {
  flex-shrink: 0;
  height: 9rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  overflow: hidden;
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
  font-size: var(--font-size-xl);
  color: var(--color-text);
}

.panel-subtitle {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}

.panel-hp {
  margin-left: auto;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}

/* â”€â”€ Damage Tracker â”€â”€ */
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
  font-size: var(--font-size-2xl);
  color: var(--color-text-danger);
}

.damage-taken-label {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}

.damage-sep { color: var(--color-text-low); }

.damage-max {
  font-size: var(--font-size-md);
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
  font-size: var(--font-size-md);
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
  font-size: var(--font-size-md);
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
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover:not(:disabled) { border-color: var(--color-text-danger); color: var(--color-text-danger); }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.heal-field { border-color: #2d5a3d; }
.heal-field:focus { border-color: #4a9e6b; }

.heal-btn {
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-surface-alt);
  border: 1px solid #2d5a3d;
  border-radius: 4px;
  color: #4a9e6b;
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.heal-btn:hover:not(:disabled) { background: #1e4d2e; border-color: #4a9e6b; }
.heal-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.hp-low { color: var(--color-text-danger); }

.remove-enemy-btn {
  margin-left: auto;
  padding: 0.35rem 0.6rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.remove-enemy-btn:hover { border-color: var(--color-text-danger); color: var(--color-text-danger); }

/* â”€â”€ Enemy combat stats â”€â”€ */
.enemy-stat-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.enemy-stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  min-width: 3.5rem;
}

.weapon-chip { min-width: unset; max-width: 12rem; }

.enemy-chip-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  line-height: 1;
}

.enemy-chip-lbl {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  margin-top: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.enemy-ability-row {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.ability-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  min-width: 38px;
}

.ability-lbl {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-text-low);
  letter-spacing: 0.05em;
}

.ability-val {
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.1;
}

.ability-mod {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
}

.ability-score-input {
  width: 2.4rem;
  background: var(--color-bg);
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: 600;
  text-align: center;
  padding: 0.05rem 0;
  line-height: 1.1;
  -moz-appearance: textfield;
}
.ability-score-input::-webkit-inner-spin-button,
.ability-score-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.ability-score-input:focus {
  outline: none;
  border-bottom-color: var(--color-accent);
}

.ability-adj-btn {
  width: 100%;
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  line-height: 1;
  padding: 0;
  cursor: pointer;
  transition: color 0.1s;
}
.ability-adj-btn:hover { color: var(--color-accent); }

/* ── Enemy Conditions ── */
.enemy-cond-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.enemy-cond-chip {
  font-size: var(--font-size-xs);
  font-family: var(--font-body);
  padding: 2px 7px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-low);
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
}
.enemy-cond-chip:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}
.enemy-cond-chip--active {
  border-color: #e67e22;
  color: #e67e22;
  background: rgba(230, 126, 34, 0.08);
}

/* ── Panel Empty ── */
.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
}
</style>
