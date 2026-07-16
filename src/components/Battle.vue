﻿﻿
<template>
  <div class="battle">
    <!-- Initiative sidebar -->
    <aside class="initiative-sidebar scrollable">
      <div class="col-label">Initiative</div>
      <div class="initiative-list">
        <div
          v-for="(entry, i) in order"
          :key="entry.key"
          class="initiative-card"
          :class="[
            entry.type,
            {
              'is-active': activeTurn === i,
              friendly: combatantStates[entry.key] === 'friendly',
              neutral: combatantStates[entry.key] === 'neutral',
            },
          ]"
          @click="activeTurn = i"
        >
          <div class="card-portrait">
            <img
              v-if="entry.type === 'player'"
              :src="entry.image"
              class="portrait-img"
            />
            <div
              v-else
              class="enemy-circle"
              :class="combatantStates[entry.key]"
              :title="
                combatantStates[entry.key] === 'friendly'
                  ? 'Friendly — click for neutral'
                  : combatantStates[entry.key] === 'neutral'
                  ? 'Neutral — click for enemy'
                  : 'Enemy — click for friendly'
              "
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
        <div class="add-mode-toggle">
          <button
            class="add-mode-btn"
            :class="{ active: !bestiaryMode }"
            @click="bestiaryMode = false"
          >
            Manual
          </button>
          <button
            class="add-mode-btn"
            :class="{ active: bestiaryMode }"
            @click="toggleBestiaryMode"
          >
            Bestiary
          </button>
        </div>
        <template v-if="!bestiaryMode">
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
        </template>
      </div>
    </aside>

    <!-- Right column: turn panel -->
    <div class="battle-right">
      <main class="turn-panel">
        <!-- Player turn -->
        <template
          v-if="activeEntry && activeEntry.type === 'player' && activeChar"
        >
          <div class="panel-header">
            <span class="panel-name">{{ activeChar.name }}</span>
            <span class="panel-subtitle">{{
              $dnd.classBreakdownLabel(activeChar)
            }}</span>
            <span class="panel-hp">{{ playerHp(activeChar.name) }} HP</span>
          </div>

          <div class="section-label">HP</div>
          <div class="damage-tracker">
            <div class="damage-summary">
              <span
                class="damage-taken"
                :class="{ 'hp-low': playerCurrentHp(activeChar.name) <= 0 }"
                >{{ playerCurrentHp(activeChar.name) }}</span
              >
              <span class="damage-taken-label"
                >/ {{ activeChar.hp_max }} HP</span
              >
            </div>
            <div class="damage-row">
              <input
                v-model.number="playerDmgInput"
                class="field dmg-field"
                type="number"
                placeholder="Damage"
                min="0"
                @keyup.enter="applyPlayerDamage"
              />
              <button
                class="add-btn"
                :disabled="!playerDmgInput"
                @click="applyPlayerDamage"
              >
                Apply
              </button>
              <input
                v-model.number="playerHealInput"
                class="field dmg-field heal-field"
                type="number"
                placeholder="Heal"
                min="0"
                @keyup.enter="applyPlayerHeal"
              />
              <button
                class="heal-btn"
                :disabled="!playerHealInput"
                @click="applyPlayerHeal"
              >
                Heal
              </button>
              <input
                v-model.number="playerTempInput"
                class="field dmg-field temp-field"
                type="number"
                placeholder="Temp HP"
                min="0"
                @keyup.enter="applyPlayerTemp"
              />
              <button
                class="temp-btn"
                :disabled="!playerTempInput"
                @click="applyPlayerTemp"
              >
                Tmp
              </button>
            </div>
          </div>

          <!-- Death saving throws (shown when downed) -->
          <template v-if="playerCurrentHp(activeChar.name) <= 0">
            <div class="section-label">Death Saving Throws</div>
            <div class="dst-row">
              <span class="dst-label dst-success">Successes</span>
              <button
                v-for="i in 3"
                :key="'s' + i"
                class="dst-pip"
                :class="{
                  'dst-pip--success':
                    deathSaveCount(activeChar.name, 'successes') >= i,
                }"
                @click="toggleDeathSave(activeChar.name, 'successes', i)"
              />
              <span class="dst-label dst-failure" style="margin-left: 0.75rem"
                >Failures</span
              >
              <button
                v-for="i in 3"
                :key="'f' + i"
                class="dst-pip"
                :class="{
                  'dst-pip--failure':
                    deathSaveCount(activeChar.name, 'failures') >= i,
                }"
                @click="toggleDeathSave(activeChar.name, 'failures', i)"
              />
            </div>
          </template>

          <CharacterCombatPanel :character="activeChar" />
        </template>

        <!-- Enemy turn -->
        <template v-else-if="activeEntry && activeEntry.type === 'enemy'">
          <div class="panel-header">
            <span class="panel-name">{{ activeEntry.name }}</span>
            <span class="panel-subtitle">{{
              activeEntry.encounterData
                ? activeEntry.encounterData.roleLabel
                : 'Enemy'
            }}</span>
            <div class="panel-header-actions">
              <button
                class="header-action-btn"
                title="Duplicate enemy"
                @click="duplicateEnemy(activeEntry.key)"
              >
                ❏ Dupe
              </button>
              <button
                class="header-action-btn header-action-btn--danger"
                title="Remove from initiative"
                @click="$emit('remove-enemy', activeEntry.key)"
              >
                ✕ Remove
              </button>
            </div>
          </div>

          <!-- Combat stats — always shown, editable -->
          <div class="section-label">Stats</div>
          <div class="enemy-stat-chips">
            <div class="enemy-stat-chip">
              <input
                class="enemy-stat-input"
                type="number"
                min="1"
                max="40"
                :value="activeEnemyMeta.ac ?? ''"
                placeholder="—"
                @change="
                  setEnemyMeta('ac', $event.target.valueAsNumber || null)
                "
              />
              <span class="enemy-chip-lbl">AC</span>
            </div>
            <div class="enemy-stat-chip">
              <input
                class="enemy-stat-input enemy-stat-input--text"
                type="text"
                :value="activeEnemyMeta.attackBonus ?? ''"
                placeholder="—"
                @change="
                  setEnemyMeta('attackBonus', $event.target.value || null)
                "
              />
              <span class="enemy-chip-lbl">Attack</span>
            </div>
            <div class="enemy-stat-chip">
              <input
                class="enemy-stat-input enemy-stat-input--text"
                type="text"
                :value="activeEnemyMeta.damage ?? ''"
                placeholder="—"
                @change="setEnemyMeta('damage', $event.target.value || null)"
              />
              <span class="enemy-chip-lbl">{{
                activeEnemyMeta.damageLabel || 'Damage'
              }}</span>
            </div>
            <div class="enemy-stat-chip">
              <input
                class="enemy-stat-input"
                type="number"
                min="1"
                max="10"
                :value="activeEnemyMeta.numAttacks ?? ''"
                placeholder="—"
                @change="
                  setEnemyMeta(
                    'numAttacks',
                    $event.target.valueAsNumber || null
                  )
                "
              />
              <span class="enemy-chip-lbl">Attacks</span>
            </div>
          </div>

          <!-- Ability scores — always shown, always editable -->
          <div class="section-label">Ability Scores</div>
          <div class="enemy-ability-row">
            <div v-for="s in statKeys" :key="s" class="ability-chip">
              <span class="ability-lbl">{{ s.toUpperCase() }}</span>
              <button class="ability-adj-btn" @click="adjustEnemyStat(s, 1)">
                +
              </button>
              <input
                class="ability-score-input"
                type="number"
                min="1"
                max="30"
                :value="activeEnemyStats[s]"
                @change="setEnemyStat(s, $event.target.valueAsNumber)"
              />
              <button class="ability-adj-btn" @click="adjustEnemyStat(s, -1)">
                −
              </button>
              <span class="ability-mod">{{
                scoreMod(activeEnemyStats[s])
              }}</span>
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
              <button
                class="add-btn"
                :disabled="!damageInput"
                @click="applyDamage"
              >
                Apply
              </button>
              <button
                class="reset-btn"
                title="Reset damage to 0"
                :disabled="activeEnemyHp.damage === 0"
                @click="resetDamage"
              >
                Reset
              </button>
            </div>

            <div class="damage-row">
              <input
                v-model.number="healInput"
                class="field dmg-field heal-field"
                type="number"
                placeholder="Heal / Temp HP"
                min="0"
                @keyup.enter="applyHeal"
              />
              <button
                class="heal-btn"
                :disabled="!healInput"
                @click="applyHeal"
              >
                Heal
              </button>
              <button
                class="temp-btn"
                :disabled="!healInput"
                @click="applyEnemyTemp"
                title="Grant temp HP"
              >
                Tmp
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
              <button
                class="reset-btn"
                title="Reset all damage and temp HP"
                :disabled="activeEnemyHp.damage === 0 && !activeEnemyHp.tempHp"
                @click="resetDamage"
              >
                Reset
              </button>
            </div>
          </div>

          <!-- Generated features & spells from encounter generator -->
          <template
            v-if="
              activeEntry.encounterData &&
              ((activeEntry.encounterData.features &&
                activeEntry.encounterData.features.length) ||
                (activeEntry.encounterData.spells &&
                  activeEntry.encounterData.spells.length))
            "
          >
            <div class="section-label abilities-section-label">
              Abilities
              <span class="abilities-label-controls">
                <label class="reveal-abilities-label">
                  <input
                    type="checkbox"
                    :checked="revealedAbilities[activeEntry.key]"
                    @change="
                      $set(
                        revealedAbilities,
                        activeEntry.key,
                        $event.target.checked
                      )
                    "
                  />
                  Reveal
                </label>
                <button
                  class="export-abilities-btn"
                  title="Copy full stat block to clipboard"
                  @click="exportEnemyAbilities(activeEntry)"
                >
                  Export
                </button>
              </span>
            </div>
            <div
              v-if="revealedAbilities[activeEntry.key]"
              class="enc-abilities-block"
            >
              <div
                v-for="f in activeEntry.encounterData.features || []"
                :key="f.name"
                class="enc-ability-entry"
              >
                <span class="enc-ability-name">{{ f.name }}.</span>
                <span class="enc-ability-desc">{{ f.description }}</span>
              </div>
              <template
                v-if="
                  activeEntry.encounterData.spells &&
                  activeEntry.encounterData.spells.length
                "
              >
                <div class="enc-ability-divider">Spells</div>
                <div
                  v-for="s in activeEntry.encounterData.spells"
                  :key="s.name"
                  class="enc-ability-entry"
                >
                  <span class="enc-ability-name">{{ s.name }}.</span>
                  <span class="enc-ability-desc">{{ s.description }}</span>
                </div>
              </template>
            </div>
            <div v-else class="abilities-hidden-hint">
              Hidden — check Reveal to view
            </div>
          </template>

          <!-- Notes -->
          <div class="section-label">Notes</div>
          <textarea
            class="enemy-notes"
            :value="activeEnemyMeta.notes"
            placeholder="Traits, abilities, resistances, reminders…"
            @input="setEnemyMeta('notes', $event.target.value)"
          ></textarea>

          <!-- Conditions -->
          <div class="section-label">Conditions</div>
          <div class="enemy-cond-row">
            <button
              v-for="cond in POSITIVE_CONDITIONS"
              :key="cond"
              class="enemy-cond-chip enemy-cond-chip--positive"
              :class="{ 'enemy-cond-chip--active': hasEnemyCondition(cond) }"
              :title="conditionTooltip(cond)"
              @click="toggleEnemyCondition(cond)"
            >
              {{ cond }}
            </button>
          </div>
          <div class="enemy-cond-row">
            <button
              v-for="cond in NEGATIVE_CONDITIONS"
              :key="cond"
              class="enemy-cond-chip"
              :class="{ 'enemy-cond-chip--active': hasEnemyCondition(cond) }"
              :title="conditionTooltip(cond)"
              @click="toggleEnemyCondition(cond)"
            >
              {{ cond }}
            </button>
            <button
              v-for="cond in (enemyConditions[activeEntry.key] || []).filter(
                (c) => !CONDITIONS.includes(c)
              )"
              :key="'custom-' + cond"
              class="enemy-cond-chip enemy-cond-chip--active enemy-cond-chip--custom"
              @click="toggleEnemyCondition(cond)"
            >
              {{ cond }} ✕
            </button>
          </div>
          <div class="custom-cond-row">
            <input
              v-model="newCustomCond"
              class="field custom-cond-input"
              placeholder="Add condition…"
              @keyup.enter="addCustomCondition"
            />
            <button
              class="add-btn"
              :disabled="!newCustomCond.trim()"
              @click="addCustomCondition"
            >
              +
            </button>
          </div>
        </template>

        <div v-else class="empty-state">
          Select a combatant to view their turn
        </div>
      </main>
    </div>

    <!-- Battle log -->
    <aside v-if="battleLog.length" class="battle-log scrollable">
      <div class="log-header">
        <span class="col-label">Battle Log</span>
        <button
          class="log-export-btn"
          title="Export log as text"
          @click="exportLog"
        >
          ↓
        </button>
      </div>
      <div v-for="entry in battleLog" :key="entry.id" class="log-entry">
        <span class="log-who">{{ entry.who }}</span>
        <span class="log-msg">{{ entry.msg }}</span>
        <span class="log-time">{{ entry.time }}</span>
      </div>
    </aside>

    <!-- Bestiary floating panel -->
    <div v-if="bestiaryMode" class="bestiary-overlay">
      <div class="bestiary-panel">
        <div class="bestiary-panel-header">
          <span class="bestiary-panel-title">Add from Bestiary</span>
          <button class="bestiary-panel-close" @click="bestiaryMode = false">
            ✕
          </button>
        </div>
        <input
          v-model="bestiarySearch"
          class="bestiary-panel-search"
          placeholder="Search 11,000+ monsters…"
          autofocus
        />
        <div v-if="bestiaryLoading" class="bestiary-loading">Loading…</div>
        <div v-else class="bestiary-panel-results scrollable">
          <div v-if="!bestiarySearch.trim()" class="bestiary-hint">
            Type to search
          </div>
          <button
            v-for="m in bestiaryResults"
            :key="m.name"
            class="bestiary-panel-result"
            @click="addFromBestiary(m)"
          >
            <span class="br-name">{{ m.name }}</span>
            <span class="br-meta"
              >CR {{ m.cr }} · {{ m.type }} · {{ m.size }}</span
            >
          </button>
          <div
            v-if="bestiarySearch.trim() && !bestiaryResults.length"
            class="bestiary-empty"
          >
            No results
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CharacterCombatPanel from '@/components/CharacterCombatPanel.vue'
import { conditionTooltip } from '@/data/conditions.js'
import { STAT_KEYS, dnd } from '@/utils/dnd_utils.js'

