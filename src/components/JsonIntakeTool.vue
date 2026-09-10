<template>
  <div class="intake">
    <div class="intake-header">
      <h3 class="intake-title">JSON Intake</h3>
      <p class="intake-desc">
        Paste JSON for a new place, NPC, lore entry, item, or asset. This checks
        it against the fields the real data actually uses, assigns a correct id
        itself, and — once it looks right — saves it straight into the real
        file. It only ever <strong>appends</strong> new entries; it never edits
        or overwrites anything already on disk.
      </p>
    </div>

    <div class="type-tabs">
      <button
        v-for="key in typeOrder"
        :key="key"
        class="type-tab"
        :class="{ active: selectedType === key }"
        @click="selectType(key)"
      >
        {{ SCHEMAS[key].label }}
      </button>
    </div>

    <div class="intake-body">
      <!-- Schema reference panel -->
      <div class="schema-panel">
        <div class="schema-panel-head">
          <span class="schema-panel-title"
            >Expected fields — {{ schema.label }}</span
          >
          <label class="occasional-toggle">
            <input type="checkbox" v-model="showOccasional" />
            show type-specific / occasional fields
          </label>
        </div>

        <select
          v-if="showOccasional && schema.typeField"
          class="type-filter"
          v-model="typeValueFilter"
        >
          <option value="">— all {{ schema.typeField }} values —</option>
          <option v-for="tv in typeValuesFor(schema)" :key="tv" :value="tv">
            only fields for {{ schema.typeField }} = "{{ tv }}"
          </option>
        </select>

        <div class="field-table">
          <div
            v-for="f in visibleFields"
            :key="f.key"
            class="field-row"
            :class="`level-${f.level}`"
          >
            <div class="field-key">
              {{ f.key }}
              <span class="field-level-badge">{{ levelLabel(f.level) }}</span>
            </div>
            <div class="field-meta">
              <span class="field-type">{{ f.type }}</span>
              <span v-if="f.description" class="field-desc">{{
                f.description
              }}</span>
              <span v-if="f.example" class="field-example"
                >e.g. {{ f.example }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Paste + validate -->
      <div class="intake-work">
        <textarea
          v-model="rawInput"
          class="paste-box"
          spellcheck="false"
          placeholder="Paste one JSON object, or an array of them, here…"
        ></textarea>

        <div class="work-actions">
          <button class="action-btn action-btn--primary" @click="validate">
            Validate
          </button>
          <button
            v-if="rawInput || results.length"
            class="ghost-btn"
            @click="reset"
          >
            Clear
          </button>
          <span v-if="parseError" class="parse-error">{{ parseError }}</span>
        </div>

        <!-- Per-entry results -->
        <div v-if="results.length" class="results">
          <div
            v-for="r in results"
            :key="r.index"
            class="result-card"
            :class="`status-${r.status}`"
          >
            <div class="result-head">
              <span class="result-name">{{ r.displayName }}</span>
              <span class="result-badge" :class="`badge-${r.status}`">{{
                statusLabel(r.status)
              }}</span>
            </div>

            <ul v-if="r.errors.length" class="issue-list issue-error">
              <li v-for="(e, i) in r.errors" :key="'e' + i">{{ e }}</li>
            </ul>
            <ul v-if="r.warnings.length" class="issue-list issue-warning">
              <li v-for="(w, i) in r.warnings" :key="'w' + i">{{ w }}</li>
            </ul>

            <label v-if="r.duplicate" class="force-dup">
              <input
                type="checkbox"
                v-model="r.forceDuplicate"
                @change="revalidateOne(r.index)"
              />
              Yes, this is intentionally separate from the existing "{{
                r.duplicate
              }}" — add it anyway
            </label>

            <details class="cleaned-preview">
              <summary>Preview what will be saved</summary>
              <pre>{{ prettyClean(r) }}</pre>
            </details>
          </div>
        </div>

        <!-- Save -->
        <div v-if="results.length" class="save-row">
          <button
            class="action-btn action-btn--primary"
            :disabled="readyCount === 0 || saving"
            @click="saveReady"
          >
            {{
              saving
                ? 'Saving…'
                : `Save ${readyCount} entr${
                    readyCount === 1 ? 'y' : 'ies'
                  } to ${schema.table}.json`
            }}
          </button>
          <span v-if="blockedCount" class="save-hint"
            >{{ blockedCount }} blocked entr{{
              blockedCount === 1 ? 'y' : 'ies'
            }}
            will be skipped.</span
          >
        </div>

        <div v-if="saveError" class="dm-error">{{ saveError }}</div>
        <div v-if="saveSummary" class="save-success">
          Saved {{ saveSummary.count }} entr{{
            saveSummary.count === 1 ? 'y' : 'ies'
          }}
          to {{ saveSummary.table }}.json.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  SCHEMAS,
  SCHEMA_ORDER,
  knownFieldKeys,
} from '@/utils/jsonIntakeSchemas'

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Forgives the most common ways AI-generated JSON breaks: a wrapping
// markdown code fence, trailing commas, and smart/curly quotes. Deliberately
// does NOT try to fix unquoted keys or single-quoted strings — those fixes
// are ambiguous (an apostrophe inside a real name, e.g. "Therynv'l", would
// get mangled) and a wrong silent "fix" is worse than surfacing the error.
function parseLenient(raw) {
  let text = raw.trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) text = fenced[1]

  try {
    return JSON.parse(text)
  } catch (e) {
    let fixed = text
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,(\s*[\]}])/g, '$1')
    try {
      return JSON.parse(fixed)
    } catch (e2) {
      throw e
    }
  }
}

