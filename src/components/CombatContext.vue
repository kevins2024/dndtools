<template>
  <div class="combat-context">
    <!-- Setup phase -->
    <template v-if="phase === 'setup'">
      <aside class="col bench-col scrollable">
        <div class="col-label">Bench</div>
        <PlayerCharacterSelect />
      </aside>

      <aside class="col ondeck-col scrollable">
        <div class="col-label">On-Deck</div>

        <div class="parties-section">
          <div v-if="parties.length" class="parties-pills">
            <div
              v-for="party in parties"
              :key="party.id"
              class="party-pill"
              :class="{ active: loadedPartyId === party.id }"
              :title="party.members.join(', ')"
              @click="loadParty(party)"
            >
              {{ party.name }}
            </div>
          </div>
          <div v-else class="col-empty">
            No parties — create one in the Party tab.
          </div>
        </div>

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

        <!-- Companions belonging to whoever's currently on-deck -->
        <div v-if="availableCompanions.length" class="companion-list">
          <div class="col-label companion-list-label">Companions</div>
          <label
            v-for="c in availableCompanions"
            :key="c.id"
            class="companion-toggle-row"
            :title="`${c.owner}'s companion`"
          >
            <input
              type="checkbox"
              :checked="c.summoned"
              @change="toggleCompanionSummoned(c)"
            />
            <span class="companion-toggle-name">{{ c.name }}</span>
            <span class="companion-toggle-owner">({{ c.owner }})</span>
          </label>
        </div>
      </aside>

      <section class="col enemy-col scrollable">
        <div class="col-label">Enemies</div>
        <div v-if="currentEncounter" class="enc-load-bar">
          <span class="enc-load-hint">
            {{ currentEncounter.difficulty }} · {{ currentEncounter.type }} ·
            {{ currentEncounter.enemies.length }} enemies
          </span>
          <button class="enc-load-btn" @click="loadEncounterEnemies">
            Load Encounter
          </button>
        </div>
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
          <button class="add-btn" @click="addEnemy">Add</button>
        </div>
        <div class="enemy-list">
          <div v-for="e in enemies" :key="e.id" class="enemy-row">
            <span class="enemy-name">{{ e.name }}</span>
            <span class="enemy-mod">{{ formatMod(e.mod) }}</span>
            <button
              class="dupe-btn"
              title="Duplicate"
              @click="duplicateEnemy(e)"
            >
              ❏
            </button>
            <button class="remove-btn" @click="removeEnemy(e)">✕</button>
          </div>
          <div v-if="enemies.length === 0" class="col-empty">
            No enemies added yet
          </div>
        </div>
      </section>

      <div class="roll-bar">
        <button class="exit-btn" @click="exitCombat">Exit Combat</button>
        <button class="gen-btn" @click="showEncounterModal = true">
          Generate Encounter
        </button>
        <button
          class="vehicles-btn"
          :class="{ active: hasVehicleSession }"
          @click="onVehicleBtn"
        >
          <Anchor class="vehicles-btn-icon" /> {{ vehicleBtnLabel }}
        </button>
        <button
          class="roll-btn"
          :disabled="!hasAnyCombatant"
          @click="rollInitiative"
        >
          Roll Initiative
        </button>
      </div>
    </template>

    <!-- Battle phase -->
    <template v-else>
      <Battle
        class="battle-fill"
        :order="initiativeOrder"
        :combatant-states="combatantStates"
        @override-roll="onOverrideRoll"
        @add-enemy="onAddEnemyMidFight"
        @duplicate-enemy="onDuplicateEnemy"
        @toggle-friendly="onToggleFriendly"
        @remove-enemy="onRemoveEnemy"
      />
      <div class="roll-bar">
        <div class="roll-bar-left">
          <button class="exit-btn" @click="exitCombat">Exit Combat</button>
          <button class="back-btn" @click="phase = 'setup'">
            ← Back to Setup
          </button>
        </div>
        <div class="roll-bar-right">
          <button
            class="vehicles-btn"
            :class="{ active: hasVehicleSession }"
            @click="onVehicleBtn"
          >
            <Anchor class="vehicles-btn-icon" /> {{ vehicleBtnLabel }}
          </button>
          <button class="map-btn" @click="showBattleMap = true">
            Battle Map
          </button>
        </div>
      </div>
      <BattleMap
        v-show="showBattleMap"
        :visible="showBattleMap"
        :order="initiativeOrder"
        :combatant-states="combatantStates"
        @close="showBattleMap = false"
      />
    </template>

    <!-- Vehicle wizard, mini panel, and full-screen ship combat -->
    <VehicleCombatWizard />
    <VehicleCombatPanel />
    <ShipCombat />

    <!-- Encounter Generator Modal -->
    <div
      v-if="showEncounterModal"
      class="enc-modal-overlay"
      @click.self="showEncounterModal = false"
    >
      <div class="enc-modal">
        <div class="enc-modal-header">
          <span>Encounter Generator</span>
          <button class="enc-modal-close" @click="showEncounterModal = false">
            ✕
          </button>
        </div>
        <div class="enc-modal-body">
          <EncounterGenerator :combat-roster="playerNames" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import PlayerCharacterSelect from './PlayerCharacterSelect.vue'
