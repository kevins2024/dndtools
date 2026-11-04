<template>
  <div class="nc">
    <header class="nc-bar">
      <input
        v-model="answers.name"
        class="nc-name"
        placeholder="Character name"
      />
      <span class="nc-status">
        <template v-if="loading">Working…</template>
        <template v-else-if="pendingCount">
          {{ pendingCount }} choice{{ pendingCount === 1 ? '' : 's' }} left
        </template>
        <template v-else>Everything is chosen.</template>
      </span>
      <button class="nc-go" :disabled="!canCreate" @click="create">
        Create and take level 1 →
      </button>
    </header>
    <p v-if="problem" class="nc-problem">{{ problem }}</p>

    <div class="nc-body">
      <div class="nc-form scrollable">
        <section v-for="s in sections" :key="s.id" class="nc-section">
          <h3 class="nc-section-title">{{ s.label }}</h3>
          <div
            v-for="c in s.choices"
            :key="c.id"
            class="nc-choice"
            :class="{ 'nc-done': c.answered }"
          >
            <div class="nc-title">
              {{ c.title }}
              <span class="nc-state">{{ c.answered ? '✓' : '•' }}</span>
            </div>
            <p v-if="!c.answered" class="nc-prompt">{{ c.prompt }}</p>

            <!-- pick one or several -->
            <div v-if="c.kind === 'pick'" class="nc-chips">
              <button
                v-for="o in c.options"
                :key="o.value"
                class="nc-chip"
                :class="{ active: isPicked(c, o.value) }"
                @click="pick(c, o.value)"
              >
                {{ o.label }}
              </button>
            </div>

            <!-- background ability bonus -->
            <div v-else-if="c.kind === 'abilityBonus'" class="nc-bonus">
              <label class="nc-radio">
                <input
                  type="radio"
                  value="twoOne"
                  :checked="bonus.mode === 'twoOne'"
                  @change="setBonus({ mode: 'twoOne' })"
                />
                +2 and +1
              </label>
              <label class="nc-radio">
                <input
                  type="radio"
                  value="oneOneOne"
                  :checked="bonus.mode === 'oneOneOne'"
                  @change="setBonus({ mode: 'oneOneOne' })"
                />
                +1 to all three
              </label>
              <div v-if="bonus.mode === 'twoOne'" class="nc-bonus-pick">
                <label>
                  +2
                  <select
                    :value="bonus.plus2 || ''"
                    @change="setBonus({ plus2: $event.target.value })"
                  >
                    <option value="">—</option>
                    <option
                      v-for="o in c.options"
                      :key="o.value"
                      :value="o.value"
                    >
                      {{ o.label }}
                    </option>
                  </select>
                </label>
                <label>
                  +1
                  <select
                    :value="bonus.plus1 || ''"
                    @change="setBonus({ plus1: $event.target.value })"
                  >
                    <option value="">—</option>
                    <option
                      v-for="o in c.options"
                      :key="o.value"
                      :value="o.value"
                    >
                      {{ o.label }}
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <!-- ability scores -->
            <div v-else-if="c.kind === 'scores'" class="nc-scores">
              <div class="nc-chips">
                <button
                  v-for="m in methods"
                  :key="m.id"
                  class="nc-chip"
                  :class="{ active: answers.scoreMethod === m.id }"
                  @click="setMethod(m.id)"
                >
                  {{ m.label }}
                </button>
              </div>
              <p v-if="answers.scoreMethod === 'pointBuy'" class="nc-note">
                {{ pointBuy.remaining }} of {{ pointBuy.budget }} points left (8
                to 15 before the background bonus).
              </p>
              <p v-if="answers.scoreMethod === 'standardArray'" class="nc-note">
                Assign 15, 14, 13, 12, 10 and 8, each once.
              </p>
              <div v-if="answers.scoreMethod === 'rolled'" class="nc-roll-row">
                <button class="nc-chip" @click="rollScores">
                  🎲 Roll 4d6, drop the lowest, six times
                </button>
                <span class="nc-note">or type the six totals (3 to 18).</span>
              </div>
              <div v-if="answers.scoreMethod" class="nc-score-grid">
                <div v-for="a in abilities" :key="a" class="nc-score">
                  <div class="nc-score-name">{{ a.toUpperCase() }}</div>
                  <template v-if="answers.scoreMethod === 'pointBuy'">
                    <div class="nc-stepper">
                      <button :disabled="draft[a] <= 8" @click="step(a, -1)">
                        −
                      </button>
                      <span class="nc-score-val">{{ draft[a] }}</span>
                      <button :disabled="draft[a] >= 15" @click="step(a, 1)">
                        +
                      </button>
                    </div>
                  </template>
                  <select
                    v-else-if="answers.scoreMethod === 'standardArray'"
                    :value="draft[a]"
                    @change="setScore(a, $event.target.value)"
                  >
                    <option v-for="v in arrayChoices(a)" :key="v" :value="v">
                      {{ v }}
                    </option>
                  </select>
                  <input
                    v-else
                    type="number"
                    min="3"
                    max="18"
                    :value="draft[a]"
                    @change="setScore(a, $event.target.value)"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="nc-preview scrollable">
        <h3 class="nc-section-title">Your character</h3>
        <p v-if="!character" class="nc-note">Choose a species to begin.</p>
        <template v-else>
          <div class="nc-pv-line">
            {{ character.subgenus ? character.subgenus + ' ' : ''
            }}{{ character.genus || 'Species' }}
            {{ character.background ? '· ' + character.background : '' }}
            {{ classLabel }}
          </div>
          <div v-if="scoresDone" class="nc-pv-scores">
            <div v-for="a in abilities" :key="a" class="nc-pv-score">
              <div class="nc-score-name">{{ a.toUpperCase() }}</div>
              <div class="nc-score-val">{{ character['stat_' + a] }}</div>
            </div>
          </div>
          <dl class="nc-pv-list">
            <template v-if="character.saving_throws.length">
              <dt>Saving throws</dt>
              <dd>{{ character.saving_throws.map(upper).join(', ') }}</dd>
            </template>
            <template v-if="character.skill_proficiencies.length">
              <dt>Skills</dt>
              <dd>{{ character.skill_proficiencies.join(', ') }}</dd>
            </template>
            <template v-if="character.tool_proficiencies.length">
              <dt>Tools</dt>
              <dd>{{ character.tool_proficiencies.join(', ') }}</dd>
            </template>
            <template v-if="character.armor_proficiencies.length">
              <dt>Armor</dt>
              <dd>{{ character.armor_proficiencies.join(', ') }}</dd>
            </template>
            <template v-if="character.weapon_proficiencies.length">
              <dt>Weapons</dt>
              <dd>{{ character.weapon_proficiencies.join(', ') }}</dd>
            </template>
            <dt>Languages</dt>
            <dd>{{ character.languages.join(', ') }}</dd>
            <template v-if="character.speed">
              <dt>Speed</dt>
              <dd>
                {{ character.speed }} ft.
                <template v-if="grants.darkvision">
                  · Darkvision {{ grants.darkvision }} ft.</template
                >
              </dd>
            </template>
            <template v-if="character.spells.length">
              <dt>Spells</dt>
              <dd>{{ character.spells.map((s) => s.name).join(', ') }}</dd>
            </template>
            <template v-if="character.features.length">
              <dt>Traits and feats</dt>
              <dd>{{ character.features.map((f) => f.name).join(', ') }}</dd>
            </template>
            <template v-if="grants.resistances.length">
              <dt>Resistances</dt>
              <dd>{{ grants.resistances.join(', ') }}</dd>
            </template>
            <template
              v-if="
                grants.savingThrowAdvantages.length ||
                grants.skillAdvantages.length ||
                grants.checkAdvantages.length
              "
            >
              <dt>Advantage</dt>
              <dd>
                {{
                  [
                    ...grants.savingThrowAdvantages.map(
                      (a) => 'saves: ' + a.replace(/_/g, ' ')
                    ),
                    ...grants.skillAdvantages.map(
                      (a) => a.skill + (a.when ? ' (' + a.when + ')' : '')
                    ),
                    ...grants.checkAdvantages.map((a) => 'checks ' + a.when),
                  ].join('; ')
                }}
              </dd>
            </template>
            <template v-if="equipment.items.length || equipment.gold">
              <dt>Starting equipment</dt>
              <dd>
                {{ equipment.items.map(itemLabel).join(', ') }}
                <template v-if="equipment.gold">
                  · {{ equipment.gold }} GP (to the party purse)</template
                >
              </dd>
            </template>
          </dl>
          <p v-if="warnings.length" class="nc-problem">
            {{ warnings.join(' ') }}
          </p>
        </template>
        <p class="nc-note">
          Hit points, class features and the rest of the class's choices come
          next, when you take level 1.
        </p>
      </aside>
    </div>
  </div>
