<template>
  <div class="character-sheet" v-if="character">
    <!-- Header: portrait + identity -->
    <div class="sheet-header">
      <div
        class="portrait"
        :style="{ backgroundImage: `url(${character.image})` }"
        @click="lightboxOpen = true"
      >
        <span class="class-badge" :title="$dnd.classLabel(character)">
          <ClassIcon :character="character" />
        </span>
      </div>

      <!-- Full-size image lightbox -->
      <teleport to="body">
        <div
          v-if="lightboxOpen"
          class="lightbox-overlay"
          @click="lightboxOpen = false"
        >
          <img :src="character.image" class="lightbox-img" @click.stop />
        </div>
      </teleport>
      <div class="identity">
        <h2 class="char-name">{{ character.name }}</h2>
        <div class="char-fullname">{{ character.full_name }}</div>
        <div class="char-subtitle">
          {{ character.race }} · {{ $dnd.classBreakdownLabel(character) }}
        </div>
        <div class="char-appearance">{{ character.appearance }}</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="sheet-section">
      <div class="section-title">Ability Scores</div>
      <div class="stat-grid">
        <div
          v-for="stat in stats"
          :key="stat.key"
          class="stat-block"
          :class="{ 'stat-block--boosted': stat.tooltip }"
          :title="stat.tooltip"
        >
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-score">{{ stat.score }}</div>
          <div class="stat-mod" :class="stat.mod >= 0 ? 'pos' : 'neg'">
            {{ stat.modStr }}
          </div>
        </div>
      </div>
    </div>

    <!-- Combat stats -->
    <CharacterCombatPanel :character="character" :hide-spells="true" />

    <!-- Saving throws + Skills (3-column layout) -->
    <div class="sheet-section saves-skills-row">
      <div class="saves-col">
        <div class="section-title">Saves</div>
        <div class="save-list">
          <div
            v-for="s in allSaves"
            :key="s.key"
            class="save-row"
            :class="{
              proficient: (character.saving_throws ?? []).includes(s.key),
            }"
          >
            <span
              class="save-dot"
              :class="{
                filled: (character.saving_throws ?? []).includes(s.key),
              }"
            ></span>
            <span class="save-label">{{ s.label }}</span>
            <span class="save-mod">{{ saveModStr(s.key) }}</span>
          </div>
        </div>
      </div>
      <div class="skills-col">
        <div class="section-title">Skills</div>
        <div class="skill-grid">
          <div
            v-for="skill in skills"
            :key="skill.name"
            class="skill-row"
            :class="{
              'skill-prof': skill.isProficient,
              'skill-expert': skill.hasExpertise,
            }"
            :title="skill.tooltip"
          >
            <span class="skill-dots">
              <span
                class="skill-dot"
                :class="{ filled: skill.isProficient || skill.hasExpertise }"
              ></span>
              <span
                class="skill-dot"
                :class="{ filled: skill.hasExpertise }"
              ></span>
            </span>
            <span class="skill-name">{{ skill.displayName }}</span>
            <span class="skill-stat">{{ skill.statLabel }}</span>
            <span class="skill-mod" :class="skill.value >= 0 ? 'pos' : 'neg'">{{
              skill.valueStr
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Languages -->
    <div class="sheet-section">
      <div class="section-title">Languages</div>
      <div class="pill-list">
        <span
          v-for="lang in character.languages ?? []"
          :key="lang"
          class="pill"
          >{{ lang }}</span
        >
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
import ClassIcon from '@/components/ClassIcon.vue'

const SAVE_KEYS = STAT_KEYS

export default {
  name: 'CharacterSheet',

  components: { CharacterCombatPanel, ClassIcon },

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return { lightboxOpen: false }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },

    stats() {
      return dnd.statArray(this.character, this.partyItems)
    },

    allSaves() {
      return SAVE_KEYS
    },

    skills() {
      const { stats, bonuses } = dnd.resolveStats(
        this.character,
        this.partyItems
      )
      const prof = dnd._prof(this.character, bonuses)
      const proficiencies = this.character.skill_proficiencies ?? []
      const expertises = this.character.skill_expertise ?? []

      return Object.entries(dnd.SKILL_MAP).map(([skillName, statKey]) => {
        const base = dnd.mod(stats[statKey])
        const isProficient = proficiencies.includes(skillName)
        const hasExpertise = expertises.includes(skillName)
        const itemBonus = bonuses[`skill_${skillName}`] ?? 0
        const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0
        const total = base + profBonus + itemBonus

        const displayName = skillName.replace(/([A-Z])/g, ' $1').trim()
        const statLabel = statKey.toUpperCase()

        const lines = [
          `${displayName} (${statLabel})`,
          `${statLabel} ${dnd.signed(base)}`,
        ]
        if (hasExpertise)
          lines.push(`Expertise ${dnd.signed(prof * 2)} (Prof ×2)`)
        else if (isProficient) lines.push(`Prof ${dnd.signed(prof)}`)
        if (itemBonus) lines.push(`Items ${dnd.signed(itemBonus)}`)
        lines.push(`= ${dnd.signed(total)}`)

        return {
          name: skillName,
          displayName,
          statKey,
          statLabel,
          value: total,
          valueStr: dnd.signed(total),
          isProficient,
          hasExpertise,
          tooltip: lines.join('\n'),
        }
      })
    },
  },

  methods: {
    saveModStr(key) {
      return dnd.signed(dnd.savingThrow(this.character, key, this.partyItems))
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
  position: relative;
  width: 10vw;
  min-width: 100px;
  aspect-ratio: 13 / 16;
  background-size: cover;
  background-position: 50% 0%;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  flex-shrink: 0;
}

.class-badge {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  backdrop-filter: blur(2px);
}

.class-badge .class-icon {
  width: 1rem;
  height: 1rem;
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.char-name {
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--color-accent-strong);
  margin: 0;
}

.char-fullname {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  font-style: italic;
}

.char-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-accent);
}