import Battle from './Battle.vue'
import EncounterGenerator from './EncounterGenerator.vue'
import BattleMap from './BattleMap.vue'
import VehicleCombatWizard from './VehicleCombatWizard.vue'
import VehicleCombatPanel from './VehicleCombatPanel.vue'
import ShipCombat from './ShipCombat.vue'
import { dnd } from '@/utils/dnd_utils.js'
import { generateEncounter, analyzeParty } from '@/utils/encounter_utils.js'
import { Anchor } from 'lucide-vue'

export default {
  name: 'CombatContext',
  components: {
    PlayerCharacterSelect,
    Battle,
    EncounterGenerator,
    BattleMap,
    VehicleCombatWizard,
    VehicleCombatPanel,
    ShipCombat,
    Anchor,
  },

  data() {
    return {
      phase: 'setup',
      enemies: [],
      rolls: {},
      combatantStates: {},
      enemyName: '',
      enemyMod: 0,
      nextEnemyId: 1,
      showEncounterModal: false,
      showBattleMap: false,
      loadedPartyId: null,
    }
  },

  computed: {
    showVehicleCombat: {
      get() {
        return this.$store.state.showVehicleCombat
      },
      set() {
        this.$store.commit('TOGGLE_VEHICLE_COMBAT')
      },
    },
    hasVehicleSession() {
      return !!this.$store.state.vehicleCombatSession
    },
    vehicleBtnLabel() {
      if (!this.hasVehicleSession) return 'Vehicle Combat'
      return this.showVehicleCombat ? 'Ships ▾' : 'Ships ▸'
    },
    characters() {
      return this.$store.state.characters
    },
    playerNames() {
      return this.$store.state.selectedPlayers
    },
    hasAnyCombatant() {
      return this.playerNames.length > 0 || this.enemies.length > 0
    },
    currentEncounter() {
      return this.$store.state.currentEncounter
    },
    parties() {
      return this.$store.state.parties
    },
    availableCompanions() {
      return (this.$store.state.companions ?? []).filter((c) =>
        this.playerNames.includes(c.owner)
      )
    },
    allEntries() {
      const players = this.playerNames.map((name) => {
        const char = this.characters.find((c) => c.name === name)
        return {
          key: `player-${name}`,
          type: 'player',
          name,
          mod: char ? dnd.initiative(char) : 0,
          image: char?.image ?? '',
        }
      })
      // Summoned companions whose owner is actually in the fight — unsummon
      // (or send the owner home) and they drop out of initiative on the
      // next roll, same as any other roster change.
      const companions = (this.$store.state.companions ?? [])
        .filter((c) => c.summoned && this.playerNames.includes(c.owner))
        .map((c) => ({
          key: `companion-${c.name}`,
          type: 'companion',
          name: c.name,
          mod: dnd.initiative(c),
          image: c.image ?? '',
        }))
      const enemies = this.enemies.map((e) => ({
        key: `enemy-${e.id}`,
        type: 'enemy',
        name: e.name,
        mod: e.mod,
        image: '',
        encounterData: e.encounterData ?? null,
      }))
      return [...players, ...companions, ...enemies]
    },
    initiativeOrder() {
      return this.allEntries
        .map((e) => ({
          ...e,
          total: this.rolls[e.key]?.total ?? 0,
          tiebreakOrder: this.rolls[e.key]?.tiebreakOrder ?? 0,
        }))
        .sort(
          (a, b) =>
            b.total - a.total ||
            b.mod - a.mod ||
            a.tiebreakOrder - b.tiebreakOrder
        )
    },
  },

  created() {
    if (this.$store.state.selectedPlayers.length === 0) {
      const active = this.$store.state.parties.find((p) => p.active)
      if (active) this.loadParty(active)
    }
  },

  watch: {
    '$store.state.pendingCombatEnemies'(enemies) {
      if (!enemies) return
      this.enemies = enemies.map((e) => ({ ...e, id: this.nextEnemyId++ }))
      this.$store.commit('CLEAR_PENDING_COMBAT_ENEMIES')
      this.showEncounterModal = false
    },
    '$store.state.openEncounterGeneratorRequest'(val) {
      if (val) {
        const seed = this.$store.state.encounterSeed
        if (seed) this.generateSeededEncounter(seed)
        this.showEncounterModal = true
        this.$store.commit('CLEAR_OPEN_ENCOUNTER_GENERATOR')
      }
    },
  },

  methods: {
    // Generates an encounter directly from a Travel Event's seed (terrain,
    // continent, and combat-flagged topic already established the scene) and
    // commits it straight to SET_ENCOUNTER — skipping the Encounter
    // Generator's wizard screens entirely. The generator's result/review
    // card renders as soon as `currentEncounter` is populated, so the DM
    // lands directly on "reroll if needed, then Load into Combat."
    generateSeededEncounter(seed) {
      const chars = this.playerNames
        .map((name) => this.characters.find((c) => c.name === name))
        .filter(Boolean)
      if (!chars.length) return

      const levels = chars.map((c) => c.level)
      const hps = chars.map((c) => c.hp_max)
      const partyLevel = Math.round(
        levels.reduce((a, b) => a + b, 0) / levels.length
      )
      const partySize = chars.length
      const minPartyHP = Math.min(...hps)
      const maxPartyHP = Math.max(...hps)
      const partyProfile = analyzeParty(chars)

      const slotCount =
        seed.size === 'group' ? Math.max(2, Math.min(4, partySize)) : 1
      const slots = Array.from({ length: slotCount }, () => ({
        source: seed.source,
        isBoss: seed.size === 'solo',
      }))

      const encounter = generateEncounter({
        resolvedDifficulty: seed.difficulty,
        resolvedType: 'Travel Encounter',
        partySize,
        partyLevel,
        minPartyHP,
        maxPartyHP,
        slots,
        partyProfile,
      })
      encounter.typeConfig = `Generated from a travel event (${seed.terrain}, ${seed.continent}).`
      this.$store.commit('SET_ENCOUNTER', encounter)
    },

    onVehicleBtn() {
      if (!this.hasVehicleSession) {
        this.$store.commit('OPEN_VEHICLE_WIZARD')
      } else {
        this.$store.commit('TOGGLE_VEHICLE_COMBAT')
      }
    },

    toggleCompanionSummoned(companion) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'companions',
        updatedItem: { ...companion, summoned: !companion.summoned },
      })
    },

    loadParty(party) {
      const valid = new Set(this.characters.map((c) => c.name))
      this.$store.commit(
        'SET_SELECTED_PLAYERS',
        party.members.filter((m) => valid.has(m))
      )
      this.loadedPartyId = party.id
    },

    portrait(name) {
      const char = this.characters.find((c) => c.name === name)
      return char?.image ?? ''
    },

    removeFromCombat(name) {
      this.$store.commit(
        'SET_SELECTED_PLAYERS',
        this.playerNames.filter((n) => n !== name)
      )
      this.$delete(this.rolls, `player-${name}`)
    },

    nextAutoName() {
      const used = new Set(
        this.enemies
          .map((e) => e.name.match(/^Enemy (\d+)$/))
          .filter(Boolean)
          .map((m) => Number(m[1]))
      )
      let n = 1
      while (used.has(n)) n++
      return `Enemy ${n}`
    },

    addEnemy() {
      this.enemies.push({
        id: this.nextEnemyId++,
        name: this.enemyName.trim() || this.nextAutoName(),
        mod: isNaN(this.enemyMod) ? 0 : this.enemyMod,
      })
      this.enemyName = ''
      this.enemyMod = 0
    },

    removeEnemy(e) {
      this.enemies = this.enemies.filter((x) => x.id !== e.id)
      this.$delete(this.rolls, `enemy-${e.id}`)
    },

    nextUniqueName(name) {
      const m = name.match(/^(.*?)\s+(\d+)$/)
      const base = m ? m[1] : name
      const taken = new Set(this.enemies.map((e) => e.name.toLowerCase()))
      let n = 2
      while (taken.has(`${base} ${n}`.toLowerCase())) n++
      return `${base} ${n}`
    },

    duplicateEnemy(e) {
      this.enemies.push({
        id: this.nextEnemyId++,
        name: this.nextUniqueName(e.name),
        mod: e.mod,
        encounterData: e.encounterData ? { ...e.encounterData } : null,
      })
    },

    onDuplicateEnemy(key) {
      const id = parseInt(key.replace('enemy-', ''))
      const src = this.enemies.find((e) => e.id === id)
      if (!src) return
      const newId = this.nextEnemyId++
      this.enemies.push({
        id: newId,
        name: this.nextUniqueName(src.name),
        mod: src.mod,
        encounterData: src.encounterData ? { ...src.encounterData } : null,
      })
      this.$set(this.rolls, `enemy-${newId}`, {
        total: dnd.roll() + src.mod,
        tiebreakOrder: 0,
      })
    },

    rollInitiative() {
      this.$store.commit('SET_DICE_DRAWER_OPEN', true)
      const newRolls = {}
      for (const entry of this.allEntries) {
        const roll = dnd.roll()
        newRolls[entry.key] = { total: roll + entry.mod, tiebreakOrder: 0 }
      }

      const groups = {}
      for (const entry of this.allEntries) {
        const r = newRolls[entry.key]
        const gk = `${r.total}_${entry.mod}`
        if (!groups[gk]) groups[gk] = []
        groups[gk].push(entry.key)
      }
      for (const keys of Object.values(groups)) {
        if (keys.length < 2) continue
        let tieRolls
        do {
          tieRolls = keys.map((k) => ({ k, r: dnd.roll() }))
        } while (new Set(tieRolls.map((x) => x.r)).size < keys.length)
        tieRolls.sort((a, b) => b.r - a.r)
        tieRolls.forEach(({ k }, i) => {
          newRolls[k].tiebreakOrder = i + 1
        })
      }

      this.rolls = newRolls
      this.phase = 'battle'
    },

    onToggleFriendly(key) {
      const current = this.combatantStates[key]
      if (!current) {
        this.$set(this.combatantStates, key, 'friendly')
      } else if (current === 'friendly') {
        this.$set(this.combatantStates, key, 'neutral')
      } else {
        this.$delete(this.combatantStates, key)
      }
    },

    onOverrideRoll({ key, total }) {
      this.$set(this.rolls, key, { ...this.rolls[key], total })
    },

    onRemoveEnemy(key) {
      const id = parseInt(key.replace('enemy-', ''))
      this.enemies = this.enemies.filter((e) => e.id !== id)
      this.$delete(this.rolls, key)
    },

    onAddEnemyMidFight({ name, mod, encounterData }) {
      const id = this.nextEnemyId++
      this.enemies.push({
        id,
        name: name || this.nextAutoName(),
        mod,
        encounterData: encounterData ?? null,
      })
      this.$set(this.rolls, `enemy-${id}`, {
        total: dnd.roll() + mod,
        tiebreakOrder: 0,
      })
    },

    loadEncounterEnemies() {
      const enc = this.$store.state.currentEncounter
      if (!enc) return
      this.enemies = enc.enemies.map((e) => ({
        id: this.nextEnemyId++,
        name: e.name,
        mod: Math.floor((e.stats.dex - 10) / 2),
        encounterData: e,
      }))
      this.showEncounterModal = false
    },

    exitCombat() {
      this.phase = 'setup'
      this.enemies = []
      this.rolls = {}
      this.combatantStates = {}
      this.enemyName = ''
      this.enemyMod = 0
      this.nextEnemyId = 1
      this.$store.commit('SET_SELECTED_PLAYERS', [])
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
    'bench ondeck enemies'
    'roll  roll   roll';
  height: 100%;
  overflow: hidden;
}

