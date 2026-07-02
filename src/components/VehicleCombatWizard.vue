<template>
  <div class="vcw-overlay" v-show="show">
    <div class="vcw-modal">
      <!-- Header -->
      <div class="vcw-header">
        <span class="vcw-title">Vehicle Combat Setup</span>
        <span class="vcw-step-badge">Step {{ step }} of 4</span>
        <button class="vcw-close" @click="cancel" title="Cancel">✕</button>
      </div>

      <!-- Body -->
      <div class="vcw-body">
        <!-- ── Step 1: Vehicle class ── -->
        <div v-if="step === 1" class="vcw-step1">
          <p class="vcw-hint-text">
            Select the type of vehicle for this engagement.
          </p>
          <div class="vcw-class-grid">
            <div class="vcw-class-card vcw-class-card--active">
              <span class="vcw-class-icon">⚓</span>
              <span class="vcw-class-name">Ships</span>
            </div>
            <div class="vcw-class-card vcw-class-card--soon">
              <span class="vcw-class-icon">🐴</span>
              <span class="vcw-class-name">Mounts</span>
              <span class="vcw-soon-badge">soon</span>
            </div>
            <div class="vcw-class-card vcw-class-card--soon">
              <span class="vcw-class-icon">🎈</span>
              <span class="vcw-class-name">Airships</span>
              <span class="vcw-soon-badge">soon</span>
            </div>
            <div class="vcw-class-card vcw-class-card--soon">
              <span class="vcw-class-icon">🐉</span>
              <span class="vcw-class-name">Mounts (flying)</span>
              <span class="vcw-soon-badge">soon</span>
            </div>
          </div>
        </div>

        <!-- ── Step 2: Roster ── -->
        <div v-if="step === 2" class="vcw-step2">
          <div class="vcw-roster-cols">
            <!-- Party assets -->
            <div class="vcw-roster-left">
              <div class="vcw-section-label">Party Ships</div>
              <div v-if="partyShips.length === 0" class="vcw-empty">
                No ships in Assets.
              </div>
              <div
                v-for="ship in partyShips"
                :key="ship.id"
                class="vcw-asset-row"
              >
                <input
                  type="checkbox"
                  :id="'vchk_' + ship.id"
                  :checked="isSelected(ship.id)"
                  @change="toggleAsset(ship)"
                  class="vcw-checkbox"
                />
                <label :for="'vchk_' + ship.id" class="vcw-asset-label">
                  <span class="vcw-asset-name">{{ ship.name }}</span>
                  <span class="vcw-asset-sub">{{
                    ship.subtype || 'Ship'
                  }}</span>
                </label>
                <select
                  v-if="isSelected(ship.id)"
                  class="vcw-role-sel"
                  :value="getRole(ship.id)"
                  @change="setRole(ship.id, $event.target.value)"
                >
                  <option value="friendly">Friendly</option>
                  <option value="neutral">Neutral</option>
                  <option value="enemy">Enemy</option>
                </select>
                <span v-else class="vcw-role-placeholder"></span>
              </div>
            </div>

            <!-- Add custom ships -->
            <div class="vcw-roster-right">
              <div class="vcw-section-label">Add Ship</div>
              <div class="vcw-add-form">
                <input
                  v-model="newName"
                  class="vcw-inp vcw-inp--wide"
                  placeholder="Ship name…"
                  @keyup.enter="addCustom"
                />
                <select v-model="newType" class="vcw-sel">
                  <option v-for="t in SHIP_TYPES" :key="t" :value="t">
                    {{ t }}
                  </option>
                </select>
                <select v-model="newRole" class="vcw-sel">
                  <option value="friendly">Friendly</option>
                  <option value="neutral">Neutral</option>
                  <option value="enemy">Enemy</option>
                </select>
                <button class="vcw-add-btn" @click="addCustom">+ Add</button>
              </div>
              <div class="vcw-custom-list">
                <div
                  v-for="s in customShips"
                  :key="s.id"
                  class="vcw-custom-row"
                >
                  <span
                    class="vcw-role-dot"
                    :class="'vcw-role-dot--' + s.team"
                  ></span>
                  <span class="vcw-custom-name">{{ s.name }}</span>
                  <span class="vcw-custom-type">{{ s.shipType }}</span>
                  <button class="vcw-remove-btn" @click="removeCustom(s.id)">
                    ✕
                  </button>
                </div>
                <div
                  v-if="customShips.length === 0"
                  class="vcw-empty vcw-empty--sm"
                >
                  No custom ships added yet.
                </div>
              </div>

              <!-- Summary -->
              <div
                class="vcw-roster-summary"
                v-if="allSelectedShips.length > 0"
              >
                <span class="vcw-sum-chip vcw-sum-chip--friendly">
                  {{
                    allSelectedShips.filter((s) => s.team === 'friendly').length
                  }}
                  friendly
                </span>
                <span class="vcw-sum-chip vcw-sum-chip--neutral">
                  {{
                    allSelectedShips.filter((s) => s.team === 'neutral').length
                  }}
                  neutral
                </span>
                <span class="vcw-sum-chip vcw-sum-chip--enemy">
                  {{
                    allSelectedShips.filter((s) => s.team === 'enemy').length
                  }}
                  enemy
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 3: Positioning ── -->
        <div v-if="step === 3" class="vcw-step3">
          <div class="vcw-pos-layout">
            <!-- Ship sidebar -->
            <div class="vcw-pos-sidebar">
              <div class="vcw-section-label">Ships</div>
              <div
                v-for="s in allSelectedShips"
                :key="s.id"
                class="vcw-pos-ship"
                :class="[
                  'vcw-pos-ship--' + s.team,
                  { 'vcw-pos-ship--active': placingId === s.id },
                  { 'vcw-pos-ship--placed': !!positions[s.id] },
                ]"
                @click="selectForPlacing(s.id)"
              >
                <span
                  class="vcw-pos-token"
                  :class="'vcw-pos-token--' + s.team"
                  >{{ initials(s.name) }}</span
                >
                <div class="vcw-pos-info">
                  <span class="vcw-pos-name">{{ s.name }}</span>
                  <span class="vcw-pos-status" v-if="positions[s.id]">
                    {{ facingArrow(positions[s.id].facing) }} placed
                  </span>
                  <span
                    class="vcw-pos-status vcw-pos-status--hint"
                    v-else-if="placingId === s.id"
                  >
                    click grid →
                  </span>
                </div>
              </div>

              <div class="vcw-facing-row" v-if="placingId">
                <span class="vcw-facing-label">Facing</span>
                <button class="vcw-facing-btn" @click="rotatePlacing(-1)">
                  ↺
                </button>
                <span class="vcw-facing-val">{{ currentFacing }}</span>
                <button class="vcw-facing-btn" @click="rotatePlacing(1)">
                  ↻
                </button>
              </div>

              <p class="vcw-pos-footnote">
                Positioning is optional — ships without placement will still
                join the combat tracker.
              </p>
            </div>

            <!-- Grid -->
            <div class="vcw-grid-area">
              <div class="vcw-grid">
                <div
                  v-for="row in gridRange"
                  :key="'r' + row"
                  class="vcw-grid-row"
                >
                  <div
                    v-for="col in gridRange"
                    :key="'c' + col"
                    class="vcw-cell"
                    :class="{
                      'vcw-cell--placing': !!placingId,
                      'vcw-cell--occupied': !!gridMap[row + ',' + col],
                    }"
                    @click="placeShip(row, col)"
                  >
                    <span
                      v-for="s in gridMap[row + ',' + col] || []"
                      :key="s.id"
                      class="vcw-grid-token"
                      :class="[
                        'vcw-grid-token--' + s.team,
                        { 'vcw-grid-token--active': placingId === s.id },
                      ]"
                      :title="
                        s.name +
                        ' · ' +
                        s.team +
                        ' · facing ' +
                        positions[s.id].facing
                      "
                      @click.stop="selectForPlacing(s.id)"
                      >{{ initials(s.name)
                      }}<span class="vcw-arr">{{
                        facingArrow(positions[s.id].facing)
                      }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Step 4: Crew & NPCs ── -->
        <div v-if="step === 4" class="vcw-step4">
          <p class="vcw-hint-text">
            Assign party members to crew positions and configure each ship's
            NPCs. Unnamed crew slots will be auto-generated as sailors when
            combat starts.
          </p>
          <div class="vcw-crew-layout">
            <!-- Ship selector -->
            <div class="vcw-crew-ships">
              <div class="vcw-section-label">Ships</div>
              <div
                v-for="s in allSelectedShips"
                :key="s.id"
                class="vcw-crew-ship-row"
                :class="[
                  'vcw-crew-ship-row--' + s.team,
                  { 'vcw-crew-ship-row--active': activeCrewShipId === s.id },
                ]"
                @click="activeCrewShipId = s.id"
              >
                <span
                  class="vcw-pos-token vcw-pos-token--sm"
                  :class="'vcw-pos-token--' + s.team"
                >
                  {{ initials(s.name) }}
                </span>
                <span class="vcw-crew-ship-name">{{ s.name }}</span>
                <span class="vcw-crew-check" v-if="hasAnyCrew(s.id)">✓</span>
              </div>
            </div>

            <!-- Crew assignment panel -->
            <div class="vcw-crew-panel" v-if="activeCrewShip">
              <!-- Party crew slots -->
              <div class="vcw-section-label">
                Party Crew — {{ activeCrewShip.name }}
              </div>
              <div class="vcw-slot-list">
                <div
                  v-for="slot in crewSlotsFor(activeCrewShip)"
                  :key="slot.id"
                  class="vcw-slot-row"
                >
                  <span class="vcw-slot-label">{{ slot.label }}</span>
                  <select
                    class="vcw-slot-sel"
                    :value="getCrewAssignment(activeCrewShipId, slot.id)"
                    @change="
                      setCrewAssignment(
                        activeCrewShipId,
                        slot.id,
                        $event.target.value
                      )
                    "
                  >
                    <option value="">— empty —</option>
                    <option
                      v-for="p in availablePlayersFor(
                        activeCrewShipId,
                        slot.id
                      )"
                      :key="p"
                      :value="p"
                    >
                      {{ p }}
                    </option>
                  </select>
                </div>
                <div
                  v-if="crewSlotsFor(activeCrewShip).length === 0"
                  class="vcw-empty vcw-empty--sm"
                >
                  No crew positions for this ship type.
                </div>
              </div>

              <!-- NPC crew count -->
              <div class="vcw-section-label" style="margin-top: 1.25rem">
                NPCs on {{ activeCrewShip.name }}
              </div>

              <div class="vcw-crew-count-row">
                <span class="vcw-crew-count-lbl">Total crew count</span>
                <input
                  type="number"
                  class="vcw-inp vcw-inp--mod"
                  min="0"
                  max="50"
                  :value="getCrewCount(activeCrewShipId)"
                  @change="setCrewCount(activeCrewShipId, $event.target.value)"
                />
                <span class="vcw-crew-count-hint">
                  {{ getShipNpcs(activeCrewShipId).length }} named ·
                  {{
                    Math.max(
                      0,
                      getCrewCount(activeCrewShipId) -
                        getShipNpcs(activeCrewShipId).length
                    )
                  }}
                  will be generated
                </span>
              </div>

              <!-- Suggested crew from asset -->
              <div
                v-if="
                  activeCrewShip.suggestedCrew &&
                  activeCrewShip.suggestedCrew.length
                "
                class="vcw-suggested"
              >
                <div class="vcw-suggested-label">Suggested crew</div>
                <div class="vcw-suggested-chips">
                  <button
                    v-for="sc in activeCrewShip.suggestedCrew"
                    :key="sc.name"
                    class="vcw-suggest-chip"
                    :class="{
                      'vcw-suggest-chip--added': isNpcAdded(
                        activeCrewShipId,
                        sc.name
                      ),
                    }"
                    :disabled="isNpcAdded(activeCrewShipId, sc.name)"
                    @click="addSuggestedNpc(activeCrewShipId, sc)"
                  >
                    <span class="vcw-chip-name">{{ sc.name }}</span>
                    <span class="vcw-chip-role">{{ sc.role }}</span>
                  </button>
                </div>
              </div>

              <!-- Manual NPC form -->
              <div class="vcw-npc-form">
                <input
                  v-model="npcName"
                  class="vcw-inp vcw-inp--wide"
                  placeholder="NPC name…"
                  @keyup.enter="addNpc"
                />
                <input
                  v-model.number="npcInitMod"
                  type="number"
                  class="vcw-inp vcw-inp--mod"
                  placeholder="+0"
                />
                <button class="vcw-add-btn" @click="addNpc">+ Add NPC</button>
              </div>
              <div class="vcw-npc-roster">
                <div
                  v-for="npc in getShipNpcs(activeCrewShipId)"
                  :key="npc.id"
                  class="vcw-npc-row"
                >
                  <span
                    class="vcw-npc-dot"
                    :class="'vcw-npc-dot--' + activeCrewShip.team"
                  ></span>
                  <span class="vcw-npc-name">{{ npc.name }}</span>
                  <span class="vcw-npc-role" v-if="npc.role">{{
                    npc.role
                  }}</span>
                  <span class="vcw-npc-mod"
                    >init
                    {{
                      npc.initMod >= 0 ? '+' + npc.initMod : npc.initMod
                    }}</span
                  >
                  <button
                    class="vcw-remove-btn"
                    @click="removeNpc(activeCrewShipId, npc.id)"
                  >
                    ✕
                  </button>
                </div>
                <div
                  v-if="getShipNpcs(activeCrewShipId).length === 0"
                  class="vcw-empty vcw-empty--sm"
                >
                  No named NPCs — unaccounted crew will be auto-generated.
                </div>
              </div>
            </div>

            <div class="vcw-crew-panel vcw-crew-panel--empty" v-else>
              <span class="vcw-empty"
                >Select a ship from the list to assign crew.</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="vcw-footer">
        <button v-if="step > 1" class="vcw-back-btn" @click="step--">
          ← Back
        </button>
        <span v-else></span>
        <button
          v-if="step < 4"
          class="vcw-next-btn"
          :disabled="step === 2 && allSelectedShips.length === 0"
          @click="advance"
        >
          Next →
        </button>
        <button v-else class="vcw-start-btn" @click="startCombat">
          ⚓ Start Vehicle Combat
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { CONFIGS } from '@/utils/shipConfigs.js'
import { generateSailorNpc } from '@/utils/encounter_utils.js'

