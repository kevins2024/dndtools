<template>
  <div class="luc-root">
    <section
      v-for="c in choices"
      :key="c.id"
      class="luc-choice"
      :class="{ 'luc-done': c.answered, 'luc-bad': showError(c) }"
    >
      <header class="luc-head">
        <span class="luc-title">{{ c.title }}</span>
        <span v-if="c.level != null" class="luc-level"
          >level {{ c.level }}</span
        >
        <span class="luc-status">{{ status(c) }}</span>
      </header>
      <p class="luc-prompt">{{ c.prompt }}</p>
      <p v-if="showError(c)" class="luc-error">{{ c.error }}</p>

      <!-- Ability Score Improvement or feat -->
      <template v-if="c.kind === 'asiOrFeat'">
        <div class="luc-tabs">
          <button
            v-if="c.allowAsi"
            class="luc-btn"
            :class="{ active: mode(c) === 'asi' }"
            @click="setMode(c, 'asi')"
          >
            Ability scores
          </button>
          <button
            class="luc-btn"
            :class="{ active: mode(c) === 'feat' }"
            @click="setMode(c, 'feat')"
          >
            {{ c.epicBoon ? 'Epic Boon' : 'Feat' }}
          </button>
        </div>

        <div v-if="mode(c) === 'asi'" class="luc-asi">
          <div v-for="a in abilities" :key="a" class="luc-asi-row">
            <span class="luc-asi-name">{{ a.toUpperCase() }}</span>
            <button
              class="luc-btn"
              :disabled="!(asiDraft(c)[a] > 0)"
              @click="bump(c, a, -1)"
            >
              −
            </button>
            <span class="luc-asi-score">
              {{ c.scores[a] + (asiDraft(c)[a] || 0) }}
              <small v-if="asiDraft(c)[a]">(+{{ asiDraft(c)[a] }})</small>
            </span>
            <button
              class="luc-btn"
              :disabled="
                asiLeft(c) <= 0 ||
                c.scores[a] + (asiDraft(c)[a] || 0) >= c.cap ||
                (asiCount(c) >= 2 && !asiDraft(c)[a])
              "
              @click="bump(c, a, 1)"
            >
              +
            </button>
          </div>
          <div class="luc-note">
            {{ asiLeft(c) }} point(s) left · +2 to one score or +1 to two
          </div>
        </div>

        <div v-else class="luc-feat">
          <input
            v-model="search[c.id]"
            class="luc-search"
            placeholder="Search feats…"
          />
          <ul class="luc-list">
            <li v-for="f in visibleFeats(c)" :key="f.name">
              <button
                class="luc-option"
                :class="{ selected: featDraft(c).featName === f.name }"
                :disabled="!f.eligible"
                :title="f.reason || ''"
                @click="pickFeat(c, f)"
              >
                {{ f.name }}
                <span v-if="f.legacy" class="luc-tag">legacy</span>
                <span v-if="!f.eligible" class="luc-reason">{{
                  f.reason
                }}</span>
              </button>
            </li>
          </ul>
          <template v-if="selectedFeat(c)">
            <div
              v-if="
                selectedFeat(c).abilityChoices &&
                selectedFeat(c).abilityChoices.length > 1
              "
              class="luc-row"
            >
              <label
                >Increase which ability by
                {{ selectedFeat(c).abilityAmount || 1 }}?</label
              >
              <select
                :value="featDraft(c).abilityChoice || ''"
                @change="setFeatField(c, 'abilityChoice', $event.target.value)"
              >
                <option value="" disabled>Choose…</option>
                <option
                  v-for="a in selectedFeat(c).abilityChoices"
                  :key="a"
                  :value="a"
                >
                  {{ a.toUpperCase() }}
                </option>
              </select>
            </div>
            <div
              v-for="sub in selectedFeat(c).choices || []"
              :key="sub.id"
              class="luc-row"
            >
              <label>{{ sub.label }}</label>
              <select
                v-for="n in sub.count"
                :key="n"
                :value="subValue(c, sub, n - 1)"
                :disabled="!subOptions(c, sub).length"
                @change="setSub(c, sub, n - 1, $event.target.value)"
              >
                <option value="" disabled>Choose…</option>
                <option
                  v-for="o in subOptions(c, sub)"
                  :key="o.value"
                  :value="o.value"
                >
                  {{ o.label }}
                </option>
              </select>
            </div>
          </template>
        </div>
      </template>

      <!-- One pick per slot -->
      <template v-else-if="c.slots">
        <div v-for="(slot, i) in c.slots" :key="i" class="luc-row">
          <label>{{ slot.label }}</label>
          <select
            :value="(answerOf(c) || [])[i] || ''"
            @change="setSlot(c, i, $event.target.value)"
          >
            <option value="" disabled>Choose…</option>
            <option
              v-for="o in slot.options"
              :key="o.value"
              :value="o.value"
              :disabled="o.disabled"
            >
              {{ o.label }}
            </option>
          </select>
        </div>
      </template>

      <!-- Pick min..max from a list -->
      <template v-else>
        <input
          v-if="c.options.length > 12"
          v-model="search[c.id]"
          class="luc-search"
          placeholder="Search…"
        />
        <ul class="luc-list">
          <li v-for="o in visibleOptions(c)" :key="o.value">
            <button
              class="luc-option"
              :class="{ selected: isPicked(c, o.value) }"
              :disabled="o.disabled && !isPicked(c, o.value)"
              :title="o.reason || o.description || ''"
              @click="toggle(c, o)"
            >
              {{ o.label }}
              <span v-if="o.level != null" class="luc-tag">{{
                o.level === 0 ? 'cantrip' : 'level ' + o.level
              }}</span>
              <span v-if="o.school" class="luc-tag">{{ o.school }}</span>
              <span v-if="o.legacy" class="luc-tag">legacy</span>
              <span v-if="o.disabled" class="luc-reason">{{ o.reason }}</span>
            </button>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>