export default {
  name: 'JsonIntakeTool',

  data() {
    return {
      SCHEMAS,
      typeOrder: SCHEMA_ORDER,
      selectedType: SCHEMA_ORDER[0],
      showOccasional: false,
      typeValueFilter: '',
      rawInput: '',
      parseError: '',
      parsedEntries: [],
      results: [],
      saving: false,
      saveError: '',
      saveSummary: null,
    }
  },

  computed: {
    schema() {
      return SCHEMAS[this.selectedType]
    },
    existingRows() {
      return this.$store.state[this.schema.table] || []
    },
    visibleFields() {
      return this.schema.fields.filter((f) => {
        if (f.level !== 'occasional') return true
        if (!this.showOccasional) return false
        if (this.typeValueFilter && f.when) {
          return f.when.includes(this.typeValueFilter)
        }
        return true
      })
    },
    readyCount() {
      return this.results.filter((r) => r.status !== 'blocked').length
    },
    blockedCount() {
      return this.results.filter((r) => r.status === 'blocked').length
    },
  },

  methods: {
    selectType(key) {
      this.selectedType = key
      this.typeValueFilter = ''
      this.reset()
    },

    levelLabel(level) {
      return { required: 'required', common: 'common', occasional: '' }[level]
    },

    statusLabel(status) {
      return { ready: '✓ ready', warning: '⚠ warnings', blocked: '⛔ blocked' }[
        status
      ]
    },

    typeValuesFor(schema) {
      if (schema.typeValues) return schema.typeValues
      // Derive from whatever values already exist in the live table.
      const seen = new Set()
      for (const row of this.existingRows) {
        if (row[schema.typeField]) seen.add(row[schema.typeField])
      }
      return [...seen].sort()
    },

    reset() {
      this.rawInput = ''
      this.parseError = ''
      this.parsedEntries = []
      this.results = []
      this.saveError = ''
      this.saveSummary = null
    },

    validate() {
      this.parseError = ''
      this.saveError = ''
      this.saveSummary = null
      let parsed
      try {
        parsed = parseLenient(this.rawInput)
      } catch (e) {
        this.parseError = `Couldn't parse that as JSON: ${e.message}`
        this.results = []
        return
      }

      // Normalize to an array of plain objects — accepts a bare object, an
      // array of objects, or a wrapper object with one array-valued property
      // (e.g. an AI handing back { "npcs": [...] }).
      let entries
      if (Array.isArray(parsed)) {
        entries = parsed
      } else if (parsed && typeof parsed === 'object') {
        const arrayProps = Object.values(parsed).filter(Array.isArray)
        entries =
          arrayProps.length === 1 && Object.keys(parsed).length === 1
            ? arrayProps[0]
            : [parsed]
      } else {
        this.parseError = 'Expected a JSON object or array of objects.'
        return
      }

      this.parsedEntries = entries
      // Built up incrementally (not entries.map) so each entry's duplicate/
      // id-collision check can see the already-resolved ids of EARLIER
      // entries in this same paste, not just what was on disk before this
      // batch started — otherwise pasting three new lore entries that all
      // slugify to the same id would silently collide with each other.
      const batch = []
      for (let index = 0; index < entries.length; index++) {
        batch.push(this.buildResult(entries[index], index, false, batch))
      }
      this.results = batch
    },

    revalidateOne(index) {
      const prior = this.results[index]
      this.results.splice(
        index,
        1,
        this.buildResult(
          this.parsedEntries[index],
          index,
          prior.forceDuplicate,
          this.results
        )
      )
    },

    buildResult(raw, index, forceDuplicate, batchSoFar) {
      const schema = this.schema
      const known = knownFieldKeys(this.selectedType)
      const errors = []
      const warnings = []

      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
          index,
          displayName: `Entry ${index + 1}`,
          status: 'blocked',
          errors: ['Not a JSON object.'],
          warnings: [],
          duplicate: null,
          forceDuplicate: false,
          clean: null,
        }
      }

      // Required / common presence check
      for (const f of schema.fields) {
        if (f.level === 'occasional') continue
        for (const key of f.key.split('/').map((s) => s.trim())) {
          const missing =
            raw[key] === undefined || raw[key] === null || raw[key] === ''
          if (missing) {
            const msg = `Missing "${key}" (${f.level}).`
            if (f.level === 'required') errors.push(msg)
            else warnings.push(msg)
          }
        }
      }

      // Unrecognized-field / typo check
      for (const key of Object.keys(raw)) {
        if (key === 'id') continue
        if (known.has(key)) continue
        let suggestion = null
        let best = Infinity
        for (const k of known) {
          const d = levenshtein(key.toLowerCase(), k.toLowerCase())
          if (d < best) {
            best = d
            suggestion = k
          }
        }
        warnings.push(
          best <= 2
            ? `Unrecognized field "${key}" — did you mean "${suggestion}"?`
            : `Unrecognized field "${key}" — not one of the standard fields for ${schema.label}.`
        )
      }

      // Duplicate check
      let duplicate = null
      if (schema.uniqueKey === 'name' && raw.name) {
        const match = this.existingRows.find(
          (row) =>
            row.name &&
            row.name.toLowerCase() === String(raw.name).toLowerCase()
        )
        if (match) duplicate = match.name
      }

      // Whether THIS entry will actually be included in the save batch —
      // decided now (before the id preview below) so a sequential id preview
      // can count only the non-blocked entries ahead of it, matching what
      // ADD_TABLE_ROWS/ADD_PARTY_ITEMS will actually mint at save time (they
      // only ever see the ready+warning subset, never the blocked ones).
      const blockedByDuplicate = duplicate && !forceDuplicate
      const willBeIncluded = errors.length === 0 && !blockedByDuplicate

      // Id resolution
      const clean = { ...raw }
      let idNote = null
      if (schema.table === 'lore') {
        const existingIds = new Set(this.existingRows.map((r) => r.id))
        const inBatchIds = new Set(
          (batchSoFar || [])
            .filter((r) => r.index !== index && r.clean)
            .map((r) => r.clean.id)
        )
        let base = slugify(raw.id || raw.name || raw.summary)
        if (!base) {
          errors.push(
            'No id, name, or summary to derive a slug id from — add at least one.'
          )
        } else {
          let candidate = base
          let n = 2
          while (existingIds.has(candidate) || inBatchIds.has(candidate)) {
            candidate = `${base}-${n++}`
          }
          if (candidate !== (raw.id ? slugify(raw.id) : base)) {
            idNote = `id set to "${candidate}"${
              raw.id ? ` (adjusted from "${raw.id}")` : ' (auto-generated)'
            } to stay unique.`
          }
          clean.id = candidate
        }
      } else if (schema.idPrefix) {
        // Real id is minted at save time (ADD_TABLE_ROWS / ADD_PARTY_ITEMS)
        // so ids stay correct even across multiple validate passes; this is
        // just a preview.
        delete clean.id
        const nums = this.existingRows
          .map((r) => new RegExp(`^${schema.idPrefix}_(\\d+)$`).exec(r.id)?.[1])
          .filter(Boolean)
          .map(Number)
        const base = nums.length ? Math.max(...nums) + 1 : 0
        const readyAheadOfThis = (batchSoFar || []).filter(
          (r) => r.index !== index && r.status !== 'blocked'
        ).length
        idNote = willBeIncluded
          ? `id will be assigned: ${schema.idPrefix}_${base + readyAheadOfThis}`
          : null
      } else {
        delete clean.id
      }

      if (blockedByDuplicate) {
        warnings.push(
          `An entry named "${duplicate}" already exists in ${schema.table}.json.`
        )
      }

      const status =
        errors.length || blockedByDuplicate
          ? 'blocked'
          : warnings.length
          ? 'warning'
          : 'ready'

      return {
        index,
        displayName:
          raw.name || raw.summary || clean.id || `Entry ${index + 1}`,
        status,
        errors,
        warnings,
        duplicate,
        forceDuplicate,
        clean,
        idNote,
      }
    },

    prettyClean(r) {
      if (!r.clean) return ''
      const withNote = r.idNote ? { ...r.clean, _id_note: r.idNote } : r.clean
      return JSON.stringify(withNote, null, 2)
    },

    async saveReady() {
      const ready = this.results.filter((r) => r.status !== 'blocked')
      if (!ready.length || this.saving) return
      this.saving = true
      this.saveError = ''
      try {
        const rows = ready.map((r) => r.clean)
        if (this.schema.table === 'party_items') {
          this.$store.commit('ADD_PARTY_ITEMS', rows)
        } else {
          this.$store.commit('ADD_TABLE_ROWS', {
            table: this.schema.table,
            rows,
            idPrefix: this.schema.idPrefix,
          })
        }
        const result = await this.$store.dispatch('save', this.schema.table)
        if (result?.conflicts?.length) {
          this.saveError = `Saved, but the server reported conflicts on: ${result.conflicts.join(
            ', '
          )} — worth double-checking ${this.schema.table}.json.`
        }
        this.saveSummary = { count: ready.length, table: this.schema.table }
        this.rawInput = ''
        this.parsedEntries = []
        this.results = []
      } catch (err) {
        this.saveError = `Save failed: ${err.message}`
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped>
.intake {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2vh 1.5rem;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.intake-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-text);
  margin: 0 0 0.4rem;
}

.intake-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  margin: 0;
  line-height: 1.5;
  max-width: 760px;
}