.char-appearance {
  font-size: var(--font-size-md);
  color: var(--color-text-low);
  margin-top: 0.4vh;
  line-height: 1.4;
}

/* ── Sections ── */
.sheet-section {
  border-top: 1px solid var(--color-bg-surface-alt);
  padding-top: 0.8vh;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
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
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-score {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}
.stat-block--boosted .stat-score {
  color: var(--color-accent);
}

.stat-mod {
  font-size: var(--font-size-md);
}

.stat-mod.pos {
  color: var(--color-accent);
}
.stat-mod.neg {
  color: var(--color-text-danger);
}

/* ── Pills (languages etc.) ── */
.pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4vw;
}

.pill {
  font-size: var(--font-size-base);
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
  font-size: var(--font-size-base);
}

/* ── Saves + Skills 3-column layout ── */
.saves-skills-row {
  display: flex;
  gap: 1.5vw;
  align-items: flex-start;
}

.saves-col {
  flex-shrink: 0;
  min-width: 7rem;
}

.skills-col {
  flex: 1;
  min-width: 0;
}

.save-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 1px 0;
}

.save-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: transparent;
  flex-shrink: 0;
  transition: background 0.1s, border-color 0.1s;
}

.save-dot.filled {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.save-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  flex: 1;
}

.save-row.proficient .save-label {
  color: var(--color-accent);
}

.save-mod {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 2rem;
  text-align: right;
}

.save-row.proficient .save-mod {
  color: var(--color-accent);
}

/* ── Skills ── */
.skill-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1.5vw;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 1px 0;
  cursor: default;
}

.skill-dots {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.skill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: transparent;
  transition: background 0.1s, border-color 0.1s;
}

.skill-dot.filled {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.skill-row.skill-expert .skill-dot.filled {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.skill-name {
  flex: 1;
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  text-decoration-color: var(--color-border);
}

.skill-row.skill-prof .skill-name {
  color: var(--color-accent);
  text-decoration-color: var(--color-accent);
}

.skill-row.skill-expert .skill-name {
  color: var(--color-accent-strong);
  text-decoration-color: var(--color-accent-strong);
}

.skill-stat {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  min-width: 2rem;
  text-align: right;
}

.skill-mod {
  font-size: var(--font-size-base);
  font-weight: 600;
  min-width: 2.5rem;
  text-align: right;
  flex-shrink: 0;
}

.skill-mod.pos {
  color: var(--color-text-muted);
}
.skill-mod.neg {
  color: var(--color-text-danger);
}

.skill-row.skill-prof .skill-mod {
  color: var(--color-accent);
}
.skill-row.skill-expert .skill-mod {
  color: var(--color-accent-strong);
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
  font-size: var(--font-size-md);
}

.feature-name {
  color: var(--color-text);
  flex: 1;
}

/* ── Flavor text ── */
.flavor-text {
  font-size: var(--font-size-md);
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

.portrait {
  cursor: pointer;
}
</style>

<style>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.8);
}
</style>
