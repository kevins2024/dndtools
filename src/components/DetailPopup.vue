<template>
  <Dialog :open="open" @close="onClose">
    <template #title>
      <div class="dp-header">
        <div class="dp-titles">
          <span class="dp-name">{{ item.title }}</span>
          <span v-if="displaySubtitle" class="dp-subtitle">{{ displaySubtitle }}</span>
        </div>
        <div class="dp-header-actions">
          <template v-if="editing">
            <button class="dp-action-btn dp-save" :disabled="saving" @click="save">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
            <button class="dp-action-btn dp-cancel" @click="cancelEdit">Cancel</button>
          </template>
          <button v-else class="dp-action-btn dp-edit" @click="startEdit">Edit</button>
          <button class="dp-close" @click="onClose">✕</button>
        </div>
      </div>
    </template>

    <!-- View mode -->
    <template v-if="!editing">
      <div v-if="displayFields.length" class="dp-fields">
        <div v-for="f in displayFields" :key="f.label" class="dp-field">
          <span class="dp-field-label">{{ f.label }}</span>
          <span class="dp-field-value">{{ f.value }}</span>
        </div>
      </div>
      <div class="dp-desc">
        <template v-if="displayDescription">{{ displayDescription }}</template>
        <span v-else class="dp-no-desc">No description available — click Edit to add one.</span>
      </div>
    </template>

    <!-- Edit mode -->
    <template v-else>
      <div class="dp-edit-form">
        <!-- Spell fields -->
        <template v-if="item.itemType === 'spell'">
          <div class="dp-edit-row">
            <label class="dp-edit-label">School<input v-model="draft.school" class="dp-edit-input" placeholder="e.g. Enchantment" /></label>
            <label class="dp-edit-label">Casting Time<input v-model="draft.casting_time" class="dp-edit-input" placeholder="e.g. 1 reaction" /></label>
            <label class="dp-edit-label">Range<input v-model="draft.range" class="dp-edit-input" placeholder="e.g. 60 feet" /></label>
          </div>
          <div class="dp-edit-row">
            <label class="dp-edit-label">Duration<input v-model="draft.duration" class="dp-edit-input" placeholder="e.g. Instantaneous" /></label>
            <label class="dp-edit-label">Components<input v-model="draft.components" class="dp-edit-input" placeholder="e.g. V, S" /></label>
            <label class="dp-edit-label">Save<input v-model="draft.save" class="dp-edit-input" placeholder="e.g. Constitution" /></label>
            <label class="dp-edit-label">Damage Type<input v-model="draft.damage_type" class="dp-edit-input" placeholder="e.g. Psychic" /></label>
          </div>
        </template>

        <!-- Feature fields -->
        <template v-else>
          <div class="dp-edit-row">
            <label class="dp-edit-label">Subtitle<input v-model="draft.subtitle" class="dp-edit-input" placeholder="e.g. Rogue · Level 3" /></label>
            <label class="dp-edit-label">Action Type<input v-model="draft.action_type" class="dp-edit-input" placeholder="e.g. bonus_action" /></label>
            <label class="dp-edit-label">Recharge<input v-model="draft.recharge" class="dp-edit-input" placeholder="e.g. short_rest" /></label>
          </div>
        </template>

        <label class="dp-edit-label dp-edit-desc-label">
          Description
          <textarea v-model="draft.description" class="dp-edit-textarea" rows="8" placeholder="Enter description…" />
        </label>

        <p v-if="saveError" class="dp-save-error">{{ saveError }}</p>
      </div>
    </template>
  </Dialog>
</template>

<script>
import Dialog from '@/components/Dialog.vue'
import { saveToHomebrew } from '@/utils/lookupService.js'