.type-tabs {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.type-tab {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  padding: 0.35em 1em;
  font-size: var(--font-size-md);
  font-family: var(--font-display);
  cursor: pointer;
}

.type-tab:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.type-tab.active {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  background: var(--color-bg-surface);
}

.intake-body {
  display: grid;
  grid-template-columns: minmax(280px, 380px) 1fr;
  gap: 1.25rem;
  align-items: start;
  min-height: 0;
}

.schema-panel {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 75vh;
  overflow-y: auto;
}

.schema-panel-head {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.schema-panel-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.occasional-toggle {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  cursor: pointer;
}

.type-filter {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  padding: 0.3em 0.5em;
  font-size: var(--font-size-sm);
}

.field-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-row {
  border-left: 3px solid var(--color-border);
  padding-left: 0.6rem;
}

.field-row.level-required {
  border-left-color: var(--color-accent-strong);
}

.field-row.level-common {
  border-left-color: var(--color-accent);
}

.field-key {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  flex-wrap: wrap;
}

.field-level-badge {
  font-family: var(--font-display);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-low);
}

.field-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: 0.15rem;
}

.field-type {
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}

.field-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  line-height: 1.4;
}

.field-example {
  font-size: 0.78rem;
  color: var(--color-text-low);
  font-family: monospace;
  opacity: 0.8;
}

