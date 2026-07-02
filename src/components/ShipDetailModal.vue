<template>
  <div class="sdm-overlay" @click.self="$emit('close')">
    <div class="sdm-modal">
      <!-- Header -->
      <div class="sdm-header">
        <span class="sdm-team-dot" :class="'sdm-team-dot--' + ship.team"></span>
        <span class="sdm-name">{{ ship.name }}</span>
        <span class="sdm-type">{{ ship.shipType }}</span>
        <button class="sdm-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Body -->
      <div class="sdm-body">
        <!-- SVG diagram -->
        <div class="sdm-diagram-col">
          <svg
            :viewBox="L.viewBox"
            class="ship-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                :id="'planks-' + uid"
                x="0"
                y="0"
                width="200"
                height="13"
                patternUnits="userSpaceOnUse"
              >
                <rect width="200" height="7" fill="#352818" />
                <rect y="7" width="200" height="6" fill="#2a1f10" />
              </pattern>
              <clipPath :id="'deck-' + uid">
                <path :d="L.hullInner" />
              </clipPath>
              <radialGradient id="fire-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(255,100,0,0.4)" />
                <stop offset="100%" stop-color="rgba(255,60,0,0)" />
              </radialGradient>
              <radialGradient id="sink-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(30,80,200,0.35)" />
                <stop offset="100%" stop-color="rgba(30,80,200,0)" />
              </radialGradient>
            </defs>

            <!-- Bowsprit -->
            <line
              v-if="L.bowsprit"
              :x1="L.bowsprit.x1"
              :y1="L.bowsprit.y1"
              :x2="L.bowsprit.x2"
              :y2="L.bowsprit.y2"
              stroke="#4a3010"
              stroke-width="5"
              stroke-linecap="round"
            />
            <line
              v-if="L.bowsprit"
              :x1="L.cx - 6"
              :y1="L.bowsprit.y1 + 4"
              :x2="L.bowsprit.x2"
              :y2="L.bowsprit.y2"
              stroke="#3a4a60"
              stroke-width="0.8"
              opacity="0.6"
            />
            <line
              v-if="L.bowsprit"
              :x1="L.cx + 6"
              :y1="L.bowsprit.y1 + 4"
              :x2="L.bowsprit.x2"
              :y2="L.bowsprit.y2"
              stroke="#3a4a60"
              stroke-width="0.8"
              opacity="0.6"
            />

            <!-- Hull exterior -->
            <path
              :d="L.hullOuter"
              fill="#100c06"
              :stroke="teamBorderColor"
              stroke-width="2.5"
            />

            <!-- Deck planking (clipped to inner hull) -->
            <rect
              x="-50"
              y="-50"
              :width="L.vbW + 100"
              :height="L.vbH + 100"
              :fill="'url(#planks-' + uid + ')'"
              :clip-path="'url(#deck-' + uid + ')'"
            />

            <!-- Hull inner border (rail) -->
            <path
              :d="L.hullInner"
              fill="none"
              stroke="#3a2810"
              stroke-width="1.5"
              opacity="0.8"
            />

            <!-- Gangway centerline -->
            <line
              :x1="L.cx"
              :y1="L.vbH * 0.1"
              :x2="L.cx"
              :y2="L.vbH * 0.9"
              stroke="rgba(70,50,25,0.45)"
              stroke-width="1"
              stroke-dasharray="7 4"
            />

            <!-- P / S labels -->
            <text
              :x="L.cx - L.vbW * 0.3"
              :y="L.vbH * 0.55"
              fill="rgba(80,100,140,0.55)"
              font-size="8"
              text-anchor="middle"
              font-family="serif"
              letter-spacing="1"
            >
              P
            </text>
            <text
              :x="L.cx + L.vbW * 0.3"
              :y="L.vbH * 0.55"
              fill="rgba(80,100,140,0.55)"
              font-size="8"
              text-anchor="middle"
              font-family="serif"
              letter-spacing="1"
            >
              S
            </text>

            <!-- Shroud lines (rigging) -->
            <line
              v-for="(s, i) in L.shrouds"
              :key="'sr' + i"
              :x1="s.x1"
              :y1="s.y1"
              :x2="s.x2"
              :y2="s.y2"
              stroke="rgba(60,85,120,0.45)"
              stroke-width="0.8"
            />

            <!-- Ram (galley) -->
            <line
              v-if="L.ram"
              :x1="L.cx"
              :y1="L.vbH * 0.02"
              :x2="L.cx"
              :y2="L.vbH * -0.04"
              stroke="#4a3010"
              stroke-width="7"
              stroke-linecap="round"
            />

            <!-- Masts -->
            <g v-for="m in L.masts" :key="m.id">
              <circle
                :cx="m.cx"
                :cy="m.cy"
                :r="m.r"
                fill="#0e0e1e"
                stroke="#3a5080"
                stroke-width="1.5"
              />
              <circle :cx="m.cx" :cy="m.cy" :r="m.r * 0.38" fill="#283050" />
              <text
                :x="m.cx"
                :y="m.cy"
                fill="rgba(100,130,170,0.7)"
                font-size="6"
                text-anchor="middle"
                dominant-baseline="central"
                font-family="serif"
              >
                {{ m.sym }}
              </text>
            </g>

            <!-- Oar positions (galley) -->
            <g v-for="(o, i) in L.oarPorts || []" :key="'op' + i">
              <rect
                :x="o.x - 8"
                :y="o.y - 3"
                width="8"
                height="6"
                rx="1"
                fill="#1c1208"
                stroke="#3a2810"
                stroke-width="1"
              />
            </g>

            <!-- Weapon mounts -->
            <g
              v-for="ws in L.weaponSlots"
              :key="ws.id"
              :transform="'translate(' + ws.cx + ',' + ws.cy + ')'"
            >
              <!-- Port (pointing left) -->
              <g v-if="ws.side === 'port'">
                <rect
                  x="-22"
                  y="-7"
                  width="20"
                  height="14"
                  rx="2"
                  fill="#251408"
                  stroke="#6a3808"
                  stroke-width="1.5"
                />
                <line
                  x1="-24"
                  y1="0"
                  x2="-12"
                  y2="0"
                  stroke="#8a4808"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <line
                  x1="-16"
                  y1="-6"
                  x2="-16"
                  y2="6"
                  stroke="#6a3808"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </g>
              <!-- Starboard (pointing right) -->
              <g v-if="ws.side === 'starboard'">
                <rect
                  x="2"
                  y="-7"
                  width="20"
                  height="14"
                  rx="2"
                  fill="#251408"
                  stroke="#6a3808"
                  stroke-width="1.5"
                />
                <line
                  x1="12"
                  y1="0"
                  x2="24"
                  y2="0"
                  stroke="#8a4808"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <line
                  x1="16"
                  y1="-6"
                  x2="16"
                  y2="6"
                  stroke="#6a3808"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </g>
              <!-- Fore (pointing up/bow) -->
              <g v-if="ws.side === 'fore'">
                <rect
                  x="-7"
                  y="-20"
                  width="14"
                  height="18"
                  rx="2"
                  fill="#251408"
                  stroke="#6a3808"
                  stroke-width="1.5"
                />
                <line
                  x1="0"
                  y1="-22"
                  x2="0"
                  y2="-12"
                  stroke="#8a4808"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <line
                  x1="-6"
                  y1="-16"
                  x2="6"
                  y2="-16"
                  stroke="#6a3808"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </g>
              <!-- Weapon label -->
              <text
                :x="ws.side === 'port' ? -28 : ws.side === 'starboard' ? 28 : 0"
                :y="ws.side === 'fore' ? -26 : 0"
                :text-anchor="
                  ws.side === 'port'
                    ? 'end'
                    : ws.side === 'starboard'
                    ? 'start'
                    : 'middle'
                "
                :dominant-baseline="ws.side === 'fore' ? 'auto' : 'central'"
                fill="rgba(120,85,40,0.8)"
                font-size="5.5"
                font-family="serif"
              >
                {{ ws.label }}
              </text>
            </g>

            <!-- Stern railing -->
            <line
              v-if="L.stern"
              :x1="L.stern.x1"
              :y1="L.stern.y1"
              :x2="L.stern.x2"
              :y2="L.stern.y2"
              stroke="#3a2810"
              stroke-width="3"
              stroke-linecap="round"
            />

            <!-- Helm wheel -->
            <g v-if="L.helm">
              <circle
                :cx="L.helm.cx"
                :cy="L.helm.cy"
                :r="L.helm.r"
                fill="none"
                stroke="#7a4510"
                stroke-width="2"
              />
              <line
                v-for="a in helmAngles"
                :key="a"
                :x1="L.helm.cx + Math.cos(a) * (L.helm.r - 2)"
                :y1="L.helm.cy + Math.sin(a) * (L.helm.r - 2)"
                :x2="L.helm.cx + Math.cos(a) * (L.helm.r + 4)"
                :y2="L.helm.cy + Math.sin(a) * (L.helm.r + 4)"
                stroke="#7a4510"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <circle :cx="L.helm.cx" :cy="L.helm.cy" r="2.5" fill="#7a4510" />
            </g>

            <!-- Condition overlays -->
            <ellipse
              v-if="isOnFire"
              :cx="L.cx"
              :cy="L.vbH * 0.5"
              :rx="L.vbW * 0.45"
              :ry="L.vbH * 0.45"
              fill="url(#fire-glow)"
              opacity="0.9"
            />
            <ellipse
              v-if="isSinking"
              :cx="L.cx"
              :cy="L.vbH * 0.5"
              :rx="L.vbW * 0.45"
              :ry="L.vbH * 0.45"
              fill="url(#sink-glow)"
              opacity="0.9"
            />

            <!-- Crew slots -->
            <g
              v-for="slot in L.crewSlots"
              :key="slot.id"
              class="crew-slot-g"
              :class="{ 'crew-slot-g--active': activeSlotId === slot.id }"
              @click="selectSlot(slot.id)"
            >
              <circle
                :cx="slot.cx"
                :cy="slot.cy"
                r="11"
                :fill="slotCircleFill(slot.id)"
                :stroke="slotCircleStroke(slot.id, activeSlotId === slot.id)"
                :stroke-dasharray="slotOccupant(slot.id) ? 'none' : '4 2'"
                stroke-width="1.5"
              />
              <text
                v-if="slotOccupant(slot.id)"
                :x="slot.cx"
                :y="slot.cy"
                fill="white"
                font-size="7"
                font-weight="bold"
                text-anchor="middle"
                dominant-baseline="central"
                font-family="sans-serif"
              >
                {{ initials(slotOccupant(slot.id)) }}
              </text>
              <title>
                {{ slot.label
                }}{{
                  slotOccupant(slot.id) ? ' — ' + slotOccupant(slot.id) : ''
                }}
              </title>
            </g>

            <!-- BOW / STERN labels -->
            <text
              :x="L.cx"
              :y="L.vbH * 0.04"
              fill="rgba(80,100,140,0.5)"
              font-size="6.5"
              text-anchor="middle"
              font-family="serif"
              letter-spacing="1.5"
            >
              BOW
            </text>
            <text
              :x="L.cx"
              :y="L.vbH * 0.97"
              fill="rgba(80,100,140,0.5)"
              font-size="6.5"
              text-anchor="middle"
              font-family="serif"
              letter-spacing="1"
            >
              STERN
            </text>
          </svg>
        </div>

        <!-- Sidebar -->
        <div class="sdm-sidebar">
          <!-- Slot picker -->
          <div v-if="activeSlotId" class="sdm-picker">
            <div class="sdm-picker-label">
              Assign to <strong>{{ activeSlotLabel }}</strong>
            </div>
            <div class="sdm-picker-list">
              <button
                v-for="person in availablePeople"
                :key="person"
                class="sdm-pick-btn"
                :class="{
                  'sdm-pick-btn--current': assignments[activeSlotId] === person,
                }"
                :style="{ borderColor: personColor(person) }"
                @click="assignPerson(person)"
              >
                <span
                  class="sdm-pick-swatch"
                  :style="{ background: personColor(person) }"
                  >{{ initials(person) }}</span
                >
                {{ person }}
              </button>
              <button
                v-if="assignments[activeSlotId]"
                class="sdm-pick-btn sdm-pick-btn--clear"
                @click="clearSlot"
              >
                — Remove
              </button>
            </div>
            <button class="sdm-picker-cancel" @click="activeSlotId = null">
              Cancel
            </button>
          </div>

          <!-- Crew manifest -->
          <div v-else class="sdm-manifest">
            <div class="sdm-section-label">Crew Positions</div>
            <div
              v-for="slot in L.crewSlots"
              :key="slot.id"
              class="sdm-manifest-row"
              :class="{ 'sdm-manifest-row--active': activeSlotId === slot.id }"
              @click="selectSlot(slot.id)"
            >
              <span
                class="sdm-manifest-swatch"
                :style="{
                  background: slotOccupant(slot.id)
                    ? slotCircleFill(slot.id)
                    : 'transparent',
                  borderColor: slotOccupant(slot.id)
                    ? slotCircleFill(slot.id)
                    : 'rgba(80,150,200,0.5)',
                }"
              >
                {{
                  slotOccupant(slot.id) ? initials(slotOccupant(slot.id)) : ''
                }}
              </span>
              <span class="sdm-manifest-slot">{{ slot.label }}</span>
              <span class="sdm-manifest-person">{{
                slotOccupant(slot.id) || '—'
              }}</span>
            </div>

            <!-- Weapon positions -->
            <div class="sdm-section-label" style="margin-top: 1rem">
              Weapon Positions
            </div>
            <div v-for="ws in L.weaponSlots" :key="ws.id" class="sdm-wpn-row">
              <span class="sdm-wpn-icon">⊕</span>
              <span class="sdm-wpn-label">{{ ws.label }}</span>
              <span class="sdm-wpn-name">{{ weaponAt(ws.id) }}</span>
            </div>
            <div v-if="L.weaponSlots.length === 0" class="sdm-empty">
              No weapon mounts.
            </div>

            <!-- HP summary -->
            <div class="sdm-section-label" style="margin-top: 1rem">Status</div>
            <div v-for="comp in hpComps" :key="comp.key" class="sdm-hp-row">
              <span class="sdm-hp-label">{{ comp.label }}</span>
              <div class="sdm-hp-bar">
                <div
                  class="sdm-hp-fill"
                  :class="hpClass(comp.pct)"
                  :style="{ width: comp.pct + '%' }"
                ></div>
              </div>
              <span class="sdm-hp-num">{{ comp.cur }}/{{ comp.max }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const PERSON_COLORS = [
  '#7a78d0',
  '#d07a78',
  '#78d094',
  '#d0b878',
  '#78c8d0',
  '#d078bc',
  '#a0d078',
  '#9878d0',
]

const SAILING_SHIP = {
  viewBox: '0 0 200 340',
  cx: 100,
  vbW: 200,
  vbH: 340,
  hullOuter:
    'M 100 14 C 142 28 157 75 157 128 L 157 225 C 157 275 142 308 134 308 L 66 308 C 58 308 43 275 43 225 L 43 128 C 43 75 58 28 100 14 Z',
  hullInner:
    'M 100 21 C 136 33 150 78 150 128 L 150 225 C 150 268 136 302 128 302 L 72 302 C 64 302 50 268 50 225 L 50 128 C 50 78 64 33 100 21 Z',
  bowsprit: { x1: 100, y1: 14, x2: 100, y2: -16 },
  stern: { x1: 66, y1: 308, x2: 134, y2: 308 },
  helm: { cx: 100, cy: 272, r: 11 },
  masts: [
    { id: 'fore', cx: 100, cy: 82, r: 12, sym: 'F' },
    { id: 'main', cx: 100, cy: 152, r: 15, sym: 'M' },
    { id: 'mizz', cx: 100, cy: 212, r: 10, sym: 'Z' },
  ],
  shrouds: [
    { x1: 100, y1: 82, x2: 50, y2: 66 },
    { x1: 100, y1: 82, x2: 50, y2: 98 },
    { x1: 100, y1: 82, x2: 150, y2: 66 },
    { x1: 100, y1: 82, x2: 150, y2: 98 },
    { x1: 100, y1: 152, x2: 50, y2: 135 },
    { x1: 100, y1: 152, x2: 50, y2: 170 },
    { x1: 100, y1: 152, x2: 150, y2: 135 },
    { x1: 100, y1: 152, x2: 150, y2: 170 },
    { x1: 100, y1: 212, x2: 50, y2: 198 },
    { x1: 100, y1: 212, x2: 50, y2: 226 },
    { x1: 100, y1: 212, x2: 150, y2: 198 },
    { x1: 100, y1: 212, x2: 150, y2: 226 },
  ],
  weaponSlots: [
    { id: 'pf', cx: 43, cy: 108, side: 'port', label: 'Port Fore' },
    { id: 'pa', cx: 43, cy: 192, side: 'port', label: 'Port Aft' },
    { id: 'sf', cx: 157, cy: 108, side: 'starboard', label: 'Stbd Fore' },
    { id: 'sa', cx: 157, cy: 192, side: 'starboard', label: 'Stbd Aft' },
    { id: 'bc', cx: 100, cy: 26, side: 'fore', label: 'Bow Chaser' },
  ],
  crewSlots: [
    { id: 'bow', cx: 100, cy: 40, label: 'Bow Watch' },
    { id: 'fp', cx: 74, cy: 90, label: 'Fore Port' },
    { id: 'fs', cx: 126, cy: 90, label: 'Fore Stbd' },
    { id: 'mp', cx: 62, cy: 158, label: 'Amid Port' },
    { id: 'ms', cx: 138, cy: 158, label: 'Amid Stbd' },
    { id: 'ap', cx: 64, cy: 218, label: 'Aft Port' },
    { id: 'as', cx: 136, cy: 218, label: 'Aft Stbd' },
    { id: 'helm', cx: 100, cy: 272, label: 'Helm' },
  ],
}

const WARSHIP = {
  ...SAILING_SHIP,
  viewBox: '0 0 220 360',
  cx: 110,
  vbW: 220,
  vbH: 360,
  hullOuter:
    'M 110 14 C 158 30 175 82 175 138 L 175 240 C 175 294 156 332 148 332 L 72 332 C 64 332 45 294 45 240 L 45 138 C 45 82 62 30 110 14 Z',
  hullInner:
    'M 110 22 C 152 36 168 86 168 138 L 168 240 C 168 286 152 325 144 325 L 76 325 C 68 325 52 286 52 240 L 52 138 C 52 86 68 36 110 22 Z',
  bowsprit: { x1: 110, y1: 14, x2: 110, y2: -18 },
  stern: { x1: 72, y1: 332, x2: 148, y2: 332 },
  helm: { cx: 110, cy: 290, r: 12 },
  masts: [
    { id: 'fore', cx: 110, cy: 88, r: 14, sym: 'F' },
    { id: 'main', cx: 110, cy: 165, r: 17, sym: 'M' },
    { id: 'mizz', cx: 110, cy: 228, r: 11, sym: 'Z' },
  ],
  shrouds: [
    { x1: 110, y1: 88, x2: 52, y2: 70 },
    { x1: 110, y1: 88, x2: 52, y2: 106 },
    { x1: 110, y1: 88, x2: 168, y2: 70 },
    { x1: 110, y1: 88, x2: 168, y2: 106 },
    { x1: 110, y1: 165, x2: 52, y2: 148 },
    { x1: 110, y1: 165, x2: 52, y2: 182 },
    { x1: 110, y1: 165, x2: 168, y2: 148 },
    { x1: 110, y1: 165, x2: 168, y2: 182 },
    { x1: 110, y1: 228, x2: 52, y2: 214 },
    { x1: 110, y1: 228, x2: 52, y2: 242 },
    { x1: 110, y1: 228, x2: 168, y2: 214 },
    { x1: 110, y1: 228, x2: 168, y2: 242 },
  ],
  weaponSlots: [
    { id: 'pf', cx: 45, cy: 112, side: 'port', label: 'Port Fore' },
    { id: 'pm', cx: 45, cy: 175, side: 'port', label: 'Port Mid' },
    { id: 'pa', cx: 45, cy: 220, side: 'port', label: 'Port Aft' },
    { id: 'sf', cx: 175, cy: 112, side: 'starboard', label: 'Stbd Fore' },
    { id: 'sm', cx: 175, cy: 175, side: 'starboard', label: 'Stbd Mid' },
    { id: 'sa', cx: 175, cy: 220, side: 'starboard', label: 'Stbd Aft' },
    { id: 'bc', cx: 110, cy: 28, side: 'fore', label: 'Bow Chaser' },
  ],
  crewSlots: [
    { id: 'bow', cx: 110, cy: 42, label: 'Bow Watch' },
    { id: 'fp', cx: 80, cy: 96, label: 'Fore Port' },
    { id: 'fs', cx: 140, cy: 96, label: 'Fore Stbd' },
    { id: 'mp1', cx: 68, cy: 148, label: 'Mid Port' },
    { id: 'ms1', cx: 152, cy: 148, label: 'Mid Stbd' },
    { id: 'mp2', cx: 68, cy: 198, label: 'Aft-Mid Port' },
    { id: 'ms2', cx: 152, cy: 198, label: 'Aft-Mid Stbd' },
    { id: 'ap', cx: 70, cy: 238, label: 'Aft Port' },
    { id: 'as', cx: 150, cy: 238, label: 'Aft Stbd' },
    { id: 'helm', cx: 110, cy: 290, label: 'Helm' },
  ],
}

const GALLEY = {
  viewBox: '0 0 170 390',
  cx: 85,
  vbW: 170,
  vbH: 390,
  hullOuter:
    'M 85 18 C 112 32 125 78 125 138 L 125 300 C 125 350 110 369 106 369 L 64 369 C 60 369 45 350 45 300 L 45 138 C 45 78 58 32 85 18 Z',
  hullInner:
    'M 85 25 C 108 38 118 80 118 138 L 118 300 C 118 344 106 362 102 362 L 68 362 C 64 362 52 344 52 300 L 52 138 C 52 80 62 38 85 25 Z',
  bowsprit: null,
  ram: true,
  stern: { x1: 64, y1: 369, x2: 106, y2: 369 },
  helm: { cx: 85, cy: 334, r: 10 },
  masts: [
    { id: 'fore', cx: 85, cy: 100, r: 12, sym: 'F' },
    { id: 'main', cx: 85, cy: 200, r: 14, sym: 'M' },
  ],
  shrouds: [
    { x1: 85, y1: 100, x2: 45, y2: 84 },
    { x1: 85, y1: 100, x2: 45, y2: 116 },
    { x1: 85, y1: 100, x2: 125, y2: 84 },
    { x1: 85, y1: 100, x2: 125, y2: 116 },
    { x1: 85, y1: 200, x2: 45, y2: 185 },
    { x1: 85, y1: 200, x2: 45, y2: 215 },
    { x1: 85, y1: 200, x2: 125, y2: 185 },
    { x1: 85, y1: 200, x2: 125, y2: 215 },
  ],
  weaponSlots: [
    { id: 'pa', cx: 45, cy: 268, side: 'port', label: 'Port Aft' },
    { id: 'sa', cx: 125, cy: 268, side: 'starboard', label: 'Stbd Aft' },
  ],
  oarPorts: [
    { x: 45, y: 148 },
    { x: 45, y: 168 },
    { x: 45, y: 188 },
    { x: 45, y: 208 },
    { x: 45, y: 228 },
    { x: 45, y: 248 },
    { x: 125, y: 148 },
    { x: 125, y: 168 },
    { x: 125, y: 188 },
    { x: 125, y: 208 },
    { x: 125, y: 228 },
    { x: 125, y: 248 },
  ],
  crewSlots: [
    { id: 'bow', cx: 85, cy: 42, label: 'Bow' },
    { id: 'fp', cx: 66, cy: 108, label: 'Fore Port' },
    { id: 'fs', cx: 104, cy: 108, label: 'Fore Stbd' },
    { id: 'mp', cx: 62, cy: 205, label: 'Mid Port' },
    { id: 'ms', cx: 108, cy: 205, label: 'Mid Stbd' },
    { id: 'ap', cx: 62, cy: 270, label: 'Aft Port' },
    { id: 'as', cx: 108, cy: 270, label: 'Aft Stbd' },
    { id: 'helm', cx: 85, cy: 334, label: 'Helm' },
  ],
}

const KEELBOAT = {
  viewBox: '0 0 160 285',
  cx: 80,
  vbW: 160,
  vbH: 285,
  hullOuter:
    'M 80 12 C 112 24 126 65 126 115 L 126 208 C 126 252 112 274 106 274 L 54 274 C 48 274 34 252 34 208 L 34 115 C 34 65 48 24 80 12 Z',
  hullInner:
    'M 80 19 C 108 30 119 68 119 115 L 119 208 C 119 245 108 267 100 267 L 60 267 C 52 267 41 245 41 208 L 41 115 C 41 68 52 30 80 19 Z',
  bowsprit: { x1: 80, y1: 12, x2: 80, y2: -10 },
  stern: { x1: 54, y1: 274, x2: 106, y2: 274 },
  helm: { cx: 80, cy: 242, r: 10 },
  masts: [{ id: 'main', cx: 80, cy: 140, r: 13, sym: 'M' }],
  shrouds: [
    { x1: 80, y1: 140, x2: 34, y2: 122 },
    { x1: 80, y1: 140, x2: 34, y2: 158 },
    { x1: 80, y1: 140, x2: 126, y2: 122 },
    { x1: 80, y1: 140, x2: 126, y2: 158 },
  ],
  weaponSlots: [
    { id: 'p', cx: 34, cy: 140, side: 'port', label: 'Port' },
    { id: 's', cx: 126, cy: 140, side: 'starboard', label: 'Stbd' },
  ],
  crewSlots: [
    { id: 'bow', cx: 80, cy: 42, label: 'Bow' },
    { id: 'port', cx: 54, cy: 145, label: 'Port' },
    { id: 'stbd', cx: 106, cy: 145, label: 'Stbd' },
    { id: 'helm', cx: 80, cy: 242, label: 'Helm' },
  ],
}

const ROWBOAT = {
  viewBox: '0 0 130 235',
  cx: 65,
  vbW: 130,
  vbH: 235,
  hullOuter:
    'M 65 10 C 90 20 102 55 102 100 L 102 172 C 102 207 90 221 84 221 L 46 221 C 40 221 28 207 28 172 L 28 100 C 28 55 40 20 65 10 Z',
  hullInner:
    'M 65 17 C 86 26 95 58 95 100 L 95 172 C 95 200 86 214 80 214 L 50 214 C 44 214 35 200 35 172 L 35 100 C 35 58 44 26 65 17 Z',
  bowsprit: null,
  stern: { x1: 46, y1: 221, x2: 84, y2: 221 },
  helm: null,
  masts: [],
  shrouds: [],
  weaponSlots: [],
  crewSlots: [
    { id: 'bow', cx: 65, cy: 38, label: 'Bow' },
    { id: 'rp1', cx: 44, cy: 112, label: 'Row Port' },
    { id: 'rs1', cx: 86, cy: 112, label: 'Row Stbd' },
    { id: 'rp2', cx: 44, cy: 150, label: 'Row Port' },
    { id: 'rs2', cx: 86, cy: 150, label: 'Row Stbd' },
    { id: 'stern', cx: 65, cy: 196, label: 'Stern' },
  ],
}

const CONFIGS = {
  'Sailing Ship': SAILING_SHIP,
  Warship: WARSHIP,
  Galley: GALLEY,
  Keelboat: KEELBOAT,
  Rowboat: ROWBOAT,
}

const HP_COMPS = [
  { key: 'hull', label: 'Hull' },
  { key: 'sails', label: 'Sails' },
  { key: 'helm', label: 'Helm' },
]

let uidSeq = 0

export default {
  name: 'ShipDetailModal',
  props: { ship: { type: Object, required: true } },
  emits: ['close'],

  data() {
    return {
      activeSlotId: null,
      assignments: {},
      uid: 'sdm' + uidSeq++,
    }
  },

  created() {
    this.assignments = { ...(this.ship.crewSlots ?? {}) }
  },

  computed: {
    L() {
      return CONFIGS[this.ship.shipType] ?? SAILING_SHIP
    },

    availablePeople() {
      return this.$store.state.selectedPlayers ?? []
    },

    helmAngles() {
      return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4)
    },

    activeSlotLabel() {
      return (
        this.L.crewSlots.find((s) => s.id === this.activeSlotId)?.label ?? ''
      )
    },

    teamBorderColor() {
      return (
        { friendly: '#8888dd', neutral: '#777777', enemy: '#cc4444' }[
          this.ship.team
        ] ?? '#8888dd'
      )
    },

    isOnFire() {
      return (this.ship.conditions ?? []).includes('on_fire')
    },
    isSinking() {
      return (this.ship.conditions ?? []).includes('sinking')
    },

    hpComps() {
      return HP_COMPS.filter((c) => this.ship[c.key]?.max > 0).map((c) => {
        const { current: cur, max } = this.ship[c.key]
        const pct = max > 0 ? Math.round((cur / max) * 100) : 0
        return { ...c, cur, max, pct }
      })
    },
  },

  methods: {
    npcAtSlot(slotId) {
      return (this.ship.npcs ?? []).find((n) => n.slotId === slotId) ?? null
    },

    slotOccupant(slotId) {
      return this.assignments[slotId] ?? this.npcAtSlot(slotId)?.name ?? null
    },

    slotIsNpc(slotId) {
      return !this.assignments[slotId] && !!this.npcAtSlot(slotId)
    },

    slotCircleFill(slotId) {
      const occ = this.slotOccupant(slotId)
      if (!occ) return 'rgba(20,35,60,0.55)'
      return this.slotIsNpc(slotId)
        ? 'rgba(180,130,50,0.85)'
        : this.personColor(occ)
    },

    slotCircleStroke(slotId, isActive) {
      if (isActive) return '#ffffff'
      const occ = this.slotOccupant(slotId)
      if (!occ) return 'rgba(80,150,200,0.65)'
      return this.slotIsNpc(slotId)
        ? 'rgba(255,210,90,0.6)'
        : 'rgba(255,255,255,0.5)'
    },

    personColor(name) {
      const idx = (this.$store.state.selectedPlayers ?? []).indexOf(name)
      return PERSON_COLORS[(idx < 0 ? 0 : idx) % PERSON_COLORS.length]
    },

    initials(name) {
      return name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    },

    selectSlot(id) {
      this.activeSlotId = this.activeSlotId === id ? null : id
    },

    assignPerson(name) {
      this.$set(this.assignments, this.activeSlotId, name)
      this.activeSlotId = null
      this.save()
    },

    clearSlot() {
      this.$delete(this.assignments, this.activeSlotId)
      this.activeSlotId = null
      this.save()
    },

    save() {
      this.$store.commit('PATCH_VEHICLE_SHIP', {
        id: this.ship.id,
        crewSlots: { ...this.assignments },
      })
    },

    weaponAt(slotId) {
      const weapons = this.ship.weapons ?? []
      const slotMap = {
        pf: 'Port Fore',
        pa: 'Port Aft',
        sf: 'Stbd Fore',
        sa: 'Stbd Aft',
        bc: 'Bow Chaser',
        pm: 'Port Mid',
        sm: 'Stbd Mid',
        p: 'Port',
        s: 'Stbd',
      }
      const label = slotMap[slotId] ?? slotId
      const wpn = weapons.find(
        (w) => w.position === slotId || w.name?.includes(label)
      )
      return wpn ? wpn.name : '—'
    },

    hpClass(pct) {
      if (pct <= 0) return 'sdm-hp-fill--zero'
      if (pct <= 25) return 'sdm-hp-fill--crit'
      if (pct <= 50) return 'sdm-hp-fill--low'
      return 'sdm-hp-fill--good'
    },
  },
}
</script>

