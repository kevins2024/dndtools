<template>
  <div class="party-context">
    <nav class="party-nav">
      <button
        class="party-tab"
        :class="{ active: activeTab === 'party' }"
        @click="activeTab = 'party'"
      >
        Party
      </button>
      <button
        class="party-tab"
        :class="{ active: activeTab === 'networks' }"
        @click="activeTab = 'networks'"
      >
        Networks
      </button>
    </nav>

    <div class="party-tab-content">
      <!-- Networks tab -->
      <NetworksContext v-if="activeTab === 'networks'" />

      <!-- Party tab -->
      <template v-else>
        <!-- Inactive party strips (same height as nav bar, with margin) -->
        <div v-if="inactiveParties.length" class="strip-list">
          <div
            v-for="p in inactiveParties"
            :key="p.id"
            class="party-strip"
            :title="`Switch to ${p.name}`"
            @click="ACTIVATE_PARTY(p.id)"
          >
            <div class="strip-avatars">
              <div
                v-for="name in p.members.slice(0, 10)"
                :key="name"
                class="strip-avatar"
                :title="name"
              >
                <img :src="charImage(name)" class="strip-face" />
              </div>
            </div>
            <span class="strip-label">{{ p.name }}</span>
          </div>
        </div>

        <!-- Active party -->
        <div v-if="activeParty" class="active-party">
          <div class="party-heading">
            <span class="party-title">{{ activeParty.name }}</span>
            <span class="member-count">{{ activeMembers.length }} members</span>
            <button
              class="copy-json-btn"
              :class="{ copied: copyConfirm }"
              :title="copyConfirm ? 'Copied!' : 'Copy party JSON'"
              @click="copyPartyJson"
            >
              {{ copyConfirm ? '✓ Copied' : 'Copy JSON' }}
            </button>
          </div>
          <div class="member-grid">
            <div
              v-for="char in activeMembers"
              :key="char.name"
              class="member-card"
            >
              <div class="card-portrait">
                <img :src="char.image" class="portrait-img" />
                <span
                  v-if="char.darkvision"
                  class="dv-badge"
                  :title="`Darkvision ${char.darkvision}ft`"
                  >DV</span
                >
              </div>
              <div class="card-body">
                <div class="card-name">{{ char.name }}</div>
                <div class="card-class">{{ $dnd.classLabel(char) }}</div>
                <div class="card-role" v-if="$dnd.subclassLabel(char)">
                  {{ $dnd.subclassLabel(char) }}
                </div>
                <div class="card-topstat">
                  <span class="stat-key">{{ topStat(char).name }}</span>
                  <span class="stat-score">{{ topStat(char).score }}</span>
                </div>
                <div class="card-skills">
                  <span
                    v-for="sk in topSkills(char)"
                    :key="sk.name"
                    class="skill-pip"
                  >
                    {{ sk.short }} <strong>{{ sk.signed }}</strong>
                  </span>
                </div>
                <div class="card-rest-row">
                  <span class="rest-label rest-short">S</span>
                  <span v-if="shortGains(char).length === 0" class="rest-full"
                    >full</span
                  >
                  <span
                    v-for="item in shortGains(char)"
                    :key="item"
                    class="rest-chip rest-chip-short"
                    >{{ item }}</span
                  >
                </div>
                <div class="card-rest-row">
                  <span class="rest-label rest-long">L</span>
                  <span v-if="longGains(char).length === 0" class="rest-full"
                    >full</span
                  >
                  <span
                    v-for="item in longGains(char)"
                    :key="item"
                    class="rest-chip rest-chip-long"
                    >{{ item }}</span
                  >
                </div>
                <div class="card-btns">
                  <button class="card-btn" @click="goTo(char.name, 'sheet')">
                    Sheet
                  </button>
                  <button
                    class="card-btn"
                    @click="goTo(char.name, 'equipment')"
                  >
                    Items
                  </button>
                  <button
                    v-if="char.spellcasting_ability"
                    class="card-btn"
                    @click="goTo(char.name, 'spellbook')"
                  >
                    Spells
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="party-empty">
          <div class="empty-msg">No active party.</div>
          <div class="empty-sub">
            Use <em>Manage Parties</em> in the toolbar to create one.
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import { dnd } from '@/utils/dnd_utils'
import NetworksContext from './NetworksContext.vue'

