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
              'is-active': combatTurn.turnIndex === i,
              friendly: combatantStates[entry.key] === 'friendly',
              neutral: combatantStates[entry.key] === 'neutral',
            },
          ]"
          @click="$emit('set-turn', i)"
        >
          <BugOff
            v-if="i !== combatTurn.turnIndex && i !== nextTurnIndex"
            class="debug-icon card-debug-badge"
            title="Debug/testing only — jumps the turn out of initiative sequence"
          />
          <div class="card-portrait">
            <img
              v-if="entry.type === 'player' || entry.type === 'companion'"
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
              <span v-else-if="entry.type === 'companion'" class="card-hp">
                {{ companionHp(entry.name) }}
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
      <div class="turn-controls">
        <div class="round-display">
          <span class="round-label">Round</span>
          <button
            class="debug-control"
            title="Debug/testing only — a real game never moves the round backward"
            @click="$emit('set-round', combatTurn.round - 1)"
          >
            <BugOff class="debug-icon" />−
          </button>
          <span class="round-value">{{ combatTurn.round }}</span>
          <button
            class="debug-control"
            title="Debug/testing only — rounds should normally only advance via Next Turn"
            @click="$emit('set-round', combatTurn.round + 1)"
          >
            <BugOff class="debug-icon" />+
          </button>
        </div>
        <button class="next-turn-btn" @click="$emit('next-turn')">
          Next Turn →
        </button>
        <ActionEconomyRow
          v-if="activeEntry"
          :resources="
            combatTurn.resources[activeEntry.key] || {
              action: true,
              bonusAction: true,
              reaction: true,
            }
          "
          @toggle="onToggleResource"
          @reset="$emit('reset-resources', activeEntry.key)"
        />
      </div>
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
          </div>

          <!-- Death saving throws (shown when downed) -->
          <template v-if="activeChar.hp_current <= 0">
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

          <CharacterCombatPanel
            :character="activeChar"
            @condition-changed="log"
          />
        </template>

        <!-- Companion turn -->
        <template
          v-else-if="
            activeEntry && activeEntry.type === 'companion' && activeCompanion
          "
        >
          <div class="panel-header">
            <span class="panel-name">{{ activeCompanion.name }}</span>
            <span class="panel-subtitle"
              >{{ activeCompanion.species }} companion —
              {{ activeCompanion.owner }}</span
            >
          </div>

          <CharacterCombatPanel
            :character="activeCompanion"
            table="companions"
            @condition-changed="log"
          />
        </template>

        <!-- Enemy turn -->
        <template v-else-if="activeEntry && activeEntry.type === 'enemy'">
          <div class="panel-header">
            <input
              v-if="renamingKey === activeEntry.key"
              :ref="`renameInput-${activeEntry.key}`"
              v-model="renameValue"
              class="panel-name panel-name-input"
              @blur="commitRename(activeEntry.key)"
              @keyup.enter="commitRename(activeEntry.key)"
              @keyup.escape="cancelRename"
            />
            <span
              v-else
              class="panel-name panel-name-editable"
              title="Click to rename"
              @click="startRename(activeEntry.key, activeEntry.name)"
              >{{ activeEntry.name }}</span
            >
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

          <!-- Combat stats + HP + Conditions — always shown, editable -->
          <div class="enemy-top-row">
            <div class="enemy-stats-box">
              <div class="section-label">Stats</div>
              <EnemyStatsChipRow
                :meta="activeEnemyMeta"
                @update-field="setEnemyMeta($event.field, $event.value)"
              />
            </div>
            <div class="enemy-hp-box">
              <div class="section-label">HP</div>
              <EnemyHpTracker
                :hp="activeEnemyHp"
                @damage="applyDamage"
                @heal="applyHeal"
                @temp="applyEnemyTemp"
                @set-max-hp="saveMaxHp"
              />
              <button
                class="reset-btn enemy-hp-reset"
                title="Reset damage and temp HP to 0"
                :disabled="activeEnemyHp.damage === 0 && !activeEnemyHp.tempHp"
                @click="resetDamage"
              >
                Reset
              </button>
              <div
                v-if="activeCrowdStrength !== null"
                class="crowd-strength-badge"
                title="Crowd Strength (house rule): steps down as pooled HP crosses thresholds of max HP. AC/ability flavor scales with it; AoE saves always succeed but damage is halved-then-x-Strength."
              >
                Strength: {{ activeCrowdStrength }}/{{
                  activeEnemyMeta.crowdSize
                }}
              </div>
            </div>
            <div class="enemy-conditions-box">
              <div class="section-label">Conditions</div>
              <EnemyConditionsRow
                :conditions="enemyConditions[activeEntry.key] || []"
                @toggle="toggleEnemyCondition"
                @add="addCustomCondition"
              />
            </div>
          </div>

          <EnemyAbilityScoreGrid
            :name="activeEntry.name"
            :stats="activeEnemyStats"
            @update-stat="setEnemyStat($event.key, $event.value)"
          />

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
import EnemyStatsChipRow from '@/components/EnemyStatsChipRow.vue'
import EnemyHpTracker from '@/components/EnemyHpTracker.vue'
import EnemyConditionsRow from '@/components/EnemyConditionsRow.vue'
import EnemyAbilityScoreGrid from '@/components/EnemyAbilityScoreGrid.vue'
import ActionEconomyRow from '@/components/ActionEconomyRow.vue'
import { BugOff } from 'lucide-vue'
import { STAT_KEYS, dnd } from '@/utils/dnd_utils.js'