.intake-work {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.paste-box {
  width: 100%;
  min-height: 220px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: monospace;
  font-size: var(--font-size-sm);
  padding: 0.75rem;
  box-sizing: border-box;
  resize: vertical;
}

.work-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-btn {
  background: var(--color-bg-panel);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.5em 1.2em;
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: border-color 0.15s;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.action-btn--primary {
  background: var(--color-accent);
  color: var(--color-bg);
  border-color: var(--color-accent);
  font-weight: 600;
}

.action-btn--primary:hover:not(:disabled) {
  color: var(--color-bg);
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.ghost-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  padding: 0.4em 0.9em;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.ghost-btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-low);
}

.parse-error {
  color: #f28b82;
  font-size: var(--font-size-sm);
}

.results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-left: 4px solid var(--color-border);
}

.result-card.status-ready {
  border-left-color: #6fbf73;
}

.result-card.status-warning {
  border-left-color: #d9a441;
}

.result-card.status-blocked {
  border-left-color: #d9534f;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.result-name {
  font-family: var(--font-display);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.result-badge {
  font-size: var(--font-size-sm);
  padding: 0.1em 0.6em;
  border-radius: 3px;
  white-space: nowrap;
}

.badge-ready {
  color: #6fbf73;
  background: rgba(111, 191, 115, 0.12);
}

.badge-warning {
  color: #d9a441;
  background: rgba(217, 164, 65, 0.12);
}

.badge-blocked {
  color: #d9534f;
  background: rgba(217, 83, 79, 0.12);
}

.issue-list {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--font-size-sm);
}

.issue-error {
  color: #f28b82;
}

.issue-warning {
  color: #d9a441;
}

.force-dup {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  cursor: pointer;
}

.cleaned-preview {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.cleaned-preview summary {
  cursor: pointer;
}

.cleaned-preview pre {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.6rem;
  overflow-x: auto;
  font-size: 0.78rem;
  margin-top: 0.4rem;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.save-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.dm-error {
  background: #3a1a1a;
  border: 1px solid #7a2a2a;
  border-radius: 4px;
  color: #f28b82;
  padding: 0.6em 1em;
  font-size: var(--font-size-sm);
}

.save-success {
  background: rgba(111, 191, 115, 0.12);
  border: 1px solid #6fbf73;
  border-radius: 4px;
  color: #6fbf73;
  padding: 0.6em 1em;
  font-size: var(--font-size-sm);
}
</style>