const STAT_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STAT_FIELDS = [
  'stat_str',
  'stat_dex',
  'stat_con',
  'stat_int',
  'stat_wis',
  'stat_cha',
]

const SKILL_SHORT = {
  Acrobatics: 'Acro',
  'Animal Handling': 'AH',
  Arcana: 'Arca',
  Athletics: 'Athl',
  Deception: 'Dcpt',
  History: 'Hist',
  Insight: 'Insi',
  Intimidation: 'Inti',
  Investigation: 'Invs',
  Medicine: 'Medi',
  Nature: 'Natu',
  Perception: 'Perc',
  Performance: 'Perf',
  Persuasion: 'Pers',
  Religion: 'Reli',
  'Sleight of Hand': 'SoH',
  Stealth: 'Stlth',
  Survival: 'Surv',
}

export default {
  name: 'PartyContext',
  components: { NetworksContext },

  data() {
    return {
      activeTab: 'party',
      copyConfirm: false,
    }
  },

  computed: {
    ...mapState(['parties', 'characters', 'party_items']),

    inactiveParties() {
      return this.parties.filter((p) => !p.active)
    },

    activeParty() {
      return this.parties.find((p) => p.active) ?? null
    },

    activeMembers() {
      if (!this.activeParty) return []
      return this.activeParty.members
        .map((name) => this.characters.find((c) => c.name === name))
        .filter(Boolean)
    },
  },

  methods: {
    ...mapMutations(['ACTIVATE_PARTY', 'NAV_TO_CHARACTER']),

    charImage(name) {
      return this.characters.find((c) => c.name === name)?.image ?? ''
    },

    topStat(char) {
      let best = { name: STAT_NAMES[0], score: char[STAT_FIELDS[0]] }
      STAT_NAMES.forEach((name, i) => {
        if (char[STAT_FIELDS[i]] > best.score)
          best = { name, score: char[STAT_FIELDS[i]] }
      })
      return best
    },

    topSkills(char) {
      return Object.entries(dnd.allSkills(char, this.party_items))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, val]) => ({
          name,
          short: SKILL_SHORT[name] ?? name.slice(0, 4),
          signed: val >= 0 ? `+${val}` : `${val}`,
        }))
    },

    goTo(name, tab = 'sheet') {
      this.NAV_TO_CHARACTER({ name, tab })
    },

    abbrevFeature(name) {
      const known = {
        'Second Wind': 'SW',
        'Action Surge': 'AS',
        Indomitable: 'Indom',
        Rage: 'Rage',
        Bladesong: 'Bladesong',
        'Channel Divinity': 'CD',
        'Bardic Inspiration': 'BI',
        'Lay on Hands': 'LoH',
        'Favored by the Gods': 'FbtG',
        'Starry Form': 'Starry',
        'Cosmic Omen': 'Omen',
        Unbroken: 'Unbroken',
      }
      for (const [key, abbr] of Object.entries(known)) {
        if (name.startsWith(key)) return abbr
      }
      return name
        .replace(/\s*\(.*\)/, '')
        .replace(/^.+—\s*/, '')
        .trim()
        .slice(0, 10)
    },

    shortGains(char) {
      const items = []
      for (const f of char.features || []) {
        if (
          f.recharge === 'short_rest' &&
          f.uses_max &&
          f.uses_current < f.uses_max
        ) {
          items.push(this.abbrevFeature(f.name))
        }
      }
      if (char.pact_magic?.current < char.pact_magic?.max) {
        const used = char.pact_magic.max - char.pact_magic.current
        items.push(`${used} pact`)
      }
      return items
    },

    longGains(char) {
      const items = []
      const hpMissing = (char.hp_max ?? 0) - (char.hp_current ?? 0)
      if (hpMissing > 0) items.push(`HP +${hpMissing}`)
      for (const f of char.features || []) {
        if (
          f.recharge === 'long_rest' &&
          f.uses_max &&
          f.uses_current < f.uses_max
        ) {
          items.push(this.abbrevFeature(f.name))
        }
      }
      if (char.spell_slots) {
        let used = 0
        for (const s of Object.values(char.spell_slots))
          used += s.max - s.current
        if (used > 0) items.push(`${used} slot${used > 1 ? 's' : ''}`)
      }
      return items
    },

    copyPartyJson() {
      const memberNames = new Set(this.activeParty.members)
      const items = this.party_items.filter(
        (item) =>
          memberNames.has(item.carried_by) ||
          memberNames.has(item.equipped_by) ||
          (item.carried_by === 'party' &&
            (item.party_id === this.activeParty.id || !item.party_id))
      )
      const payload = {
        party: this.activeParty,
        characters: this.activeMembers,
        items,
      }
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      this.copyConfirm = true
      setTimeout(() => {
        this.copyConfirm = false
      }, 1800)
    },
  },
}
</script>