const SHIP_TYPES = ['Rowboat', 'Keelboat', 'Sailing Ship', 'Warship', 'Galley']

const SHIP_HP_PRESETS = {
  Rowboat: { hull: 50, sails: 0, helm: 20 },
  Keelboat: { hull: 100, sails: 50, helm: 50 },
  'Sailing Ship': { hull: 300, sails: 100, helm: 50 },
  Warship: { hull: 500, sails: 100, helm: 50 },
  Galley: { hull: 500, sails: 50, helm: 50 },
}

const FACINGS = ['N', 'E', 'S', 'W']
const FACING_ARROWS = { N: '↑', E: '→', S: '↓', W: '←' }

let vcwSeq = 1

export default {
  name: 'VehicleCombatWizard',

  data() {
    return {
      SHIP_TYPES,
      step: 1,

      // Step 2
      selectedAssetIds: [],
      assetRoles: {},
      customShips: [],
      newName: '',
      newType: 'Sailing Ship',
      newRole: 'enemy',

      // Step 3
      placingId: null,
      positions: {},
      pendingFacing: 'E',

      // Step 4
      activeCrewShipId: null,
      crewAssignments: {},
      shipNpcs: {},
      shipCrewCounts: {},
      npcName: '',
      npcInitMod: 0,
    }
  },

  computed: {
    show() {
      return this.$store.state.showVehicleWizard
    },

    partyShips() {
      return (this.$store.state.assets ?? []).filter((a) => a.type === 'ship')
    },

    selectedPlayers() {
      return this.$store.state.selectedPlayers ?? []
    },

    allSelectedShips() {
      const fromAssets = this.partyShips
        .filter((a) => this.selectedAssetIds.includes(a.id))
        .map((a) => this.assetToShip(a))
      const fromCustom = this.customShips.map((c) => this.customToShip(c))
      return [...fromAssets, ...fromCustom]
    },

    gridRange() {
      return Array.from({ length: 12 }, (_, i) => i)
    },

    gridMap() {
      const map = {}
      for (const s of this.allSelectedShips) {
        const pos = this.positions[s.id]
        if (pos) {
          const key = pos.row + ',' + pos.col
          if (!map[key]) map[key] = []
          map[key].push(s)
        }
      }
      return map
    },

    currentFacing() {
      if (this.placingId && this.positions[this.placingId]) {
        return this.positions[this.placingId].facing
      }
      return this.pendingFacing
    },

    activeCrewShip() {
      if (!this.activeCrewShipId) return null
      return (
        this.allSelectedShips.find((s) => s.id === this.activeCrewShipId) ??
        null
      )
    },
  },

  methods: {
    // ── Step 2 ──
    isSelected(assetId) {
      return this.selectedAssetIds.includes(assetId)
    },
    getRole(assetId) {
      return this.assetRoles[assetId] ?? 'friendly'
    },

    toggleAsset(asset) {
      const idx = this.selectedAssetIds.indexOf(asset.id)
      if (idx === -1) {
        this.selectedAssetIds.push(asset.id)
        this.$set(this.assetRoles, asset.id, 'friendly')
      } else {
        this.selectedAssetIds.splice(idx, 1)
      }
    },

    setRole(assetId, role) {
      this.$set(this.assetRoles, assetId, role)
    },

    addCustom() {
      const name = this.newName.trim() || 'Ship ' + vcwSeq
      this.customShips.push({
        id: 'vcw_' + vcwSeq++,
        name,
        shipType: this.newType,
        team: this.newRole,
      })
      this.newName = ''
    },

    removeCustom(id) {
      this.customShips = this.customShips.filter((s) => s.id !== id)
    },

    assetToShip(asset) {
      const preset =
        SHIP_HP_PRESETS[asset.subtype] ?? SHIP_HP_PRESETS['Sailing Ship']
      return {
        id: 'vcws_' + asset.id,
        assetId: asset.id,
        name: asset.name,
        shipType: asset.subtype || 'Sailing Ship',
        team: this.assetRoles[asset.id] ?? 'friendly',
        hull: asset.hull ?? { current: preset.hull, max: preset.hull },
        sails: asset.sails ?? { current: preset.sails, max: preset.sails },
        helm: asset.helm ?? { current: preset.helm, max: preset.helm },
        weapons: asset.weapons ?? [],
        conditions: [],
        suggestedCrew: asset.crew ?? [],
        defaultCrewCount: asset.crew_current ?? asset.crew_full ?? 0,
      }
    },

    customToShip(c) {
      const preset =
        SHIP_HP_PRESETS[c.shipType] ?? SHIP_HP_PRESETS['Sailing Ship']
      return {
        id: c.id,
        assetId: null,
        name: c.name,
        shipType: c.shipType,
        team: c.team,
        hull: { current: preset.hull, max: preset.hull },
        sails: { current: preset.sails, max: preset.sails },
        helm: { current: preset.helm, max: preset.helm },
        weapons: [],
        conditions: [],
        suggestedCrew: [],
        defaultCrewCount: 0,
      }
    },

    // ── Step 3 ──
    initials(name) {
      return name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    },

    facingArrow(facing) {
      return FACING_ARROWS[facing] ?? '→'
    },
    selectForPlacing(id) {
      this.placingId = id
    },

    rotatePlacing(dir) {
      const idx = (FACINGS.indexOf(this.currentFacing) + dir + 4) % 4
      const facing = FACINGS[idx]
      if (this.placingId && this.positions[this.placingId]) {
        this.$set(this.positions, this.placingId, {
          ...this.positions[this.placingId],
          facing,
        })
      } else {
        this.pendingFacing = facing
      }
    },

    placeShip(row, col) {
      if (!this.placingId) return
      this.$set(this.positions, this.placingId, {
        row,
        col,
        facing: this.currentFacing,
      })
      const unplaced = this.allSelectedShips.find(
        (s) => s.id !== this.placingId && !this.positions[s.id]
      )
      this.placingId = unplaced ? unplaced.id : null
    },

    // ── Step 4 ──
    crewSlotsFor(ship) {
      return (CONFIGS[ship.shipType] ?? CONFIGS['Sailing Ship']).crewSlots
    },

    availablePlayersFor(shipId, slotId) {
      // Collect players assigned to OTHER ships' slots
      const takenOnOthers = new Set()
      for (const [sid, slots] of Object.entries(this.crewAssignments)) {
        if (sid === shipId) continue
        for (const name of Object.values(slots)) {
          if (name) takenOnOthers.add(name)
        }
      }
      // The current value for this slot is always available (so the select renders it)
      const currentVal = this.crewAssignments[shipId]?.[slotId] ?? ''
      return this.selectedPlayers.filter(
        (p) => !takenOnOthers.has(p) || p === currentVal
      )
    },

    getCrewAssignment(shipId, slotId) {
      return this.crewAssignments[shipId]?.[slotId] ?? ''
    },

    setCrewAssignment(shipId, slotId, name) {
      if (!this.crewAssignments[shipId])
        this.$set(this.crewAssignments, shipId, {})
      if (name) {
        this.$set(this.crewAssignments[shipId], slotId, name)
      } else {
        this.$delete(this.crewAssignments[shipId], slotId)
      }
    },

    getCrewCount(shipId) {
      if (this.shipCrewCounts[shipId] !== undefined)
        return this.shipCrewCounts[shipId]
      return (
        this.allSelectedShips.find((s) => s.id === shipId)?.defaultCrewCount ??
        0
      )
    },

    setCrewCount(shipId, raw) {
      this.$set(
        this.shipCrewCounts,
        shipId,
        Math.max(0, parseInt(raw, 10) || 0)
      )
    },

    hasAnyCrew(shipId) {
      const slots = this.crewAssignments[shipId] ?? {}
      const npcs = this.shipNpcs[shipId] ?? []
      const count = this.getCrewCount(shipId)
      return Object.keys(slots).length > 0 || npcs.length > 0 || count > 0
    },

    getShipNpcs(shipId) {
      return this.shipNpcs[shipId] ?? []
    },

    isNpcAdded(shipId, name) {
      return (this.shipNpcs[shipId] ?? []).some((n) => n.name === name)
    },

    addSuggestedNpc(shipId, sc) {
      if (this.isNpcAdded(shipId, sc.name)) return
      if (!this.shipNpcs[shipId]) this.$set(this.shipNpcs, shipId, [])
      this.shipNpcs[shipId].push({
        id: 'npc_' + vcwSeq++,
        name: sc.name,
        role: sc.role ?? '',
        initMod: sc.initMod ?? 0,
      })
    },

    addNpc() {
      const name = this.npcName.trim()
      if (!name || !this.activeCrewShipId) return
      if (!this.shipNpcs[this.activeCrewShipId]) {
        this.$set(this.shipNpcs, this.activeCrewShipId, [])
      }
      this.shipNpcs[this.activeCrewShipId].push({
        id: 'npc_' + vcwSeq++,
        name,
        role: '',
        initMod: this.npcInitMod ?? 0,
      })
      this.npcName = ''
      this.npcInitMod = 0
    },

    removeNpc(shipId, npcId) {
      if (!this.shipNpcs[shipId]) return
      this.$set(
        this.shipNpcs,
        shipId,
        this.shipNpcs[shipId].filter((n) => n.id !== npcId)
      )
    },

    // ── Navigation ──
    advance() {
      if (this.step === 2) {
        const first = this.allSelectedShips[0]
        this.placingId = first ? first.id : null
      }
      if (this.step === 3) {
        // Seed crew counts from asset defaults
        for (const s of this.allSelectedShips) {
          if (this.shipCrewCounts[s.id] === undefined) {
            this.$set(this.shipCrewCounts, s.id, s.defaultCrewCount)
          }
        }
        const first = this.allSelectedShips[0]
        this.activeCrewShipId = first ? first.id : null
      }
      this.step++
    },

    cancel() {
      this.resetState()
      this.$store.commit('CLOSE_VEHICLE_WIZARD')
    },

    startCombat() {
      const ships = this.allSelectedShips.map((s) => {
        const namedNpcs = [...(this.shipNpcs[s.id] ?? [])]
        const crewCount = this.getCrewCount(s.id)
        const toGenerate = Math.max(0, crewCount - namedNpcs.length)
        const generatedNpcs = Array.from({ length: toGenerate }, () =>
          generateSailorNpc()
        )
        const allNpcs = [...namedNpcs, ...generatedNpcs]

        // Captain-tagged NPC goes first so it claims the helm
        const captainIdx = allNpcs.findIndex((n) => n.role === 'Captain')
        if (captainIdx > 0) allNpcs.unshift(allNpcs.splice(captainIdx, 1)[0])

        // Build an ordered list of open slots (helm first, then the rest in config order)
        const shipCfg = CONFIGS[s.shipType] ?? CONFIGS['Sailing Ship']
        const partyClaimed = new Set(
          Object.keys(this.crewAssignments[s.id] ?? {})
        )
        const openSlots = (shipCfg.crewSlots ?? []).filter(
          (sl) => !partyClaimed.has(sl.id)
        )
        const helmSlot = openSlots.find((sl) => sl.id === 'helm')
        const othersInOrder = openSlots.filter((sl) => sl.id !== 'helm')
        const assignQueue = helmSlot
          ? [helmSlot, ...othersInOrder]
          : othersInOrder

        const usedSlotIds = new Set()
        const npcsWithSlots = allNpcs.map((npc) => {
          let slotId = null
          if (npc.role === 'Captain' && helmSlot && !usedSlotIds.has('helm')) {
            slotId = 'helm'
          } else {
            const slot = assignQueue.find((sl) => !usedSlotIds.has(sl.id))
            if (slot) slotId = slot.id
          }
          if (slotId) usedSlotIds.add(slotId)
          return { ...npc, slotId }
        })

        return {
          ...s,
          position: this.positions[s.id] ?? null,
          facing: this.positions[s.id]?.facing ?? 'E',
          crewSlots: { ...(this.crewAssignments[s.id] ?? {}) },
          npcs: npcsWithSlots,
        }
      })
      this.$store.commit('START_VEHICLE_COMBAT', ships)
      this.resetState()
    },

    resetState() {
      this.step = 1
      this.selectedAssetIds = []
      this.assetRoles = {}
      this.customShips = []
      this.newName = ''
      this.placingId = null
      this.positions = {}
      this.pendingFacing = 'E'
      this.activeCrewShipId = null
      this.crewAssignments = {}
      this.shipNpcs = {}
      this.shipCrewCounts = {}
      this.npcName = ''
      this.npcInitMod = 0
    },
  },
}
</script>