/* Battle phase fills the content row */
.battle-fill {
  grid-column: 1 / -1;
}

/* Shared column styles */
.col {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.col-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  text-align: center;
  padding: 1rem 0.5rem;
}

/* Bench */
.bench-col {
  grid-area: bench;
  background: var(--color-bg-panel);
  border-right: 1px solid var(--color-border);
}

/* On-Deck */
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

.player-card:hover {
  opacity: 0.7;
}

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
  font-size: var(--font-size-base);
  color: var(--color-accent);
  background: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Companion toggles (compact, on-deck sidebar) ── */
.companion-list {
  padding: 4px 8px 8px;
  border-top: 1px solid var(--color-border);
}

.companion-list-label {
  padding: 0;
  margin-bottom: 4px;
}

.companion-toggle-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  cursor: pointer;
}

.companion-toggle-row input {
  cursor: pointer;
}

.companion-toggle-name {
  color: var(--color-accent);
}

.companion-toggle-owner {
  color: var(--color-text-low);
}

/* Saved Parties */
.parties-section {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.parties-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.4rem;
  padding: 0 0.5rem;
}

.party-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.35rem 0.18rem 0.55rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 12px;
  font-size: var(--font-size-base);
  color: var(--color-accent);
  cursor: pointer;
  transition: background 0.15s ease;
  user-select: none;
}

