<template>
  <Dialog :open="open" @close="$emit('close')">
    <template #title>Save Changes</template>

    <p>The following data has been modified:</p>
    <div class="changes-list">
      <div
        v-for="entry in changeEntries"
        :key="entry.table"
        class="change-item"
      >
        <strong>{{ entry.table }}.json</strong> - {{ entry.summary }}
        <ul class="change-detail-list">
          <li v-for="(detail, idx) in entry.details" :key="idx">
            {{ detail }}
          </li>
        </ul>
      </div>
    </div>

    <template #actions>
      <button class="act-btn dim" @click="$emit('close')">Cancel</button>
      <button class="act-btn" @click="confirmSave">Save All Changes</button>
    </template>
  </Dialog>
</template>

<script>
import Dialog from './Dialog.vue'

export default {
  name: 'SaveDialog',

  components: { Dialog },

  props: {
    open: {
      type: Boolean,
      required: true,
    },
  },

  computed: {
    changeEntries() {
      return Object.entries(this.$store.getters.changes).map(
        ([table, change]) => ({
          table,
          summary: this.getChangeSummary(change),
          details: this.getChangeDetails(table, change),
        })
      )
    },
  },

  methods: {
    async confirmSave() {
      try {
        await this.$store.dispatch('saveAll')
        this.$emit('close')
        alert('Changes saved successfully!')
      } catch (error) {
        alert('Error saving changes: ' + error.message)
      }
    },
    getChangeSummary(change) {
      const isArray = Array.isArray(change.original)
      const origCount = isArray
        ? change.original.length
        : Object.keys(change.original).length
      const currCount = isArray
        ? change.current.length
        : Object.keys(change.current).length
      const type = isArray ? 'items' : 'properties'
      return `${origCount} → ${currCount} ${type}`
    },
    getChangeDetails(table, change) {
      if (Array.isArray(change.original) && Array.isArray(change.current)) {
        return this.getArrayDiffDetails(change.original, change.current)
      }
      if (
        change.original &&
        typeof change.original === 'object' &&
        change.current &&
        typeof change.current === 'object'
      ) {
        return this.getObjectDiffDetails(change.original, change.current)
      }
      return ['Change detected']
    },
    getArrayDiffDetails(original, current) {
      const byId = (items) =>
        items.reduce((map, item) => {
          if (item && item.id != null) map[item.id] = item
          return map
        }, {})

      const originalById = byId(original)
      const currentById = byId(current)
      const originalIds = Object.keys(originalById)
      const currentIds = Object.keys(currentById)

      if (originalIds.length > 0 && currentIds.length > 0) {
        const added = currentIds.filter((id) => !originalIds.includes(id))
        const removed = originalIds.filter((id) => !currentIds.includes(id))
        const modified = currentIds
          .filter((id) => originalIds.includes(id))
          .filter(
            (id) =>
              JSON.stringify(originalById[id]) !==
              JSON.stringify(currentById[id])
          )

        const details = []
        if (added.length)
          details.push(
            `Added: ${added.map((id) => this.describeItem(currentById[id])).join(', ')}`
          )
        if (removed.length)
          details.push(
            `Removed: ${removed.map((id) => this.describeItem(originalById[id])).join(', ')}`
          )
        modified.forEach((id) => {
          const changedKeys = this.getObjectDiffKeys(originalById[id], currentById[id])
          details.push(
            `Modified ${this.describeItem(currentById[id])}: ${changedKeys.join(', ')}`
          )
        })
        return details.length ? details : ['No item-level change details available']
      }

      return ['Array changed']
    },
    getObjectDiffDetails(original, current) {
      const keys = Array.from(
        new Set([...Object.keys(original), ...Object.keys(current)])
      )
      const changes = keys
        .filter(
          (key) =>
            JSON.stringify(original[key]) !== JSON.stringify(current[key])
        )
        .map(
          (key) =>
            `${key}: ${JSON.stringify(original[key])} → ${JSON.stringify(current[key])}`
        )
      return changes.length ? changes : ['No property-level changes detected']
    },
    getObjectDiffKeys(original, current) {
      const keys = Array.from(
        new Set([...Object.keys(original), ...Object.keys(current)])
      )
      return keys.filter(
        (key) =>
          JSON.stringify(original[key]) !== JSON.stringify(current[key])
      )
    },
    describeItem(item) {
      if (!item) return 'unknown'
      if (item.name) return `${item.name} (${item.id})`
      return item.id || 'unknown'
    },
  },
}
</script>

<style scoped>
.changes-list {
  margin: 1rem 0;
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.change-item {
  padding: 0.75rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: var(--font-size-small);
}

.change-detail-list {
  list-style: disc;
  margin: 0.5rem 0 0 1rem;
  padding: 0;
  color: var(--color-text-muted);
}

.change-detail-list li {
  margin-bottom: 0.35rem;
  line-height: 1.4;
}
</style>
