<template>
  <div class="editable-object">
    <div v-for="(value, key) in localItem" :key="key" class="field-row">
      <strong class="field-key">{{ key }}:</strong>

      <template v-if="!editing">
        <span v-if="isPrimitive(value)">{{ value }}</span>
        <pre v-else class="json-preview">{{
          JSON.stringify(value, null, 2)
        }}</pre>
      </template>

      <template v-else>
        <input
          v-if="isPrimitive(value)"
          v-model="localItem[key]"
          class="field-input"
        />
        <textarea
          v-else
          v-model="localJsonFields[key]"
          rows="6"
          class="field-textarea"
        />
      </template>
    </div>

    <div class="actions">
      <button v-if="!editing" @click="startEdit">Edit</button>
      <template v-else>
        <button @click="save">Save</button>
        <button @click="cancel">Cancel</button>
      </template>
    </div>

    <div v-if="jsonError" class="json-error">{{ jsonError }}</div>
  </div>
</template>

<script>
export default {
  name: 'Editor',
  props: {
    item: { type: Object, required: true },
    storeName: { type: String, required: true },
  },
  data() {
    return {
      editing: false,
      localItem: null,
      localJsonFields: {}, // holds stringified versions of nested fields while editing
      jsonError: null,
    }
  },
  created() {
    this.localItem = { ...this.item }
  },
  methods: {
    isPrimitive(value) {
      return value === null || typeof value !== 'object'
    },

    getMutationName() {
      return 'UPDATE_TABLE_ITEM'
    },

    startEdit() {
      this.localItem = { ...this.item }
      // Stringify all nested fields into localJsonFields for textarea editing
      this.localJsonFields = {}
      for (const [key, value] of Object.entries(this.localItem)) {
        if (!this.isPrimitive(value)) {
          this.localJsonFields[key] = JSON.stringify(value, null, 2)
        }
      }
      this.editing = true
      this.jsonError = null
    },

    cancel() {
      this.localItem = { ...this.item }
      this.localJsonFields = {}
      this.editing = false
      this.jsonError = null
    },

    save() {
      // Parse all JSON textarea fields back into objects
      const merged = { ...this.localItem }
      for (const [key, raw] of Object.entries(this.localJsonFields)) {
        try {
          merged[key] = JSON.parse(raw)
        } catch {
          this.jsonError = `Invalid JSON in field "${key}"`
          return
        }
      }
      this.$store.commit(this.getMutationName(), {
        table: this.storeName,
        updatedItem: merged,
      })
      this.editing = false
      this.jsonError = null
    },
  },
  watch: {
    item(newVal) {
      this.localItem = { ...newVal }
      this.localJsonFields = {}
      this.editing = false
      this.jsonError = null
    },
  },
}
</script>
