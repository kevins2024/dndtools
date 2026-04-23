<template>
  <div class="character-sheet" v-if="character">
    <!-- Header: portrait + identity -->
    <div class="sheet-header">
      <div
        class="portrait"
        :style="{ backgroundImage: `url(${character.image})` }"
      />
      <div class="identity">
        <h2 class="char-name">{{ character.name }}</h2>
        <div class="char-fullname">{{ character.full_name }}</div>
        <div class="char-subtitle">
          {{ character.race }} ·
          <template v-if="character.class_breakdown">{{ character.class_breakdown }}</template>
          <template v-else>{{ character.class }}<span v-if="character.subclass"> ({{ character.subclass }})</span> · Level {{ character.level }}</template>
        </div>
        <div class="char-appearance">{{ character.appearance }}</div>
      </div>
    </div>

    <!-- Combat stats -->
    <CharacterCombatPanel :character="character" />

    <!-- Stats -->
    <div class="sheet-section">
      <div class="section-title">Ability Scores</div>
      <div class="stat-grid">
        <div v-for="stat in stats" :key="stat.key" class="stat-block">
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-score">{{ stat.score }}</div>
          <div class="stat-mod" :class="stat.mod >= 0 ? 'pos' : 'neg'">
            {{ stat.modStr }}
          </div>
        </div>
      </div>
    </div>

    <!-- Saving throws + skills -->
    <div class="sheet-row">
      <div class="sheet-section half">
        <div class="section-title">Saving Throws</div>
        <div class="pill-list">
          <span
            v-for="s in allSaves"
            :key="s.key"
            class="pill"
            :class="{ proficient: character.saving_throws.includes(s.key) }"
          >
            {{ s.label }}
            <span class="pill-mod">{{ saveModStr(s.key) }}</span>
          </span>
        </div>
      </div>
      <div class="sheet-section half">
        <div class="section-title">Skill Proficiencies</div>
        <div class="pill-list">
          <span
            v-for="skill in character.skill_proficiencies"
            :key="skill"
            class="pill proficient"
          >
            {{ skill }}
          </span>
        </div>
      </div>
    </div>

    <!-- Languages -->
    <div class="sheet-section">
      <div class="section-title">Languages</div>
      <div class="pill-list">
        <span v-for="lang in character.languages" :key="lang" class="pill">{{
          lang
        }}</span>
      </div>
    </div>

    <!-- Personality -->
    <div
      class="sheet-section"
      v-if="character.personality_traits || character.personality_quirks"
    >
      <div class="section-title">Personality</div>
      <p v-if="character.personality_traits" class="flavor-text">
        {{ character.personality_traits }}
      </p>
      <p v-if="character.personality_quirks" class="flavor-text quirk">
        {{ character.personality_quirks }}
      </p>
    </div>

    <!-- Features grouped by type -->
    <div
      v-for="(group, type) in featureGroups"
      :key="type"
      class="sheet-section"
    >
      <div class="section-title">{{ capitalize(type) }}s</div>
      <div class="feature-list">
        <div v-for="f in group" :key="f.name" class="feature-item">
          <span class="feature-name">{{ f.name }}</span>
          <span v-if="f.uses_max" class="feature-uses">
            {{ f.uses_current }} / {{ f.uses_max }}
          </span>
          <span v-if="f.recharge" class="feature-recharge">{{
            f.recharge
          }}</span>
          <span v-if="f.action_type" class="feature-action">{{
            f.action_type
          }}</span>
        </div>
      </div>
    </div>

    <!-- Spells -->
    <div
      class="sheet-section"
      v-if="character.spells && character.spells.length"
    >
      <div class="section-title">Spells</div>
      <div class="feature-list">
        <div
          v-for="spell in character.spells"
          :key="spell.name"
          class="feature-item"
        >
          <span class="feature-name">{{ spell.name }}</span>
        </div>
      </div>
    </div>

    <!-- Active effects -->
    <div
      class="sheet-section"
      v-if="character.active_effects && character.active_effects.length"
    >
      <div class="section-title">Active Effects</div>
      <div class="feature-list">
        <div
          v-for="effect in character.active_effects"
          :key="effect.name"
          class="feature-item"
        >
          <span class="feature-name">{{ effect.name }}</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div class="sheet-section" v-if="character.notes">
      <div class="section-title">Notes</div>
      <p class="flavor-text">{{ character.notes }}</p>
    </div>
  </div>