.party-pill:hover {
  background: var(--color-bg-surface-alt);
}

.party-pill.active {
  border-width: 2px;
  font-weight: 600;
}

/* Encounter load bar */
.enc-load-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: rgba(136, 136, 221, 0.07);
  border-bottom: 1px solid rgba(136, 136, 221, 0.25);
}

.enc-load-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  text-transform: capitalize;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.enc-load-btn {
  padding: 0.2rem 0.6rem;
  background: none;
  border: 1px solid var(--color-info);
  border-radius: 4px;
  color: var(--color-info);
  font-size: var(--font-size-base);
  font-family: var(--font-display);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s ease;
}
.enc-load-btn:hover {
  background: rgba(136, 136, 221, 0.15);
}

/* Enemies column */
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
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  padding: 0.35rem 0.5rem;
}

.field:focus {
  outline: none;
  border-color: var(--color-accent);
}

.name-field {
  flex: 1;
}

.mod-field {
  width: 4rem;
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

.enemy-name {
  flex: 1;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.enemy-mod {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  min-width: 2.5rem;
  text-align: right;
}

.dupe-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: color 0.15s ease;
}
.dupe-btn:hover {
  color: var(--color-accent);
}

.remove-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: color 0.15s ease;
}
.remove-btn:hover {
  color: var(--color-text-danger);
}

