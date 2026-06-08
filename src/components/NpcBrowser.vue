<template>
  <div class="npc-browser">
    <!-- List -->
    <aside class="nb-list scrollable">
      <div class="nb-search-wrap">
        <input
          v-model="search"
          class="nb-search"
          placeholder="Search NPCs…"
          type="search"
        />
      </div>
      <div class="nb-filter-row">
        <button
          v-for="s in statusFilters"
          :key="s"
          class="nb-filter-chip"
          :class="{ active: statusFilter === s }"
          @click="statusFilter = statusFilter === s ? null : s"
        >
          {{ s }}
        </button>
      </div>
      <div
        v-for="npc in filteredNpcs"
        :key="npc.id"
        class="nb-item"
        :class="{ selected: selected && selected.id === npc.id }"
        @click="selected = npc"
      >
        <div class="nb-item-name">{{ npc.name }}</div>
        <div class="nb-item-sub">{{ npc.role }}</div>
        <div class="nb-item-meta">
          <span
            v-for="s in npc.status ?? []"
            :key="s"
            class="nb-status-dot"
            :class="'nb-status--' + s"
            >{{ s }}</span
          >
          <span class="nb-item-loc">{{ npc.location }}</span>
        </div>
      </div>
      <div v-if="!filteredNpcs.length" class="empty-state">No results.</div>
    </aside>

    <!-- Detail -->
    <main class="nb-detail" v-if="selected">
      <div class="nb-detail-header">
        <div class="nb-detail-identity">
          <h2 class="nb-detail-name">{{ selected.name }}</h2>
          <div class="nb-detail-role">{{ selected.role }}</div>
          <div class="nb-detail-faction" v-if="selected.faction">
            {{ selected.faction }}
          </div>
          <div class="nb-detail-location" v-if="selected.location">
            {{ selected.location }}
          </div>
          <div class="nb-status-pills">
            <span
              v-for="s in selected.status ?? []"
              :key="s"
              class="nb-status-pill"
              :class="'nb-status--' + s"
              >{{ s }}</span
            >
          </div>
        </div>
        <div class="nb-portrait" v-if="selected.image">
          <img
            :src="selected.image"
            :alt="selected.name"
            class="nb-portrait-img"
          />
        </div>
        <div class="nb-portrait nb-portrait--empty" v-else></div>
      </div>

      <div class="nb-detail-body scrollable">
        <div v-if="selected.appearance" class="nb-block">
          <div class="section-label">Appearance</div>
          <p class="nb-text">{{ selected.appearance }}</p>
        </div>
        <div
          v-if="selected.personality_traits || selected.personality_quirks"
          class="nb-block"
        >
          <div class="section-label">Personality</div>
          <p v-if="selected.personality_traits" class="nb-text">
            {{ selected.personality_traits }}
          </p>
          <p v-if="selected.personality_quirks" class="nb-text nb-text--quirk">
            {{ selected.personality_quirks }}
          </p>
        </div>
        <div v-if="selected.notes" class="nb-block">
          <div class="section-label">Notes</div>
          <p class="nb-text">{{ selected.notes }}</p>
        </div>
      </div>
    </main>

    <div v-else class="nb-detail empty-state">
      Select an NPC to view details.
    </div>
  </div>
</template>

<script>
const STATUS_ORDER = ['ally', 'enemy', 'neutral', 'deceased', 'unknown']

export default {
  name: 'NpcBrowser',

  data() {
    return {
      search: '',
      statusFilter: null,
      selected: null,
    }
  },

  computed: {
    npcs() {
      return this.$store.state.npcs ?? []
    },
    statusFilters() {
      const all = new Set()
      this.npcs.forEach((n) => (n.status ?? []).forEach((s) => all.add(s)))
      return [...all].sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a),
          bi = STATUS_ORDER.indexOf(b)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
    },
    filteredNpcs() {
      const q = this.search.trim().toLowerCase()
      return this.npcs.filter((n) => {
        if (this.statusFilter && !(n.status ?? []).includes(this.statusFilter))
          return false
        if (!q) return true
        return (
          n.name?.toLowerCase().includes(q) ||
          n.role?.toLowerCase().includes(q) ||
          n.faction?.toLowerCase().includes(q) ||
          n.location?.toLowerCase().includes(q)
        )
      })
    },
  },

  watch: {
    filteredNpcs(list) {
      if (this.selected && !list.find((n) => n.id === this.selected.id)) {
        this.selected = list[0] ?? null
      }
    },
  },
}
</script>

<style scoped>
.npc-browser {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── List ── */
.nb-list {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.nb-search-wrap {
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nb-search {
  width: 100%;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  padding: 0.3rem 0.5rem;
  outline: none;
  box-sizing: border-box;
}
.nb-search:focus {
  border-color: var(--color-accent);
}

.nb-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nb-filter-chip {
  font-size: var(--font-size-xs);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  text-transform: capitalize;
}
.nb-filter-chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.nb-item {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s;
}
.nb-item:hover {
  background: var(--color-bg-surface);
}
.nb-item.selected {
  background: var(--color-bg-surface-alt);
  border-left: 2px solid var(--color-accent);
}

.nb-item-name {
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-weight: 500;
}
.nb-item-sub {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nb-item-meta {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 0.15rem;
  flex-wrap: wrap;
}
.nb-item-loc {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

/* ── Status ── */
.nb-status-dot {
  font-size: var(--font-size-xs);
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  text-transform: capitalize;
}
.nb-status-pill {
  font-size: var(--font-size-base);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid;
  text-transform: capitalize;
}
.nb-status--ally {
  color: var(--color-success);
  border-color: var(--color-success);
  background: rgba(74, 158, 107, 0.08);
}
.nb-status--enemy {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: rgba(192, 57, 43, 0.08);
}
.nb-status--deceased {
  color: var(--color-text-low);
  border-color: var(--color-border);
}
.nb-status--neutral {
  color: var(--color-neutral-amber);
  border-color: var(--color-neutral-amber);
  background: rgba(201, 149, 42, 0.08);
}
.nb-status--unknown {
  color: var(--color-text-low);
  border-color: var(--color-border);
}

/* ── Detail ── */
.nb-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nb-detail-header {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.nb-detail-identity {
  flex: 1;
  min-width: 0;
}

.nb-detail-name {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-accent-strong);
  margin: 0 0 0.2rem;
}
.nb-detail-role {
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}
.nb-detail-faction {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  margin-top: 0.15rem;
}
.nb-detail-location {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  font-style: italic;
}

.nb-status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

/* Portrait — compact, image-ready */
.nb-portrait {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.nb-portrait--empty {
  background: var(--color-bg-surface);
  opacity: 0.4;
}
.nb-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 0%;
}

.nb-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nb-block {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.nb-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}
.nb-text--quirk {
  color: var(--color-text-low);
  font-style: italic;
}
</style>