<style scoped>
.vcw-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.vcw-modal {
  display: flex;
  flex-direction: column;
  width: min(900px, 96vw);
  max-height: 90vh;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

.vcw-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.vcw-title {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  letter-spacing: 0.04em;
  flex: 1;
}

.vcw-step-badge {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.vcw-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: color 0.1s;
}
.vcw-close:hover {
  color: var(--color-text-danger);
}

.vcw-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  min-height: 0;
}

.vcw-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
  gap: 1rem;
}

/* Step 1 */
.vcw-hint-text {
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  margin: 0 0 1.25rem;
}

.vcw-class-grid {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.vcw-class-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.25rem 1.5rem;
  border-radius: 8px;
  border: 2px solid var(--color-border);
  background: var(--color-bg-surface);
  cursor: default;
  min-width: 120px;
  position: relative;
}
.vcw-class-card--active {
  border-color: var(--color-accent);
  background: rgba(136, 136, 221, 0.08);
}
.vcw-class-card--soon {
  opacity: 0.35;
}
.vcw-class-icon {
  font-size: 2rem;
  line-height: 1;
}
.vcw-class-name {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}
.vcw-soon-badge {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-low);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.05rem 0.25rem;
}

/* Step 2 */
.vcw-roster-cols {
  display: flex;
  gap: 1.5rem;
}
.vcw-roster-left {
  flex: 1;
  min-width: 0;
  border-right: 1px solid var(--color-border);
  padding-right: 1.25rem;
}
.vcw-roster-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vcw-section-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
  margin-bottom: 0.6rem;
}