/* Roll Bar */
.roll-bar {
  grid-area: roll;
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
}

.roll-bar-left,
.roll-bar-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.roll-btn {
  padding: 0.45rem 3rem;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-bg);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.roll-btn:hover:not(:disabled) {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.roll-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.back-btn {
  padding: 0.45rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.exit-btn {
  padding: 0.45rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.exit-btn:hover {
  border-color: var(--color-text-danger);
  color: var(--color-text-danger);
}

.map-btn {
  padding: 0.45rem 1.1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.map-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.gen-btn {
  padding: 0.45rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.gen-btn:hover {
  border-color: var(--color-info);
  color: var(--color-info);
}

/* Vehicle Combat button */
.vehicles-btn {
  padding: 0.45rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.vehicles-btn-icon {
  width: 0.9rem;
  height: 0.9rem;
}
.vehicles-btn:hover {
  border-color: var(--color-info);
  color: var(--color-info);
}
.vehicles-btn.active {
  border-color: var(--color-info);
  color: var(--color-info);
  background: rgba(136, 136, 221, 0.1);
}

/* Encounter modal */
.enc-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.enc-modal {
  display: flex;
  flex-direction: column;
  width: 96vw;
  height: 94vh;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.enc-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.enc-modal-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.enc-modal-close:hover {
  color: var(--color-text-danger);
}

.enc-modal-body {
  flex: 1;
  overflow: hidden;
}

/* col-label shared */
.col-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
}
</style>