const STAT_KEY_LIST = Object.freeze(STAT_KEYS.map((s) => s.key))
const POSITIVE_CONDITIONS = Object.freeze(['Bardic', 'Concentrating', 'Haste'])
const NEGATIVE_CONDITIONS = Object.freeze([
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Muddled',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
])
const CONDITIONS = Object.freeze([
  ...POSITIVE_CONDITIONS,
  ...NEGATIVE_CONDITIONS,
])

export default {
  name: 'Battle',

  components: { CharacterCombatPanel },

  props: {
    order: { type: Array, required: true },
    combatantStates: { type: Object, default: () => ({}) },
  },

  emits: [
    'override-roll',
    'add-enemy',
    'duplicate-enemy',
    'toggle-friendly',
    'remove-enemy',
  ],

  data() {
    return {
      activeTurn: 0,
      editingKey: null,
      overrideValue: null,
      enemyHp: {},
      enemyConditions: {},
      enemyStats: {},
      enemyMeta: {},
      damageInput: null,
      healInput: null,
      maxHpInput: null,
      playerHpDelta: {},
      playerTempHp: {},
      playerDmgInput: null,
      playerHealInput: null,
      playerTempInput: null,
      enemyCustomCond: {},
      newCustomCond: '',
      newEnemyName: '',
      newEnemyMod: 0,
      statKeys: STAT_KEY_LIST,
      CONDITIONS,
      POSITIVE_CONDITIONS,
      NEGATIVE_CONDITIONS,
      deathSaves: {},
      pendingStateCopy: null,
      bestiaryMode: false,
      bestiarySearch: '',
      bestiaryIndex: null,
      bestiaryLoading: false,
      battleLog: [],
      revealedAbilities: {},
    }
  },

  computed: {
    activeEntry() {
      return this.order[this.activeTurn] ?? null
    },
    activeChar() {
      if (!this.activeEntry || this.activeEntry.type !== 'player') return null
      return (
        this.$store.state.characters.find(
          (c) => c.name === this.activeEntry.name
        ) ?? null
      )
    },
    activeEnemyHp() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return null
      return (
        this.enemyHp[this.activeEntry.key] ?? {
          damage: 0,
          maxHp: null,
          tempHp: 0,
        }
      )
    },

    activeEnemyStats() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return {}
      const key = this.activeEntry.key
      const fromEncounter = this.activeEntry.encounterData?.stats ?? {}
      const fromOverrides = this.enemyStats[key] ?? {}
      return Object.fromEntries(
        this.statKeys.map((s) => [
          s,
          fromOverrides[s] ?? fromEncounter[s] ?? 10,
        ])
      )
    },
    activeEnemyMeta() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return {}
      const key = this.activeEntry.key
      const enc = this.activeEntry.encounterData ?? {}
      const ov = this.enemyMeta[key] ?? {}
      const encDamage = enc.weapon
        ? `${enc.weapon.damageDice}${this.signed(enc.weapon.damageMod)}`
        : null
      return {
        ac: 'ac' in ov ? ov.ac : enc.ac ?? null,
        attackBonus:
          'attackBonus' in ov ? ov.attackBonus : enc.attackBonus ?? null,
        damage: 'damage' in ov ? ov.damage : encDamage,
        damageLabel:
          'damageLabel' in ov
            ? ov.damageLabel
            : enc.weapon?.displayName ?? null,
        numAttacks: 'numAttacks' in ov ? ov.numAttacks : null,
        notes: 'notes' in ov ? ov.notes : '',
      }
    },
    bestiaryResults() {
      if (!this.bestiaryIndex || !this.bestiarySearch.trim()) return []
      const q = this.bestiarySearch.trim().toLowerCase()
      return this.bestiaryIndex
        .filter((m) => m.name.toLowerCase().includes(q))
        .slice(0, 18)
    },
  },

  watch: {
    '$store.state.restVersion'() {
      this.playerHpDelta = {}
    },
    order: {
      immediate: true,
      handler(entries, oldEntries) {
        for (const entry of entries) {
          if (
            entry.type === 'enemy' &&
            entry.encounterData?.maxHp &&
            !this.enemyHp[entry.key]
          ) {
            this.$set(this.enemyHp, entry.key, {
              damage: 0,
              maxHp: entry.encounterData.maxHp,
            })
          }
        }
        if (this.pendingStateCopy && oldEntries) {
          const oldKeys = new Set(oldEntries.map((e) => e.key))
          const newEnemies = entries.filter(
            (e) => e.type === 'enemy' && !oldKeys.has(e.key)
          )
          if (newEnemies.length > 0) {
            const key = newEnemies[newEnemies.length - 1].key
            const { meta, hp, stats, conditions } = this.pendingStateCopy
            if (meta) this.$set(this.enemyMeta, key, { ...meta })
            if (hp) this.$set(this.enemyHp, key, { ...hp })
            if (stats) this.$set(this.enemyStats, key, { ...stats })
            if (conditions)
              this.$set(this.enemyConditions, key, [...conditions])
            this.pendingStateCopy = null
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

    log(msg) {
      const who = this.activeEntry?.name ?? '?'
      this.battleLog.unshift({
        id: Date.now(),
        turn: this.activeTurn + 1,
        who,
        msg,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    },

    exportLog() {
      const lines = [...this.battleLog]
        .reverse()
        .map((e) => `[${e.time}] Turn ${e.turn} — ${e.who}: ${e.msg}`)
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `battle-log-${new Date().toISOString().slice(0, 10)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    },

    exportEnemyAbilities(entry) {
      const enc = entry.encounterData ?? {}
      const lines = [
        `${entry.name}${enc.roleLabel ? ' — ' + enc.roleLabel : ''}`,
        `HP ${enc.hp ?? '?'}  |  AC ${enc.ac ?? '?'}  |  ATK ${
          enc.attackBonus ?? '?'
        }  |  ${enc.weapon?.displayName ?? ''} (${
          enc.weapon?.damageDice ?? ''
        } ${enc.weapon?.damageType ?? ''})`,
      ]
      if (enc.stats) {
        const s = enc.stats
        lines.push(
          `STR ${s.str}  DEX ${s.dex}  CON ${s.con}  INT ${s.int}  WIS ${s.wis}  CHA ${s.cha}`
        )
      }
      if (enc.features?.length) {
        lines.push('── Features')
        for (const f of enc.features)
          lines.push(`• ${f.name}: ${f.description}`)
      }
      if (enc.spells?.length) {
        lines.push('── Spells')
        for (const s of enc.spells) lines.push(`• ${s.name}: ${s.description}`)
      }
      const text = lines.join('\n')
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {})
      }
    },

    // ── Player HP display ──
    playerHp(name) {
      const char = this.$store.state.characters.find((c) => c.name === name)
      if (!char) return '—'
      const delta = this.playerHpDelta[name] ?? 0
      const temp = this.playerTempHp[name] ?? 0
      const base = `${char.hp_current - delta}/${char.hp_max}`
      return temp ? `${base} +${temp}tmp` : base
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
      const temp = this.playerTempHp[name] ?? 0
      if (temp > 0) {
        const absorbed = Math.min(temp, amount)
        this.$set(this.playerTempHp, name, temp - absorbed)
        if (amount - absorbed > 0)
          this.$set(
            this.playerHpDelta,
            name,
            (this.playerHpDelta[name] ?? 0) + amount - absorbed
          )
        this.log(`${amount} dmg (${absorbed} absorbed by temp HP)`)
      } else {
        this.$set(
          this.playerHpDelta,
          name,
          (this.playerHpDelta[name] ?? 0) + amount
        )
        this.log(`${amount} damage`)
      }
      this.playerDmgInput = null
    },
    applyPlayerHeal() {
      const amount = Number(this.playerHealInput)
      if (!amount || amount <= 0 || !this.activeChar) return
      const name = this.activeChar.name
      this.$set(
        this.playerHpDelta,
        name,
        Math.max(0, (this.playerHpDelta[name] ?? 0) - amount)
      )
      this.log(`healed ${amount}`)
      this.playerHealInput = null
    },
    applyPlayerTemp() {
      const amount = Number(this.playerTempInput)
      if (!amount || amount <= 0 || !this.activeChar) return
      const name = this.activeChar.name
      this.$set(
        this.playerTempHp,
        name,
        Math.max(this.playerTempHp[name] ?? 0, amount)
      )
      this.log(`+${amount} temp HP`)
      this.playerTempInput = null
    },

    // â”€â”€ Enemy damage display (sidebar) â”€â”€
    enemyDmgLabel(key) {
      const hp = this.enemyHp[key]
      if (!hp) return ''
      const temp = hp.tempHp ? ` +${hp.tempHp}t` : ''
      if (hp.damage === 0 && !hp.tempHp) return ''
      if (hp.maxHp !== null) return `${hp.maxHp - hp.damage}/${hp.maxHp}${temp}`
      return `DMG ${hp.damage}${temp}`
    },

    _ensureEnemyHp(key) {
      if (!this.enemyHp[key])
        this.$set(this.enemyHp, key, { damage: 0, maxHp: null, tempHp: 0 })
    },
    applyDamage() {
      const amount = Number(this.damageInput)
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      const hp = this.enemyHp[key]
      const temp = hp.tempHp ?? 0
      if (temp > 0) {
        const absorbed = Math.min(temp, amount)
        this.$set(this.enemyHp, key, {
          ...hp,
          damage: hp.damage + (amount - absorbed),
          tempHp: temp - absorbed,
        })
        this.log(`${amount} damage (${absorbed} absorbed by temp HP)`)
      } else {
        this.$set(this.enemyHp, key, { ...hp, damage: hp.damage + amount })
        this.log(`${amount} damage`)
      }
      this.damageInput = null
    },
    applyHeal() {
      const amount = Number(this.healInput)
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      const hp = this.enemyHp[key]
      this.$set(this.enemyHp, key, {
        ...hp,
        damage: Math.max(0, hp.damage - amount),
      })
      this.log(`healed ${amount}`)
      this.healInput = null
    },
    applyEnemyTemp() {
      const amount = Number(this.healInput)
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      const hp = this.enemyHp[key]
      this.$set(this.enemyHp, key, {
        ...hp,
        tempHp: Math.max(hp.tempHp ?? 0, amount),
      })
      this.log(`+${amount} temp HP`)
      this.healInput = null
    },
    resetDamage() {
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, {
        ...this.enemyHp[key],
        damage: 0,
        tempHp: 0,
      })
      this.log('damage reset')
    },
    saveMaxHp() {
      if (!this.activeEntry) return
      const key = this.activeEntry.key
      const val = this.maxHpInput > 0 ? this.maxHpInput : null
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, { ...this.enemyHp[key], maxHp: val })
    },

    hasEnemyCondition(cond) {
      return (this.enemyConditions[this.activeEntry?.key] ?? []).includes(cond)
    },
    toggleEnemyCondition(cond) {
      const key = this.activeEntry.key
      const current = this.enemyConditions[key] ?? []
      const had = current.includes(cond)
      this.$set(
        this.enemyConditions,
        key,
        had ? current.filter((c) => c !== cond) : [...current, cond]
      )
      this.log(had ? `removed ${cond}` : `gained ${cond}`)
    },
    addCustomCondition() {
      const cond = this.newCustomCond.trim()
      if (!cond || !this.activeEntry) return
      const key = this.activeEntry.key
      const current = this.enemyConditions[key] ?? []
      if (!current.includes(cond)) {
        this.$set(this.enemyConditions, key, [...current, cond])
        this.log(`gained ${cond}`)
      }
      this.newCustomCond = ''
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

    setEnemyMeta(field, value) {
      const key = this.activeEntry.key
      if (!this.enemyMeta[key]) this.$set(this.enemyMeta, key, {})
      this.$set(this.enemyMeta[key], field, value)
    },

    async toggleBestiaryMode() {
      this.bestiaryMode = !this.bestiaryMode
      if (this.bestiaryMode && !this.bestiaryIndex) {
        this.bestiaryLoading = true
        const data = await import('@/data/monsters_index.json')
        this.bestiaryIndex = data.default ?? data
        this.bestiaryLoading = false
      }
    },
    async addFromBestiary(monster) {
      const { lookupMonster } = await import('@/utils/lookupService.js')
      const data = await lookupMonster(monster.name)
      const weaponAction = data?.actions?.find((a) => a.damage?.length)
      const dmg = weaponAction?.damage?.[0]
      const encounterData = {
        roleLabel: `${monster.type ?? ''} CR ${monster.cr ?? '?'}`,
        ac: data?.ac ?? null,
        maxHp: data?.hp ?? null,
        hp: data?.hp ?? null,
        stats: {
          str: data?.str ?? 10,
          dex: data?.dex ?? 10,
          con: data?.con ?? 10,
          int: data?.int ?? 10,
          wis: data?.wis ?? 10,
          cha: data?.cha ?? 10,
        },
        attackBonus: null,
        weapon: dmg
          ? {
              damageDice: dmg.damage_dice,
              damageMod: 0,
              displayName: weaponAction.name,
            }
          : null,
        isBoss: false,
      }
      const dexMod = Math.floor(((data?.dex ?? 10) - 10) / 2)
      this.$emit('add-enemy', {
        name: monster.name,
        mod: dexMod,
        encounterData,
      })
      this.bestiarySearch = ''
      this.bestiaryMode = false
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

    deathSaveCount(name, type) {
      return this.deathSaves[name]?.[type] ?? 0
    },
    toggleDeathSave(name, type, pip) {
      const current = this.deathSaves[name]?.[type] ?? 0
      const next = current >= pip ? pip - 1 : pip
      this.$set(this.deathSaves, name, {
        ...(this.deathSaves[name] ?? { successes: 0, failures: 0 }),
        [type]: next,
      })
    },

    duplicateEnemy(key) {
      this.pendingStateCopy = {
        meta: this.enemyMeta[key] ? { ...this.enemyMeta[key] } : null,
        hp: this.enemyHp[key]
          ? { ...this.enemyHp[key], damage: 0, tempHp: 0 }
          : null,
        stats: this.enemyStats[key] ? { ...this.enemyStats[key] } : null,
        conditions: this.enemyConditions[key]
          ? [...this.enemyConditions[key]]
          : null,
      }
      this.$emit('duplicate-enemy', key)
    },
  },
}
</script>

<style scoped>
.battle {
  display: flex;
  height: 100%;
  overflow: hidden;
  position: relative;
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
}

.initiative-list {
  display: flex;
  flex-direction: column;
}

.initiative-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s ease;
}

.initiative-card:hover {
  background: var(--color-bg-surface);
}
.initiative-card.is-active {
  background: var(--color-bg-surface-alt);
}
.initiative-card.player.is-active {
  border-left: 3px solid var(--color-accent);
}
.initiative-card.enemy.is-active {
  border-left: 3px solid var(--color-text-danger);
}
.initiative-card.enemy.friendly.is-active {
  border-left: 3px solid var(--color-success);
}
.initiative-card.enemy.neutral.is-active {
  border-left: 3px solid var(--color-neutral-amber);
}

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
  background: var(--color-success-dark);
  border-color: var(--color-success);
}

.enemy-circle.neutral {
  background: #4d3d0a;
  border-color: var(--color-neutral-amber);
}

.card-info {
  flex: 1;
  min-width: 0;
}

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

.card-turn {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}

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

.add-enemy-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sidebar-add-enemy {
  flex-wrap: wrap;
}

.add-mode-toggle {
  display: flex;
  width: 100%;
  gap: 0.25rem;
  margin-bottom: 0.3rem;
}

.add-mode-btn {
  flex: 1;
  padding: 0.2rem 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  cursor: pointer;
}
.add-mode-btn.active {
  background: var(--color-bg-surface-alt);
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.add-enemy-input--full {
  width: 100%;
  flex: unset;
}

.bestiary-results {
  width: 100%;
  max-height: 14rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}
.bestiary-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-surface);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-base);
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.bestiary-result:hover {
  background: var(--color-bg-surface-alt);
  color: var(--color-accent);
}
.br-name {
  font-size: var(--font-size-md);
}
.br-meta {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
}
.bestiary-loading,
.bestiary-empty {
  width: 100%;
  text-align: center;
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  padding: 0.5rem 0;
  font-style: italic;
}

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

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.6rem;
}
.panel-header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.header-action-btn {
  padding: 0.2rem 0.55rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
  font-family: var(--font-display);
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}
.header-action-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.header-action-btn--danger:hover {
  color: var(--color-text-danger);
  border-color: var(--color-text-danger);
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

.damage-sep {
  color: var(--color-text-low);
}

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

.field:focus {
  outline: none;
  border-color: var(--color-accent);
}

.dmg-field {
  width: 8rem;
}

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

.add-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

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

.reset-btn:hover:not(:disabled) {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}
.reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.heal-field {
  border-color: var(--color-success-border);
}
.heal-field:focus {
  border-color: var(--color-success);
}

.heal-btn {
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-surface-alt);
  border: 1px solid var(--color-success-border);
  border-radius: 4px;
  color: var(--color-success);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.heal-btn:hover:not(:disabled) {
  background: var(--color-success-dark);
  border-color: var(--color-success);
}
.heal-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hp-low {
  color: var(--color-text-danger);
}

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

.weapon-chip {
  min-width: unset;
  max-width: 12rem;
}

.enemy-chip-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  line-height: 1;
}

.enemy-stat-input {
  width: 3.5rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-accent-strong);
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  text-align: center;
  outline: none;
  padding: 0;
  line-height: 1;
}
.enemy-stat-input--text {
  width: 5rem;
}
.enemy-stat-input:focus {
  border-bottom-color: var(--color-accent);
}
.enemy-stat-input::placeholder {
  color: var(--color-text-low);
  font-size: var(--font-size-md);
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

.enemy-notes {
  width: 100%;
  min-height: 4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  padding: 0.4rem 0.5rem;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.enemy-notes:focus {
  border-color: var(--color-accent);
}

.enc-abilities-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}

.enc-ability-entry {
  font-size: var(--font-size-xs);
  line-height: 1.45;
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
}

.enc-ability-name {
  font-weight: 700;
  color: var(--color-text);
  margin-right: 0.2rem;
}

.enc-ability-desc {
  color: var(--color-text-muted);
}

.enc-ability-divider {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  margin: 0.35rem 0 0.1rem;
}

.abilities-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.abilities-label-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reveal-abilities-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  cursor: pointer;
  font-weight: normal;
  text-transform: none;
  letter-spacing: normal;
}

.reveal-abilities-label input[type='checkbox'] {
  cursor: pointer;
  accent-color: var(--color-accent);
}

.export-abilities-btn {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.4rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-weight: normal;
  text-transform: none;
  letter-spacing: normal;
}

.export-abilities-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.abilities-hidden-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  margin-bottom: 0.25rem;
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
.ability-score-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
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
.ability-adj-btn:hover {
  color: var(--color-accent);
}

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
  border-color: var(--color-condition);
  color: var(--color-condition);
  background: rgba(230, 126, 34, 0.08);
}
.enemy-cond-chip--custom {
  font-size: var(--font-size-xs);
}
.enemy-cond-chip--positive {
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 50%,
    calc(100% - 10px) 100%,
    10px 100%,
    0 50%
  );
  padding: 2px 14px;
  border-radius: 0;
  border: none;
}
.enemy-cond-chip--positive.enemy-cond-chip--active {
  background: rgba(74, 158, 107, 0.2);
  color: var(--color-success);
}
.enemy-cond-chip--positive:not(.enemy-cond-chip--active) {
  background: var(--color-bg-surface);
}

/* ── Death saving throws ── */
.dst-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.dst-label {
  font-size: var(--font-size-xs);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.dst-success {
  color: var(--color-success);
}
.dst-failure {
  color: var(--color-text-danger);
}
.dst-pip {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}
.dst-pip--success {
  background: var(--color-success);
  border-color: var(--color-success);
}
.dst-pip--failure {
  background: var(--color-text-danger);
  border-color: var(--color-text-danger);
}

.custom-cond-row {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.3rem;
}
.custom-cond-input {
  flex: 1;
  min-width: 0;
}

.temp-field {
  border-color: var(--color-info);
}
.temp-btn {
  padding: 0.25rem 0.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-info);
  border-radius: 4px;
  color: var(--color-info);
  font-size: var(--font-size-base);
  cursor: pointer;
  flex-shrink: 0;
}
.temp-btn:hover:not(:disabled) {
  background: var(--color-info);
  color: var(--color-bg);
}
.temp-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Battle log ── */
.battle-log {
  width: 200px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  font-size: var(--font-size-base);
}
.log-entry {
  display: flex;
  flex-direction: column;
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  gap: 0.1rem;
}
.log-who {
  color: var(--color-accent);
  font-size: var(--font-size-base);
  font-weight: 600;
}
.log-msg {
  color: var(--color-text-muted);
}
.log-time {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
}

/* ── Bestiary floating panel ── */
.bestiary-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
}
.bestiary-panel {
  width: 480px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
.bestiary-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
}
.bestiary-panel-title {
  font-family: var(--font-display);
  color: var(--color-accent);
}
.bestiary-panel-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: 1rem;
  cursor: pointer;
}
.bestiary-panel-close:hover {
  color: var(--color-text);
}
.bestiary-panel-search {
  padding: 0.5rem 1rem;
  background: var(--color-bg-surface);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-md);
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.bestiary-panel-results {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.bestiary-panel-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.4rem 1rem;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  gap: 1rem;
}
.bestiary-panel-result:hover {
  background: var(--color-bg-surface-alt);
  color: var(--color-accent);
}
.bestiary-hint {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-low);
  font-style: italic;
}
</style>