.vcw-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  font-style: italic;
}
.vcw-empty--sm {
  font-size: var(--font-size-xs);
}

.vcw-asset-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
}
.vcw-checkbox {
  flex-shrink: 0;
}
.vcw-asset-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  cursor: pointer;
}
.vcw-asset-name {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}
.vcw-asset-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.vcw-role-sel {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  padding: 0.2rem 0.3rem;
  flex-shrink: 0;
}
.vcw-role-placeholder {
  width: 5.5rem;
  flex-shrink: 0;
}

.vcw-add-form {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.vcw-inp {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  padding: 0.3rem 0.5rem;
  font-family: var(--font-body);
}
.vcw-inp:focus {
  outline: none;
  border-color: var(--color-accent);
}
.vcw-inp--wide {
  flex: 1;
}
.vcw-inp--mod {
  width: 4.5rem;
}

.vcw-sel {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  padding: 0.3rem 0.4rem;
}

.vcw-add-btn {
  padding: 0.3rem 0.75rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
  align-self: flex-start;
  white-space: nowrap;
}
.vcw-add-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.vcw-custom-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.vcw-custom-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border);
}
.vcw-role-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.vcw-role-dot--friendly {
  background: var(--color-accent);
}
.vcw-role-dot--neutral {
  background: var(--color-text-low);
}
.vcw-role-dot--enemy {
  background: var(--color-text-danger);
}
.vcw-custom-name {
  flex: 1;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vcw-custom-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.vcw-remove-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: 0 0.1rem;
  line-height: 1;
  transition: color 0.1s;
}
.vcw-remove-btn:hover {
  color: var(--color-text-danger);
}

