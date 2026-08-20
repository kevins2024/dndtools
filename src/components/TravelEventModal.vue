<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel">
      <div class="modal-header">
        <span class="modal-title">Travel Event</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- ══ STEP: Config ══════════════════════════ -->
      <template v-if="step === 'config'">
        <div class="travel-body">
          <div class="travel-section">
            <div class="travel-label">Continent</div>
            <div class="travel-chips">
              <span
                v-for="c in CONTINENTS"
                :key="c.id"
                class="travel-chip"
                :class="{ active: continent === c.id }"
                :title="c.blurb"
                @click="selectContinent(c.id)"
                >{{ c.label }}</span
              >
            </div>
          </div>

          <div class="travel-section">
            <div class="travel-label">Terrain</div>
            <div class="travel-chips">
              <span
                v-for="t in TERRAINS"
                :key="t.id"
                class="travel-chip"
                :class="{ active: terrain === t.id }"
                @click="selectTerrain(t.id)"
                >{{ t.label }}</span
              >
            </div>
          </div>

          <div class="travel-section">
            <div class="travel-label">Do you know where you're going?</div>
            <div class="travel-chips">
              <span
                v-for="opt in KNOWS_WAY_OPTIONS"
                :key="opt.id"
                class="travel-chip"
                :class="{ active: knowsWay === opt.id }"
                :title="opt.blurb"
                @click="setKnowsWay(opt.id)"
                >{{ opt.label }}</span
              >
            </div>
            <div class="travel-hint">{{ currentKnowsWayBlurb }}</div>
          </div>

          <div v-if="leadTracker()" class="travel-tracker-note">
            Tracker: <strong>{{ leadTracker().name }}</strong> (Survival
            {{ signedMod }})
          </div>
          <div v-else class="travel-tracker-note travel-tracker-warn">
            No active party or marching order — set one during a Long Rest
            first.
          </div>
        </div>

        <div class="modal-footer">
          <span class="footer-summary"
            >Settings are remembered for this party.</span
          >
          <button
            class="rest-btn"
            :disabled="!leadTracker()"
            @click="rollEvent"
          >
            Roll for Event
          </button>
        </div>
      </template>

      <!-- ══ STEP: Result ══════════════════════════ -->
      <template v-else-if="step === 'result' && result">
        <div class="travel-body">
          <div class="travel-result-meta">
            <span class="tier-badge" :class="'tier-' + result.tier">{{
              result.tierLabel
            }}</span>
            <span class="roll-detail">
              {{ result.label }} · d20
              {{
                result.rollMode === 'flat'
                  ? result.rolls[0]
                  : `(${result.rolls.join('/')}, ${
                      result.rollMode === 'advantage' ? 'adv' : 'disadv'
                    })`
              }}
              {{ signed(result.mod) }} = {{ result.total }}
            </span>
          </div>

          <textarea
            ref="resultText"
            class="travel-result-text"
            :value="result.text"
            readonly
            @focus="$event.target.select()"
          ></textarea>

          <button
            v-if="result.offerEncounter"
            class="encounter-link-btn"
            @click="openEncounter"
          >
            ⚔ This turned hostile — generate the encounter
          </button>
        </div>

        <div class="modal-footer">
          <button class="skip-btn" @click="rollAgain">Roll Again</button>
          <button class="rest-btn" @click="copyText">
            {{ copyConfirm ? '✓ Copied' : 'Copy Text' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations } from 'vuex'
import {
  TERRAINS,
  CONTINENTS,
  KNOWS_WAY_OPTIONS,
} from '@/data/travel_events.js'
import { pickTravelTopic, resolveTravelEvent } from '@/utils/travel_utils.js'

const KNOWS_WAY_IDS = KNOWS_WAY_OPTIONS.map((o) => o.id)

export default {
  name: 'TravelEventModal',
  emits: ['close'],

  data() {
    return {
      step: 'config',
      continent: 'Kaemahz',
      terrain: 'road',
      knowsWay: 'yes',
      result: null,
      copyConfirm: false,
      TERRAINS,
      CONTINENTS,
      KNOWS_WAY_OPTIONS,
    }
  },

  computed: {
    ...mapState(['characters', 'party_items', 'parties']),
    ...mapGetters(['activeParty']),

    signedMod() {
      const leader = this.leadTracker()
      if (!leader) return ''
      const mod = this.$dnd.skill(leader, 'Survival', this.party_items)
      return this.signed(mod)
    },

    currentKnowsWayBlurb() {
      return KNOWS_WAY_OPTIONS.find((o) => o.id === this.knowsWay)?.blurb ?? ''
    },
  },

  created() {
    const prefs = this.activeParty?.travel_prefs
    if (prefs?.continent) this.continent = prefs.continent
    if (prefs?.terrain) this.terrain = prefs.terrain
    if (KNOWS_WAY_IDS.includes(prefs?.knowsWay)) this.knowsWay = prefs.knowsWay
  },

  methods: {
    ...mapMutations([
      'SET_PARTIES',
      'REQUEST_COMBAT_NAV',
      'REQUEST_OPEN_ENCOUNTER_GENERATOR',
    ]),

    signed(n) {
      return n >= 0 ? `+${n}` : `${n}`
    },

    leadTracker() {
      const memberNames = this.activeParty?.members ?? []
      const order = this.activeParty?.marching_order ?? []
      const leadName =
        order.find((name) => memberNames.includes(name)) ?? memberNames[0]
      return this.characters.find((c) => c.name === leadName) ?? null
    },

    savePrefs() {
      const updated = this.parties.map((p) =>
        p.active
          ? {
              ...p,
              travel_prefs: {
                continent: this.continent,
                terrain: this.terrain,
                knowsWay: this.knowsWay,
              },
            }
          : p
      )
      this.SET_PARTIES(updated)
    },

    selectContinent(id) {
      this.continent = id
      this.savePrefs()
    },
    selectTerrain(id) {
      this.terrain = id
      this.savePrefs()
    },
    setKnowsWay(val) {
      this.knowsWay = val
      this.savePrefs()
    },

    rollEvent() {
      const leader = this.leadTracker()
      if (!leader) return
      const topic = pickTravelTopic(this.terrain, this.continent)
      if (!topic) return
      const survivalMod = this.$dnd.skill(leader, 'Survival', this.party_items)
      this.result = resolveTravelEvent({
        topic,
        survivalMod,
        knowsWay: this.knowsWay,
        trackerName: leader.name,
      })
      this.step = 'result'
    },

    rollAgain() {
      this.result = null
      this.step = 'config'
    },

    async copyText() {
      try {
        await navigator.clipboard.writeText(this.result.text)
      } catch (e) {
        this.$refs.resultText?.select()
      }
      this.copyConfirm = true
      setTimeout(() => {
        this.copyConfirm = false
      }, 1500)
    },

    openEncounter() {
      const topic = this.result.topic
      const seed = {
        source: topic.encounterSource ?? 'Beast',
        size: topic.encounterSize ?? 'solo',
        difficulty: this.result.tier === 'extremeBad' ? 'hard' : 'medium',
        terrain: this.terrain,
        continent: this.continent,
      }
      this.REQUEST_COMBAT_NAV()
      this.REQUEST_OPEN_ENCOUNTER_GENERATOR(seed)
      this.$emit('close')
    },
  },
}
</script>

<style scoped>
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
  width: min(56vw, 680px);
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

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1.1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-panel-dark);
  flex-shrink: 0;
  gap: 1rem;
}
.footer-summary {
  font-size: 0.78rem;
  color: var(--color-text-low);
}