<script>
// Renders the questions a level-up asks, exactly as the engine describes them
// (engine/rules/5e/choiceProtocol.js): this component knows four kinds of question and nothing
// about any particular class, feature or rule. `choices` comes from POST /api/engine/level-up;
// `value` is the answers map { [choice.id]: answer } and is sent back unchanged.
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export default {
  name: 'LevelUpChoices',
  props: {
    choices: { type: Array, required: true },
    value: { type: Object, default: () => ({}) },
  },
  model: { prop: 'value', event: 'input' },
  data() {
    return { abilities: ABILITIES, search: {}, modes: {} }
  },
  methods: {
    answerOf(c) {
      return this.value[c.id]
    },
    emit(c, answer) {
      const next = { ...this.value }
      if (answer === null || answer === undefined) delete next[c.id]
      else next[c.id] = answer
      this.$emit('input', next)
    },
    status(c) {
      if (c.answered) return '✓'
      if (c.kind === 'asiOrFeat') return ''
      const n = (this.answerOf(c) || []).length
      return c.slots ? '' : `${n}/${c.max}`
    },
    // ── lists ──
    isPicked(c, v) {
      return (this.answerOf(c) || []).includes(v)
    },
    toggle(c, o) {
      const cur = this.answerOf(c) || []
      let next
      if (cur.includes(o.value)) next = cur.filter((x) => x !== o.value)
      else if (c.max === 1) next = [o.value]
      else if (cur.length >= c.max) return
      else next = [...cur, o.value]
      this.emit(c, next.length ? next : null)
    },
    visibleOptions(c) {
      const q = (this.search[c.id] || '').trim().toLowerCase()
      return q
        ? c.options.filter((o) => o.label.toLowerCase().includes(q))
        : c.options
    },
    setSlot(c, i, v) {
      const cur = this.answerOf(c) || []
      const next = c.slots.map((_, k) => cur[k] || '')
      next[i] = v
      this.emit(c, next)
    },
    // An answer that is merely not finished yet is not an error worth showing.
    showError(c) {
      const a = this.answerOf(c)
      if (!c.error) return false
      if (Array.isArray(a) && (a.length < c.min || a.includes(''))) return false
      return true
    },
    // ── ability score improvement / feat ──
    mode(c) {
      if (this.modes[c.id]) return this.modes[c.id]
      return !c.allowAsi || this.answerOf(c)?.type === 'feat' ? 'feat' : 'asi'
    },
    setMode(c, m) {
      this.$set(this.modes, c.id, m)
      this.emit(c, null)
    },
    asiDraft(c) {
      const a = this.answerOf(c)
      return a?.type === 'asi' ? a.increases : {}
    },
    asiLeft(c) {
      return (
        c.points - Object.values(this.asiDraft(c)).reduce((n, v) => n + v, 0)
      )
    },
    asiCount(c) {
      return Object.keys(this.asiDraft(c)).length
    },
    bump(c, a, d) {
      const inc = { ...this.asiDraft(c) }
      inc[a] = (inc[a] || 0) + d
      if (inc[a] <= 0) delete inc[a]
      this.emit(
        c,
        Object.keys(inc).length ? { type: 'asi', increases: inc } : null
      )
    },
    featDraft(c) {
      const a = this.answerOf(c)
      return a?.type === 'feat' ? a : {}
    },
    selectedFeat(c) {
      return c.feats.find((f) => f.name === this.featDraft(c).featName)
    },
    visibleFeats(c) {
      const q = (this.search[c.id] || '').trim().toLowerCase()
      return q
        ? c.feats.filter((f) => f.name.toLowerCase().includes(q))
        : c.feats
    },
    pickFeat(c, f) {
      this.emit(c, {
        type: 'feat',
        featName: f.name,
        abilityChoice:
          f.abilityChoices && f.abilityChoices.length === 1
            ? f.abilityChoices[0]
            : undefined,
        choices: undefined,
      })
    },
    setFeatField(c, key, v) {
      this.emit(c, { ...this.featDraft(c), [key]: v })
    },
    subOptions(c, sub) {
      if (sub.optionsBy) {
        const parent = (this.featDraft(c).choices || {})[sub.dependsOn]
        return sub.optionsBy[Array.isArray(parent) ? parent[0] : parent] || []
      }
      return sub.options || []
    },
    subValue(c, sub, i) {
      const v = (this.featDraft(c).choices || {})[sub.id]
      return (Array.isArray(v) ? v[i] : i === 0 ? v : '') || ''
    },
    setSub(c, sub, i, v) {
      const d = this.featDraft(c)
      const choices = { ...(d.choices || {}) }
      if (sub.count === 1) choices[sub.id] = v
      else {
        const list = [
          ...(Array.isArray(choices[sub.id]) ? choices[sub.id] : []),
        ]
        list[i] = v
        choices[sub.id] = list
      }
      this.emit(c, { ...d, choices })
    },
  },
}
</script>

<style scoped>
.luc-choice {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.7rem;
  background: var(--color-bg-surface);
}
.luc-done {
  border-color: var(--color-accent);
}
.luc-bad {
  border-color: #c0392b;
}
.luc-head {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
}
.luc-title {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
}
.luc-level,
.luc-status,
.luc-prompt,
.luc-note {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.luc-status {
  margin-left: auto;
}
.luc-prompt {
  margin: 0.2rem 0 0.5rem;
}
.luc-error {
  color: #c0392b;
  font-size: var(--font-size-sm);
}
.luc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 14rem;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.luc-option,
.luc-btn {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.25rem 0.6rem;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.luc-option.selected,
.luc-btn.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
}
.luc-option:disabled,
.luc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.luc-tag {
  margin-left: 0.3rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.luc-reason {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}
.luc-search {
  margin-bottom: 0.4rem;
  width: 100%;
  max-width: 20rem;
}
.luc-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 0.3rem 0;
  flex-wrap: wrap;
}
.luc-tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.luc-asi-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.15rem 0;
}
.luc-asi-name {
  width: 2.5rem;
}
.luc-asi-score {
  min-width: 4rem;
  text-align: center;
}
</style>