<style scoped>
.sdm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
}

.sdm-modal {
  display: flex;
  flex-direction: column;
  width: min(880px, 96vw);
  max-height: 90vh;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.6);
}

.sdm-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  background: var(--color-bg-panel-dark);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sdm-team-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sdm-team-dot--friendly {
  background: var(--color-accent);
}
.sdm-team-dot--neutral {
  background: var(--color-text-low);
}
.sdm-team-dot--enemy {
  background: var(--color-text-danger);
}

.sdm-name {
  font-family: var(--font-display, serif);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  flex: 1;
}

.sdm-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sdm-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  font-size: var(--font-size-md);
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
  transition: color 0.1s;
}
.sdm-close:hover {
  color: var(--color-text-danger);
}

.sdm-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Diagram column */
.sdm-diagram-col {
  flex: 0 0 320px;
  background: #0a0e18;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
}

.ship-svg {
  max-width: 100%;
  max-height: calc(90vh - 80px);
  height: auto;
  cursor: default;
}

.crew-slot-g {
  cursor: pointer;
  transition: opacity 0.1s;
}
.crew-slot-g:hover circle {
  opacity: 0.85;
}
.crew-slot-g--active circle {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
}

/* Sidebar */
.sdm-sidebar {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sdm-section-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
  margin-bottom: 0.5rem;
}

