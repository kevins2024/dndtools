<template>
  <div class="vitals-card">
    <div class="subrow-identity">
      <span class="level-badge" :title="`Level ${character.level}`"
        ><span class="level-num">{{ character.level }}</span></span
      >
      <span
        class="name-group"
        :class="{ 'has-tip': character.full_name }"
        :title="character.full_name"
        >{{ character.name }}</span
      >
    </div>

    <div class="subrow-subtitle">
      {{ character.race }} ·
      <template v-for="(entry, i) in subclassEntries"
        ><span
          :key="entry.key"
          :class="{ 'has-tip': entry.tooltip }"
          :title="entry.tooltip"
          >{{ entry.label }}</span
        ><span v-if="i < subclassEntries.length - 1" :key="entry.key + '-sep'">
          /
        </span></template
      >
    </div>

    <div class="subrow-hp">
      <HpTracker :character="character" />
    </div>
  </div>
</template>

<script>
import HpTracker from '@/components/HpTracker.vue'

// The character sheet's "always visible" card — identity and HP together
// so nothing vital ever scrolls out of view. AC/Speed/etc chips and
// Conditions live in their own top-row columns now, not here.
export default {
  name: 'VitalsSection',

  components: { HpTracker },

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    // One entry per class — shows the subclass where one's been chosen
    // (with a tooltip naming which class it belongs to, since a multiclass
    // character's subclasses don't otherwise say so), falling back to the
    // class name itself for a class with no subclass picked yet.
    subclassEntries() {
      const classes = this.character.classes ?? []
      const multi = classes.length > 1
      return classes.map((c) => ({
        key: c.name,
        label: c.subclass || c.name,
        tooltip: c.subclass ? (multi ? `${c.name} ${c.level}` : c.name) : null,
      }))
    },
  },
}
</script>

<style scoped>
.vitals-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.8rem 1rem;
  flex: 1 1 0;
  min-width: 0;
}

.subrow-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5em;
}

.level-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.9rem;
  height: 1.9rem;
  padding: 0 0.35em;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--color-accent-strong);
  line-height: 1;
  cursor: default;
}

.level-num {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-bg-panel);
}

.name-group {
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 600;
  line-height: 1;
  color: var(--color-accent-strong);
}

.subrow-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-accent);
}

.has-tip {
  border-bottom: 1px dotted currentColor;
  cursor: default;
}

.subrow-hp {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.3rem;
  border-top: 1px solid var(--color-bg-surface-alt);
}
</style>