.vcw-roster-summary {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  margin-top: auto;
}
.vcw-sum-chip {
  font-size: var(--font-size-xs);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.vcw-sum-chip--friendly {
  color: var(--color-accent);
}
.vcw-sum-chip--neutral {
  color: var(--color-text-low);
}
.vcw-sum-chip--enemy {
  color: var(--color-text-danger);
}

/* Step 3 */
.vcw-step3 {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.vcw-pos-layout {
  display: flex;
  gap: 1.25rem;
  flex: 1;
  min-height: 0;
}

.vcw-pos-sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  overflow-y: auto;
}

.vcw-pos-ship {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.vcw-pos-ship:hover {
  border-color: var(--color-accent);
}
.vcw-pos-ship--active {
  border-color: var(--color-accent);
  background: rgba(136, 136, 221, 0.08);
}
.vcw-pos-ship--placed {
  opacity: 0.7;
}

.vcw-pos-token {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: -0.03em;
}
.vcw-pos-token--sm {
  width: 22px;
  height: 22px;
  font-size: 0.55rem;
}
.vcw-pos-token--friendly {
  background: var(--color-accent);
  color: var(--color-bg);
}
.vcw-pos-token--neutral {
  background: var(--color-text-low);
  color: var(--color-bg);
}
.vcw-pos-token--enemy {
  background: var(--color-text-danger);
  color: white;
}

.vcw-pos-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}
.vcw-pos-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vcw-pos-status {
  font-size: 0.6rem;
  color: var(--color-text-low);
}
.vcw-pos-status--hint {
  color: var(--color-accent);
  font-style: italic;
}

.vcw-facing-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.4rem;
  border-top: 1px solid var(--color-border);
  margin-top: 0.25rem;
}
.vcw-facing-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}
.vcw-facing-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  width: 28px;
  height: 28px;
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vcw-facing-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.vcw-facing-val {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  color: var(--color-accent);
  width: 1.4rem;
  text-align: center;
}
.vcw-pos-footnote {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
  margin: 0.75rem 0 0;
  line-height: 1.5;
}