</template>

<script>
import { validatePointBuy } from '@/utils/pointBuy.js'
import { abilityScoreRoll } from '@/utils/abilityScoreRoll.js'

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SECTIONS = [
  { id: 'species', label: 'Species' },
  { id: 'background', label: 'Background' },
  { id: 'scores', label: 'Ability scores' },
  { id: 'languages', label: 'Languages' },
  { id: 'class', label: 'Class' },
  { id: 'equipment', label: 'Starting equipment' },
]
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

// Where each engine pick's answer lives in `answers`.
function pathFor(id) {
  if (id === 'species') return ['species']
  if (id === 'background') return ['background']
  if (id === 'className') return ['className']
  if (id === 'languages') return ['languages']
  if (id === 'classSkills') return ['classSkills']
  if (id === 'background.tool') return ['backgroundTool']
  if (id.startsWith('species.')) return ['speciesPicks', id.slice(8)]
  if (id.startsWith('equipment.')) return ['equipment', id.slice(10)]
  if (id.startsWith('featPicks.')) {
    const [, which, key] = id.split('.')
    return ['featPicks', which, key]
  }
  return [id]
}

function getIn(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export default {
  name: 'NewCharacter2024',

  data() {
    return {
      abilities: ABILITIES,
      methods: [
        { id: 'pointBuy', label: 'Point buy' },
        { id: 'standardArray', label: 'Standard array' },
        { id: 'rolled', label: 'Rolled' },
      ],
      answers: {
        name: '',
        speciesPicks: {},
        featPicks: {},
        equipment: {},
        backgroundBonus: {},
        scoreMethod: null,
        scores: null,
      },
      draft: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      result: null,
      loading: false,
      problem: '',
      timer: null,
      requestId: 0,
    }
  },

  computed: {
    choices() {
      return this.result?.choices ?? []
    },
    character() {
      return this.result?.character ?? null
    },
    warnings() {
      return this.result?.warnings ?? []
    },
    equipment() {
      return this.result?.equipment ?? { items: [], gold: 0 }
    },
    grants() {
      return (
        this.result?.grants ?? {
          resistances: [],
          savingThrowAdvantages: [],
          skillAdvantages: [],
          checkAdvantages: [],
          darkvision: 0,
        }
      )
    },
    pendingCount() {
      return this.result?.pending?.length ?? 0
    },
    sections() {
      return SECTIONS.map((s) => ({
        ...s,
        choices: this.choices.filter((c) => c.section === s.id),
      })).filter((s) => s.choices.length)
    },
    bonus() {
      return this.answers.backgroundBonus
    },
    pointBuy() {
      try {
        return validatePointBuy(this.draft)
      } catch {
        return { remaining: 0, budget: 27, valid: false }
      }
    },
    scoresDone() {
      return Boolean(this.choices.find((c) => c.id === 'scores')?.answered)
    },
    classLabel() {
      return this.character?.classes?.[0]?.name
        ? `· ${this.character.classes[0].name}`
        : ''
    },
    nameTaken() {
      const n = this.answers.name.trim().toLowerCase()
      return (
        n &&
        this.$store.state.characters.some((c) => c.name.toLowerCase() === n)
      )
    },
    canCreate() {
      return Boolean(
        this.answers.name.trim() &&
          !this.nameTaken &&
          this.result &&
          !this.pendingCount &&
          !this.loading
      )
    },
  },

  watch: {
    answers: { deep: true, handler: 'schedule' },
    nameTaken(taken) {
      this.problem = taken ? 'A character with that name already exists.' : ''
    },
  },

  created() {
    this.refresh()
  },

  beforeDestroy() {
    clearTimeout(this.timer)
  },

  methods: {
    upper: (s) => s.toUpperCase(),
    itemLabel: (i) => (i.quantity > 1 ? `${i.quantity} ${i.name}` : i.name),

    schedule() {
      clearTimeout(this.timer)
      this.timer = setTimeout(this.refresh, 120)
    },

    async refresh() {
      const id = ++this.requestId
      this.loading = true
      try {
        const res = await fetch('/api/engine/new-character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: this.answers }),
        })
        const data = await res.json()
        if (id !== this.requestId) return
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.result = data
        if (!this.nameTaken) this.problem = ''
      } catch (err) {
        if (id === this.requestId)
          this.problem = `Could not build the character (${err.message}). Is the backend running?`
      } finally {
        if (id === this.requestId) this.loading = false
      }
    },

    // ── picks ──
    current(c) {
      const v = getIn(this.answers, pathFor(c.id))
      return Array.isArray(v) ? v : v == null ? [] : [v]
    },
    isPicked(c, value) {
      return this.current(c).includes(value)
    },
    set(path, value) {
      let o = this.answers
      path.slice(0, -1).forEach((k) => {
        if (o[k] == null) this.$set(o, k, {})
        o = o[k]
      })
      this.$set(o, path[path.length - 1], value)
    },
    pick(c, value) {
      const path = pathFor(c.id)
      if (c.max === 1) return this.set(path, value)
      const now = this.current(c)
      const next = now.includes(value)
        ? now.filter((v) => v !== value)
        : [...now, value].slice(-c.max)
      this.set(path, next)
    },

    // ── background bonus ──
    setBonus(patch) {
      this.$set(this.answers, 'backgroundBonus', { ...this.bonus, ...patch })
    },

    // ── ability scores ──
    setMethod(method) {
      this.answers.scoreMethod = method
      if (method === 'pointBuy')
        this.draft = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
      else if (method === 'standardArray')
        this.draft = Object.fromEntries(
          ABILITIES.map((a, i) => [a, STANDARD_ARRAY[i]])
        )
      else this.draft = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
      this.syncScores()
    },
    syncScores() {
      this.answers.scores = { ...this.draft }
    },
    step(a, delta) {
      const next = this.draft[a] + delta
      if (next < 8 || next > 15) return
      this.draft = { ...this.draft, [a]: next }
      this.syncScores()
    },
    setScore(a, raw) {
      const v = Number(raw)
      if (!Number.isInteger(v)) return
      if (this.answers.scoreMethod === 'standardArray') {
        // swap with whichever ability holds this value, so each number stays used once
        const other = ABILITIES.find((x) => x !== a && this.draft[x] === v)
        const old = this.draft[a]
        this.draft = {
          ...this.draft,
          [a]: v,
          ...(other ? { [other]: old } : {}),
        }
      } else this.draft = { ...this.draft, [a]: v }
      this.syncScores()
    },
    arrayChoices() {
      return STANDARD_ARRAY
    },
    rollScores() {
      const set = abilityScoreRoll.rollAbilityScoreSet().map((r) => r.total)
      this.draft = Object.fromEntries(ABILITIES.map((a, i) => [a, set[i]]))
      this.syncScores()
    },

    // ── finish ──
    async create() {
      if (!this.canCreate) return
      await this.refresh()
      if (this.pendingCount || !this.character) return
      const character = JSON.parse(JSON.stringify(this.character))
      // Every Wizard has a spellbook of their own from the start; level 1 fills it.
      if (character.classes?.[0]?.name === 'Wizard') {
        const id = `sb_${Date.now()}`
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: 'spellbooks',
          updatedItem: {
            id,
            name: `${character.name}'s Spellbook`,
            notes: '',
            spells: [],
          },
        })
        character.spellbook_id = id
        character.prepared_spells = []
      }
      this.$store.commit('ADD_CHARACTER', character)
      // The starting gear goes into the party's items, carried by the new character, and the
      // gold into the party purse (this table keeps one purse for the party).
      const { items, gold } = this.equipment
      if (items.length) this.$store.commit('ADD_PARTY_ITEMS', items)
      if (gold > 0) this.$store.commit('ADJUST_PARTY_GOLD', gold)
      this.$store.commit('NAV_TO_LEVEL_UP_ENGINE', character.name)
    },
  },
}
</script>