const STAT_KEY_LIST = Object.freeze(STAT_KEYS.map((s) => s.key))

export default {
  name: 'Battle',

  components: {
    CharacterCombatPanel,
    EnemyStatsChipRow,
    EnemyHpTracker,
    EnemyConditionsRow,
    EnemyAbilityScoreGrid,
    ActionEconomyRow,
    BugOff,
  },

  props: {
    order: { type: Array, required: true },
    combatantStates: { type: Object, default: () => ({}) },
    // { round, turnIndex, order, resources } from engine/rules/combatTurn.js
    // via CombatContext.vue — see src/utils/combatTurn.js.
    combatTurn: { type: Object, required: true },
  },

  emits: [
    'override-roll',
    'add-enemy',
    'duplicate-enemy',
    'toggle-friendly',
    'remove-enemy',
    'next-turn',
    'set-turn',
    'toggle-resource',
    'reset-resources',
    'set-round',
  ],

  data() {
    return {
      editingKey: null,
      overrideValue: null,
      renamingKey: null,
      renameValue: '',
      enemyHp: {},
      enemyConditions: {},
      enemyStats: {},
      enemyMeta: {},
      newEnemyName: '',
      newEnemyMod: 0,
      statKeys: STAT_KEY_LIST,
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
      return this.order[this.combatTurn.turnIndex] ?? null
    },
    // The card clicking "Next Turn" would land on — clicking any OTHER card
    // is a debug/testing jump out of initiative sequence (see the BugOff
    // badge in the template), not something a real game lets you do.
    nextTurnIndex() {
      if (!this.order.length) return null
      return (this.combatTurn.turnIndex + 1) % this.order.length
    },
    activeChar() {
      if (!this.activeEntry || this.activeEntry.type !== 'player') return null
      return (
        this.$store.state.characters.find(
          (c) => c.name === this.activeEntry.name
        ) ?? null
      )
    },
    activeCompanion() {
      if (!this.activeEntry || this.activeEntry.type !== 'companion')
        return null
      return (
        (this.$store.state.companions ?? []).find(
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
        ? `${enc.weapon.damageDice}${this.signed(enc.weapon.damageMod)}${
            enc.weapon.damageType ? ' ' + enc.weapon.damageType : ''
          }`
        : null
      // Whether this enemy's attacks count as magical for the purposes of
      // resistance/immunity to nonmagical damage — real RAW, not cosmetic:
      // a weapon with an enhancement bonus is magical by definition, and a
      // monster with a special ability named "Magic Weapons" (a common
      // trait on higher-CR fiends/celestials/etc.) makes its natural
      // attacks count too. Requested 2026-09-11 alongside damage type.
      const encMagical = enc.weapon
        ? Boolean(enc.weapon.magical) || (enc.weapon.enhancement ?? 0) > 0
        : false
      return {
        ac: 'ac' in ov ? ov.ac : enc.ac ?? null,
        attackBonus:
          'attackBonus' in ov ? ov.attackBonus : enc.attackBonus ?? null,
        damage: 'damage' in ov ? ov.damage : encDamage,
        damageLabel:
          'damageLabel' in ov
            ? ov.damageLabel
            : enc.weapon?.displayName ?? null,
        magical: 'magical' in ov ? ov.magical : encMagical,
        numAttacks: 'numAttacks' in ov ? ov.numAttacks : null,
        speed: 'speed' in ov ? ov.speed : enc.speed ?? 30,
        spellSaveDC:
          'spellSaveDC' in ov ? ov.spellSaveDC : enc.spellSaveDC ?? null,
        savingThrows:
          'savingThrows' in ov
            ? ov.savingThrows
            : enc.savingThrows?.map((s) => s.toUpperCase()).join(', ') ?? null,
        notes: 'notes' in ov ? ov.notes : '',
        crowdSize: 'crowdSize' in ov ? ov.crowdSize : null,
      }
    },
    // "Crowd" house rule (see house_rules.json): up to 5 weak creatures
    // tracked as one pooled-HP unit. Strength steps down as pooled HP
    // crosses even thresholds of max — derived purely from HP + crowdSize,
    // no separate stored state.
    activeCrowdStrength() {
      const size = this.activeEnemyMeta.crowdSize
      if (!size || size <= 1) return null
      const hp = this.activeEnemyHp
      if (!hp || !hp.maxHp) return null
      const current = Math.max(0, hp.maxHp - hp.damage)
      return Math.ceil((current / hp.maxHp) * size)
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
  },

  methods: {
    onToggleResource(resource) {
      if (!this.activeEntry) return
      this.$emit('toggle-resource', { key: this.activeEntry.key, resource })
    },
    log(msg) {
      const who = this.activeEntry?.name ?? '?'
      this.battleLog.unshift({
        id: Date.now(),
        turn: this.combatTurn.round,
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
        } ${enc.weapon?.damageType ?? ''}${
          enc.weapon?.magical ? ', magical' : ''
        })`,
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

    // ── Player/companion HP display (sidebar) — reads the real persisted
    // fields directly; HpTracker inside CharacterCombatPanel is the only
    // thing that mutates them now. ──
    playerHp(name) {
      const char = this.$store.state.characters.find((c) => c.name === name)
      if (!char) return '—'
      const base = `${char.hp_current}/${char.hp_max}`
      return char.hp_temp ? `${base} +${char.hp_temp}tmp` : base
    },
    companionHp(name) {
      const c = (this.$store.state.companions ?? []).find(
        (x) => x.name === name
      )
      if (!c) return '—'
      const base = `${c.hp_current}/${c.hp_max}`
      return c.hp_temp ? `${base} +${c.hp_temp}tmp` : base
    },

    // ── Enemy damage display (sidebar) ──
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
    applyDamage(amount) {
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
    },
    applyHeal(amount) {
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      const hp = this.enemyHp[key]
      this.$set(this.enemyHp, key, {
        ...hp,
        damage: Math.max(0, hp.damage - amount),
      })
      this.log(`healed ${amount}`)
    },
    applyEnemyTemp(amount) {
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      const hp = this.enemyHp[key]
      this.$set(this.enemyHp, key, {
        ...hp,
        tempHp: Math.max(hp.tempHp ?? 0, amount),
      })
      this.log(`+${amount} temp HP`)
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
    saveMaxHp(value) {
      if (!this.activeEntry) return
      const key = this.activeEntry.key
      const val = value > 0 ? value : null
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, { ...this.enemyHp[key], maxHp: val })
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
    addCustomCondition(cond) {
      if (!cond || !this.activeEntry) return
      const key = this.activeEntry.key
      const current = this.enemyConditions[key] ?? []
      if (!current.includes(cond)) {
        this.$set(this.enemyConditions, key, [...current, cond])
        this.log(`gained ${cond}`)
      }
    },

    // ── Enemy ability scores ──
    setEnemyStat(stat, value) {
      const key = this.activeEntry.key
      if (!this.enemyStats[key]) this.$set(this.enemyStats, key, {})
      const clamped = isNaN(value) ? 10 : Math.min(30, Math.max(1, value))
      this.$set(this.enemyStats[key], stat, clamped)
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
      // A "Magic Weapons" special ability (common on higher-CR fiends,
      // celestials, etc.) makes a monster's own natural attacks count as
      // magical for bypassing resistance/immunity — real RAW, checked here
      // since dnd5eapi doesn't expose a plain boolean for it.
      const hasMagicWeapons = (data?.special_abilities ?? []).some((sa) =>
        /magic weapon/i.test(sa.name ?? '')
      )
      const encounterData = {
        roleLabel: `${monster.type ?? ''} CR ${monster.cr ?? '?'}`,
        size: monster.size ?? null,
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
        attackBonus: weaponAction?.attack_bonus ?? null,
        weapon: dmg
          ? {
              damageDice: dmg.damage_dice,
              damageMod: 0,
              damageType: dmg.damage_type?.name ?? null,
              magical: hasMagicWeapons,
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

    // ── Enemy rename (especially useful after Duplicate leaves identical names) ──
    startRename(key, currentName) {
      this.renamingKey = key
      this.renameValue = currentName
      this.$nextTick(() => {
        const ref = this.$refs[`renameInput-${key}`]
        const el = Array.isArray(ref) ? ref[0] : ref
        el?.focus()
        el?.select()
      })
    },
    commitRename(key) {
      const name = this.renameValue.trim()
      if (name) this.$emit('rename-enemy', { key, name })
      this.renamingKey = null
      this.renameValue = ''
    },
    cancelRename() {
      this.renamingKey = null
      this.renameValue = ''
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
  position: relative;
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

.turn-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.round-display {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-display);
}

.round-label {
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
}

.round-value {
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  min-width: 1.5rem;
  text-align: center;
}

.next-turn-btn {
  padding: 0.4rem 0.9rem;
  background: var(--color-accent);
  border: none;
  border-radius: 6px;
  color: var(--color-bg);
  font-weight: 600;
  cursor: pointer;
}

.next-turn-btn:hover {
  background: var(--color-accent-strong);
}

/* Debug/testing-only controls — anything that manipulates combat state a
   real game never would (rewinding the round, un-spending a resource,
   jumping the turn out of initiative sequence) gets this treatment so it
   never reads as a normal part of play. */
/* Pink tinge is deliberate — a plain muted-gray outline read as just
   another normal control at a glance. Pink doesn't appear anywhere else in
   this app's palette, so it reads unambiguously as "not a real game
   action" the instant you see it, not just on hover/tooltip. */
.debug-control {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  background: transparent;
  border: 1px dashed var(--color-debug, #e0629e);
  border-radius: 4px;
  color: var(--color-debug, #e0629e);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.debug-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--color-debug, #e0629e);
}

.card-debug-badge {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  width: 0.9rem;
  height: 0.9rem;
  color: var(--color-debug, #e0629e);
  opacity: 0.85;
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

.panel-name-editable {
  cursor: text;
  border-bottom: 1px dashed transparent;
}

.panel-name-editable:hover {
  border-bottom-color: var(--color-border);
}

.panel-name-input {
  font-family: inherit;
  font-weight: inherit;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0 4px;
}

.panel-subtitle {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}

/* ── Enemy combat panel boxes ── */
.enemy-top-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.enemy-stats-box,
.enemy-hp-box,
.enemy-conditions-box {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.5rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.enemy-conditions-box {
  flex: 1;
  min-width: 240px;
}

.enemy-hp-box {
  align-items: flex-start;
}

.enemy-hp-reset {
  align-self: flex-end;
}

.crowd-strength-badge {
  align-self: flex-end;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-accent-strong);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: help;
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
  /* Without this, a drag-resize gets fought/reset by the parent
     flex-column's own sizing pass on the next render. */
  flex-shrink: 0;
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