/* Manifest */
.sdm-manifest-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.1s;
  margin-bottom: 0.2rem;
}
.sdm-manifest-row:hover {
  background: var(--color-bg-surface);
}
.sdm-manifest-row--active {
  background: var(--color-bg-surface);
  border-color: var(--color-accent);
}

.sdm-manifest-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  border: 1.5px solid;
}

.sdm-manifest-slot {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex: 1;
}

.sdm-manifest-person {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Weapon rows */
.sdm-wpn-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border);
}

.sdm-wpn-icon {
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
}
.sdm-wpn-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  flex: 1;
}
.sdm-wpn-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* HP rows */
.sdm-hp-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0;
}

.sdm-hp-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  width: 3rem;
  flex-shrink: 0;
}

.sdm-hp-bar {
  flex: 1;
  height: 6px;
  background: var(--color-bg-surface);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.sdm-hp-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.2s;
}
.sdm-hp-fill--good {
  background: var(--color-success);
}
.sdm-hp-fill--low {
  background: var(--color-neutral-amber);
}
.sdm-hp-fill--crit {
  background: var(--color-text-danger);
}
.sdm-hp-fill--zero {
  background: var(--color-bg-panel);
}

.sdm-hp-num {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
  min-width: 3.5rem;
  text-align: right;
}

/* Slot picker */
.sdm-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sdm-picker-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sdm-picker-label strong {
  color: var(--color-accent);
  text-transform: none;
  font-size: var(--font-size-md);
  letter-spacing: 0;
}

.sdm-picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sdm-pick-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-body);
  cursor: pointer;
  transition: background 0.1s;
  text-align: left;
}
.sdm-pick-btn:hover {
  background: var(--color-bg-surface-alt);
}
.sdm-pick-btn--current {
  background: var(--color-bg-surface-alt);
}
.sdm-pick-btn--clear {
  color: var(--color-text-danger);
  border-color: transparent;
}

.sdm-pick-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.sdm-picker-cancel {
  padding: 0.3rem 0.75rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-xs);
  cursor: pointer;
  align-self: flex-start;
  transition: border-color 0.1s, color 0.1s;
}
.sdm-picker-cancel:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.sdm-empty {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  font-style: italic;
}
</style>