<style scoped>
.nc {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.nc-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  padding: 0.5rem 0.9rem;
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nc-name {
  flex: 1 1 14rem;
  max-width: 22rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-base);
}

.nc-status {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.nc-go {
  margin-left: auto;
  padding: 0.3rem 0.9rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  color: var(--color-accent-strong);
  font-family: var(--font-display);
  cursor: pointer;
}

.nc-go:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nc-problem {
  margin: 0;
  padding: 0.4rem 0.9rem;
  color: var(--color-danger, #c0392b);
  font-size: var(--font-size-sm);
}

.nc-body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  min-height: 0;
}

.nc-form,
.nc-preview {
  overflow-y: auto;
  padding: 0 0.9rem 1.5rem;
}

.nc-preview {
  border-left: 1px solid var(--color-border);
}

.nc-section-title {
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

.nc-choice {
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
}

.nc-title {
  font-family: var(--font-display);
  color: var(--color-text);
}

.nc-state {
  margin-left: 0.4rem;
  color: var(--color-accent);
}

.nc-done .nc-state {
  color: var(--color-success, #4caf50);
}

.nc-prompt,
.nc-note {
  margin: 0.15rem 0 0.35rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.nc-chips,
.nc-roll-row,
.nc-bonus,
.nc-bonus-pick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.5rem;
}

.nc-chip {
  padding: 0.15rem 0.6rem;
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  cursor: pointer;
}

/* an equipment package is a sentence, not a word */
.nc-choice .nc-chip {
  max-width: 100%;
  text-align: left;
}

.nc-chip:hover {
  color: var(--color-accent);
}

.nc-chip.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.nc-radio {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.nc-score-grid,
.nc-pv-scores {
  display: grid;
  grid-template-columns: repeat(6, minmax(3.2rem, 1fr));
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.nc-score,
.nc-pv-score {
  text-align: center;
  padding: 0.3rem 0.2rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
}

.nc-score-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
}

.nc-score-val {
  font-family: var(--font-display);
  font-size: var(--font-size-lg, 1.2rem);
  color: var(--color-text);
}

.nc-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.nc-stepper button {
  width: 1.4rem;
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
}

.nc-stepper button:disabled {
  opacity: 0.35;
  cursor: default;
}

.nc-score select,
.nc-score input,
.nc-bonus-pick select {
  width: 100%;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.nc-pv-line {
  padding: 0.5rem 0;
  font-family: var(--font-display);
  color: var(--color-text);
}

.nc-pv-list {
  margin: 0.5rem 0;
  font-size: var(--font-size-sm);
}

.nc-pv-list dt {
  margin-top: 0.4rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.nc-pv-list dd {
  margin: 0;
  color: var(--color-text);
}

@media (max-width: 900px) {
  .nc-body {
    grid-template-columns: 1fr;
  }
  .nc-preview {
    border-left: none;
    border-top: 1px solid var(--color-border);
  }
}
</style>