.vcw-grid-area {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
}
.vcw-grid {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(136, 136, 221, 0.25);
  border-radius: 3px;
  overflow: hidden;
  background: rgba(10, 15, 30, 0.5);
}
.vcw-grid-row {
  display: flex;
}
.vcw-cell {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(136, 136, 221, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
  flex-shrink: 0;
}
.vcw-cell--placing {
  cursor: crosshair;
}
.vcw-cell--placing:hover {
  background: rgba(136, 136, 221, 0.1);
}
.vcw-grid-token {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  letter-spacing: -0.02em;
  border: 2px solid transparent;
}
.vcw-grid-token--friendly {
  background: var(--color-accent);
  color: var(--color-bg);
}
.vcw-grid-token--neutral {
  background: var(--color-text-low);
  color: var(--color-bg);
}
.vcw-grid-token--enemy {
  background: var(--color-text-danger);
  color: white;
}
.vcw-grid-token--active {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}
.vcw-arr {
  font-size: 0.5rem;
  line-height: 1;
  display: block;
}

/* Step 4 */
.vcw-step4 {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.vcw-crew-layout {
  display: flex;
  gap: 1.25rem;
  flex: 1;
  min-height: 0;
  margin-top: 0.75rem;
}

.vcw-crew-ships {
  width: 190px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  overflow-y: auto;
  border-right: 1px solid var(--color-border);
  padding-right: 1rem;
}

.vcw-crew-ship-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.vcw-crew-ship-row:hover {
  border-color: var(--color-accent);
}
.vcw-crew-ship-row--active {
  border-color: var(--color-accent);
  background: rgba(136, 136, 221, 0.08);
}
.vcw-crew-ship-name {
  flex: 1;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vcw-crew-check {
  font-size: 0.65rem;
  color: var(--color-success);
  flex-shrink: 0;
}

.vcw-crew-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
}
.vcw-crew-panel--empty {
  align-items: center;
  justify-content: center;
}

.vcw-slot-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.25rem;
}
.vcw-slot-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border);
}
.vcw-slot-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  width: 7rem;
  flex-shrink: 0;
}
.vcw-slot-sel {
  flex: 1;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  padding: 0.25rem 0.4rem;
}

