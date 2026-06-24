<template>
  <div class="rel-card">
    <div class="rel-header">
      <div class="rel-people">
        <template v-for="(name, i) in displayNames">
          <span v-if="i > 0" :key="'sep-' + i" class="rel-connector">↔</span>
          <span :key="name" class="rel-person">{{ name }}</span>
        </template>
      </div>
      <select
        class="rel-select rel-type-select"
        :value="relationship.type"
        @change="saveField('type', $event.target.value)"
      >
        <option
          v-if="!knownTypes.includes(relationship.type)"
          :value="relationship.type"
        >
          {{ formatType(relationship.type) }}
        </option>
        <optgroup label="Family">
          <option value="family">Family</option>
          <option value="family-clan">Family — Clan</option>
          <option value="sibling">Sibling</option>
          <option value="sibling-bond">Sibling Bond</option>
          <option value="ward">Ward</option>
        </optgroup>
        <optgroup label="Romantic">
          <option value="devotion">Devotion</option>
          <option value="affectionate-partnership">
            Affectionate Partnership
          </option>
          <option value="growing-romance">Growing Romance</option>
        </optgroup>
        <optgroup label="Friendship">
          <option value="old-friend">Old Friend</option>
          <option value="warm">Warm</option>
          <option value="new-warm">New — Warm</option>
          <option value="unexpected-friendship">Unexpected Friendship</option>
          <option value="instant-recognition">Instant Recognition</option>
          <option value="traveled-with">Traveled With</option>
        </optgroup>
        <optgroup label="Loyalty">
          <option value="loyalty-forming">Loyalty Forming</option>
          <option value="protective-warmth">Protective Warmth</option>
          <option value="careful-fascination">Careful Fascination</option>
          <option value="mutual-respect">Mutual Respect</option>
        </optgroup>
        <optgroup label="Complex">
          <option value="warm-complicated">Warm — Complicated</option>
          <option value="warm-distant">Warm — Distant</option>
          <option value="growing-complicated">Growing Complicated</option>
          <option value="complicated-beginning">Complicated Beginning</option>
          <option value="complicated-history">Complicated History</option>
          <option value="unaddressed">Unaddressed</option>
        </optgroup>
        <optgroup label="Professional">
          <option value="business-partner">Business Partner</option>
          <option value="colleague">Colleague</option>
          <option value="collegial-warmth">Collegial Warmth</option>
          <option value="works-for">Works For</option>
        </optgroup>
        <optgroup label="Other">
          <option value="communication">Communication</option>
          <option value="meeting-arranged">Meeting Arranged</option>
          <option value="sent">Sent</option>
          <option value="sent-by">Sent By</option>
        </optgroup>
      </select>
      <span
        class="renown-score-inline"
        :class="renownClass(relationship.renown)"
      >
        {{ relationship.renown }} · {{ renownLabel(relationship.renown) }}
      </span>
    </div>

    <textarea
      class="rel-textarea"
      :value="relationship.notes"
      placeholder="Notes…"
      rows="2"
      @blur="saveField('notes', $event.target.value)"
    />

    <div class="rel-footer">
      <div class="renown-controls">
        <button class="renown-btn" title="−1" @click="adjustRenown(-1)">
          −
        </button>
        <button
          class="renown-btn renown-btn--sm"
          title="−5"
          @click="adjustRenown(-5)"
        >
          −5
        </button>
        <span class="renown-label-full">Renown</span>
        <button
          class="renown-btn renown-btn--sm"
          title="+5"
          @click="adjustRenown(5)"
        >
          +5
        </button>
        <button class="renown-btn" title="+1" @click="adjustRenown(1)">
          +
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RelationshipCard',

  props: {
    relationship: { type: Object, required: true },
    displayNames: { type: Array, required: true },
  },

  computed: {
    knownTypes() {
      return [
        'family',
        'family-clan',
        'sibling',
        'sibling-bond',
        'ward',
        'devotion',
        'affectionate-partnership',
        'growing-romance',
        'old-friend',
        'warm',
        'new-warm',
        'unexpected-friendship',
        'instant-recognition',
        'traveled-with',
        'loyalty-forming',
        'protective-warmth',
        'careful-fascination',
        'mutual-respect',
        'warm-complicated',
        'warm-distant',
        'growing-complicated',
        'complicated-beginning',
        'complicated-history',
        'unaddressed',
        'business-partner',
        'colleague',
        'collegial-warmth',
        'works-for',
        'communication',
        'meeting-arranged',
        'sent',
        'sent-by',
      ]
    },
  },

  methods: {
    formatType(val) {
      return val.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    },

    saveField(field, value) {
      const trimmed = value.trim()
      if (this.relationship[field] === trimmed) return
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'relationships',
        updatedItem: { ...this.relationship, [field]: trimmed },
      })
    },

    adjustRenown(delta) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'relationships',
        updatedItem: {
          ...this.relationship,
          renown: this.relationship.renown + delta,
        },
      })
    },

    renownLabel(score) {
      if (score <= -10) return 'Strained'
      if (score < 0) return 'Cool'
      if (score === 0) return 'Neutral'
      if (score <= 10) return 'Warm'
      if (score <= 25) return 'Trusted'
      if (score <= 50) return 'Close'
      return 'Devoted'
    },

    renownClass(score) {
      if (score <= -10) return 'renown--strained'
      if (score < 0) return 'renown--cool'
      if (score === 0) return 'renown--neutral'
      if (score <= 10) return 'renown--warm'
      if (score <= 25) return 'renown--trusted'
      if (score <= 50) return 'renown--close'
      return 'renown--devoted'
    },
  },
}
</script>

<style scoped>
.rel-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6vh 0.8vw;
  display: flex;
  flex-direction: column;
  gap: 0.5vh;
}

/* ── Header ── */
.rel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1vw;
}

.rel-people {
  display: flex;
  align-items: center;
  gap: 0.4vw;
  flex-wrap: wrap;
}

.rel-person {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.rel-connector {
  color: var(--color-text-low);
  font-size: var(--font-size-sm);
}

.renown-score-inline {
  font-size: var(--font-size-sm);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Editable fields ── */
.rel-type-select {
  font-size: var(--font-size-sm);
  padding: 1px 4px;
}

.rel-select,
.rel-textarea {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  padding: 2px 6px;
  transition: border-color 0.1s;
  resize: none;
  width: 100%;
}

.rel-select:focus,
.rel-textarea:focus {
  border-color: var(--color-accent);
  outline: none;
}

.rel-textarea {
  line-height: 1.4;
}

/* ── Renown controls ── */
.rel-footer {
  border-top: 1px solid var(--color-border);
  padding-top: 0.4vh;
}

.renown-controls {
  display: flex;
  align-items: center;
  gap: 0.3vw;
}

.renown-label-full {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  flex: 1;
  text-align: center;
}

.renown-btn {
  background: var(--color-bg-panel-dark);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  line-height: 1;
  padding: 2px 7px;
  transition: border-color 0.1s, color 0.1s;
}
.renown-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.renown-btn--sm {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  padding: 2px 5px;
}

.renown--strained {
  color: var(--color-text-danger);
}
.renown--cool {
  color: var(--color-text-low);
}
.renown--neutral {
  color: var(--color-text-low);
}
.renown--warm {
  color: var(--color-text-muted);
}
.renown--trusted {
  color: var(--color-accent);
}
.renown--close {
  color: var(--color-accent-strong);
}
.renown--devoted {
  color: var(--color-highlight);
}
</style>
