<template>
  <div class="feat-browser">
    <header class="fb-bar">
      <input
        v-model="search"
        class="fb-search"
        placeholder="Search feats by name or by what they do…"
      />
      <div class="fb-chip-row">
        <button
          class="fb-chip"
          :class="{ active: category === null }"
          @click="category = null"
        >
          All ({{ feats.length }})
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          class="fb-chip"
          :class="{ active: category === c.id }"
          @click="category = c.id"
        >
          {{ c.label }} ({{ c.count }})
        </button>
      </div>
      <div class="fb-count">{{ visibleCount }} shown</div>
    </header>

    <div class="fb-body scrollable">
      <p v-if="loading" class="fb-note">Loading feats…</p>
      <p v-else-if="error" class="fb-note">
        Couldn't load the feat list ({{ error }}). Is the backend running?
      </p>

      <section v-for="g in groups" :key="g.id" class="fb-group">
        <h3 class="fb-group-title">
          {{ g.label }}
          <span class="fb-group-sub">{{ g.blurb }}</span>
        </h3>
        <article v-for="f in g.feats" :key="f.name" class="fb-row">
          <div class="fb-who">
            <div class="fb-name">{{ f.name }}</div>
            <div v-if="f.prerequisite_text" class="fb-prereq">
              Needs: {{ f.prerequisite_text }}
            </div>
            <div v-if="asiText(f)" class="fb-asi">{{ asiText(f) }}</div>
            <div v-if="f.repeatable" class="fb-tag">Repeatable</div>
            <div v-if="!isHandbook(f)" class="fb-tag fb-tag-source">
              {{ f.source }}
            </div>
          </div>
          <div class="fb-text">{{ f.description }}</div>
        </article>
      </section>

      <p v-if="!loading && !error && !visibleCount" class="fb-note">
        No feat matches “{{ search }}”.
      </p>
    </div>
  </div>
</template>

<script>
// Every 2024 feat on one page: what it needs and what it does, so choosing one
// doesn't mean opening them one at a time. Reads /api/engine/feats (the same
// catalog the level-up picker uses); nothing here is game math.
const CATEGORIES = [
  {
    id: 'origin',
    label: 'Origin',
    blurb: 'Taken with a background, or any time a feat is allowed',
  },
  { id: 'general', label: 'General', blurb: 'Level 4 or higher' },
  {
    id: 'fighting_style',
    label: 'Fighting Style',
    blurb: 'Chosen by a class’s Fighting Style feature',
  },
  { id: 'epic_boon', label: 'Epic Boon', blurb: 'Level 19 or higher' },
]
const ABILITY = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

export default {
  name: 'FeatBrowser',

  data() {
    return {
      feats: [],
      loading: true,
      error: null,
      search: '',
      category: null,
    }
  },

  computed: {
    categories() {
      return CATEGORIES.map((c) => ({
        ...c,
        count: this.feats.filter((f) => f.category === c.id).length,
      })).filter((c) => c.count)
    },

    groups() {
      const q = this.search.trim().toLowerCase()
      const matches = (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      return this.categories
        .filter((c) => this.category === null || this.category === c.id)
        .map((c) => ({
          ...c,
          feats: this.feats.filter((f) => f.category === c.id && matches(f)),
        }))
        .filter((g) => g.feats.length)
    },

    visibleCount() {
      return this.groups.reduce((n, g) => n + g.feats.length, 0)
    },
  },

  async created() {
    try {
      const res = await fetch('/api/engine/feats')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // The 2014 feats the 2024 books didn't rewrite carry no text, so they
      // are left out; the picker still offers them.
      this.feats = (await res.json()).filter(
        (f) => f.ruleset === '2024' && f.description
      )
    } catch (e) {
      this.error = e.message
    } finally {
      this.loading = false
    }
  },

  methods: {
    isHandbook(f) {
      return /^Player's Handbook/.test(f.source || '')
    },

    asiText(f) {
      const a = f.ability_score_increase
      if (!a || !a.choice_of?.length) return ''
      const names = a.choice_of.map((s) => ABILITY[s] || s)
      const which =
        names.length === 6
          ? 'one ability score'
          : names.length === 1
          ? names[0]
          : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]
      return (
        `+${a.amount || 1} ${which}` +
        (a.max_score ? ` (max ${a.max_score})` : '')
      )
    },
  },
}
</script>

<style scoped>
.feat-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.fb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.5rem 0.9rem;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.fb-search {
  flex: 1 1 18rem;
  max-width: 28rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.fb-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.fb-chip {
  padding: 0.15rem 0.6rem;
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  cursor: pointer;
}

.fb-chip:hover {
  color: var(--color-accent);
}

.fb-chip.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.fb-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.fb-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.9rem 1.5rem;
}

.fb-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  padding: 1rem 0;
}

.fb-group-title {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 0.5rem 0 0.3rem;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent);
  letter-spacing: 0.04em;
}

.fb-group-sub {
  margin-left: 0.6rem;
  font-family: inherit;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0;
}

.fb-row {
  display: grid;
  grid-template-columns: 14rem 1fr;
  gap: 0.2rem 1.2rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
}

.fb-row:hover {
  background: var(--color-bg-hover, var(--color-bg-surface));
}

.fb-name {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.fb-prereq,
.fb-asi {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.fb-asi {
  color: var(--color-accent-alt, var(--color-accent));
}

.fb-tag {
  display: inline-block;
  margin-top: 0.2rem;
  margin-right: 0.3rem;
  padding: 0 0.4rem;
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.fb-tag-source {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.fb-text {
  font-size: var(--font-size-sm);
  line-height: 1.45;
  color: var(--color-text);
  white-space: pre-line;
}

@media (max-width: 700px) {
  .fb-row {
    grid-template-columns: 1fr;
  }
}
</style>