/* Crew count */
.vcw-crew-count-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.5rem;
}
.vcw-crew-count-lbl {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.vcw-crew-count-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}

/* Suggested crew */
.vcw-suggested {
  margin-bottom: 0.75rem;
}
.vcw-suggested-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-low);
  margin-bottom: 0.35rem;
}
.vcw-suggested-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.vcw-suggest-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}
.vcw-suggest-chip:hover:not(:disabled) {
  border-color: var(--color-accent);
  background: rgba(136, 136, 221, 0.06);
}
.vcw-suggest-chip--added {
  opacity: 0.4;
  cursor: default;
}
.vcw-suggest-chip:disabled {
  cursor: default;
}
.vcw-chip-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.vcw-chip-role {
  font-size: 0.6rem;
  color: var(--color-text-low);
}

/* NPCs */
.vcw-npc-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.vcw-npc-roster {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.vcw-npc-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border);
}
.vcw-npc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.vcw-npc-dot--friendly {
  background: var(--color-accent);
}
.vcw-npc-dot--neutral {
  background: var(--color-text-low);
}
.vcw-npc-dot--enemy {
  background: var(--color-text-danger);
}
.vcw-npc-name {
  flex: 1;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vcw-npc-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
}
.vcw-npc-mod {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex-shrink: 0;
}

/* Footer */
.vcw-back-btn {
  padding: 0.4rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.1s;
}
.vcw-back-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.vcw-next-btn {
  padding: 0.4rem 1.5rem;
  background: none;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.1s;
}
.vcw-next-btn:hover:not(:disabled) {
  background: rgba(136, 136, 221, 0.1);
}
.vcw-next-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.vcw-start-btn {
  padding: 0.4rem 1.75rem;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-bg);
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.1s;
  letter-spacing: 0.03em;
}
.vcw-start-btn:hover {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}
</style>