.rest-btn {
  padding: 0.35rem 1.2rem;
  background: var(--color-accent);
  color: #0e0c09;
  border: none;
  border-radius: 5px;
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.12s;
}
.rest-btn:hover {
  opacity: 0.85;
}
.rest-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.skip-btn {
  padding: 0.35rem 0.9rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  font-size: 0.82rem;
  cursor: pointer;
}
.skip-btn:hover {
  color: var(--color-text-muted);
  border-color: var(--color-text-low);
}

/* ── Config step ── */
.travel-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.9rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.travel-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.travel-label {
  font-size: 0.78rem;
  color: var(--color-text-low);
  font-family: var(--font-display, serif);
  letter-spacing: 0.03em;
}

.travel-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.travel-chip {
  padding: 0.25rem 0.7rem;
  font-size: 0.78rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-low);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.travel-chip:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}
.travel-chip.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: rgba(230, 180, 90, 0.1);
}

.travel-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.travel-tracker-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  padding-top: 0.4rem;
  border-top: 1px solid var(--color-border);
}
.travel-tracker-warn {
  color: var(--color-text-danger);
}

/* ── Result step ── */
.travel-result-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.tier-badge {
  font-family: var(--font-display, serif);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.tier-extremeBad {
  color: var(--color-text-danger);
}
.tier-bad {
  color: var(--color-condition);
}
.tier-mundane {
  color: var(--color-text-low);
}
.tier-good {
  color: var(--color-success);
}
.tier-extremeGood {
  color: var(--color-highlight);
}

.roll-detail {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.travel-result-text {
  flex: 1;
  min-height: 9rem;
  resize: none;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.88rem;
  line-height: 1.5;
  padding: 0.6rem 0.75rem;
}
.travel-result-text:focus {
  outline: none;
  border-color: var(--color-accent);
}

.encounter-link-btn {
  align-self: flex-start;
  padding: 0.35rem 0.8rem;
  background: rgba(230, 90, 70, 0.12);
  border: 1px solid var(--color-text-danger);
  border-radius: 5px;
  color: var(--color-text-danger);
  font-family: var(--font-display, serif);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.12s;
}
.encounter-link-btn:hover {
  background: rgba(230, 90, 70, 0.22);
}
</style>