<style scoped>
.party-context {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Tab nav ──────────────────────────────── */
.party-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.party-tab {
  font-size: var(--font-size-base);
  font-family: var(--font-display);
  letter-spacing: 0.04em;
  padding: 0.4rem 1rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
  margin-bottom: -1px;
}
.party-tab:hover {
  color: var(--color-text-muted);
}
.party-tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.party-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Inactive party strips ────────────────── */
.strip-list {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4vh 0.5vw;
  padding: 1vh 1vw 0.4vh;
}

.party-strip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.6rem;
  padding: 0 0.6rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  overflow: hidden;
}
.party-strip:hover {
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.strip-avatars {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.strip-avatar {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.strip-face {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 20%;
}

.strip-label {
  font-size: 0.8rem;
  font-family: var(--font-display, serif);
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

/* ── Active party area ────────────────────── */
.active-party {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.party-heading {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem 0.25rem;
}

.copy-json-btn {
  margin-left: auto;
  padding: 0.15rem 0.6rem;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}
.copy-json-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.copy-json-btn.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}
.party-title {
  font-family: var(--font-display, serif);
  font-size: 1rem;
  letter-spacing: 0.05em;
  color: var(--color-text);
}
.member-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.member-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.75rem;
  padding: 0.5rem 1rem 1rem;
  align-content: start;
}

/* ── Member card ──────────────────────────── */
.member-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.12s;
}
.member-card:hover {
  border-color: var(--color-accent);
}

.card-portrait {
  width: 100%;
  height: 140px;
  overflow: hidden;
  flex-shrink: 0;
}
.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

.card-body {
  padding: 0.5rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.card-name {
  font-family: var(--font-display, serif);
  font-size: 0.9rem;
  color: var(--color-text);
  font-weight: 600;
  letter-spacing: 0.03em;
}
.card-class {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.card-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-topstat {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin-top: 0.1rem;
}
.stat-key {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-low);
}
.stat-score {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-accent);
  font-family: var(--font-display, serif);
}

.card-skills {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}
.skill-pip {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 5px;
}
.skill-pip strong {
  color: var(--color-text-muted);
}

.card-btns {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.35rem;
}
.card-btn {
  flex: 1;
  padding: 0.18rem 0;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.04em;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-low);
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}
.card-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* ── Darkvision badge ─────────────────────── */
.card-portrait {
  position: relative;
}
.dv-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.06em;
  background: rgba(80, 60, 120, 0.82);
  color: #c8a8f0;
  border: 1px solid rgba(180, 130, 255, 0.4);
  border-radius: 3px;
  padding: 1px 5px;
  pointer-events: none;
}

/* ── Rest recovery rows ───────────────────── */
.card-rest-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.18rem;
}
.rest-label {
  font-size: var(--font-size-xs);
  font-family: var(--font-display, serif);
  letter-spacing: 0.08em;
  font-weight: 700;
  flex-shrink: 0;
  width: 0.9rem;
}
.rest-short {
  color: #6aaccc;
}
.rest-long {
  color: #c8963a;
}
.rest-full {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.rest-chip {
  font-size: var(--font-size-xs);
  border-radius: 3px;
  padding: 1px 4px;
}
.rest-chip-short {
  background: rgba(80, 160, 210, 0.12);
  border: 1px solid rgba(80, 160, 210, 0.35);
  color: #8ac8e0;
}
.rest-chip-long {
  background: rgba(200, 140, 50, 0.12);
  border: 1px solid rgba(200, 140, 50, 0.35);
  color: #d4a860;
}

/* ── Empty state ──────────────────────────── */
.party-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.empty-msg {
  font-family: var(--font-display, serif);
  font-size: 1.1rem;
  color: var(--color-text-low);
  letter-spacing: 0.05em;
}
.empty-sub {
  font-size: 0.8rem;
  color: var(--color-text-low);
}
.empty-sub em {
  color: var(--color-accent);
  font-style: normal;
}
</style>