</template>

<script>
import { STAT_KEYS, dnd } from '@/utils/dnd_utils.js'
import CharacterCombatPanel from '@/components/CharacterCombatPanel.vue'

const SAVE_KEYS = STAT_KEYS

export default {
  name: 'CharacterSheet',

  components: { CharacterCombatPanel },

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    stats() {
      return dnd.statArray(this.character)
    },

    allSaves() {
      return SAVE_KEYS
    },

    featureGroups() {
      if (!this.character.features) return {}
      return this.character.features.reduce((groups, f) => {
        const type = f.type || 'feature'
        if (!groups[type]) groups[type] = []
        groups[type].push(f)
        return groups
      }, {})
    },
  },

  methods: {
    saveModStr(key) {
      const score = this.character[`stat_${key}`]
      const mod = this.$dnd.mod(score)
      const proficient = this.character.saving_throws.includes(key)
      const total = proficient ? mod + this.character.proficiency_bonus : mod
      return this.$dnd.signed(total)
    },

    capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1)
    },
  },
}
</script>

<style scoped>
.character-sheet {
  display: flex;
  flex-direction: column;
  gap: 1.2vh;
  padding: 1.5vh 1.5vw;
  color: var(--color-text);
  font-family: var(--font-body);
}

/* ── Header ── */
.sheet-header {
  display: flex;
  gap: 1.5vw;
  align-items: flex-start;
}

.portrait {
  width: 10vw;
  min-width: 100px;
  aspect-ratio: 13 / 16;
  background-size: cover;
  background-position: 50% 0%;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  flex-shrink: 0;
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.char-name {
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  font-weight: 600;
  color: var(--color-accent-strong);
  margin: 0;
}

.char-fullname {
  font-size: var(--font-size-label);
  color: var(--color-text-muted);
  font-style: italic;
}

.char-subtitle {
  font-size: var(--font-size-text);
  color: var(--color-accent);
}

.char-appearance {
  font-size: var(--font-size-small);
  color: var(--color-text-low);
  margin-top: 0.4vh;
  line-height: 1.4;
}

/* ── Sections ── */
.sheet-section {
  border-top: 1px solid var(--color-bg-surface-alt);
  padding-top: 0.8vh;
}

.sheet-row {
  display: flex;
  gap: 1vw;
}

.sheet-section.half {
  flex: 1;
  border-top: 1px solid var(--color-bg-surface-alt);
  padding-top: 0.8vh;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.6vh;
}

/* ── Stat grid ── */
.stat-grid {
  display: flex;
  gap: 0.8vw;
}

.stat-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-panel);
  padding: 0.4vh 0;
}

.stat-label {
  font-size: var(--font-size-xxxs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-score {
  font-size: var(--font-size-large);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}

.stat-mod {
  font-size: var(--font-size-small);
}

.stat-mod.pos {
  color: var(--color-accent);
}
.stat-mod.neg {
  color: var(--color-text-danger);
}

/* ── Pills ── */
.pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4vw;
}

.pill {
  font-size: var(--font-size-caption);
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text-low);
  display: flex;
  align-items: center;
  gap: 4px;
}

.pill.proficient {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.pill-mod {
  color: var(--color-text-muted);
  font-size: var(--font-size-tiny);
}

/* ── Features ── */
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 0.6vw;
  font-size: var(--font-size-label);
}

.feature-name {
  color: var(--color-text);
  flex: 1;
}

.feature-uses {
  font-size: var(--font-size-tiny);
  color: var(--color-accent);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 5px;
}

.feature-recharge {
  font-size: var(--font-size-xxs);
  color: var(--color-text-low);
}

.feature-action {
  font-size: var(--font-size-xxs);
  color: var(--color-text-low);
  text-transform: uppercase;
}

/* ── Flavor text ── */
.flavor-text {
  font-size: var(--font-size-label);
  color: var(--color-text-low);
  line-height: 1.5;
  margin: 0;
  font-style: italic;
}

.flavor-text.quirk {
  color: var(--color-text-low);
  margin-top: 0.4vh;
}

.flavor-text.quirk {
  color: var(--color-text-low);
  margin-top: 0.4vh;
}
</style>