export default {
  name: 'DetailPopup',
  components: { Dialog },

  props: {
    open: { type: Boolean, required: true },
    item: {
      type: Object,
      default: () => ({ title: '', subtitle: null, description: null, fields: [], itemType: null, editable: null }),
    },
  },

  emits: ['close', 'saved'],

  data() {
    return {
      editing: false,
      saving: false,
      saveError: null,
      draft: {},
      // After a successful save, override the display with these values.
      savedData: null,
    }
  },

  computed: {
    displaySubtitle() {
      if (this.savedData) return this.savedData.subtitle ?? this.item.subtitle
      return this.item.subtitle
    },
    displayDescription() {
      if (this.savedData) return this.savedData.description
      return this.item.description
    },
    displayFields() {
      if (this.savedData && this.item.itemType === 'spell') {
        const d = this.savedData
        const fields = []
        if (d.casting_time) fields.push({ label: 'Cast', value: d.casting_time })
        if (d.range) fields.push({ label: 'Range', value: d.range })
        if (d.duration) fields.push({ label: 'Duration', value: d.duration })
        if (d.components) fields.push({ label: 'Comp', value: d.components })
        if (d.save) fields.push({ label: 'Save', value: d.save })
        if (d.damage_type) fields.push({ label: 'Dmg', value: d.damage_type })
        return fields
      }
      return this.item.fields ?? []
    },
  },

  watch: {
    // Reset edit state whenever a new item is opened.
    'item.title'() {
      this.editing = false
      this.savedData = null
      this.saveError = null
    },
  },

  methods: {
    onClose() {
      this.editing = false
      this.savedData = null
      this.saveError = null
      this.$emit('close')
    },

    startEdit() {
      const base = this.item.editable ?? {}
      // Pre-fill from savedData if we already edited once this session.
      const src = this.savedData ? { ...base, ...this.savedData } : base
      this.draft = { ...src }
      this.saveError = null
      this.editing = true
    },

    cancelEdit() {
      this.editing = false
      this.saveError = null
    },

    async save() {
      this.saving = true
      this.saveError = null

      const section = this.item.itemType === 'spell' ? 'spells' : 'features'
      const payload = { name: this.item.title, ...this.draft }

      // Strip empty strings so we don't overwrite with blanks.
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') payload[k] = null
      }

      const ok = await saveToHomebrew(section, payload)

      if (ok) {
        this.savedData = { ...payload }
        this.editing = false
        this.$emit('saved', { section, data: payload })
      } else {
        this.saveError = 'Save failed — is the dev server running on port 3001?'
      }

      this.saving = false
    },
  },
}
</script>

<style scoped>
.dp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.dp-titles {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dp-name {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.dp-subtitle {
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  letter-spacing: 0.03em;
}

.dp-header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.dp-action-btn {
  font-size: var(--font-size-tiny);
  padding: 0.2rem 0.55rem;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-muted);
  cursor: pointer;
  line-height: 1.4;
  transition: border-color 0.12s, color 0.12s;
}

.dp-action-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.dp-edit:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.dp-save {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.dp-save:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-bg);
}

.dp-cancel:hover {
  border-color: var(--color-text-low);
  color: var(--color-text);
}

.dp-close {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-small);
  padding: 0;
  line-height: 1;
}

.dp-close:hover {
  color: var(--color-text);
}

/* ── View mode ── */
.dp-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.dp-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.25rem 0.6rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  min-width: 3.5rem;
}

.dp-field-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-low);
}

.dp-field-value {
  font-size: var(--font-size-tiny);
  color: var(--color-text);
  margin-top: 0.1rem;
}

.dp-desc {
  margin-top: 0.85rem;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 40vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.dp-no-desc {
  color: var(--color-text-low);
  font-style: italic;
}

/* ── Edit mode ── */
.dp-edit-form {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dp-edit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dp-edit-label {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-low);
  flex: 1;
  min-width: 6rem;
}

.dp-edit-desc-label {
  min-width: 100%;
}

.dp-edit-input {
  font-size: var(--font-size-tiny);
  padding: 0.25rem 0.4rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
  width: 100%;
  box-sizing: border-box;
}

.dp-edit-input:focus,
.dp-edit-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.dp-edit-textarea {
  font-size: var(--font-size-tiny);
  padding: 0.35rem 0.4rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  line-height: 1.55;
  font-family: inherit;
}

.dp-save-error {
  font-size: var(--font-size-tiny);
  color: #c0392b;
  margin: 0;
}
</style>
